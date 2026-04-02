const toCleanString = (value) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '');

const toTokenSet = (value) => {
  if (!value || typeof value !== 'string') {
    return [];
  }

  return [...new Set(
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s\-#]/gi, ' ')
      .split(/\s+/)
      .filter((token) => token.length >= 4)
  )];
};

const computeTextContinuityScore = (referenceText, candidateText) => {
  const expected = toTokenSet(referenceText);
  const actual = toTokenSet(candidateText);

  if (expected.length === 0) {
    return 1;
  }

  const matched = expected.filter((token) => actual.includes(token));
  return matched.length / expected.length;
};

export const buildVisualScoringHooks = (constraintBundle) => {
  const continuityReference = toCleanString(constraintBundle?.continuity?.previousRevisedPrompt);

  return {
    referenceComparisonAvailable: false,
    interPageComparisonAvailable: Boolean(continuityReference),
    externalVisualRerankerAvailable: false,
    continuityReference
  };
};

export const getFutureVisualScoringPreview = (constraintBundle, revisedPrompt) => {
  const hooks = buildVisualScoringHooks(constraintBundle);

  return {
    hooks,
    previewScores: {
      referenceImageSimilarity: null,
      interPageSimilarity: hooks.interPageComparisonAvailable
        ? computeTextContinuityScore(hooks.continuityReference, revisedPrompt)
        : null,
      externalRerankerScore: null
    }
  };
};
