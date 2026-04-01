export const AUTO_BEST_RESULT_VARIANT_COUNT = 4;
export const AUTO_BEST_RESULT_MAX_CONSISTENCY_ATTEMPTS = 3;
export const AUTO_BEST_RESULT_MAX_BATCH_RETRIES = 1;

const getConsistencyScore = (variant) => {
  return Number.isFinite(variant?.consistencyScore) ? variant.consistencyScore : Number.NEGATIVE_INFINITY;
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
