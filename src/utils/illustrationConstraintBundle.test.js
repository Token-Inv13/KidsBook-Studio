/** @jest-environment node */

import { buildIllustrationConstraintBundle, summarizeConstraintBundle } from './illustrationConstraintBundle';
import { buildVisualIdentitySpec } from './visualIdentitySpec';

describe('illustrationConstraintBundle', () => {
  test('builds a guided constraint bundle from the validated visual identity and continuity context', () => {
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
        summary: 'A gentle story',
        pages: [
          {
            number: 1,
            illustration: {
              revised_prompt: 'Mia round face freckles brown bob haircut yellow raincoat soft watercolor illustration'
            }
          }
        ],
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

    const summary = summarizeConstraintBundle(bundle);

    expect(bundle.reference.hasReferenceImage).toBe(true);
    expect(bundle.reference.derivedDescriptor).toContain('canonical character sheet');
    expect(bundle.sceneSpec).toBeNull();
    expect(bundle.generationPolicy).toBeDefined();
    expect(bundle.continuity.previousPageNumber).toBe(1);
    expect(bundle.futureVisualScoring.referenceComparisonReady).toBe(true);
    expect(summary.referenceImageId).toBe('main-character-reference');
    expect(summary.characterReferenceCount).toBeGreaterThanOrEqual(1);
    expect(summary.generationPolicy.allowProviderFallback).toBe(false);
    expect(summary.continuityFromPage).toBe(1);
  });
});
