/**
 * Print Rendering Utility for KDP Export
 * Handles color adjustment and print-ready image processing
 */

import { resolvePageImageUrl } from './imageUrlResolver';
import { getPrintFormatInches } from './printFormat';

/**
 * Apply print color adjustment to prevent dark prints
 * Increases brightness and contrast for better print output
 * 
 * @param {string} imageUrl - Image URL or data URL
 * @param {object} options - Adjustment options
 * @returns {Promise<string>} Adjusted image as data URL
 */
export async function applyPrintColorAdjustment(imageUrl, options = {}) {
  const {
    brightnessIncrease = 10,  // Increase brightness by 10%
    contrastIncrease = 5,     // Increase contrast by 5%
    saturationAdjust = -5     // Slightly reduce saturation for print
  } = options;
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      
      // Draw original image
      ctx.drawImage(img, 0, 0);
      
      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Apply adjustments
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Convert to HSL for better control
        const hsl = rgbToHsl(r, g, b);
        
        // Adjust lightness (brightness)
        hsl.l = Math.min(100, hsl.l + brightnessIncrease);
        
        // Adjust saturation
        hsl.s = Math.max(0, Math.min(100, hsl.s + saturationAdjust));
        
        // Convert back to RGB
        const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
        
        // Apply contrast
        const contrast = (contrastIncrease / 100) + 1;
        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
        
        data[i] = clamp(factor * (rgb.r - 128) + 128);
        data[i + 1] = clamp(factor * (rgb.g - 128) + 128);
        data[i + 2] = clamp(factor * (rgb.b - 128) + 128);
      }
      
      // Put adjusted data back
      ctx.putImageData(imageData, 0, 0);
      
      // Return as data URL
      resolve(canvas.toDataURL('image/png'));
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image for color adjustment'));
    };
    
    img.src = imageUrl;
  });
}

/**
 * Convert RGB to HSL
 */
function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  
  return {
    h: h * 360,
    s: s * 100,
    l: l * 100
  };
}

/**
 * Convert HSL to RGB
 */
function hslToRgb(h, s, l) {
  h /= 360;
  s /= 100;
  l /= 100;
  
  let r, g, b;
  
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}

/**
 * Clamp value between 0 and 255
 */
function clamp(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

/**
 * Prepare image for print (resize, adjust colors)
 * 
 * @param {string} imageUrl - Source image URL
 * @param {object} targetDimensions - Target dimensions in pixels
 * @param {boolean} applyColorAdjustment - Whether to apply print color adjustment
 * @returns {Promise<string>} Print-ready image as data URL
 */
export async function prepareImageForPrint(imageUrl, targetDimensions, applyColorAdjustment = true) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetDimensions.width;
      canvas.height = targetDimensions.height;
      const ctx = canvas.getContext('2d');
      
      // Use high-quality image smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // Draw resized image
      ctx.drawImage(img, 0, 0, targetDimensions.width, targetDimensions.height);
      
      let dataUrl = canvas.toDataURL('image/png');
      
      // Apply color adjustment if requested
      if (applyColorAdjustment) {
        try {
          dataUrl = await applyPrintColorAdjustment(dataUrl);
        } catch (error) {
          console.warn('Color adjustment failed, using original:', error);
        }
      }
      
      resolve(dataUrl);
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image for print preparation'));
    };
    
    img.src = imageUrl;
  });
}

/**
 * Calculate pixel dimensions for print at specific DPI
 * 
 * @param {number} widthInches - Width in inches
 * @param {number} heightInches - Height in inches
 * @param {number} dpi - Dots per inch (300 or 600 recommended)
 * @returns {object} Pixel dimensions
 */
export function calculatePrintPixels(widthInches, heightInches, dpi = 300) {
  return {
    width: Math.round(widthInches * dpi),
    height: Math.round(heightInches * dpi),
    dpi
  };
}

/**
 * Generate bleed area for an image
 * Extends image into bleed zone
 * 
 * @param {string} imageUrl - Source image
 * @param {object} dimensions - Page dimensions with bleed
 * @returns {Promise<string>} Image with bleed as data URL
 */
export async function generateBleedImage(imageUrl, dimensions) {
  const { width, height, bleedAmount } = dimensions;
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      // Draw image slightly larger to extend into bleed
      const bleedScale = 1 + (bleedAmount * 2 / Math.min(width, height));
      const scaledWidth = width * bleedScale;
      const scaledHeight = height * bleedScale;
      const offsetX = -(scaledWidth - width) / 2;
      const offsetY = -(scaledHeight - height) / 2;
      
      ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);
      
      resolve(canvas.toDataURL('image/png'));
    };
    
    img.onerror = () => {
      reject(new Error('Failed to generate bleed image'));
    };
    
    img.src = imageUrl;
  });
}

/**
 * Flatten page content (combine all elements into single image)
 * 
 * @param {object} page - Page data
 * @param {object} format - Book format
 * @param {number} dpi - Target DPI
 * @returns {Promise<string>} Flattened page as data URL
 */
export async function flattenPage(page, format, dpi = 300, options = {}) {
  const { applyColorAdjustment = true } = options;
  const normalizedFormat = getPrintFormatInches(format);
  const { width, height, bleed = 0.125 } = normalizedFormat;
  const totalWidth = width + (bleed * 2);
  const totalHeight = height + (bleed * 2);
  
  const pixelDimensions = calculatePrintPixels(totalWidth, totalHeight, dpi);
  
  const canvas = document.createElement('canvas');
  canvas.width = pixelDimensions.width;
  canvas.height = pixelDimensions.height;
  const ctx = canvas.getContext('2d');
  
  // Fill with white background
  ctx.fillStyle = page?.pageBackground?.color || '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw illustration if present
  const imageUrl = resolvePageImageUrl(page);
  if (imageUrl) {
    
    try {
      const printImage = await prepareImageForPrint(
        imageUrl,
        pixelDimensions,
        applyColorAdjustment
      );
      
      const img = await loadImage(printImage);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    } catch (error) {
      console.error('Failed to render image:', error);
    }
  }
  
  // Draw text blocks
  if (page.textBlocks && page.textBlocks.length > 0) {
    const scale = dpi / 96; // Convert from screen pixels to print pixels
    
    page.textBlocks.forEach(block => {
      ctx.save();
      
      // Scale and position
      const x = (block.x || 0) * scale;
      const y = (block.y || 0) * scale;
      
      // Set text properties
      const fontSize = (block.fontSize || 16) * scale;
      ctx.font = `${fontSize}px ${block.fontFamily || 'Arial'}`;
      ctx.fillStyle = block.color || '#000000';
      ctx.textAlign = block.textAlign || 'left';
      
      // Draw text
      const lines = String(block.content || block.text || '').split('\n');
      const lineHeight = fontSize * (typeof block.lineHeight === 'number' ? block.lineHeight : 1.2);
      
      lines.forEach((line, index) => {
        ctx.fillText(line, x, y + (index * lineHeight) + fontSize);
      });
      
      ctx.restore();
    });
  }
  
  return canvas.toDataURL('image/png');
}

/**
 * Load image from URL
 */
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Get print color adjustment preview
 * Shows before/after comparison
 * 
 * @param {string} imageUrl - Source image
 * @returns {Promise<object>} Before and after URLs
 */
export async function getColorAdjustmentPreview(imageUrl) {
  const adjusted = await applyPrintColorAdjustment(imageUrl);
  
  return {
    before: imageUrl,
    after: adjusted
  };
}

/**
 * Validate image for print
 * 
 * @param {string} imageUrl - Image URL
 * @param {object} requiredDimensions - Required pixel dimensions
 * @returns {Promise<object>} Validation result
 */
export async function validateImageForPrint(imageUrl, requiredDimensions) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const actualDPI = Math.min(
        img.width / (requiredDimensions.width / 300),
        img.height / (requiredDimensions.height / 300)
      );
      
      const issues = [];
      
      if (img.width < requiredDimensions.width || img.height < requiredDimensions.height) {
        issues.push({
          severity: 'critical',
          message: `Image resolution too low: ${img.width}x${img.height}px (required: ${requiredDimensions.width}x${requiredDimensions.height}px)`
        });
      }
      
      if (actualDPI < 300) {
        issues.push({
          severity: 'critical',
          message: `Image DPI too low: ${Math.round(actualDPI)} (minimum: 300)`
        });
      } else if (actualDPI < 600) {
        issues.push({
          severity: 'warning',
          message: `Image DPI acceptable but not optimal: ${Math.round(actualDPI)} (recommended: 600+)`
        });
      }
      
      resolve({
        valid: issues.filter(i => i.severity === 'critical').length === 0,
        actualDimensions: { width: img.width, height: img.height },
        actualDPI: Math.round(actualDPI),
        issues
      });
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image for validation'));
    };
    
    img.src = imageUrl;
  });
}
