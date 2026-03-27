import { flattenPage } from './printRenderer';

class FakeCanvasContext {
  constructor(operations) {
    this.operations = operations;
    this.fillStyle = '#000000';
    this.strokeStyle = '';
    this.lineWidth = 0;
    this.font = '16px Arial';
    this.textAlign = 'left';
    this.textBaseline = 'alphabetic';
    this.shadowColor = 'transparent';
    this.shadowBlur = 0;
    this.shadowOffsetX = 0;
    this.shadowOffsetY = 0;
  }

  save() {}

  restore() {}

  beginPath() {}

  moveTo() {}

  lineTo() {}

  quadraticCurveTo() {}

  closePath() {}

  fillRect(x, y, width, height) {
    this.operations.push({
      type: 'fillRect',
      fillStyle: this.fillStyle,
      x,
      y,
      width,
      height
    });
  }

  fill() {
    this.operations.push({
      type: 'fill',
      fillStyle: this.fillStyle
    });
  }

  fillText(text, x, y, maxWidth) {
    this.operations.push({
      type: 'fillText',
      fillStyle: this.fillStyle,
      text,
      x,
      y,
      maxWidth
    });
  }

  strokeText(text, x, y, maxWidth) {
    this.operations.push({
      type: 'strokeText',
      strokeStyle: this.strokeStyle,
      lineWidth: this.lineWidth,
      text,
      x,
      y,
      maxWidth
    });
  }

  measureText(text) {
    return { width: String(text || '').length * 10 };
  }
}

class FakeCanvas {
  constructor() {
    this.operations = [];
    this.context = new FakeCanvasContext(this.operations);
    this.width = 0;
    this.height = 0;
  }

  getContext() {
    return this.context;
  }

  toDataURL() {
    return `data:application/json,${encodeURIComponent(JSON.stringify(this.operations))}`;
  }
}

describe('flattenPage', () => {
  const originalCreateElement = document.createElement.bind(document);

  beforeEach(() => {
    jest.spyOn(document, 'createElement').mockImplementation((tagName, ...args) => {
      if (String(tagName).toLowerCase() === 'canvas') {
        return new FakeCanvas();
      }
      return originalCreateElement(tagName, ...args);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('draws a readable backdrop for white text on a plain page', async () => {
    const dataUrl = await flattenPage(
      {
        pageBackground: { color: '#ffffff' },
        textBlocks: [{
          id: 'block-1',
          content: 'Texte visible',
          x: 36,
          y: 36,
          width: 320,
          height: 140,
          fontSize: 32,
          fontFamily: 'Georgia',
          color: '#ffffff',
          colorMode: 'custom',
          backdropMode: 'on',
          textEffect: 'outline',
          lineHeight: 1.4
        }]
      },
      { width: 8.5, height: 8.5, bleed: 0.125, unit: 'inches' },
      300
    );

    const operations = JSON.parse(decodeURIComponent(dataUrl.split(',')[1]));
    const backdropDraw = operations.find((entry) => entry.type === 'fill' && entry.fillStyle !== '#ffffff');
    const textDraw = operations.find((entry) => entry.type === 'fillText' && entry.text === 'Texte visible');
    const outlineDraw = operations.find((entry) => entry.type === 'strokeText');

    expect(backdropDraw).toBeTruthy();
    expect(textDraw).toBeTruthy();
    expect(textDraw.fillStyle).toBe('#ffffff');
    expect(outlineDraw).toBeTruthy();
  });
});
