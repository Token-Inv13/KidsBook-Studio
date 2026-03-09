/** @jest-environment node */

import { optimizeNarrativePageLayout, optimizeNarrativeProjectLayout } from './narrativeLayoutEngine';

describe('narrativeLayoutEngine', () => {
  const project = {
    format: { width: 8.5, height: 8.5, unit: 'in', bleed: true },
    targetAge: '3-5'
  };

  test('keeps manual block geometry in full mode', async () => {
    const page = {
      id: 'page-1',
      template: 'mixte',
      textBlocks: [
        {
          id: 'block-1',
          content: 'Texte manuel à conserver.',
          x: 111,
          y: 222,
          width: 260,
          height: 95,
          layoutMode: 'manual',
          fontSize: 16,
          lineHeight: 1.3
        }
      ]
    };

    const optimized = await optimizeNarrativePageLayout(page, project, { mode: 'full' });
    expect(optimized.textBlocks[0].x).toBe(111);
    expect(optimized.textBlocks[0].y).toBe(222);
    expect(optimized.textBlocks[0].width).toBe(260);
    expect(optimized.textBlocks[0].height).toBe(95);
  });

  test('applies age-aware typography and readability fields for auto blocks', async () => {
    const page = {
      id: 'page-2',
      template: 'illustration-pleine',
      textBlocks: [
        {
          id: 'block-2',
          content: 'Première phrase. Deuxième phrase. Troisième phrase.',
          layoutMode: 'auto',
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          fontSize: 14,
          lineHeight: 1.2
        }
      ]
    };

    const optimized = await optimizeNarrativePageLayout(page, project, { mode: 'full' });
    const block = optimized.textBlocks[0];

    expect(block.fontSize).toBeGreaterThanOrEqual(22);
    expect(block.lineHeight).toBeGreaterThanOrEqual(1.5);
    expect(block.colorMode).toBe('custom');
    expect(['shadow', 'outline']).toContain(block.textEffect);
  });

  test('optimizes all pages in project-level API', async () => {
    const pages = [
      {
        id: 'a',
        template: 'mixte',
        textBlocks: [{ id: 'a1', content: 'Page A', layoutMode: 'auto' }]
      },
      {
        id: 'b',
        template: 'mixte',
        textBlocks: [{ id: 'b1', content: 'Page B', layoutMode: 'auto' }]
      }
    ];

    const optimizedPages = await optimizeNarrativeProjectLayout({ ...project, pages }, { mode: 'full' });
    expect(optimizedPages).toHaveLength(2);
    expect(optimizedPages[0].textBlocks[0].content.length).toBeGreaterThan(0);
    expect(optimizedPages[1].textBlocks[0].content.length).toBeGreaterThan(0);
  });
});
