/** @jest-environment node */

import {
  rankIllustrationVariants,
  selectBestIllustrationVariant
} from './illustrationAutoPipeline';

describe('illustrationAutoPipeline', () => {
  test('prioritizes consistent variants with fewer parasite artifacts', () => {
    const variants = [
      {
        url: 'https://example.com/variant-1.png',
        variantIndex: 0,
        consistencyScore: 0.92,
        weightedPenalty: 0.2,
        isConsistent: true,
        detectedNonNarrativeArtifacts: [{ key: 'gridLayout' }],
        consistencyMatchedTokens: ['mia', 'hair'],
        consistencyAnchorRequirementMet: true
      },
      {
        url: 'https://example.com/variant-2.png',
        variantIndex: 1,
        consistencyScore: 0.88,
        weightedPenalty: 0,
        isConsistent: true,
        detectedNonNarrativeArtifacts: [],
        consistencyMatchedTokens: ['mia', 'hair', 'raincoat'],
        consistencyAnchorRequirementMet: true
      },
      {
        url: 'https://example.com/variant-3.png',
        variantIndex: 2,
        consistencyScore: 0.97,
        weightedPenalty: 0.1,
        isConsistent: false,
        detectedNonNarrativeArtifacts: [],
        consistencyMatchedTokens: ['mia'],
        consistencyAnchorRequirementMet: false
      }
    ];

    const ranked = rankIllustrationVariants(variants);

    expect(ranked[0].url).toBe('https://example.com/variant-2.png');
    expect(ranked[1].url).toBe('https://example.com/variant-1.png');
    expect(ranked[2].url).toBe('https://example.com/variant-3.png');
  });

  test('hard reject artifacts are always ranked behind viable variants', () => {
    const variants = [
      {
        url: 'https://example.com/hard-reject.png',
        variantIndex: 0,
        consistencyScore: 0.99,
        weightedPenalty: 0,
        isConsistent: false,
        hardRejected: true,
        detectedNonNarrativeArtifacts: [{ key: 'designSheet' }]
      },
      {
        url: 'https://example.com/usable.png',
        variantIndex: 1,
        consistencyScore: 0.81,
        weightedPenalty: 0.08,
        isConsistent: true,
        hardRejected: false,
        detectedNonNarrativeArtifacts: []
      }
    ];

    const ranked = rankIllustrationVariants(variants);

    expect(ranked[0].url).toBe('https://example.com/usable.png');
    expect(ranked[1].url).toBe('https://example.com/hard-reject.png');
  });

  test('returns null when no candidate is available', () => {
    expect(selectBestIllustrationVariant([])).toBeNull();
  });
});
