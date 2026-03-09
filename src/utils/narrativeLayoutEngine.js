import { resolvePageImageUrl } from './imageUrlResolver';
import {
  autoFitTextBlock,
  getFormatDimensions,
  getReadableTextStyle,
  getTemplateZones,
  normalizeTextBlock
} from './writingLayout';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const overlapArea = (a, b) => {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  if (x2 <= x1 || y2 <= y1) {
    return 0;
  }
  return (x2 - x1) * (y2 - y1);
};

const parseAgeBand = (project) => {
  const raw = String(project?.ageRange || project?.targetAge || '6-8').trim();
  const match = raw.match(/(\d+)/);
  const minAge = match ? Number(match[1]) : 6;

  if (minAge <= 5) {
    return {
      minAge,
      maxSentences: 2,
      baseFontSize: 28,
      minFontSize: 22,
      maxFontSize: 34,
      lineHeight: 1.6,
      textAlign: 'center'
    };
  }

  if (minAge <= 8) {
    return {
      minAge,
      maxSentences: 3,
      baseFontSize: 21,
      minFontSize: 16,
      maxFontSize: 28,
      lineHeight: 1.46,
      textAlign: 'left'
    };
  }

  return {
    minAge,
    maxSentences: 4,
    baseFontSize: 17,
    minFontSize: 14,
    maxFontSize: 24,
    lineHeight: 1.35,
    textAlign: 'left'
  };
};

const truncateBySentenceCount = (content, maxSentences) => {
  if (!content || maxSentences <= 0) {
    return content || '';
  }

  const sentences = String(content)
    .split(/(?<=[.!?])\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (sentences.length <= maxSentences) {
    return content;
  }

  return `${sentences.slice(0, maxSentences).join(' ')}…`;
};

const normalizeZone = (zone, dims) => {
  if (!zone || typeof zone !== 'object') {
    return null;
  }

  const isRatio = zone.x <= 1 && zone.y <= 1 && zone.width <= 1 && zone.height <= 1;
  return {
    x: isRatio ? zone.x * dims.width : zone.x,
    y: isRatio ? zone.y * dims.height : zone.y,
    width: isRatio ? zone.width * dims.width : zone.width,
    height: isRatio ? zone.height * dims.height : zone.height
  };
};

const getForbiddenZones = (page, dims) => {
  const zones = [];
  const explicit = Array.isArray(page?.forbiddenZones) ? page.forbiddenZones : [];
  const faceBoxes = Array.isArray(page?.faceBoxes) ? page.faceBoxes : [];
  const eyeBoxes = Array.isArray(page?.eyeBoxes) ? page.eyeBoxes : [];
  const characterBoxes = Array.isArray(page?.characterBoxes) ? page.characterBoxes : [];

  [...explicit, ...faceBoxes, ...eyeBoxes, ...characterBoxes].forEach((zone) => {
    const normalized = normalizeZone(zone, dims);
    if (normalized) {
      zones.push(normalized);
    }
  });

  if (page?.mainCharacterBox) {
    const normalized = normalizeZone(page.mainCharacterBox, dims);
    if (normalized) {
      zones.push(normalized);
    }
  }

  if (page?.template === 'double-page') {
    zones.push({
      x: dims.width * 0.45,
      y: 0,
      width: dims.width * 0.1,
      height: dims.height
    });
  }

  return zones;
};

const buildCandidateZones = (page, format) => {
  const { width, height, bleed, safeArea } = getFormatDimensions(format);
  const margin = bleed + safeArea;
  const usableWidth = width - margin * 2;
  const usableHeight = height - margin * 2;

  const topHeight = clamp(usableHeight * 0.24, 96, 190);
  const sideWidth = clamp(usableWidth * 0.44, 180, usableWidth * 0.55);
  const bottomHeight = clamp(usableHeight * 0.22, 90, 180);

  return [
    {
      type: 'top-left',
      x: margin,
      y: margin,
      width: sideWidth,
      height: topHeight
    },
    {
      type: 'top-right',
      x: width - margin - sideWidth,
      y: margin,
      width: sideWidth,
      height: topHeight
    },
    {
      type: 'bottom-band',
      x: margin,
      y: height - margin - bottomHeight,
      width: usableWidth,
      height: bottomHeight
    },
    {
      type: 'floating-box',
      x: margin + usableWidth * 0.15,
      y: margin + usableHeight * 0.58,
      width: usableWidth * 0.7,
      height: clamp(usableHeight * 0.2, 90, 170)
    }
  ];
};

const loadImageAnalysis = async (imageUrl) => {
  if (!imageUrl || typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const size = 48;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;

        const luminance = [];
        for (let y = 0; y < size; y += 1) {
          const row = [];
          for (let x = 0; x < size; x += 1) {
            const idx = (y * size + x) * 4;
            const r = data[idx] / 255;
            const g = data[idx + 1] / 255;
            const b = data[idx + 2] / 255;
            row.push((0.2126 * r) + (0.7152 * g) + (0.0722 * b));
          }
          luminance.push(row);
        }

        const detail = [];
        const values = [];
        for (let y = 0; y < size; y += 1) {
          const row = [];
          for (let x = 0; x < size; x += 1) {
            const here = luminance[y][x];
            const right = luminance[y][Math.min(size - 1, x + 1)];
            const down = luminance[Math.min(size - 1, y + 1)][x];
            const delta = Math.abs(here - right) + Math.abs(here - down);
            row.push(delta);
            values.push(delta);
          }
          detail.push(row);
        }

        values.sort((a, b) => a - b);
        const calmThreshold = values[Math.floor(values.length * 0.35)] || 0.12;

        resolve({
          size,
          luminance,
          detail,
          calmThreshold
        });
      } catch (error) {
        resolve(null);
      }
    };

    img.onerror = () => resolve(null);
    img.src = imageUrl;
  });
};

const measureZone = (analysis, zone, dims) => {
  if (!analysis) {
    return { averageLuminance: 0.5, averageDetail: 0.4, calmRatio: 0.5 };
  }

  const xStart = clamp(Math.floor((zone.x / dims.width) * analysis.size), 0, analysis.size - 1);
  const yStart = clamp(Math.floor((zone.y / dims.height) * analysis.size), 0, analysis.size - 1);
  const xEnd = clamp(Math.ceil(((zone.x + zone.width) / dims.width) * analysis.size), xStart + 1, analysis.size);
  const yEnd = clamp(Math.ceil(((zone.y + zone.height) / dims.height) * analysis.size), yStart + 1, analysis.size);

  let luminanceSum = 0;
  let detailSum = 0;
  let calmCount = 0;
  let total = 0;

  for (let y = yStart; y < yEnd; y += 1) {
    for (let x = xStart; x < xEnd; x += 1) {
      const lum = analysis.luminance[y][x];
      const det = analysis.detail[y][x];
      luminanceSum += lum;
      detailSum += det;
      if (det <= analysis.calmThreshold) {
        calmCount += 1;
      }
      total += 1;
    }
  }

  if (!total) {
    return { averageLuminance: 0.5, averageDetail: 0.4, calmRatio: 0.5 };
  }

  return {
    averageLuminance: luminanceSum / total,
    averageDetail: detailSum / total,
    calmRatio: calmCount / total
  };
};

const selectBestZone = (candidates, forbiddenZones, analysis, dims) => {
  let best = null;

  candidates.forEach((candidate) => {
    const area = candidate.width * candidate.height;
    const overlap = forbiddenZones.reduce((acc, zone) => acc + overlapArea(candidate, zone), 0);
    const forbiddenRatio = area > 0 ? overlap / area : 1;

    if (forbiddenRatio >= 0.22) {
      return;
    }

    const metrics = measureZone(analysis, candidate, dims);
    const detailScore = 1 - clamp(metrics.averageDetail * 4.6, 0, 1);
    const score = (metrics.calmRatio * 4.3) + (detailScore * 3.2) - (forbiddenRatio * 8);

    if (!best || score > best.score) {
      best = {
        zone: candidate,
        score,
        metrics
      };
    }
  });

  if (best) {
    return best;
  }

  return {
    zone: candidates[0],
    score: 0,
    metrics: measureZone(analysis, candidates[0], dims)
  };
};

const applyReadabilityFromMetrics = (block, metrics, hasImage) => {
  const luminance = metrics?.averageLuminance;
  const autoColor = typeof luminance === 'number' && luminance > 0.58 ? '#111827' : '#ffffff';
  const readable = getReadableTextStyle(
    {
      ...block,
      colorMode: 'custom',
      color: autoColor,
      backdropMode: 'auto',
      textEffect: 'auto'
    },
    luminance,
    hasImage
  );

  return {
    ...block,
    colorMode: 'custom',
    color: autoColor,
    backdropMode: readable.contrastRatio < 4 ? 'on' : 'auto',
    textEffect: readable.contrastRatio < 3.2 ? 'outline' : 'shadow'
  };
};

export const optimizeNarrativePageLayout = async (page, project, options = {}) => {
  const mode = options.mode || 'full';
  const format = project?.format;
  const dims = getFormatDimensions(format);
  const ageBand = parseAgeBand(project);
  const forbiddenZones = getForbiddenZones(page, dims);
  const imageUrl = resolvePageImageUrl(page);
  const analysis = await loadImageAnalysis(imageUrl);
  const templateZones = getTemplateZones(page.template, format);
  const candidates = buildCandidateZones(page, format);
  const selected = selectBestZone(candidates, forbiddenZones, analysis, dims);

  const textBlocks = (page.textBlocks || []).map((block, index) => {
    const normalized = normalizeTextBlock(block);

    if (normalized.layoutMode === 'manual' && mode !== 'readability') {
      return normalized;
    }

    const zone = mode === 'readability'
      ? {
          x: normalized.x,
          y: normalized.y,
          width: normalized.width,
          height: normalized.height
        }
      : (index === 0 ? selected.zone : templateZones.textZones[Math.min(index, templateZones.textZones.length - 1)] || selected.zone);

    const trimmed = truncateBySentenceCount(normalized.content, ageBand.maxSentences);

    const fitted = autoFitTextBlock(
      {
        ...normalized,
        content: trimmed,
        fontSize: ageBand.baseFontSize,
        lineHeight: ageBand.lineHeight,
        textAlign: normalized.textAlign || ageBand.textAlign,
        layoutMode: normalized.layoutMode === 'manual' ? 'manual' : 'auto'
      },
      zone,
      {
        format,
        minFontSize: ageBand.minFontSize,
        maxFontSize: ageBand.maxFontSize
      }
    );

    return applyReadabilityFromMetrics(fitted, selected.metrics, Boolean(imageUrl));
  });

  return {
    ...page,
    textBlocks
  };
};

export const optimizeNarrativeProjectLayout = async (project, options = {}) => {
  const pages = project?.pages || [];
  const optimizedPages = [];

  for (const page of pages) {
    // eslint-disable-next-line no-await-in-loop
    optimizedPages.push(await optimizeNarrativePageLayout(page, project, options));
  }

  return optimizedPages;
};
