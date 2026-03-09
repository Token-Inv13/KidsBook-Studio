const MM_PER_INCH = 25.4;

export const getPrintFormatInches = (format = {}) => {
  const unit = String(format.unit || 'inches').toLowerCase();
  const isMM = unit === 'mm';

  const rawWidth = typeof format.width === 'number' && Number.isFinite(format.width) ? format.width : 8.5;
  const rawHeight = typeof format.height === 'number' && Number.isFinite(format.height) ? format.height : 11;

  const width = isMM ? rawWidth / MM_PER_INCH : rawWidth;
  const height = isMM ? rawHeight / MM_PER_INCH : rawHeight;

  let bleed = 0;
  if (typeof format.bleed === 'number' && Number.isFinite(format.bleed)) {
    if (format.bleed > 0) {
      bleed = isMM ? format.bleed / MM_PER_INCH : format.bleed;
    }
  } else if (format.bleed === true) {
    bleed = 0.125;
  }

  return {
    width,
    height,
    bleed,
    unit: 'inches'
  };
};
