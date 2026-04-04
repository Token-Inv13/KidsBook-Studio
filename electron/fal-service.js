const express = require('express');
const path = require('path');
const JSZip = require('jszip');
const FileCtor = globalThis.File || require('buffer').File;
const { getSecret } = require('./credential-store');

const DEFAULT_IMAGE_SIZE = '1024x1024';
const TRAINING_MODEL = 'fal-ai/flux-lora-fast-training';
const INFERENCE_MODEL = 'fal-ai/flux-lora';
const REQUEST_TIMEOUT_MS = 240_000;
const FAL_LOG_PREFIX = '[Fal Service]';

let server;
let falApiKey;
let falClientPromise = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withTimeout = async (promise, timeoutMs, label) => {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const error = new Error(`${label} timed out after ${timeoutMs}ms`);
      error.code = 'ETIMEDOUT';
      reject(error);
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
};

const toCleanString = (value) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '');

const getFalClient = async () => {
  if (!falClientPromise) {
    falClientPromise = import('@fal-ai/client').then((module) => module.fal || module.default?.fal || module.default || module);
  }

  const fal = await falClientPromise;
  if (!fal || typeof fal.config !== 'function') {
    throw new Error('Unable to load fal client');
  }

  if (falApiKey) {
    fal.config({
      credentials: falApiKey
    });
  }

  return fal;
};

async function initializeFal() {
  falApiKey = await getSecret('fal');
  return Boolean(falApiKey);
}

const readBinaryImage = async (input) => {
  if (!input) {
    return null;
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) {
      return null;
    }

    if (/^https?:\/\//i.test(trimmed)) {
      const response = await fetch(trimmed);
      if (!response.ok) {
        throw new Error(`Unable to fetch remote image (${response.status})`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const contentType = response.headers.get('content-type') || 'image/png';
      return {
        bytes: Buffer.from(arrayBuffer),
        mimeType: contentType,
        filename: path.basename(new URL(trimmed).pathname) || 'reference.png'
      };
    }

    const filePath = path.resolve(trimmed);
    const fileBuffer = await require('fs').promises.readFile(filePath);
    return {
      bytes: fileBuffer,
      mimeType: 'image/png',
      filename: path.basename(filePath) || 'reference.png'
    };
  }

  if (typeof input === 'object') {
    if (typeof input.path === 'string' && input.path.trim()) {
      const filePath = path.resolve(input.path.trim());
      const fileBuffer = await require('fs').promises.readFile(filePath);
      return {
        bytes: fileBuffer,
        mimeType: input.mimeType || 'image/png',
        filename: input.filename || path.basename(filePath) || 'reference.png'
      };
    }

    if (typeof input.url === 'string' && input.url.trim()) {
      return readBinaryImage(input.url.trim());
    }

    if (typeof input.base64 === 'string' && input.base64.trim()) {
      const cleanBase64 = input.base64.replace(/^data:[^;]+;base64,/, '');
      return {
        bytes: Buffer.from(cleanBase64, 'base64'),
        mimeType: input.mimeType || 'image/png',
        filename: input.filename || 'reference.png'
      };
    }
  }

  return null;
};

const normalizeReferenceImages = (images = []) => {
  if (!Array.isArray(images)) {
    return [];
  }

  return images
    .map((entry) => ({
      url: toCleanString(entry?.url),
      path: toCleanString(entry?.path),
      base64: toCleanString(entry?.base64),
      mimeType: toCleanString(entry?.mimeType) || 'image/png',
      filename: toCleanString(entry?.filename) || null
    }))
    .filter((entry) => entry.url || entry.path || entry.base64);
};

const buildTrainingArchive = async ({ referenceImages, triggerWord }) => {
  const zip = new JSZip();
  const normalizedReferences = normalizeReferenceImages(referenceImages);

  for (let index = 0; index < normalizedReferences.length; index += 1) {
    const entry = normalizedReferences[index];
    const binary = await readBinaryImage(entry);
    if (!binary) {
      continue;
    }

    const extension = binary.mimeType && binary.mimeType.includes('jpeg') ? 'jpg' : 'png';
    const filename = entry.filename || `reference-${index + 1}.${extension}`;
    zip.file(filename, binary.bytes);

    if (triggerWord) {
      const captionName = filename.replace(/\.[^.]+$/, '.txt');
      zip.file(captionName, triggerWord);
    }
  }

  const archiveBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  const archiveFile = new FileCtor([archiveBuffer], 'training-dataset.zip', {
    type: 'application/zip'
  });

  return archiveFile;
};

const buildImageSize = (size = DEFAULT_IMAGE_SIZE) => {
  if (typeof size !== 'string') {
    return { width: 1024, height: 1024 };
  }

  const trimmed = size.trim();
  if (!/^\d+x\d+$/i.test(trimmed)) {
    return { width: 1024, height: 1024 };
  }

  const [width, height] = trimmed.split('x').map((value) => Number(value));
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return { width: 1024, height: 1024 };
  }

  return {
    width: Math.min(2048, Math.max(512, width)),
    height: Math.min(2048, Math.max(512, height))
  };
};

const normalizeFalImageResponse = (payload, requestId, prompt) => {
  const images = Array.isArray(payload?.images)
    ? payload.images
    : (Array.isArray(payload?.data) ? payload.data : []);

  const normalizedImages = images
    .map((entry) => ({
      url: entry?.url || null,
      revised_prompt: entry?.revised_prompt || entry?.prompt || prompt || '',
      requestId,
      seed: entry?.seed || null,
      width: entry?.width || null,
      height: entry?.height || null
    }))
    .filter((entry) => entry.url);

  return {
    success: true,
    requestId,
    url: normalizedImages[0]?.url || payload?.url || null,
    revised_prompt: normalizedImages[0]?.revised_prompt || prompt || '',
    images: normalizedImages
  };
};

const normalizeTrainingResponse = (payload, requestId, triggerWord) => {
  return {
    success: true,
    requestId,
    triggerWord,
    status: payload?.status || 'completed',
    artifacts: {
      modelUrl: payload?.diffusers_lora_file?.url || payload?.lora_file?.url || payload?.lora?.url || null,
      configUrl: payload?.config_file?.url || payload?.config?.url || null,
      previewUrl: payload?.preview_image?.url || payload?.preview?.url || null,
      raw: payload
    }
  };
};

async function startFalService() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', hasApiKey: Boolean(falApiKey) });
  });

  app.post('/api/reinitialize', async (req, res) => {
    try {
      const hasKey = await initializeFal();
      res.json({ success: true, hasApiKey: hasKey });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/train-lora', async (req, res) => {
    const requestId = `fal-train-${Date.now()}`;

    try {
      if (!falApiKey) {
        await initializeFal();
      }

      if (!falApiKey) {
        return res.status(401).json({
          success: false,
          error: 'fal.ai API key not configured'
        });
      }

      const {
        referenceImages = [],
        triggerWord = '',
        steps = 1000,
        isStyle = false
      } = req.body || {};

      const normalizedTriggerWord = toCleanString(triggerWord) || `kidsbook_${String(Date.now()).slice(-6)}`;
      const archiveFile = await buildTrainingArchive({
        referenceImages,
        triggerWord: normalizedTriggerWord
      });

      const fal = await getFalClient();
      const uploadedArchiveResult = await fal.storage.upload(archiveFile);
      const uploadedArchiveUrl = typeof uploadedArchiveResult === 'string'
        ? uploadedArchiveResult
        : uploadedArchiveResult?.url || uploadedArchiveResult?.data?.url || null;

      if (!uploadedArchiveUrl) {
        throw new Error('Unable to upload training archive to fal storage');
      }
      console.info(`${FAL_LOG_PREFIX} [${requestId}] submitted training job`, {
        triggerWord: normalizedTriggerWord,
        steps,
        isStyle,
        referenceCount: normalizeReferenceImages(referenceImages).length
      });

      const result = await withTimeout(
        fal.subscribe(TRAINING_MODEL, {
          input: {
            images_data_url: uploadedArchiveUrl,
            trigger_word: normalizedTriggerWord,
            steps: Number.isFinite(Number(steps)) ? Number(steps) : 1000,
            is_style: Boolean(isStyle),
            create_masks: true
          },
          logs: true
        }),
        REQUEST_TIMEOUT_MS,
        'fal training request'
      );

      const payload = result?.data || result || {};
      res.json(normalizeTrainingResponse(payload, requestId, normalizedTriggerWord));
    } catch (error) {
      console.error(`${FAL_LOG_PREFIX} [${requestId}] training error`, error);
      res.status(Number(error?.statusCode) || Number(error?.status) || 500).json({
        success: false,
        error: error?.message || 'Internal server error',
        requestId
      });
    }
  });

  app.post('/api/generate-image', async (req, res) => {
    const requestId = `fal-gen-${Date.now()}`;

    try {
      if (!falApiKey) {
        await initializeFal();
      }

      if (!falApiKey) {
        return res.status(401).json({
          success: false,
          error: 'fal.ai API key not configured'
        });
      }

      const {
        prompt,
        size = DEFAULT_IMAGE_SIZE,
        loras = [],
        numImages = 1,
        negativePrompt = null,
        seed = null,
        guidanceScale = 3.5,
        steps = 28
      } = req.body || {};

      if (!prompt) {
        return res.status(400).json({
          success: false,
          error: 'Prompt is required'
        });
      }

      const fal = await getFalClient();
      const payload = await withTimeout(
        fal.subscribe(INFERENCE_MODEL, {
          input: {
            prompt,
            image_size: buildImageSize(size),
            loras: Array.isArray(loras) ? loras : [],
            num_images: Number(numImages) > 0 ? Number(numImages) : 1,
            negative_prompt: negativePrompt,
            seed: seed === null || seed === undefined || seed === '' ? undefined : Number(seed),
            guidance_scale: Number(guidanceScale) || 3.5,
            num_inference_steps: Number(steps) || 28
          },
          logs: true
        }),
        REQUEST_TIMEOUT_MS,
        'fal image request'
      );

      const normalized = normalizeFalImageResponse(payload?.data || payload || {}, requestId, prompt);
      res.json(normalized);
    } catch (error) {
      console.error(`${FAL_LOG_PREFIX} [${requestId}] image generation error`, error);
      res.status(Number(error?.statusCode) || Number(error?.status) || 500).json({
        success: false,
        error: error?.message || 'Internal server error',
        requestId
      });
    }
  });

  return new Promise((resolve, reject) => {
    server = app.listen(3003, '127.0.0.1', async () => {
      try {
        await initializeFal();
        const port = server.address().port;
        resolve(port);
      } catch (error) {
        reject(error);
      }
    });

    server.on('error', reject);
  });
}

async function stopFalService() {
  if (!server) {
    return;
  }

  await new Promise((resolve) => {
    server.close(() => resolve());
  });

  server = null;
}

module.exports = {
  startFalService,
  stopFalService
};
