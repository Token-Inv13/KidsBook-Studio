const TEMP_DALLE_URL_REGEX = /^https?:\/\/oaidalleapiprodscus\.blob\.core\.windows\.net\/private\//i;

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

export const isRenderableImageUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return false;
  }

  if (url.startsWith('file://') || url.startsWith('data:')) {
    return true;
  }

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return !isTemporaryDalleUrl(url);
  }

  return false;
};

export const resolvePageImageUrl = (page) => {
  if (!page) {
    return null;
  }

  const candidates = [
    toFileUrl(page.imageLocalPath),
    toFileUrl(page.illustration?.localPath),
    page.imageUrl,
    page.illustration?.url
  ];

  return candidates.find((url) => isRenderableImageUrl(url)) || null;
};

export const resolveCharacterReferenceImageUrl = (mainCharacter) => {
  if (!mainCharacter) {
    return null;
  }

  const candidates = [
    toFileUrl(mainCharacter.referenceImagePath),
    mainCharacter.referenceImage
  ];

  return candidates.find((url) => isRenderableImageUrl(url)) || null;
};
