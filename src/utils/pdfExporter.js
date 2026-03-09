/**
 * PDF Exporter for KDP Print
 * Generates print-ready interior and cover PDFs
 */

import { jsPDF } from 'jspdf';
import { orderPagesForPrint } from './paginationEngine.js';
import { flattenPage, calculatePrintPixels } from './printRenderer.js';
import { calculateCoverDimensions, getCoverLayout } from './coverGenerator.js';
import { getPrintFormatInches } from './printFormat';

/**
 * Export interior PDF (all book pages)
 * 
 * @param {object} project - Project data
 * @param {object} options - Export options
 * @returns {Promise<Blob>} PDF blob
 */
export async function exportInteriorPDF(project, options = {}) {
  const {
    dpi = 300,
    embedFonts = true,
    applyColorAdjustment = true
  } = options;
  
  const { pages } = project;
  const format = getPrintFormatInches(project?.format);
  const { width, height, bleed = 0.125 } = format;
  
  // Total page dimensions including bleed
  const totalWidth = width + (bleed * 2);
  const totalHeight = height + (bleed * 2);
  
  // Convert to mm for jsPDF (jsPDF uses mm by default)
  const widthMM = totalWidth * 25.4;
  const heightMM = totalHeight * 25.4;
  
  // Create PDF
  const pdf = new jsPDF({
    orientation: width > height ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [widthMM, heightMM],
    compress: true
  });
  
  // Order pages for print
  const orderedPages = orderPagesForPrint(pages);
  
  // Process each page
  for (let i = 0; i < orderedPages.length; i++) {
    const page = orderedPages[i];
    
    if (i > 0) {
      pdf.addPage([widthMM, heightMM]);
    }
    
    // Flatten page to single image
    const flattenedImage = await flattenPage(page, format, dpi, { applyColorAdjustment });
    
    // Add image to PDF (full bleed)
    pdf.addImage(
      flattenedImage,
      'PNG',
      0,
      0,
      widthMM,
      heightMM,
      undefined,
      'FAST' // Compression
    );
  }
  
  // Return as blob
  return pdf.output('blob');
}

/**
 * Export cover PDF
 * 
 * @param {object} project - Project data
 * @param {object} coverData - Cover design data
 * @param {object} options - Export options
 * @returns {Promise<Blob>} PDF blob
 */
export async function exportCoverPDF(project, coverData, options = {}) {
  const {
    dpi = 300,
    paperType = 'white'
  } = options;
  
  const format = getPrintFormatInches(project?.format);
  const { pages } = project;
  const pageCount = pages?.length || 0;
  
  // Calculate cover dimensions
  const coverDimensions = calculateCoverDimensions(format, pageCount, paperType);
  const layout = getCoverLayout(coverDimensions);
  
  // Convert to mm for jsPDF
  const widthMM = coverDimensions.totalWidth * 25.4;
  const heightMM = coverDimensions.totalHeight * 25.4;
  
  // Create PDF
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [widthMM, heightMM],
    compress: true
  });
  
  // Render cover to canvas
  const coverImage = await renderCoverToImage(coverData, layout, dpi);
  
  // Add to PDF
  pdf.addImage(
    coverImage,
    'PNG',
    0,
    0,
    widthMM,
    heightMM,
    undefined,
    'FAST'
  );
  
  return pdf.output('blob');
}

/**
 * Render cover design to image
 * 
 * @param {object} coverData - Cover design data
 * @param {object} layout - Cover layout
 * @param {number} dpi - Target DPI
 * @returns {Promise<string>} Cover image as data URL
 */
async function renderCoverToImage(coverData, layout, dpi) {
  const pixelWidth = Math.round(layout.totalWidth * dpi);
  const pixelHeight = Math.round(layout.totalHeight * dpi);
  
  const canvas = document.createElement('canvas');
  canvas.width = pixelWidth;
  canvas.height = pixelHeight;
  const ctx = canvas.getContext('2d');
  
  const scale = dpi; // Scale factor from inches to pixels
  
  // Fill background
  ctx.fillStyle = coverData.design?.backgroundColor || '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw back cover
  if (coverData.design?.backImage) {
    await drawCoverImage(ctx, coverData.design.backImage, layout.backCover, scale);
  }
  
  // Draw back text
  if (coverData.design?.backText) {
    drawCoverText(ctx, coverData.design.backText, layout.backSafe, scale);
  }
  
  // Draw spine
  ctx.fillStyle = coverData.design?.spineColor || '#333333';
  ctx.fillRect(
    layout.spine.x * scale,
    layout.spine.y * scale,
    layout.spine.width * scale,
    layout.spine.height * scale
  );
  
  // Draw spine text (rotated)
  if (coverData.design?.spineText && layout.spine.width >= 0.25) {
    drawSpineText(ctx, coverData.design.spineText, layout.spine, scale);
  }
  
  // Draw front cover
  if (coverData.design?.frontImage) {
    await drawCoverImage(ctx, coverData.design.frontImage, layout.frontCover, scale);
  }
  
  // Draw front title
  if (coverData.design?.frontTitle) {
    drawCoverTitle(ctx, coverData.design.frontTitle, layout.frontSafe, scale);
  }
  
  // Draw front author
  if (coverData.design?.frontAuthor) {
    drawCoverAuthor(ctx, coverData.design.frontAuthor, layout.frontSafe, scale);
  }
  
  // Draw barcode placeholder
  if (coverData.design?.includeBarcode) {
    drawBarcodeArea(ctx, coverData.design.barcodePosition, scale);
  }
  
  // Draw trim and bleed guides (optional, for preview)
  if (coverData.showGuides) {
    drawCoverGuides(ctx, layout, scale);
  }
  
  return canvas.toDataURL('image/png');
}

/**
 * Draw image on cover zone
 */
async function drawCoverImage(ctx, imageUrl, zone, scale) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      ctx.drawImage(
        img,
        zone.x * scale,
        zone.y * scale,
        zone.width * scale,
        zone.height * scale
      );
      resolve();
    };
    
    img.onerror = () => {
      console.warn('Failed to load cover image');
      resolve();
    };
    
    img.src = imageUrl;
  });
}

/**
 * Draw text on cover
 */
function drawCoverText(ctx, text, zone, scale) {
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.font = `${14 * scale}px Arial`;
  ctx.textAlign = 'left';
  
  const x = zone.x * scale;
  const y = zone.y * scale + (20 * scale);
  const maxWidth = zone.width * scale;
  
  const lines = wrapText(ctx, text, maxWidth);
  const lineHeight = 18 * scale;
  
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + (index * lineHeight));
  });
  
  ctx.restore();
}

/**
 * Draw spine text (rotated 90 degrees)
 */
function drawSpineText(ctx, text, zone, scale) {
  ctx.save();
  
  const x = (zone.x + zone.width / 2) * scale;
  const y = (zone.y + zone.height / 2) * scale;
  
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `${12 * scale}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  ctx.fillText(text, 0, 0);
  
  ctx.restore();
}

/**
 * Draw cover title
 */
function drawCoverTitle(ctx, title, zone, scale) {
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.font = `bold ${36 * scale}px Arial`;
  ctx.textAlign = 'center';
  
  const x = (zone.x + zone.width / 2) * scale;
  const y = zone.y * scale + (60 * scale);
  
  ctx.fillText(title, x, y);
  ctx.restore();
}

/**
 * Draw cover author
 */
function drawCoverAuthor(ctx, author, zone, scale) {
  ctx.save();
  ctx.fillStyle = '#333333';
  ctx.font = `${24 * scale}px Arial`;
  ctx.textAlign = 'center';
  
  const x = (zone.x + zone.width / 2) * scale;
  const y = zone.y * scale + (100 * scale);
  
  ctx.fillText(author, x, y);
  ctx.restore();
}

/**
 * Draw barcode placeholder area
 */
function drawBarcodeArea(ctx, position, scale) {
  ctx.save();
  
  const x = position.x * scale;
  const y = position.y * scale;
  const width = 2.0 * scale;
  const height = 1.2 * scale;
  
  // Draw white background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x, y, width, height);
  
  // Draw border
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, height);
  
  // Draw text
  ctx.fillStyle = '#000000';
  ctx.font = `${10 * scale}px Arial`;
  ctx.textAlign = 'center';
  ctx.fillText('BARCODE', x + width / 2, y + height / 2);
  
  ctx.restore();
}

/**
 * Draw cover guides (trim, bleed, safe areas)
 */
function drawCoverGuides(ctx, layout, scale) {
  ctx.save();
  ctx.strokeStyle = '#FF0000';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  
  // Trim lines
  ctx.strokeRect(
    layout.bleed * scale,
    layout.bleed * scale,
    (layout.totalWidth - layout.bleed * 2) * scale,
    (layout.totalHeight - layout.bleed * 2) * scale
  );
  
  // Spine boundaries
  ctx.beginPath();
  ctx.moveTo(layout.spine.x * scale, 0);
  ctx.lineTo(layout.spine.x * scale, layout.totalHeight * scale);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo((layout.spine.x + layout.spine.width) * scale, 0);
  ctx.lineTo((layout.spine.x + layout.spine.width) * scale, layout.totalHeight * scale);
  ctx.stroke();
  
  ctx.restore();
}

/**
 * Wrap text to fit width
 */
function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';
  
  words.forEach(word => {
    const testLine = currentLine + (currentLine ? ' ' : '') + word;
    const metrics = ctx.measureText(testLine);
    
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  });
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines;
}

/**
 * Create export package (ZIP with PDFs and report)
 * 
 * @param {object} project - Project data
 * @param {object} coverData - Cover data
 * @param {object} preflightReport - Preflight report
 * @returns {Promise<Blob>} ZIP blob
 */
export async function createExportPackage(project, coverData, preflightReport) {
  // This would use JSZip library
  // For now, return a placeholder
  
  const interiorPDF = await exportInteriorPDF(project);
  const coverPDF = await exportCoverPDF(project, coverData);
  
  // In a real implementation, we'd use JSZip to create:
  // - interior.pdf
  // - cover.pdf
  // - preflight-report.json
  // - README.txt
  
  return {
    interiorPDF,
    coverPDF,
    preflightReport
  };
}

/**
 * Save PDF to file system
 * 
 * @param {Blob} pdfBlob - PDF blob
 * @param {string} filename - Filename
 */
export async function savePDFToFile(pdfBlob, filename) {
  // Convert blob to array buffer
  const arrayBuffer = await pdfBlob.arrayBuffer();
  
  // Use electronBridge which handles both Electron and browser modes
  const { electronBridge } = await import('./electronBridge');
  const result = await electronBridge.saveFile({
    filename,
    data: arrayBuffer,
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
  });

  if (!result || result.canceled || result.success === false) {
    throw new Error('Enregistrement annulé ou impossible');
  }
  
  return result;
}
