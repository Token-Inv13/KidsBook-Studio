/** @jest-environment node */

import { buildIllustrationPrompt, validateRevisedPromptConsistency } from './illustrationPromptBuilder';
import { buildVisualIdentitySpec } from './visualIdentitySpec';

describe('illustrationPromptBuilder', () => {
  const project = {
    artStyle: 'aquarelle',
    visualIdentity: {
      stylePrompt: 'soft watercolor illustration, gentle washes, children\'s book style'
    }
  };

  const mainCharacterData = {
    name: 'Mia',
    age: '6',
    appearance: 'round face, freckles, brown bob haircut',
    description: 'friendly child with a bright smile',
    clothing: 'yellow raincoat',
    referencePrompt: 'canonical character sheet',
    referenceImagePath: '/tmp/reference.png',
    colorPalette: ['#F2C14E', '#4A90E2']
  };

  const spec = buildVisualIdentitySpec({
    project,
    mainCharacterData
  });

  test('buildIllustrationPrompt keeps identity blocks ahead of scene blocks and returns trace metadata', () => {
    const result = buildIllustrationPrompt({
      spec,
      page: { number: 4, template: 'mixte' },
      template: 'mixte',
      pageText: 'Mia walks into the forest and finds a tiny lantern.',
      sceneDescription: 'sunny forest clearing with warm light',
      continuityContext: 'previous validated page kept the same outfit',
      retryForConsistency: true,
      safeMode: true
    });

    expect(result.prompt).toContain('VISUAL IDENTITY LOCK');
    expect(result.prompt).toContain('REFERENCE LOCK');
    expect(result.prompt).toContain('STYLE LOCK');
    expect(result.prompt).toContain('PALETTE LOCK');
    expect(result.prompt).toContain('SCENE DIRECTION');
    expect(result.prompt).toContain('PAGE NARRATIVE');
    expect(result.prompt).toContain('FINAL ILLUSTRATION RULE');
    expect(result.prompt).toContain('The image must look like a final children\'s book illustration, not a concept sheet or design board.');
    expect(result.prompt).toContain('GLOBAL NEGATIVE CONSTRAINTS');
    expect(result.prompt.indexOf('VISUAL IDENTITY LOCK')).toBeLessThan(result.prompt.indexOf('SCENE DIRECTION'));
    expect(result.negativePrompt).toContain('different face');
    expect(result.negativePrompt).toContain('No color palette panel');
    expect(result.negativePrompt).toContain('No UI elements');
    expect(result.metadata.identityHash).toMatch(/^[0-9a-f]{8}$/);
    expect(result.metadata.promptTrace.pageNumber).toBe(4);
    expect(result.metadata.promptTrace.referenceImagePath).toBe('/tmp/reference.png');
    expect(result.metadata.promptSections.templatePrompt).toContain('mixed layout');
  });

  test('validateRevisedPromptConsistency rewards stable character and style markers', () => {
    const result = validateRevisedPromptConsistency(
      {
        revisedPrompt: 'Mia 6-year-old round face freckles brown bob haircut yellow raincoat soft watercolor illustration #F2C14E #4A90E2',
        prompt: 'REFERENCE LOCK: use the selected visual identity image as the canonical visual anchor for every page. The main character MUST match the reference image EXACTLY in face, hair, proportions, and style.'
      },
      {
        ...spec,
        mainCharacter: spec.mainCharacter,
        artStyle: spec.artStyle
      }
    );

    expect(result.isConsistent).toBe(true);
    expect(result.flags.faceStable).toBe(true);
    expect(result.flags.styleStable).toBe(true);
    expect(result.flags.paletteAdherence).toBe(true);
    expect(result.groupScores.faceHair.score).toBeGreaterThanOrEqual(0.5);
  });

  test('validateRevisedPromptConsistency rejects obvious style and identity drift', () => {
    const result = validateRevisedPromptConsistency(
      'different face, older child, photorealistic, blue hair, blue outfit, logo',
      {
        ...spec,
        mainCharacter: spec.mainCharacter,
        artStyle: spec.artStyle
      }
    );

    expect(result.isConsistent).toBe(false);
    expect(result.flags.styleStable).toBe(false);
    expect(result.score).toBeLessThan(0.55);
  });

  test('validateRevisedPromptConsistency flags non-narrative design-board artifacts as inconsistent', () => {
    const result = validateRevisedPromptConsistency(
      {
        revisedPrompt: 'Mia round face freckles brown bob haircut yellow raincoat soft watercolor illustration with a palette chart, character sheet grid, and UI elements',
        prompt: 'REFERENCE LOCK: use the selected visual identity image as the canonical visual anchor for every page.'
      },
      {
        ...spec,
        mainCharacter: spec.mainCharacter,
        artStyle: spec.artStyle
      }
    );

    expect(result.isConsistent).toBe(false);
    expect(result.flags.finalIllustrationPresentation).toBe(false);
    expect(result.flags.parasiteElementsDetected).toBe(true);
    expect(result.detectedNonNarrativeArtifacts.map((artifact) => artifact.key)).toEqual(expect.arrayContaining([
      'colorPalettePanel',
      'designSheet',
      'gridLayout',
      'uiElements'
    ]));
    expect(result.score).toBeLessThanOrEqual(0.1);
  });
});
