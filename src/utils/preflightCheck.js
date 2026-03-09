/**
 * Preflight Check System for KDP Print
 * Analyzes book for compliance issues before export
 */

import { getSafeArea, isInSafeArea, isInGutterDangerZone, orderPagesForPrint } from './paginationEngine.js';
import { resolvePageImageUrl } from './imageUrlResolver';
import { getPrintFormatInches } from './printFormat';

/**
 * Issue severity levels
 */
export const SEVERITY = {
  CRITICAL: 'critical',  // Blocks export - must fix
  WARNING: 'warning',    // Should fix - may cause issues
  INFO: 'info'          // Optional improvement
};

/**
 * Issue categories
 */
export const CATEGORY = {
  SAFE_AREA: 'safe_area',
  RESOLUTION: 'resolution',
  CONTENT: 'content',
  BLEED: 'bleed',
  FONTS: 'fonts',
  GUTTER: 'gutter',
  PAGINATION: 'pagination'
};

const matchesTemplate = (template, aliases = []) => aliases.includes(template);

/**
 * Check if text blocks are within safe area
 * 
 * @param {Array} pages - Array of pages
 * @param {object} format - Book format
 * @returns {Array} Array of issues found
 */
function checkTextSafeArea(pages, format) {
  const issues = [];
  const orderedPages = orderPagesForPrint(pages);
  
  orderedPages.forEach((page, index) => {
    if (page.isBlank) return;
    
    const pageNumber = page.number || index + 1;
    const safeArea = getSafeArea(format, pageNumber, pages.length);
    
    if (!page.textBlocks || page.textBlocks.length === 0) {
      return;
    }
    
    page.textBlocks.forEach((block, blockIndex) => {
      // Convert block position to inches (assuming pixels at 96 DPI)
      const blockInInches = {
        x: (block.x || 0) / 96,
        y: (block.y || 0) / 96,
        width: (block.width || 100) / 96,
        height: (block.height || 50) / 96
      };
      
      if (!isInSafeArea(blockInInches, safeArea)) {
        issues.push({
          severity: SEVERITY.WARNING,
          category: CATEGORY.SAFE_AREA,
          page: pageNumber,
          message: `Text block ${blockIndex + 1} extends outside safe area`,
          details: `Text may be cut during trimming`,
          fix: 'Move text block away from page edges'
        });
      }
    });
  });
  
  return issues;
}

/**
 * Check image resolution
 * 
 * @param {Array} pages - Array of pages
 * @param {object} format - Book format
 * @returns {Array} Array of issues found
 */
function checkImageResolution(pages) {
  const issues = [];
  const minDPI = 300;
  const recommendedDPI = 600;

  pages.forEach((page, index) => {
    const pageNumber = page.number || index + 1;
    const hasImage = Boolean(resolvePageImageUrl(page));
    if (!hasImage) {
      return;
    }

    const dpi = page.illustration?.dalleParams?.calculatedDPI;
    if (!dpi) {
      issues.push({
        severity: SEVERITY.INFO,
        category: CATEGORY.RESOLUTION,
        page: pageNumber,
        message: 'Image DPI metadata unavailable',
        details: 'La résolution exacte ne peut pas être vérifiée automatiquement pour cette image',
        fix: 'Vérifiez visuellement la netteté dans un export test'
      });
      return;
    }

    if (dpi < minDPI) {
      issues.push({
        severity: SEVERITY.CRITICAL,
        category: CATEGORY.RESOLUTION,
        page: pageNumber,
        message: `Image resolution too low (${Math.round(dpi)} DPI)`,
        details: 'KDP requires minimum 300 DPI for print quality',
        fix: 'Regenerate illustration with higher resolution'
      });
    } else if (dpi < recommendedDPI) {
      issues.push({
        severity: SEVERITY.WARNING,
        category: CATEGORY.RESOLUTION,
        page: pageNumber,
        message: `Image resolution acceptable but not optimal (${Math.round(dpi)} DPI)`,
        details: '600+ DPI recommended for best print quality',
        fix: 'Consider regenerating for higher quality'
      });
    }
  });
  
  return issues;
}

/**
 * Check for empty pages
 * 
 * @param {Array} pages - Array of pages
 * @returns {Array} Array of issues found
 */
function checkEmptyPages(pages) {
  const issues = [];
  
  pages.forEach((page, index) => {
    const pageNumber = page.number || index + 1;
    const hasText = Boolean((page.textBlocks || []).some((block) => String(block.content || '').trim().length > 0));
    const hasImage = !!resolvePageImageUrl(page);

    if (!hasText && !hasImage && !matchesTemplate(page.template, ['short_text', 'texte-court'])) {
      issues.push({
        severity: SEVERITY.WARNING,
        category: CATEGORY.CONTENT,
        page: pageNumber,
        message: `Page ${pageNumber} is empty`,
        details: 'Page contains no text or images',
        fix: 'Add content or remove page'
      });
    }
  });
  
  return issues;
}

/**
 * Check bleed configuration
 * 
 * @param {object} format - Book format
 * @returns {Array} Array of issues found
 */
function checkBleed(format) {
  const issues = [];
  const standardBleed = 0.125;

  if (!format.bleed || format.bleed <= 0) {
    issues.push({
      severity: SEVERITY.CRITICAL,
      category: CATEGORY.BLEED,
      page: null,
      message: 'No bleed configured',
      details: 'KDP requires 0.125" bleed on all sides',
      fix: 'Enable bleed in project settings'
    });
  } else if (format.bleed < standardBleed) {
    issues.push({
      severity: SEVERITY.WARNING,
      category: CATEGORY.BLEED,
      page: null,
      message: `Bleed (${format.bleed}") is less than KDP standard (${standardBleed}")`,
      details: 'May cause white edges after trimming',
      fix: `Set bleed to ${standardBleed}"`
    });
  }
  
  return issues;
}

/**
 * Check for elements too close to gutter
 * 
 * @param {Array} pages - Array of pages
 * @param {object} format - Book format
 * @returns {Array} Array of issues found
 */
function checkGutterProximity(pages, format) {
  const issues = [];
  const orderedPages = orderPagesForPrint(pages);
  
  orderedPages.forEach((page, index) => {
    if (page.isBlank) return;
    
    const pageNumber = page.number || index + 1;
    
    // Check text blocks
    if (page.textBlocks && page.textBlocks.length > 0) {
      page.textBlocks.forEach((block, blockIndex) => {
        const blockInInches = {
          x: (block.x || 0) / 96,
          y: (block.y || 0) / 96,
          width: (block.width || 100) / 96,
          height: (block.height || 50) / 96
        };
        
        if (isInGutterDangerZone(blockInInches, format, pageNumber, pages.length)) {
          issues.push({
            severity: SEVERITY.WARNING,
            category: CATEGORY.GUTTER,
            page: pageNumber,
            message: `Text block ${blockIndex + 1} too close to binding`,
            details: 'Content may be hard to read or cut by binding',
            fix: 'Move content away from inner margin'
          });
        }
      });
    }
    
    // Check images
    if (resolvePageImageUrl(page)) {
      // For full-page illustrations, this is expected
      if (!matchesTemplate(page.template, ['full_illustration', 'illustration-pleine', 'double-page', 'double_page'])) {
        const imageArea = {
          x: 0,
          y: 0,
          width: format.width,
          height: format.height * 0.5
        };
        
        if (isInGutterDangerZone(imageArea, format, pageNumber, pages.length)) {
          issues.push({
            severity: SEVERITY.INFO,
            category: CATEGORY.GUTTER,
            page: pageNumber,
            message: 'Image extends into gutter area',
            details: 'Part of image may be hidden by binding',
            fix: 'Ensure important elements are away from binding'
          });
        }
      }
    }
  });
  
  return issues;
}

/**
 * Check pagination requirements
 * 
 * @param {Array} pages - Array of pages
 * @returns {Array} Array of issues found
 */
function checkPagination(pages) {
  const issues = [];
  const minPages = 24;
  const maxPages = 828;
  
  if (pages.length < minPages) {
    issues.push({
      severity: SEVERITY.CRITICAL,
      category: CATEGORY.PAGINATION,
      page: null,
      message: `Book has ${pages.length} pages (minimum: ${minPages})`,
      details: 'KDP requires at least 24 pages for paperback',
      fix: `Add ${minPages - pages.length} more pages`
    });
  }
  
  if (pages.length > maxPages) {
    issues.push({
      severity: SEVERITY.CRITICAL,
      category: CATEGORY.PAGINATION,
      page: null,
      message: `Book has ${pages.length} pages (maximum: ${maxPages})`,
      details: 'KDP maximum is 828 pages for paperback',
      fix: `Remove ${pages.length - maxPages} pages`
    });
  }
  
  // Check for odd page count (will need blank page)
  if (pages.length % 2 !== 0) {
    issues.push({
      severity: SEVERITY.INFO,
      category: CATEGORY.PAGINATION,
      page: null,
      message: 'Odd page count detected',
      details: 'A blank page will be added automatically',
      fix: 'No action needed - handled automatically'
    });
  }
  
  return issues;
}

/**
 * Check font embedding (placeholder - would need actual font analysis)
 * 
 * @param {Array} pages - Array of pages
 * @returns {Array} Array of issues found
 */
function checkFonts(pages) {
  const issues = [];
  
  // This is a placeholder - actual implementation would analyze fonts
  // For now, we'll just add an info message
  issues.push({
    severity: SEVERITY.INFO,
    category: CATEGORY.FONTS,
    page: null,
    message: 'Font embedding will be handled during PDF export',
    details: 'All fonts will be embedded in the final PDF',
    fix: 'No action needed'
  });
  
  return issues;
}

/**
 * Run complete preflight check
 * 
 * @param {object} project - Project data
 * @returns {object} Preflight report
 */
export function runPreflightCheck(project) {
  const { pages } = project;
  const format = getPrintFormatInches(project?.format);
  
  if (!pages || !format) {
    return {
      status: 'error',
      canExport: false,
      issues: [{
        severity: SEVERITY.CRITICAL,
        category: CATEGORY.CONTENT,
        page: null,
        message: 'Invalid project data',
        details: 'Project is missing pages or format information',
        fix: 'Ensure project is properly configured'
      }]
    };
  }
  
  // Run all checks
  const allIssues = [
    ...checkPagination(pages),
    ...checkBleed(format),
    ...checkTextSafeArea(pages, format),
    ...checkImageResolution(pages),
    ...checkEmptyPages(pages),
    ...checkGutterProximity(pages, format),
    ...checkFonts(pages)
  ];
  
  // Categorize issues
  const critical = allIssues.filter(i => i.severity === SEVERITY.CRITICAL);
  const warnings = allIssues.filter(i => i.severity === SEVERITY.WARNING);
  const info = allIssues.filter(i => i.severity === SEVERITY.INFO);
  
  // Determine status
  let status;
  if (critical.length > 0) {
    status = 'critical'; // RED - cannot export
  } else if (warnings.length > 0) {
    status = 'warning'; // ORANGE - can export but not recommended
  } else {
    status = 'ready'; // GREEN - ready to export
  }
  
  const canExport = critical.length === 0;
  
  return {
    status,
    canExport,
    timestamp: new Date().toISOString(),
    summary: {
      total: allIssues.length,
      critical: critical.length,
      warnings: warnings.length,
      info: info.length
    },
    issues: allIssues,
    issuesByCategory: {
      [CATEGORY.PAGINATION]: allIssues.filter(i => i.category === CATEGORY.PAGINATION),
      [CATEGORY.BLEED]: allIssues.filter(i => i.category === CATEGORY.BLEED),
      [CATEGORY.SAFE_AREA]: allIssues.filter(i => i.category === CATEGORY.SAFE_AREA),
      [CATEGORY.RESOLUTION]: allIssues.filter(i => i.category === CATEGORY.RESOLUTION),
      [CATEGORY.CONTENT]: allIssues.filter(i => i.category === CATEGORY.CONTENT),
      [CATEGORY.GUTTER]: allIssues.filter(i => i.category === CATEGORY.GUTTER),
      [CATEGORY.FONTS]: allIssues.filter(i => i.category === CATEGORY.FONTS)
    }
  };
}

/**
 * Get status color for UI display
 * 
 * @param {string} status - Status from preflight report
 * @returns {object} Color information
 */
export function getStatusColor(status) {
  switch (status) {
    case 'ready':
      return {
        bg: 'bg-green-100',
        text: 'text-green-800',
        border: 'border-green-300',
        label: 'PRÊT À EXPORTER',
        icon: '✓'
      };
    case 'warning':
      return {
        bg: 'bg-orange-100',
        text: 'text-orange-800',
        border: 'border-orange-300',
        label: 'AVERTISSEMENTS',
        icon: '⚠'
      };
    case 'critical':
      return {
        bg: 'bg-red-100',
        text: 'text-red-800',
        border: 'border-red-300',
        label: 'ERREURS CRITIQUES',
        icon: '✕'
      };
    default:
      return {
        bg: 'bg-gray-100',
        text: 'text-gray-800',
        border: 'border-gray-300',
        label: 'INCONNU',
        icon: '?'
      };
  }
}

/**
 * Get severity color for UI display
 * 
 * @param {string} severity - Issue severity
 * @returns {object} Color information
 */
export function getSeverityColor(severity) {
  switch (severity) {
    case SEVERITY.CRITICAL:
      return {
        bg: 'bg-red-50',
        text: 'text-red-700',
        badge: 'bg-red-100 text-red-800',
        label: 'Critique'
      };
    case SEVERITY.WARNING:
      return {
        bg: 'bg-orange-50',
        text: 'text-orange-700',
        badge: 'bg-orange-100 text-orange-800',
        label: 'Avertissement'
      };
    case SEVERITY.INFO:
      return {
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        badge: 'bg-blue-100 text-blue-800',
        label: 'Info'
      };
    default:
      return {
        bg: 'bg-gray-50',
        text: 'text-gray-700',
        badge: 'bg-gray-100 text-gray-800',
        label: 'Inconnu'
      };
  }
}
