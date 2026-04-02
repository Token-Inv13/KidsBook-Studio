export const AUTO_BEST_RESULT_VARIANT_COUNT = 3;
export const AUTO_BEST_RESULT_MAX_CONSISTENCY_ATTEMPTS = 3;
export const AUTO_BEST_RESULT_MAX_BATCH_RETRIES = 1;
export const AUTO_BEST_RESULT_PASS1_BATCH_CANDIDATE_COUNT = 2;
export const AUTO_BEST_RESULT_PASS2_BATCH_CANDIDATE_COUNT = 2;
export const AUTO_BEST_RESULT_PASS2_PAGE_CANDIDATE_COUNT = 2;
export const AUTO_BEST_RESULT_PASS1_ACCEPTANCE_SCORE = 0.74;
export const AUTO_BEST_RESULT_PASS2_ACCEPTANCE_SCORE = 0.68;
export const AUTO_BEST_RESULT_MIN_FACE_SCORE = 0.52;
export const AUTO_BEST_RESULT_MIN_STYLE_SCORE = 0.3;
export const AUTO_BEST_RESULT_MIN_PALETTE_SCORE = 0.3;
export const AUTO_BEST_RESULT_MIN_CLOTHING_SCORE = 0.3;

const getConsistencyScore = (variant) => {
  return Number.isFinite(variant?.consistencyScore) ? variant.consistencyScore : Number.NEGATIVE_INFINITY;
};

const getWeightedPenalty = (variant) => {
  return Number.isFinite(variant?.weightedPenalty)
    ? variant.weightedPenalty
    : Number.isFinite(variant?.consistencyProfile?.weightedPenalty)
      ? variant.consistencyProfile.weightedPenalty
      : 0;
};

const getArtifactCount = (variant) => {
  if (Array.isArray(variant?.detectedNonNarrativeArtifacts)) {
    return variant.detectedNonNarrativeArtifacts.length;
  }

  if (Array.isArray(variant?.consistencyProfile?.detectedNonNarrativeArtifacts)) {
    return variant.consistencyProfile.detectedNonNarrativeArtifacts.length;
  }

  return 0;
};

const getMatchedTokenCount = (variant) => {
  return Array.isArray(variant?.consistencyMatchedTokens)
    ? variant.consistencyMatchedTokens.length
    : 0;
};

const isAnchorRequirementMet = (variant) => {
  if (typeof variant?.consistencyAnchorRequirementMet === 'boolean') {
    return variant.consistencyAnchorRequirementMet;
  }

  if (typeof variant?.consistencyProfile?.anchorRequirementMet === 'boolean') {
    return variant.consistencyProfile.anchorRequirementMet;
  }

  return false;
};

const isConsistent = (variant) => {
  if (typeof variant?.isConsistent === 'boolean') {
    return variant.isConsistent;
  }

  if (typeof variant?.consistencyProfile?.isConsistent === 'boolean') {
    return variant.consistencyProfile.isConsistent;
  }

  return false;
};

export const rankIllustrationVariants = (variants = []) => {
  return variants
    .filter(Boolean)
    .map((variant, index) => ({
      ...variant,
      variantIndex: Number.isInteger(variant?.variantIndex) ? variant.variantIndex : index
    }))
    .sort((left, right) => {
      if (isConsistent(left) !== isConsistent(right)) {
        return Number(isConsistent(right)) - Number(isConsistent(left));
      }

      if (getWeightedPenalty(left) !== getWeightedPenalty(right)) {
        return getWeightedPenalty(left) - getWeightedPenalty(right);
      }

      if (getArtifactCount(left) !== getArtifactCount(right)) {
        return getArtifactCount(left) - getArtifactCount(right);
      }

      if (getConsistencyScore(left) !== getConsistencyScore(right)) {
        return getConsistencyScore(right) - getConsistencyScore(left);
      }

      if (isAnchorRequirementMet(left) !== isAnchorRequirementMet(right)) {
        return Number(isAnchorRequirementMet(right)) - Number(isAnchorRequirementMet(left));
      }

      if (getMatchedTokenCount(left) !== getMatchedTokenCount(right)) {
        return getMatchedTokenCount(right) - getMatchedTokenCount(left);
      }

      return (left.variantIndex || 0) - (right.variantIndex || 0);
    });
};

export const selectBestIllustrationVariant = (variants = []) => {
  const ranked = rankIllustrationVariants(variants);
  return ranked[0] || null;
};
