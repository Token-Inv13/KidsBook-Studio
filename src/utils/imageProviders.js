const DEFAULT_IMAGE_SIZE = '1024x1024';

const buildReferenceImagePayload = (pack, fallbackImagePath = null) => {
  const referenceImages = Array.isArray(pack?.referenceImages)
    ? pack.referenceImages.filter((entry) => entry && typeof entry === 'object')
    : [];
  const canonicalReference = pack?.canonicalReference || {};

  const payload = referenceImages.length > 0
    ? referenceImages
    : [canonicalReference];

  return payload
    .map((entry) => ({
      url: entry?.url || null,
      path: entry?.path || entry?.referenceImagePath || fallbackImagePath || null,
      base64: entry?.base64 || null,
      mimeType: entry?.mimeType || 'image/png',
      filename: entry?.filename || null
    }))
    .filter((entry) => entry.url || entry.path || entry.base64);
};

const ensureReferenceImages = (referenceImages, label) => {
  if (referenceImages.length === 0) {
    throw new Error(`Ideogram generation requires a ${label} reference`);
  }
};

const createLocalImageProvider = ({
  id,
  label,
  serviceUrl,
  supportsRemix = false,
  buildRequestBody,
  extractResponseImage
}) => {
  const postImageRequest = async (requestBody) => {
    const response = await fetch(`${serviceUrl}/api/generate-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload?.success === false) {
      const error = new Error(payload?.error || `Image generation failed (${response.status})`);
      error.statusCode = payload?.statusCode || response.status;
      error.requestId = payload?.requestId || null;
      throw error;
    }

    return payload;
  };

  return {
    id,
    label,
    supportsRemix,
    async generateCandidate(params) {
      const requestBody = buildRequestBody({
        ...params,
        mode: 'generate'
      });
      const payload = await postImageRequest(requestBody);
      return extractResponseImage(payload, params);
    },
    async remixCandidate(params) {
      if (!supportsRemix) {
        throw new Error(`${label} does not support remix generation`);
      }

      const requestBody = buildRequestBody({
        ...params,
        mode: 'remix'
      });
      const payload = await postImageRequest(requestBody);
      return extractResponseImage(payload, params);
    }
  };
};

export const imageProviderOpenAI = ({ serviceUrl }) => {
  return createLocalImageProvider({
    id: 'openai',
    label: 'OpenAI',
    serviceUrl,
    supportsRemix: false,
    buildRequestBody: ({
      prompt,
      dalleParams,
      strategyMetadata,
      referenceImageId,
      referenceImagePath
    }) => ({
      prompt,
      size: dalleParams?.size || DEFAULT_IMAGE_SIZE,
      quality: 'standard',
      referenceImageId: referenceImageId || 'main-character-reference',
      referenceImagePath: referenceImagePath || null,
      generatorMode: strategyMetadata?.mode || 'text-only'
    }),
    extractResponseImage: (payload) => ({
      url: payload?.url || null,
      revised_prompt: payload?.revised_prompt || '',
      requestId: payload?.requestId || null,
      images: Array.isArray(payload?.images) ? payload.images : payload?.url ? [{ url: payload.url }] : []
    })
  });
};

export const imageProviderIdeogram = ({ serviceUrl }) => {
  return createLocalImageProvider({
    id: 'ideogram',
    label: 'Ideogram',
    serviceUrl,
    supportsRemix: true,
    buildRequestBody: ({
      prompt,
      dalleParams,
      constraintBundle,
      strategyMetadata,
      variantIndex = 0,
      mode = 'generate'
    }) => {
      const characterPack = constraintBundle?.characterPack || constraintBundle?.spec?.characterPack || null;
      const stylePack = constraintBundle?.stylePack || constraintBundle?.spec?.stylePack || null;
      const characterReferenceImages = buildReferenceImagePayload(
        characterPack,
        constraintBundle?.reference?.imagePath || null
      );
      const styleReferenceImages = buildReferenceImagePayload(
        stylePack,
        constraintBundle?.reference?.imagePath || null
      );

      ensureReferenceImages(characterReferenceImages, 'character');
      ensureReferenceImages(styleReferenceImages, 'style');

      return {
        prompt,
        mode,
        resolution: dalleParams?.size || DEFAULT_IMAGE_SIZE,
        rendering_speed: mode === 'remix' ? 'QUALITY' : 'TURBO',
        magic_prompt: 'AUTO',
        negative_prompt: strategyMetadata?.negativePrompt || null,
        style_type: 'AUTO',
        num_images: 1,
        image_weight: mode === 'remix' ? 65 : 50,
        seed: variantIndex + 1,
        character_reference_images: characterReferenceImages,
        style_reference_images: styleReferenceImages,
        image: mode === 'remix'
          ? (constraintBundle?.selectedImage || constraintBundle?.reference?.imagePath || constraintBundle?.reference?.imageUrl || null)
          : null
      };
    },
    extractResponseImage: (payload) => {
      const images = Array.isArray(payload?.images) && payload.images.length > 0
        ? payload.images
        : (Array.isArray(payload?.data) ? payload.data : []);

      const first = images[0] || {};
      return {
        url: first.url || payload?.url || null,
        revised_prompt: first.revised_prompt || first.prompt || payload?.revised_prompt || '',
        requestId: payload?.requestId || null,
        images: images.map((entry) => ({
          url: entry.url || null,
          revised_prompt: entry.revised_prompt || entry.prompt || '',
          requestId: payload?.requestId || null,
          style_type: entry.style_type || null,
          seed: entry.seed || null,
          resolution: entry.resolution || null,
          is_image_safe: entry.is_image_safe ?? null
        })).filter((entry) => entry.url)
      };
    }
  });
};

export const selectPrimaryImageProvider = ({ ideogramServiceUrl, openaiServiceUrl }) => {
  if (typeof ideogramServiceUrl === 'string' && /^https?:\/\//i.test(ideogramServiceUrl)) {
    return 'ideogram';
  }

  if (typeof openaiServiceUrl === 'string' && /^https?:\/\//i.test(openaiServiceUrl)) {
    return 'openai';
  }

  return null;
};

export const fallbackImageProvider = (primaryProviderId) => {
  if (primaryProviderId === 'ideogram') {
    return 'openai';
  }

  return null;
};
