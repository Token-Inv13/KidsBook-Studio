const TEMP_DALLE_URL_REGEX = /^https?:\/\/oaidalleapiprodscus\.blob\.core\.windows\.net\/private\//i;
const SAFE_FILE_URL_PREFIX = 'safe-file://';

export const isTemporaryDalleUrl = (url) => {
  return typeof url === 'string' && TEMP_DALLE_URL_REGEX.test(url);
};

export const toFileUrl = (localPath) => {
  if (!localPath || typeof localPath !== 'string') {
    return null;
  }

  if (localPath.startsWith('file://')) {
    const normalized = localPath.replace(/\\/g, '/');
    if (/^file:\/\/[A-Za-z]:\//.test(normalized)) {
      return normalized.replace('file://', 'file:///');
    }
    return normalized;
  }

  const normalizedPath = localPath.replace(/\\/g, '/');
  if (/^[A-Za-z]:\//.test(normalizedPath)) {
    return `file:///${normalizedPath}`;
  }

  return `file://${normalizedPath}`;
};

export const toSafeFileUrl = (value) => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  if (value.startsWith(SAFE_FILE_URL_PREFIX) || value.startsWith('data:') || value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }

  const localPath = value.startsWith('file://')
    ? decodeURIComponent(value.replace(/^file:\/+/, '')).replace(/^\/([A-Za-z]:\/)/, '$1')
    : value;

  const normalizedPath = localPath.replace(/\\/g, '/');
  if (/^[A-Za-z]:\//.test(normalizedPath)) {
    return `${SAFE_FILE_URL_PREFIX}/${encodeURI(normalizedPath)}`;
  }

  return `${SAFE_FILE_URL_PREFIX}${encodeURI(normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`)}`;
};

export const isRenderableImageUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return false;
  }

  if (url.startsWith(SAFE_FILE_URL_PREFIX) || url.startsWith('data:')) {
    return true;
  }

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return !isTemporaryDalleUrl(url);
  }

  return false;
};

const toDataUrl = (base64, mimeType = 'image/png') => {
  if (typeof base64 !== 'string' || !base64.trim()) {
    return null;
  }

  const cleaned = base64.trim().replace(/^data:[^;]+;base64,/, '');
  return `data:${mimeType || 'image/png'};base64,${cleaned}`;
};

export const resolvePageImageUrl = (page) => {
  if (!page) {
    return null;
  }

  const candidates = [
    toSafeFileUrl(page.imageLocalPath),
    toSafeFileUrl(page.illustration?.localPath),
    toSafeFileUrl(page.imageUrl),
    toSafeFileUrl(page.illustration?.url)
  ];

  return candidates.find((url) => isRenderableImageUrl(url)) || null;
};

export const resolveCharacterReferenceImageUrl = (mainCharacter) => {
  if (!mainCharacter) {
    return null;
  }

  const candidates = [
    toSafeFileUrl(mainCharacter.referenceImagePath),
    toDataUrl(mainCharacter.referenceImageBase64, mainCharacter.referenceImageMimeType),
    toSafeFileUrl(mainCharacter.referenceImage)
  ];

  return candidates.find((url) => isRenderableImageUrl(url)) || null;
};
