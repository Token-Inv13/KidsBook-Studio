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

  const identityScore = clamp(
    ((groupScores.faceHair?.score || 0) * 0.55)
    + ((groupScores.age?.score || 0) * 0.1)
    + ((groupScores.clothing?.score || 0) * 0.2)
    + ((groupScores.referenceLock?.score || 0) * 0.15)
    - explicitPenalty
  );
  const styleScore = clamp(groupScores.style?.score || 0);
  const paletteScore = clamp(groupScores.palette?.score || 0);
  const continuityScore = clamp(
    ((groupScores.referenceLock?.score || 0) * 0.35)
    + (((futureVisualPreview?.previewScores?.interPageSimilarity) ?? 1) * 0.65)
  );
  const artifactScore = clamp(1 - Math.min(1, (artifactCount * 0.25) + explicitPenalty + (consistencyProfile?.weightedPenalty || 0) * 0.15));

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
  const finalScore = clamp(
    (componentScores.identity * 0.34)
    + (componentScores.style * 0.18)
    + (componentScores.palette * 0.12)
    + (componentScores.continuity * 0.16)
    + (componentScores.artifacts * 0.2)
  );

  return {
    ...consistencyProfile,
    score: roundScore(finalScore),
    componentScores,
    futureVisualPreview,
    evaluationVersion: '2.0'
  };
};
