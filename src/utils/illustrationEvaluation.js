import { validateRevisedPromptConsistency } from './illustrationPromptBuilder';
import { getFutureVisualScoringPreview } from './illustrationVisualScoring';

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const roundScore = (value) => Math.round(clamp(value) * 1000) / 1000;

const buildComponentScores = (consistencyProfile, futureVisualPreview) => {
  const groupScores = consistencyProfile?.groupScores || {};
  const explicitPenalty = Array.isArray(consistencyProfile?.explicitDriftPenalties)
    ? consistencyProfile.explicitDriftPenalties.reduce((sum, entry) => sum + (entry.penalty || 0), 0)
    : 0;
  const artifactCount = Array.isArray(consistencyProfile?.detectedNonNarrativeArtifacts)
    ? consistencyProfile.detectedNonNarrativeArtifacts.length
    : 0;
  const hardRejectPenalty = consistencyProfile?.hardRejected ? 1 : 0;

  const identityScore = clamp(
    ((groupScores.faceHair?.score || 0) * 0.64)
    + ((groupScores.age?.score || 0) * 0.08)
    + ((groupScores.clothing?.score || 0) * 0.16)
    + ((groupScores.referenceLock?.score || 0) * 0.12)
    - explicitPenalty
    - (hardRejectPenalty * 0.45)
  );
  const styleScore = clamp(groupScores.style?.score || 0);
  const paletteScore = clamp(groupScores.palette?.score || 0);
  const continuityScore = clamp(
    ((groupScores.referenceLock?.score || 0) * 0.35)
    + (((futureVisualPreview?.previewScores?.interPageSimilarity) ?? 1) * 0.65)
  );
  const artifactScore = consistencyProfile?.hardRejected
    ? 0
    : clamp(1 - Math.min(1, (artifactCount * 0.3) + explicitPenalty + (consistencyProfile?.weightedPenalty || 0) * 0.18));

  return {
    identity: roundScore(identityScore),
    style: roundScore(styleScore),
    palette: roundScore(paletteScore),
    continuity: roundScore(continuityScore),
    artifacts: roundScore(artifactScore)
  };
};

export const evaluateIllustrationCandidate = ({
  revisedPrompt,
  prompt,
  promptSections,
  promptTrace,
  constraintBundle
}) => {
  const consistencyProfile = validateRevisedPromptConsistency({
    revisedPrompt,
    prompt,
    promptSections,
    promptTrace
  }, constraintBundle?.spec);
  const futureVisualPreview = getFutureVisualScoringPreview(constraintBundle, revisedPrompt);
  const componentScores = buildComponentScores(consistencyProfile, futureVisualPreview);
  const baseFinalScore = clamp(
    (componentScores.identity * 0.5)
    + (componentScores.style * 0.14)
    + (componentScores.palette * 0.08)
    + (componentScores.continuity * 0.12)
    + (componentScores.artifacts * 0.16)
  );
  const finalScore = consistencyProfile?.hardRejected ? 0 : baseFinalScore;

  return {
    ...consistencyProfile,
    score: roundScore(finalScore),
    componentScores,
    futureVisualPreview,
    evaluationVersion: '2.5'
  };
};
