/**
 * Image Ratio Calculator
 * Calculates optimal image dimensions and ratios for KDP printing
 * based on book format, page template, and bleed requirements
 */

// KDP standard formats (width x height in inches)
const KDP_FORMATS = {
  '8.5x11': { width: 8.5, height: 11, name: '8.5" x 11" (Letter)' },
  '8x10': { width: 8, height: 10, name: '8" x 10"' },
  '8.5x8.5': { width: 8.5, height: 8.5, name: '8.5" x 8.5" (Square)' },
  '8x8': { width: 8, height: 8, name: '8" x 8" (Square)' },
  '7x10': { width: 7, height: 10, name: '7" x 10"' },
  '6x9': { width: 6, height: 9, name: '6" x 9"' },
  '5.5x8.5': { width: 5.5, height: 8.5, name: '5.5" x 8.5"' },
  '5x8': { width: 5, height: 8, name: '5" x 8"' }
};

// KDP bleed requirement (0.125 inches on all sides)
const BLEED_INCHES = 0.125;

// Minimum DPI for print quality
const MIN_PRINT_DPI = 300;
const RECOMMENDED_DPI = 600;

const MM_PER_INCH = 25.4;

const toCanonicalFormat = (bookFormat) => {
  if (bookFormat && typeof bookFormat === 'object') {
    const unit = String(bookFormat.unit || 'inches').toLowerCase() === 'mm' ? 'mm' : 'inches';
    const width = Number(bookFormat.width);
    const height = Number(bookFormat.height);

    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      return {
        width: unit === 'mm' ? width / MM_PER_INCH : width,
        height: unit === 'mm' ? height / MM_PER_INCH : height
      };
    }
  }

  return KDP_FORMATS[bookFormat];
};

/**
 * Calculate image dimensions for a page template
 * @param {Object} params - Calculation parameters
 * @param {string} params.bookFormat - Book format (e.g., '8x10')
 * @param {string} params.pageTemplate - Page template type
 * @param {boolean} params.includeBleed - Whether to include bleed area
 * @param {number} params.dpi - Target DPI (default: 300)
 * @returns {Object} Image dimensions and metadata
 */
export function calculateImageDimensions({
  bookFormat = '8x10',
  pageTemplate = 'full_illustration',
  includeBleed = true,
  dpi = MIN_PRINT_DPI
}) {
  const format = toCanonicalFormat(bookFormat);
  
  if (!format || !Number.isFinite(format.width) || !Number.isFinite(format.height)) {
    throw new Error(`Unknown book format: ${bookFormat}`);
  }

  let imageWidth = format.width;
  let imageHeight = format.height;

  // Add bleed if required
  if (includeBleed) {
    imageWidth += (BLEED_INCHES * 2);
    imageHeight += (BLEED_INCHES * 2);
  }

  // Adjust dimensions based on page template (support both English and French names)
  switch (pageTemplate) {
    case 'full_illustration':
    case 'illustration-pleine':
      // Full page - use complete dimensions
      break;

    case 'short_text':
    case 'texte-court':
      // Mostly text, small illustration area (30% of page)
      imageHeight = imageHeight * 0.3;
      break;

    case 'mixed':
    case 'mixte':
      // Half illustration, half text
      imageHeight = imageHeight * 0.5;
      break;

    case 'double_page':
    case 'double-page':
      // Double page spread
      imageWidth = imageWidth * 2;
      break;

    default:
      console.warn(`Unknown page template: ${pageTemplate}, using full page`);
  }

  // Calculate pixel dimensions at target DPI
  const widthPx = Math.round(imageWidth * dpi);
  const heightPx = Math.round(imageHeight * dpi);

  // Calculate aspect ratio
  const aspectRatio = widthPx / heightPx;

  // Determine closest DALL-E 3 size
  const dalleSize = getDallESize(widthPx, heightPx);

  return {
    inches: {
      width: imageWidth,
      height: imageHeight,
      withBleed: includeBleed
    },
    pixels: {
      width: widthPx,
      height: heightPx,
      dpi: dpi
    },
    aspectRatio: aspectRatio.toFixed(3),
    dalleSize: dalleSize,
    printQuality: assessPrintQuality(widthPx, heightPx, imageWidth, imageHeight)
  };
}

/**
 * Get the closest DALL-E 3 size for given dimensions
 * DALL-E 3 supports: 1024x1024, 1024x1792, 1792x1024
 * @param {number} widthPx - Target width in pixels
 * @param {number} heightPx - Target height in pixels
 * @returns {string} DALL-E size string
 */
function getDallESize(widthPx, heightPx) {
  const ratio = widthPx / heightPx;

  if (ratio > 1.3) {
    // Landscape
    return '1792x1024';
  } else if (ratio < 0.77) {
    // Portrait
    return '1024x1792';
  } else {
    // Square-ish
    return '1024x1024';
  }
}

/**
 * Assess print quality of image dimensions
 * @param {number} widthPx - Image width in pixels
 * @param {number} heightPx - Image height in pixels
 * @param {number} widthIn - Physical width in inches
 * @param {number} heightIn - Physical height in inches
 * @returns {Object} Quality assessment
 */
function assessPrintQuality(widthPx, heightPx, widthIn, heightIn) {
  const actualDpiWidth = widthPx / widthIn;
  const actualDpiHeight = heightPx / heightIn;
  const actualDpi = Math.min(actualDpiWidth, actualDpiHeight);

  let quality = 'excellent';
  let warning = null;

  if (actualDpi < MIN_PRINT_DPI) {
    quality = 'poor';
    warning = `Résolution trop faible pour l'impression (${Math.round(actualDpi)} DPI). Minimum requis: ${MIN_PRINT_DPI} DPI.`;
  } else if (actualDpi < RECOMMENDED_DPI) {
    quality = 'acceptable';
    warning = `Résolution acceptable mais non optimale (${Math.round(actualDpi)} DPI). Recommandé: ${RECOMMENDED_DPI} DPI.`;
  }

  return {
    quality,
    actualDpi: Math.round(actualDpi),
    warning
  };
}

/**
 * Get recommended DALL-E parameters for a page
 * @param {Object} page - Page object with template and format info
 * @param {string} bookFormat - Book format
 * @returns {Object} DALL-E generation parameters
 */
export function getRecommendedDalleParams(page, bookFormat) {
  const dimensions = calculateImageDimensions({
    bookFormat: bookFormat,
    pageTemplate: page.template || 'full_illustration',
    includeBleed: true,
    dpi: MIN_PRINT_DPI
  });

  return {
    size: dimensions.dalleSize,
    quality: 'standard', // or 'hd' for higher quality
    dimensions: dimensions,
    calculatedDPI: dimensions.printQuality.actualDpi,
    printWarning: dimensions.printQuality.warning
  };
}

/**
 * Validate if an image meets print requirements
 * @param {Object} image - Image object with width/height
 * @param {string} bookFormat - Book format
 * @param {string} pageTemplate - Page template
 * @returns {Object} Validation result
 */
export function validateImageForPrint(image, bookFormat, pageTemplate) {
  const required = calculateImageDimensions({
    bookFormat,
    pageTemplate,
    includeBleed: true,
    dpi: MIN_PRINT_DPI
  });

  const issues = [];

  if (image.width < required.pixels.width) {
    issues.push(`Largeur insuffisante: ${image.width}px (requis: ${required.pixels.width}px)`);
  }

  if (image.height < required.pixels.height) {
    issues.push(`Hauteur insuffisante: ${image.height}px (requis: ${required.pixels.height}px)`);
  }

  const imageRatio = image.width / image.height;
  const requiredRatio = parseFloat(required.aspectRatio);
  const ratioDiff = Math.abs(imageRatio - requiredRatio);

  if (ratioDiff > 0.1) {
    issues.push(`Ratio incorrect: ${imageRatio.toFixed(2)} (requis: ${requiredRatio})`);
  }

  return {
    isValid: issues.length === 0,
    issues,
    required
  };
}

/**
 * Get all available KDP formats
 * @returns {Array} List of format objects
 */
export function getAvailableFormats() {
  return Object.entries(KDP_FORMATS).map(([key, value]) => ({
    id: key,
    ...value
  }));
}

/**
 * Calculate total pages needed for printing (must be multiple of 2)
 * @param {number} contentPages - Number of content pages
 * @returns {number} Total pages for printing
 */
export function calculatePrintPages(contentPages) {
  // KDP requires even number of pages
  return contentPages % 2 === 0 ? contentPages : contentPages + 1;
}
