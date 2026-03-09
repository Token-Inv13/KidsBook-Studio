/** @jest-environment node */

import {
  autoFitTextBlock,
  autoLayoutPage,
  createPageFromTemplate,
  getAdjacentSpreadPageId,
  getFormatDimensions,
  getPagePositionFromNumber,
  getSpreadPages,
  getTemplateZones
} from './writingLayout';

describe('writingLayout UX V1.6', () => {
  const formatInches = { width: 8.5, height: 8.5, unit: 'in', bleed: true };
  const formatMM = { width: 216, height: 216, unit: 'mm', bleed: false };

  test('1) getFormatDimensions returns inch-based dimensions', () => {
    const dims = getFormatDimensions(formatInches);
    expect(dims.width).toBeCloseTo(816, 0);
    expect(dims.height).toBeCloseTo(816, 0);
  });

  test('2) getFormatDimensions converts mm to px', () => {
    const dims = getFormatDimensions(formatMM);
    expect(dims.width).toBeGreaterThan(800);
    expect(dims.height).toBeGreaterThan(800);
  });

  test('3) getPagePositionFromNumber maps odd page to right', () => {
    expect(getPagePositionFromNumber(1)).toBe('right');
    expect(getPagePositionFromNumber(3)).toBe('right');
  });

  test('4) getPagePositionFromNumber maps even page to left', () => {
    expect(getPagePositionFromNumber(2)).toBe('left');
    expect(getPagePositionFromNumber(8)).toBe('left');
  });

  test('5) illustration-pleine template creates image and text zone', () => {
    const zones = getTemplateZones('illustration-pleine', formatInches);
    expect(zones.imageZones.length).toBe(1);
    expect(zones.textZones.length).toBe(1);
  });

  test('6) texte-court template creates centered text zone only', () => {
    const zones = getTemplateZones('texte-court', formatInches);
    expect(zones.imageZones.length).toBe(0);
    expect(zones.textZones.length).toBe(1);
  });

  test('7) mixte template creates one image and one text zone', () => {
    const zones = getTemplateZones('mixte', formatInches);
    expect(zones.imageZones.length).toBe(1);
    expect(zones.textZones.length).toBe(1);
  });

  test('8) double-page template creates full image zone and overlay text zone', () => {
    const zones = getTemplateZones('double-page', formatInches);
    expect(zones.imageZones.length).toBe(1);
    expect(zones.textZones.length).toBe(1);
  });

  test('9) createPageFromTemplate includes default text block', () => {
    const page = createPageFromTemplate('mixte', 5, formatInches);
    expect(page.template).toBe('mixte');
    expect(page.textBlocks.length).toBe(1);
  });

  test('10) createPageFromTemplate computes page position from page number', () => {
    const page = createPageFromTemplate('mixte', 6, formatInches);
    expect(page.position).toBe('left');
  });

  test('11) autoFitTextBlock reduces font size when overflowing', () => {
    const block = { content: 'x'.repeat(1200), fontSize: 20 };
    const zone = { x: 10, y: 10, width: 220, height: 80 };
    const fitted = autoFitTextBlock(block, zone, { minFontSize: 12 });
    expect(fitted.fontSize).toBeLessThanOrEqual(20);
  });

  test('12) autoFitTextBlock marks overflowWarning when still overflowing at min size', () => {
    const block = { content: 'x'.repeat(4000), fontSize: 18 };
    const zone = { x: 10, y: 10, width: 160, height: 50 };
    const fitted = autoFitTextBlock(block, zone, { minFontSize: 12 });
    expect(fitted.overflowWarning).toBe(true);
  });

  test('13) autoFitTextBlock keeps placement aligned to provided zone', () => {
    const block = { content: 'Texte court', fontSize: 16 };
    const zone = { x: 40, y: 100, width: 300, height: 140 };
    const fitted = autoFitTextBlock(block, zone);
    expect(fitted.x).toBe(40);
    expect(fitted.y).toBe(100);
  });

  test('14) autoLayoutPage applies zone sizing to all text blocks', () => {
    const page = {
      id: 'p1',
      template: 'mixte',
      textBlocks: [
        { id: 'b1', content: 'Hello', fontSize: 16, width: 20, height: 20 },
        { id: 'b2', content: 'World', fontSize: 16, width: 20, height: 20 }
      ]
    };

    const laidOut = autoLayoutPage(page, formatInches);
    expect(laidOut.textBlocks[0].width).toBeGreaterThan(20);
    expect(laidOut.textBlocks[1].height).toBeGreaterThan(20);
  });

  test('15) getSpreadPages returns correct right/left pages for selected spread', () => {
    const pages = [
      { id: 'p1', number: 1 },
      { id: 'p2', number: 2 },
      { id: 'p3', number: 3 },
      { id: 'p4', number: 4 }
    ];

    const spread = getSpreadPages(pages, 'p3');
    expect(spread.rightPage.number).toBe(3);
    expect(spread.leftPage.number).toBe(2);
  });

  test('16) getSpreadPages handles missing selected page by defaulting to first spread', () => {
    const pages = [{ id: 'p1', number: 1 }, { id: 'p2', number: 2 }, { id: 'p3', number: 3 }];
    const spread = getSpreadPages(pages, 'unknown');
    expect(spread.rightPage.number).toBe(3);
    expect(spread.leftPage.number).toBe(2);
  });

  test('17) getAdjacentSpreadPageId returns next spread id', () => {
    const pages = [
      { id: 'p1', number: 1 },
      { id: 'p2', number: 2 },
      { id: 'p3', number: 3 },
      { id: 'p4', number: 4 },
      { id: 'p5', number: 5 }
    ];

    const next = getAdjacentSpreadPageId(pages, 'p2', 'next');
    expect(next).toBe('p5');
  });

  test('18) getAdjacentSpreadPageId returns previous spread id', () => {
    const pages = [
      { id: 'p1', number: 1 },
      { id: 'p2', number: 2 },
      { id: 'p3', number: 3 },
      { id: 'p4', number: 4 },
      { id: 'p5', number: 5 }
    ];

    const prev = getAdjacentSpreadPageId(pages, 'p5', 'prev');
    expect(prev).toBe('p3');
  });

  test('19) getAdjacentSpreadPageId keeps current id at upper boundary', () => {
    const pages = [{ id: 'p1', number: 1 }, { id: 'p2', number: 2 }, { id: 'p3', number: 3 }];
    const next = getAdjacentSpreadPageId(pages, 'p2', 'next');
    expect(next).toBe('p2');
  });

  test('20) autoLayoutPage preserves text content while applying auto fit', () => {
    const page = {
      id: 'p9',
      template: 'illustration-pleine',
      textBlocks: [{ id: 'b9', content: 'Mon texte narratif', fontSize: 18 }]
    };

    const laidOut = autoLayoutPage(page, formatInches);
    expect(laidOut.textBlocks[0].content).toBe('Mon texte narratif');
    expect(typeof laidOut.textBlocks[0].overflowWarning).toBe('boolean');
  });
});
