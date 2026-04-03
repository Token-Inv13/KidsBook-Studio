const express = require('express');
const path = require('path');
const { getSecret } = require('./credential-store');

const BlobCtor = globalThis.Blob || require('buffer').Blob;

const SERVICE_BASE_URL = 'https://api.ideogram.ai';
const IMAGE_TIMEOUT_MS = 120_000;
const IDEOGRAM_GENERATE_ENDPOINT = '/v1/ideogram-v3/generate';
const IDEOGRAM_REMX_ENDPOINT = '/v1/ideogram-v3/remix';

let server;
let ideogramApiKey;

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

async function initializeIdeogram() {
  ideogramApiKey = await getSecret('ideogram');
  return Boolean(ideogramApiKey);
}

const readImageBlobFromInput = async (input) => {
  if (typeof input === 'string' && input.trim()) {
    const trimmed = input.trim();
    if (/^https?:\/\//i.test(trimmed)) {
      return readImageBlobFromInput({ url: trimmed });
    }

    return readImageBlobFromInput({ path: trimmed });
  }

  if (!input || typeof input !== 'object') {
    return null;
  }

  if (typeof input.path === 'string' && input.path.trim()) {
    const filePath = path.resolve(input.path.trim());
    const fileBuffer = await require('fs').promises.readFile(filePath);
    return new BlobCtor([fileBuffer], { type: input.mimeType || 'image/png' });
  }

  if (typeof input.url === 'string' && input.url.trim()) {
    const response = await fetch(input.url.trim());
    if (!response.ok) {
      throw new Error(`Unable to fetch remote image (${response.status})`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || input.mimeType || 'image/png';
    return new BlobCtor([arrayBuffer], { type: contentType });
  }

  if (typeof input.base64 === 'string' && input.base64.trim()) {
    const buffer = Buffer.from(input.base64.replace(/^data:[^;]+;base64,/, ''), 'base64');
    return new BlobCtor([buffer], { type: input.mimeType || 'image/png' });
  }

  return null;
};

const appendOptionalField = (formData, name, value) => {
  if (value === null || value === undefined || value === '') {
    return;
  }

  formData.append(name, String(value));
};

const appendImageFields = async (formData, fieldName, images = []) => {
  for (let index = 0; index < images.length; index += 1) {
    const blob = await readImageBlobFromInput(images[index]);
    if (!blob) {
      continue;
    }

    const fallbackName = `${fieldName}-${index + 1}.png`;
    formData.append(fieldName, blob, images[index]?.filename || fallbackName);
  }
};

const normalizeResponse = (payload, requestId, prompt) => {
  const images = Array.isArray(payload?.data)
    ? payload.data.map((entry, index) => ({
        url: entry?.url || null,
        revised_prompt: entry?.prompt || prompt || '',
        requestId,
        style_type: entry?.style_type || null,
        seed: entry?.seed || null,
        resolution: entry?.resolution || null,
        is_image_safe: entry?.is_image_safe ?? null,
        index
      })).filter((entry) => entry.url)
    : [];

  return {
    success: true,
    requestId,
    url: images[0]?.url || null,
    revised_prompt: images[0]?.revised_prompt || prompt || '',
    images
  };
};

const callIdeogramApi = async ({ endpoint, formData, requestId, prompt }) => {
  const response = await withTimeout(
    fetch(`${SERVICE_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Api-Key': ideogramApiKey
      },
      body: formData
    }),
    IMAGE_TIMEOUT_MS,
    'Ideogram image request'
  );

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload?.message || payload?.error || `Ideogram request failed (${response.status})`);
    error.statusCode = response.status;
    error.errorCode = payload?.code || payload?.error_code || null;
    error.requestId = requestId;
    throw error;
  }

  return normalizeResponse(payload, requestId, prompt);
};

async function startIdeogramService() {
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
    res.json({ status: 'ok', hasApiKey: Boolean(ideogramApiKey) });
  });

  app.post('/api/reinitialize', async (req, res) => {
    try {
      const hasKey = await initializeIdeogram();
      res.json({ success: true, hasApiKey: hasKey });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/generate-image', async (req, res) => {
    const requestId = `ideo-${Date.now()}`;

    try {
      if (!ideogramApiKey) {
        await initializeIdeogram();
      }

      if (!ideogramApiKey) {
        return res.status(401).json({
          success: false,
          error: 'Ideogram API key not configured'
        });
      }

      const {
        prompt,
        mode = 'generate',
        num_images = 1,
        seed = null,
        aspect_ratio = null,
        resolution = null,
        rendering_speed = 'QUALITY',
        magic_prompt = 'AUTO',
        negative_prompt = null,
        style_type = 'GENERAL',
        style_preset = null,
        color_palette = null,
        image_weight = 50,
        character_reference_images = [],
        character_reference_images_mask = [],
        style_reference_images = [],
        image = null
      } = req.body || {};

      if (!prompt) {
        return res.status(400).json({
          success: false,
          error: 'Prompt is required'
        });
      }

      const endpoint = mode === 'remix' ? IDEOGRAM_REMX_ENDPOINT : IDEOGRAM_GENERATE_ENDPOINT;
      const formData = new FormData();

      appendOptionalField(formData, 'prompt', prompt);
      appendOptionalField(formData, 'num_images', num_images);
      appendOptionalField(formData, 'seed', seed);
      appendOptionalField(formData, 'aspect_ratio', aspect_ratio);
      appendOptionalField(formData, 'resolution', resolution);
      appendOptionalField(formData, 'rendering_speed', rendering_speed);
      appendOptionalField(formData, 'magic_prompt', magic_prompt);
      appendOptionalField(formData, 'negative_prompt', negative_prompt);
      appendOptionalField(formData, 'style_type', style_type);
      appendOptionalField(formData, 'style_preset', style_preset);
      appendOptionalField(formData, 'image_weight', image_weight);

      if (color_palette) {
        appendOptionalField(formData, 'color_palette', JSON.stringify(color_palette));
      }

      await appendImageFields(formData, 'character_reference_images', character_reference_images);
      await appendImageFields(formData, 'character_reference_images_mask', character_reference_images_mask);
      await appendImageFields(formData, 'style_reference_images', style_reference_images);

      if (mode === 'remix' && image) {
        const remixBlob = await readImageBlobFromInput(image);
        if (!remixBlob) {
          return res.status(400).json({
            success: false,
            error: 'Remix image is required'
          });
        }
        formData.append('image', remixBlob, image?.filename || 'remix.png');
      }

      const normalizedResponse = await callIdeogramApi({
        endpoint,
        formData,
        requestId,
        prompt
      });

      res.json(normalizedResponse);
    } catch (error) {
      const statusCode = Number(error?.statusCode) || Number(error?.status) || 500;
      res.status(statusCode).json({
        success: false,
        error: error?.message || 'Internal server error',
        errorCode: error?.errorCode || null,
        statusCode,
        requestId
      });
    }
  });

  return new Promise((resolve, reject) => {
    const PORT = 3002;
    server = app.listen(PORT, 'localhost', async () => {
      console.log(`Ideogram service running on http://localhost:${PORT}`);
      await initializeIdeogram();
      resolve(PORT);
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        const altPort = PORT + 1;
        server = app.listen(altPort, 'localhost', async () => {
          console.log(`Ideogram service running on http://localhost:${altPort}`);
          await initializeIdeogram();
          resolve(altPort);
        });
      } else {
        reject(error);
      }
    });
  });
}

async function stopIdeogramService() {
  if (server) {
    return new Promise((resolve) => {
      server.close(() => {
        console.log('Ideogram service stopped');
        resolve();
      });
    });
  }
}

module.exports = { startIdeogramService, stopIdeogramService };
