import { v4 as uuidv4 } from 'uuid';

const MM_TO_PX = 3.7795275591;

const DEFAULT_TEXT_COLOR_DARK = '#111827';
const DEFAULT_TEXT_COLOR_LIGHT = '#ffffff';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const getTypographyBounds = (format) => {
  const { width } = getFormatDimensions(format);
  if (width >= 950) {
    return { minFontSize: 14, maxFontSize: 30, minLineHeight: 1.2, maxLineHeight: 1.55 };
  }
  if (width >= 800) {
    return { minFontSize: 13, maxFontSize: 28, minLineHeight: 1.2, maxLineHeight: 1.5 };
  }
  return { minFontSize: 12, maxFontSize: 24, minLineHeight: 1.18, maxLineHeight: 1.45 };
};

export const normalizeTextBlock = (block = {}) => ({
  ...block,
  layoutMode: block.layoutMode || 'auto',
  colorMode: block.colorMode || 'auto',
  backdropMode: block.backdropMode || 'auto',
  textEffect: block.textEffect || 'shadow',
  lineHeight: typeof block.lineHeight === 'number' ? block.lineHeight : 1.35,
  color: block.color || DEFAULT_TEXT_COLOR_DARK,
  textAlign: block.textAlign || 'left'
});

const getContrastRatio = (textLuminance, backgroundLuminance) => {
  const lighter = Math.max(textLuminance, backgroundLuminance);
  const darker = Math.min(textLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
};

export const getReadableTextStyle = (block, luminance, hasImage) => {
  const normalized = normalizeTextBlock(block);
  const hasKnownLuminance = typeof luminance === 'number';
  const backgroundLuminance = hasKnownLuminance ? clamp(luminance, 0, 1) : 0.5;

  let color = normalized.color;
  if (normalized.colorMode === 'auto') {
    color = backgroundLuminance > 0.58 ? DEFAULT_TEXT_COLOR_DARK : DEFAULT_TEXT_COLOR_LIGHT;
  }

  const textLuminance = color === DEFAULT_TEXT_COLOR_LIGHT ? 1 : 0.05;
  const contrastRatio = getContrastRatio(textLuminance, backgroundLuminance);

  const forceBackdrop = normalized.backdropMode === 'on';
  const disableBackdrop = normalized.backdropMode === 'off';
  const shouldUseBackdrop = disableBackdrop
    ? false
    : (forceBackdrop || (hasImage && (contrastRatio < 3.8 || (backgroundLuminance > 0.36 && backgroundLuminance < 0.72))));

  const effectMode = normalized.textEffect;
  const useShadow = effectMode === 'shadow' || (effectMode === 'auto' && hasImage);
  const useOutline = effectMode === 'outline';

  const baseBackground = color === DEFAULT_TEXT_COLOR_LIGHT
    ? 'rgba(17,24,39,0.34)'
    : 'rgba(255,255,255,0.58)';

  return {
    color,
    backgroundColor: shouldUseBackdrop ? baseBackground : 'transparent',
    padding: shouldUseBackdrop ? '10px 12px' : '4px',
    borderRadius: shouldUseBackdrop ? 10 : 6,
    textShadow: useShadow
      ? (color === DEFAULT_TEXT_COLOR_LIGHT ? '0 2px 8px rgba(0,0,0,0.6)' : '0 1px 4px rgba(255,255,255,0.35)')
      : 'none',
    WebkitTextStroke: useOutline
      ? (color === DEFAULT_TEXT_COLOR_LIGHT ? '0.7px rgba(0,0,0,0.75)' : '0.7px rgba(255,255,255,0.72)')
      : undefined,
    contrastRatio
  };
};

export const getFormatDimensions = (format) => {
  const width = format?.unit === 'mm'
    ? (format?.width || 216) * MM_TO_PX
    : (format?.width || 8.5) * 96;

  const height = format?.unit === 'mm'
    ? (format?.height || 216) * MM_TO_PX
    : (format?.height || 8.5) * 96;

  return {
    width,
    height,
    bleed: format?.bleed ? 12 : 0,
    safeArea: 24
  };
};

const fitContentWithoutOverflow = (content, width, height, fontSize, lineHeight) => {
  let candidate = (content || '').trim();
  let metrics = estimateOverflow(candidate, width, height, fontSize, lineHeight);

  if (!metrics.overflow) {
    return { content: candidate, metrics, wasTruncated: false };
  }

  while (candidate.length > 0 && metrics.overflow) {
    candidate = `${candidate.slice(0, -2).trimEnd()}…`;
    metrics = estimateOverflow(candidate, width, height, fontSize, lineHeight);
  }

  return {
    content: candidate,
    metrics,
    wasTruncated: true
  };
};

export const getPagePositionFromNumber = (pageNumber) => (pageNumber % 2 === 0 ? 'left' : 'right');

export const getTemplateZones = (template, format) => {
  const { width, height, bleed, safeArea } = getFormatDimensions(format);
  const margin = bleed + safeArea;
  const usableWidth = width - margin * 2;
  const usableHeight = height - margin * 2;

  const zone = {
    textZones: [],
    imageZones: []
  };

  switch (template) {
    case 'illustration-pleine': {
      const textHeight = Math.max(100, usableHeight * 0.22);
      zone.imageZones.push({
        id: uuidv4(),
        x: bleed,
        y: bleed,
        width: width - bleed * 2,
        height: height - bleed * 2 - textHeight
      });
      zone.textZones.push({
        id: uuidv4(),
        x: margin,
        y: height - bleed - textHeight,
        width: usableWidth,
        height: textHeight - safeArea
      });
      break;
    }
    case 'texte-court':
      zone.textZones.push({
        id: uuidv4(),
        x: margin + usableWidth * 0.1,
        y: margin + usableHeight * 0.3,
        width: usableWidth * 0.8,
        height: usableHeight * 0.4
      });
      break;
    case 'mixte': {
      const imageHeight = usableHeight * 0.62;
      zone.imageZones.push({
        id: uuidv4(),
        x: margin,
        y: margin,
        width: usableWidth,
        height: imageHeight
      });
      zone.textZones.push({
        id: uuidv4(),
        x: margin,
        y: margin + imageHeight + safeArea * 0.5,
        width: usableWidth,
        height: usableHeight - imageHeight - safeArea * 0.5
      });
      break;
    }
    case 'double-page':
      zone.imageZones.push({
        id: uuidv4(),
        x: bleed,
        y: bleed,
        width: width - bleed * 2,
        height: height - bleed * 2
      });
      zone.textZones.push({
        id: uuidv4(),
        x: margin,
        y: margin,
        width: usableWidth * 0.55,
        height: Math.max(110, usableHeight * 0.28)
      });
      break;
    default:
      zone.textZones.push({
        id: uuidv4(),
        x: margin,
        y: margin + usableHeight * 0.5,
        width: usableWidth,
        height: Math.max(110, usableHeight * 0.28)
      });
      break;
  }

  return zone;
};

const estimateOverflow = (content, width, height, fontSize, lineHeight = 1.3) => {
  const normalized = (content || '').trim();
  const charsPerLine = Math.max(8, Math.floor(width / (fontSize * 0.55)));
  const lineCount = normalized.length === 0 ? 1 : Math.ceil(normalized.length / charsPerLine);
  const computedLineHeight = fontSize * lineHeight;
  const estimatedHeight = lineCount * computedLineHeight + 12;

  return {
    overflow: estimatedHeight > height,
    estimatedHeight,
    charsPerLine,
    lineCount
  };
};

export const autoFitTextBlock = (block, zone, options = {}) => {
  const normalized = normalizeTextBlock(block);
  const typographyBounds = getTypographyBounds(options.format);
  const minFontSize = options.minFontSize || typographyBounds.minFontSize;
  const maxFontSize = options.maxFontSize || Math.max(typographyBounds.maxFontSize, normalized.fontSize || typographyBounds.maxFontSize);

  let lineHeight = clamp(normalized.lineHeight, typographyBounds.minLineHeight, typographyBounds.maxLineHeight);

  let fontSize = maxFontSize;
  let metrics = estimateOverflow(normalized.content, zone.width, zone.height, fontSize, lineHeight);

  while (metrics.overflow && fontSize > minFontSize) {
    fontSize -= 1;
    metrics = estimateOverflow(normalized.content, zone.width, zone.height, fontSize, lineHeight);
  }

  while (metrics.overflow && lineHeight > typographyBounds.minLineHeight) {
    lineHeight = clamp(lineHeight - 0.03, typographyBounds.minLineHeight, typographyBounds.maxLineHeight);
    metrics = estimateOverflow(normalized.content, zone.width, zone.height, fontSize, lineHeight);
  }

  const fittedContent = fitContentWithoutOverflow(normalized.content, zone.width, zone.height, fontSize, lineHeight);

  return {
    ...normalized,
    x: zone.x,
    y: zone.y,
    width: zone.width,
    height: zone.height,
    content: fittedContent.content,
    fontSize,
    lineHeight,
    overflowWarning: fittedContent.wasTruncated,
    textWasTruncated: fittedContent.wasTruncated
  };
};

export const autoLayoutPage = (page, format, options = {}) => {
  const preserveManual = options.preserveManual !== false;
  const zones = getTemplateZones(page.template, format);
  const textZones = zones.textZones.length > 0 ? zones.textZones : [{ x: 40, y: 40, width: 500, height: 180 }];

  const textBlocks = (page.textBlocks || []).map((block, index) => {
    const normalizedBlock = normalizeTextBlock(block);
    if (preserveManual && normalizedBlock.layoutMode === 'manual') {
      return {
        ...normalizedBlock,
        overflowWarning: false,
        textWasTruncated: false
      };
    }

    const zone = textZones[Math.min(index, textZones.length - 1)];
    return autoFitTextBlock(normalizedBlock, zone, { ...options, format });
  });

  return {
    ...page,
    imageZones: zones.imageZones,
    pageBackground: page.pageBackground || { color: '#ffffff' },
    spreadBackground: page.spreadBackground || null,
    imageTransform: {
      zoom: typeof page.imageTransform?.zoom === 'number' ? page.imageTransform.zoom : 1,
      offsetX: typeof page.imageTransform?.offsetX === 'number' ? page.imageTransform.offsetX : 0,
      offsetY: typeof page.imageTransform?.offsetY === 'number' ? page.imageTransform.offsetY : 0,
      fitMode: page.imageTransform?.fitMode || 'cover'
    },
    textBlocks
  };
};

export const createPageFromTemplate = (template, pageNumber, format, overrides = {}) => {
  const zones = getTemplateZones(template, format);
  const defaultZone = zones.textZones[0] || { x: 40, y: 40, width: 500, height: 140 };

  const textBlock = {
    id: uuidv4(),
    type: 'text',
    content: 'Votre texte ici...',
    style: 'narration',
    x: defaultZone.x,
    y: defaultZone.y,
    width: defaultZone.width,
    height: defaultZone.height,
    fontSize: template === 'texte-court' ? 24 : 16,
    fontFamily: 'Georgia',
    color: '#2c3e50',
    textAlign: template === 'texte-court' ? 'center' : 'left',
    layoutMode: 'auto',
    colorMode: 'auto',
    backdropMode: 'auto',
    textEffect: 'shadow',
    lineHeight: 1.35
  };

  return {
    id: uuidv4(),
    number: pageNumber,
    position: getPagePositionFromNumber(pageNumber),
    template,
    textBlocks: [normalizeTextBlock(textBlock)],
    imageZones: zones.imageZones,
    pageBackground: { color: '#ffffff' },
    spreadBackground: null,
    imageTransform: {
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
      fitMode: 'cover'
    },
    imageUrl: null,
    createdAt: new Date().toISOString(),
    ...overrides
  };
};

export const getSpreadPages = (pages, selectedPageId) => {
  if (!pages || pages.length === 0) {
    return { leftPage: null, rightPage: null, spreadIndex: 0, spreadCount: 0 };
  }

  const ordered = [...pages].sort((a, b) => a.number - b.number);
  const editorialPages = ordered.filter((p) => p.number >= 2);

  if (editorialPages.length === 0) {
    return { leftPage: null, rightPage: null, spreadIndex: 0, spreadCount: 0 };
  }

  const selected = ordered.find((p) => p.id === selectedPageId) || editorialPages[0];
  const selectedNumber = selected.number < 2 ? 2 : selected.number;
  const spreadIndex = Math.max(0, Math.floor((selectedNumber - 2) / 2));
  const leftNumber = 2 + spreadIndex * 2;
  const rightNumber = leftNumber + 1;

  return {
    spreadIndex,
    spreadCount: Math.ceil(editorialPages.length / 2),
    rightPage: editorialPages.find((p) => p.number === rightNumber) || null,
    leftPage: editorialPages.find((p) => p.number === leftNumber) || null
  };
};

export const getAdjacentSpreadPageId = (pages, selectedPageId, direction) => {
  const { spreadIndex, spreadCount } = getSpreadPages(pages, selectedPageId);
  const nextIndex = direction === 'next' ? spreadIndex + 1 : spreadIndex - 1;

  if (nextIndex < 0 || nextIndex >= spreadCount) {
    return selectedPageId;
  }

  const leftNumber = 2 + nextIndex * 2;
  const rightNumber = leftNumber + 1;
  const ordered = [...(pages || [])]
    .sort((a, b) => a.number - b.number)
    .filter((p) => p.number >= 2);
  const left = ordered.find((p) => p.number === leftNumber);
  const right = ordered.find((p) => p.number === rightNumber);

  return (right || left || ordered[0])?.id || selectedPageId || null;
};
