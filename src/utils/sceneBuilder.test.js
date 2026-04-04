/** @jest-environment node */

import {
  buildSceneBlueprint,
  buildSceneDescription,
  extractVisualElements,
  formatSceneBlueprint,
  validateSceneDescription
} from './sceneBuilder';

describe('sceneBuilder', () => {
  test('buildSceneBlueprint returns a structured scene contract', () => {
    const blueprint = buildSceneBlueprint({
      pageText: 'Mia walks through the forest and finds a tiny lantern.',
      bookSummary: 'A gentle story set in a forest village.',
      characters: [{ name: 'Mia', role: 'hero' }],
      targetAge: '5-7',
      template: 'double-page'
    });

    expect(blueprint.subject).toBe('Mia');
    expect(blueprint.setting).toBe('forest');
    expect(blueprint.composition).toBe('wide panoramic spread');
    expect(formatSceneBlueprint(blueprint)).toContain('SCENE BLUEPRINT');
    expect(formatSceneBlueprint(blueprint)).toContain('subject=Mia');
  });

  test('buildSceneDescription falls back to local prose when OpenAI is unavailable', async () => {
    const result = await buildSceneDescription({
      pageText: 'Mia walks through the forest and finds a tiny lantern.',
      bookSummary: 'A gentle story set in a forest village.',
      characters: [{ name: 'Mia', role: 'hero' }],
      targetAge: '5-7',
      openaiServiceUrl: null,
      template: 'double-page'
    });

    expect(result.blueprint.subject).toBe('Mia');
    expect(result.description).toContain('Mia');
    expect(result.description).toContain('forest');
  });

  test('validateSceneDescription keeps the legacy prose validation', () => {
    const validation = validateSceneDescription('Mia walks through the forest. The light is warm.');

    expect(validation.isValid).toBe(true);
    expect(validation.issues).toEqual([]);
  });

  test('extractVisualElements is accent-insensitive and uses normalized keywords', () => {
    const elements = extractVisualElements('Une forêt mystérieuse entoure la maison.');

    expect(elements.setting).toBe('foret');
    expect(elements.mood).toBe('mysteri');
  });
});
