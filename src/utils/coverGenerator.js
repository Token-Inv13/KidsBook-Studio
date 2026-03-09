/**
 * Cover Generator for KDP Print
 * Calculates spine width and generates cover template layout
 */

/**
 * Paper types and their thickness (inches per page)
 * Based on KDP specifications
 */
const PAPER_THICKNESS = {
  white: 0.0025,      // White paper: 0.0025" per page
  cream: 0.00267,     // Cream paper: 0.00267" per page
  standard: 0.0025    // Default to white
};

/**
 * Calculate spine width based on page count and paper type
 * Formula: (page count × paper thickness) + cover thickness
 * 
 * @param {number} pageCount - Total number of interior pages
 * @param {string} paperType - Paper type ('white', 'cream', 'standard')
 * @returns {number} Spine width in inches
 */
export function calculateSpineWidth(pageCount, paperType = 'white') {
  const thickness = PAPER_THICKNESS[paperType] || PAPER_THICKNESS.standard;
  const coverThickness = 0.002; // Cover stock thickness
  
  // Spine width = (pages × thickness) + cover
  const spineWidth = (pageCount * thickness) + coverThickness;
  
  // KDP minimum spine width is 0.06"
  return Math.max(spineWidth, 0.06);
}

/**
 * Calculate total cover dimensions
 * Cover = back + spine + front + bleed on all sides
 * 
 * @param {object} format - Book format { width, height, bleed }
 * @param {number} pageCount - Total pages
 * @param {string} paperType - Paper type
 * @returns {object} Cover dimensions
 */
export function calculateCoverDimensions(format, pageCount, paperType = 'white') {
  const { width, height, bleed = 0.125 } = format;
  const spineWidth = calculateSpineWidth(pageCount, paperType);
  
  // Total width = bleed + back + spine + front + bleed
  const totalWidth = (bleed * 2) + (width * 2) + spineWidth;
  
  // Total height = bleed + height + bleed
  const totalHeight = (bleed * 2) + height;
  
  return {
    totalWidth,
    totalHeight,
    spineWidth,
    bleed,
    trimWidth: width,
    trimHeight: height
  };
}

/**
 * Get cover layout zones (back, spine, front)
 * All measurements in inches from top-left corner
 * 
 * @param {object} coverDimensions - From calculateCoverDimensions
 * @returns {object} Layout zones with positions and dimensions
 */
export function getCoverLayout(coverDimensions) {
  const { totalWidth, totalHeight, spineWidth, bleed, trimWidth, trimHeight } = coverDimensions;
  
  // Back cover zone
  const backCover = {
    x: bleed,
    y: bleed,
    width: trimWidth,
    height: trimHeight,
    type: 'back'
  };
  
  // Spine zone
  const spine = {
    x: bleed + trimWidth,
    y: bleed,
    width: spineWidth,
    height: trimHeight,
    type: 'spine'
  };
  
  // Front cover zone
  const frontCover = {
    x: bleed + trimWidth + spineWidth,
    y: bleed,
    width: trimWidth,
    height: trimHeight,
    type: 'front'
  };
  
  // Safe zones (0.125" inside trim for text/important elements)
  const safeMargin = 0.125;
  
  const backSafe = {
    x: backCover.x + safeMargin,
    y: backCover.y + safeMargin,
    width: backCover.width - (safeMargin * 2),
    height: backCover.height - (safeMargin * 2),
    type: 'back-safe'
  };
  
  const spineSafe = {
    x: spine.x + safeMargin,
    y: spine.y + safeMargin,
    width: Math.max(spine.width - (safeMargin * 2), 0),
    height: spine.height - (safeMargin * 2),
    type: 'spine-safe'
  };
  
  const frontSafe = {
    x: frontCover.x + safeMargin,
    y: frontCover.y + safeMargin,
    width: frontCover.width - (safeMargin * 2),
    height: frontCover.height - (safeMargin * 2),
    type: 'front-safe'
  };
  
  return {
    totalWidth,
    totalHeight,
    bleed,
    backCover,
    spine,
    frontCover,
    backSafe,
    spineSafe,
    frontSafe
  };
}

/**
 * Validate cover design elements
 * 
 * @param {object} coverData - Cover design data
 * @param {object} layout - Cover layout from getCoverLayout
 * @returns {object} Validation result { valid, errors, warnings }
 */
export function validateCoverDesign(coverData, layout) {
  const errors = [];
  const warnings = [];
  
  if (!coverData) {
    errors.push('No cover data provided');
    return { valid: false, errors, warnings };
  }
  
  // Check if spine is too narrow for text
  if (layout.spine.width < 0.25) {
    warnings.push(`Spine width (${layout.spine.width.toFixed(3)}") is very narrow. Consider removing spine text.`);
  }
  
  // Check for required elements
  if (!coverData.frontTitle) {
    warnings.push('Front cover should include book title');
  }
  
  if (!coverData.frontAuthor) {
    warnings.push('Front cover should include author name');
  }
  
  // Check barcode placement (back cover, bottom right)
  if (coverData.includeBarcode) {
    const barcodeArea = {
      x: layout.backCover.x + layout.backCover.width - 2.5,
      y: layout.backCover.y + layout.backCover.height - 1.5,
      width: 2.0,
      height: 1.2
    };
    
    // Ensure barcode area is within safe zone
    if (barcodeArea.x < layout.backSafe.x) {
      warnings.push('Barcode may be too close to spine edge');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Generate cover template data structure
 * 
 * @param {object} project - Project data
 * @param {string} paperType - Paper type
 * @returns {object} Cover template
 */
export function generateCoverTemplate(project, paperType = 'white') {
  const { format, pages, metadata } = project;
  const pageCount = pages?.length || 0;
  const projectTitle = metadata?.title || project?.title || '';
  const projectAuthor = metadata?.author || project?.author || '';
  
  const dimensions = calculateCoverDimensions(format, pageCount, paperType);
  const layout = getCoverLayout(dimensions);
  
  return {
    dimensions,
    layout,
    paperType,
    pageCount,
    design: {
      frontTitle: projectTitle,
      frontAuthor: projectAuthor,
      frontImage: null,
      backText: '',
      backImage: null,
      spineText: projectTitle,
      spineAuthor: projectAuthor,
      backgroundColor: '#FFFFFF',
      includeBarcode: true,
      barcodePosition: {
        x: layout.backCover.x + layout.backCover.width - 2.5,
        y: layout.backCover.y + layout.backCover.height - 1.5
      }
    }
  };
}

/**
 * Check if spine is wide enough for text
 * 
 * @param {number} spineWidth - Spine width in inches
 * @param {number} fontSize - Font size in points
 * @returns {boolean} True if spine can accommodate text
 */
export function canSpineFitText(spineWidth, fontSize = 12) {
  // Rule of thumb: spine needs to be at least 0.0625" per point of font size
  const minWidth = (fontSize * 0.0625) / 72; // Convert to inches
  return spineWidth >= minWidth;
}

/**
 * Get recommended spine font size
 * 
 * @param {number} spineWidth - Spine width in inches
 * @returns {number} Recommended font size in points
 */
export function getRecommendedSpineFontSize(spineWidth) {
  if (spineWidth < 0.25) {
    return 0; // Too narrow for text
  } else if (spineWidth < 0.5) {
    return 10;
  } else if (spineWidth < 0.75) {
    return 12;
  } else {
    return 14;
  }
}

/**
 * Calculate bleed extension for cover images
 * Images should extend into bleed area
 * 
 * @param {object} zone - Cover zone (front, back, or spine)
 * @param {number} bleed - Bleed amount in inches
 * @returns {object} Extended zone including bleed
 */
export function extendZoneToBleed(zone, bleed) {
  return {
    x: zone.x - bleed,
    y: zone.y - bleed,
    width: zone.width + (bleed * 2),
    height: zone.height + (bleed * 2),
    type: `${zone.type}-with-bleed`
  };
}

/**
 * Validate cover file specifications
 * 
 * @param {object} coverDimensions - Cover dimensions
 * @param {number} dpi - Resolution in DPI
 * @returns {object} Validation result
 */
export function validateCoverSpecs(coverDimensions, dpi = 300) {
  const errors = [];
  const warnings = [];
  
  // Check DPI
  if (dpi < 300) {
    errors.push(`Cover resolution (${dpi} DPI) is below KDP minimum of 300 DPI`);
  } else if (dpi < 600) {
    warnings.push(`Cover resolution (${dpi} DPI) is acceptable but 600+ DPI is recommended`);
  }
  
  // Calculate pixel dimensions
  const pixelWidth = Math.round(coverDimensions.totalWidth * dpi);
  const pixelHeight = Math.round(coverDimensions.totalHeight * dpi);
  
  // Check if dimensions are reasonable
  if (pixelWidth > 15000 || pixelHeight > 15000) {
    warnings.push(`Cover dimensions (${pixelWidth}x${pixelHeight}px) are very large. Consider using 300 DPI instead of ${dpi} DPI.`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    pixelWidth,
    pixelHeight
  };
}
