/** @jest-environment node */

import { buildIllustrationConstraintBundle } from './illustrationConstraintBundle';
import { evaluateIllustrationCandidate } from './illustrationEvaluation';
import { buildVisualIdentitySpec } from './visualIdentitySpec';

describe('illustrationEvaluation', () => {
  const spec = buildVisualIdentitySpec({
    project: {
      artStyle: 'aquarelle',
      visualIdentity: {
        stylePrompt: 'soft watercolor illustration, gentle washes, children\'s book style'
      }
    },
    mainCharacterData: {
      name: 'Mia',
      age: '6',
      appearance: 'round face, freckles, brown bob haircut',
      description: 'friendly child with a bright smile',
      clothing: 'yellow raincoat',
      referencePrompt: 'canonical character sheet',
      referenceImagePath: '/tmp/reference.png',
      colorPalette: ['#F2C14E', '#4A90E2']
    }
  });

  const bundle = buildIllustrationConstraintBundle({
    currentProject: {
      pages: [],
      visualIdentitySpec: spec
    },
    page: {
      id: 'page-2',
      number: 2,
      template: 'mixte'
    },
    pageText: 'Mia walks through the rainy village.',
    sceneDescription: 'a rainy village street with warm windows'
  });

  test('returns a weighted V2 evaluation with explicit component scores', () => {
    const evaluation = evaluateIllustrationCandidate({
      revisedPrompt: 'Mia 6-year-old round face freckles brown bob haircut yellow raincoat soft watercolor illustration #F2C14E #4A90E2',
      prompt: 'REFERENCE LOCK: use the selected visual identity image as the canonical visual anchor for every page.',
      promptSections: {},
      promptTrace: {},
      constraintBundle: bundle
    });

    expect(evaluation.evaluationVersion).toBe('2.0');
    expect(evaluation.componentScores.identity).toBeGreaterThan(0.5);
    expect(evaluation.componentScores.style).toBeGreaterThan(0.2);
    expect(evaluation.componentScores.artifacts).toBeGreaterThan(0.7);
    expect(evaluation.futureVisualPreview.hooks.referenceComparisonAvailable).toBe(false);
  });

  test('penalizes identity/style drift and parasite artifacts in the final score', () => {
    const evaluation = evaluateIllustrationCandidate({
      revisedPrompt: 'different face, blue hair, photorealistic, palette chart, character sheet, logo',
      prompt: 'REFERENCE LOCK: use the selected visual identity image as the canonical visual anchor for every page.',
      promptSections: {},
      promptTrace: {},
      constraintBundle: bundle
    });

    expect(evaluation.isConsistent).toBe(false);
    expect(evaluation.componentScores.identity).toBeLessThan(0.3);
    expect(evaluation.componentScores.artifacts).toBeLessThan(0.5);
    expect(evaluation.score).toBeLessThan(0.4);
  });
});
