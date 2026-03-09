/**
 * Pagination Engine for KDP Print
 * Handles proper page ordering, gutter margins, and print layout
 */

/**
 * Calculate gutter margin (inner binding margin) based on page count
 * KDP requires increasing gutter for thicker books
 * 
 * @param {number} pageCount - Total number of pages in the book
 * @returns {number} Gutter margin in inches
 */
export function calculateGutterMargin(pageCount) {
  // KDP gutter margin guidelines
  // 24-150 pages: 0.375"
  // 151-300 pages: 0.5"
  // 301-500 pages: 0.625"
  // 501-828 pages: 0.75"
  
  if (pageCount <= 150) {
    return 0.375;
  } else if (pageCount <= 300) {
    return 0.5;
  } else if (pageCount <= 500) {
    return 0.625;
  } else {
    return 0.75;
  }
}

/**
 * Determine if a page number is on the left or right side
 * Page 1 is always on the right (odd pages = right, even pages = left)
 * 
 * @param {number} pageNumber - Page number (1-indexed)
 * @returns {'left' | 'right'} Page side
 */
export function getPageSide(pageNumber) {
  return pageNumber % 2 === 0 ? 'left' : 'right';
}

/**
 * Calculate margins for a specific page considering gutter
 * 
 * @param {number} pageNumber - Page number (1-indexed)
 * @param {number} totalPages - Total number of pages
 * @param {object} baseMargins - Base margins { top, bottom, outer }
 * @returns {object} Calculated margins { top, bottom, left, right }
 */
export function calculatePageMargins(pageNumber, totalPages, baseMargins = {}) {
  const {
    top = 0.5,
    bottom = 0.5,
    outer = 0.5
  } = baseMargins;
  
  const gutter = calculateGutterMargin(totalPages);
  const side = getPageSide(pageNumber);
  
  // Left pages: gutter on right, outer on left
  // Right pages: gutter on left, outer on right
  if (side === 'left') {
    return {
      top,
      bottom,
      left: outer,
      right: gutter
    };
  } else {
    return {
      top,
      bottom,
      left: gutter,
      right: outer
    };
  }
}

/**
 * Get safe area boundaries for a page (excluding bleed and margins)
 * 
 * @param {object} format - Book format { width, height, bleed }
 * @param {number} pageNumber - Page number (1-indexed)
 * @param {number} totalPages - Total number of pages
 * @returns {object} Safe area { x, y, width, height } in inches
 */
export function getSafeArea(format, pageNumber, totalPages) {
  const { width, height, bleed = 0.125 } = format;
  const margins = calculatePageMargins(pageNumber, totalPages);
  
  return {
    x: bleed + margins.left,
    y: bleed + margins.top,
    width: width - margins.left - margins.right,
    height: height - margins.top - margins.bottom
  };
}

/**
 * Check if content is within safe area
 * 
 * @param {object} element - Element with { x, y, width, height } in inches
 * @param {object} safeArea - Safe area boundaries
 * @returns {boolean} True if element is fully within safe area
 */
export function isInSafeArea(element, safeArea) {
  const elementRight = element.x + element.width;
  const elementBottom = element.y + element.height;
  const safeRight = safeArea.x + safeArea.width;
  const safeBottom = safeArea.y + safeArea.height;
  
  return (
    element.x >= safeArea.x &&
    element.y >= safeArea.y &&
    elementRight <= safeRight &&
    elementBottom <= safeBottom
  );
}

/**
 * Check if element is too close to gutter (binding area)
 * Elements within 0.25" of gutter may be cut or hard to read
 * 
 * @param {object} element - Element with { x, y, width, height } in inches
 * @param {object} format - Book format
 * @param {number} pageNumber - Page number
 * @param {number} totalPages - Total pages
 * @returns {boolean} True if element is in danger zone
 */
export function isInGutterDangerZone(element, format, pageNumber, totalPages) {
  const margins = calculatePageMargins(pageNumber, totalPages);
  const side = getPageSide(pageNumber);
  const dangerZone = 0.25; // inches from gutter
  
  const { bleed = 0.125 } = format;
  
  if (side === 'left') {
    // Gutter is on the right
    const gutterStart = format.width - margins.right - bleed;
    const elementRight = element.x + element.width;
    return elementRight > (gutterStart - dangerZone);
  } else {
    // Gutter is on the left
    const gutterEnd = margins.left + bleed;
    return element.x < (gutterEnd + dangerZone);
  }
}

/**
 * Order pages for print layout
 * Ensures page 1 is on the right, and handles double-page spreads
 * 
 * @param {Array} pages - Array of page objects
 * @returns {Array} Ordered pages with print metadata
 */
export function orderPagesForPrint(pages) {
  // Ensure we have an even number of pages (KDP requirement)
  // If odd, add a blank page at the end
  const totalPages = pages.length;
  const needsBlankPage = totalPages % 2 !== 0;
  
  const orderedPages = pages.map((page, index) => {
    const pageNumber = index + 1;
    const side = getPageSide(pageNumber);
    
    return {
      ...page,
      printPageNumber: pageNumber,
      side,
      isDoublePage: page.template === 'double_page',
      margins: calculatePageMargins(pageNumber, totalPages)
    };
  });
  
  // Add blank page if needed
  if (needsBlankPage) {
    orderedPages.push({
      id: 'blank-page',
      printPageNumber: totalPages + 1,
      side: 'left',
      isBlank: true,
      textBlocks: [],
      margins: calculatePageMargins(totalPages + 1, totalPages + 1)
    });
  }
  
  return orderedPages;
}

/**
 * Get spread information for a page number
 * A spread is two facing pages (left + right)
 * 
 * @param {number} pageNumber - Page number (1-indexed)
 * @param {number} totalPages - Total pages
 * @returns {object} Spread info { spreadNumber, leftPage, rightPage }
 */
export function getSpreadInfo(pageNumber, totalPages) {
  const side = getPageSide(pageNumber);
  
  let leftPage, rightPage;
  
  if (side === 'left') {
    leftPage = pageNumber;
    rightPage = pageNumber + 1 <= totalPages ? pageNumber + 1 : null;
  } else {
    leftPage = pageNumber - 1 > 0 ? pageNumber - 1 : null;
    rightPage = pageNumber;
  }
  
  const spreadNumber = Math.ceil(pageNumber / 2);
  
  return {
    spreadNumber,
    leftPage,
    rightPage
  };
}

/**
 * Validate pagination setup
 * 
 * @param {Array} pages - Array of pages
 * @returns {object} Validation result { valid, errors, warnings }
 */
export function validatePagination(pages) {
  const errors = [];
  const warnings = [];
  
  if (!pages || pages.length === 0) {
    errors.push('No pages to paginate');
    return { valid: false, errors, warnings };
  }
  
  // Check page count limits (KDP: 24-828 pages)
  if (pages.length < 24) {
    warnings.push(`Page count (${pages.length}) is below KDP minimum of 24 pages`);
  }
  
  if (pages.length > 828) {
    errors.push(`Page count (${pages.length}) exceeds KDP maximum of 828 pages`);
  }
  
  // Check for double-page spreads on wrong pages
  pages.forEach((page, index) => {
    if (page.template === 'double_page') {
      const pageNumber = index + 1;
      const side = getPageSide(pageNumber);
      
      if (side === 'right') {
        warnings.push(`Page ${pageNumber}: Double-page spread should start on a left page (even number)`);
      }
    }
  });
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
