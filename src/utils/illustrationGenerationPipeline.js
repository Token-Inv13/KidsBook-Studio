import { getRecommendedDalleParams } from './imageRatioCalculator';
import { buildSceneDescription } from './sceneBuilder';
import {
  AUTO_BEST_RESULT_MAX_BATCH_RETRIES,
  AUTO_BEST_RESULT_MAX_CONSISTENCY_ATTEMPTS,
  AUTO_BEST_RESULT_PASS1_ACCEPTANCE_SCORE,
  AUTO_BEST_RESULT_PASS1_BATCH_CANDIDATE_COUNT,
  AUTO_BEST_RESULT_PASS2_ACCEPTANCE_SCORE,
  AUTO_BEST_RESULT_PASS2_BATCH_CANDIDATE_COUNT,
  AUTO_BEST_RESULT_PASS2_PAGE_CANDIDATE_COUNT,
  AUTO_BEST_RESULT_VARIANT_COUNT,
  selectBestIllustrationVariant
} from './illustrationAutoPipeline';
import { buildIllustrationConstraintBundle, summarizeConstraintBundle } from './illustrationConstraintBundle';
import { evaluateIllustrationCandidate } from './illustrationEvaluation';
import { prepareGeneratorRequest, selectGeneratorStrategy } from './illustrationGeneratorStrategies';

const PAGE_MIN_TEXT_LENGTH = 10;
const SAFETY_RETRY_DELAY_MS = 1500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getPageText = (page) => {
  if (!page?.textBlocks || !Array.isArray(page.textBlocks)) {
    throw new Error(`Page ${page?.number} n'a pas de blocs de texte`);
  }

  const pageText = page.textBlocks
    .filter((block) => block && block.content)
    .map((block) => block.content)
    .join(' ')
    .trim();

  if (!pageText || pageText.length < PAGE_MIN_TEXT_LENGTH) {
    throw new Error(`Page ${page?.number} n'a pas assez de texte (minimum ${PAGE_MIN_TEXT_LENGTH} caractères)`);
  }

  return pageText;
};

const createImageRequester = ({ openaiServiceUrl, constraintBundle, dalleParams }) => {
  return async ({ prompt, strategyMetadata }) => {
    const reference = constraintBundle?.reference || {};
    const response = await fetch(`${openaiServiceUrl}/api/generate-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        size: dalleParams.size,
        quality: 'standard',
        referenceImageId: reference.imageId || 'main-character-reference',
        referenceImagePath: reference.imagePath || null,
        generatorMode: strategyMetadata?.mode || 'text-only'
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const statusCode = payload.statusCode || response.status;
      const requestId = payload.requestId ? ` [req:${payload.requestId}]` : '';
      const baseMessage = payload.error || `Erreur lors de la génération (${statusCode})`;
      const error = new Error(`${baseMessage}${requestId}`);
      error.transient = statusCode >= 500 || statusCode === 429;
      error.statusCode = statusCode;
      throw error;
    }

    return payload;
  };
};

const isModerationBlocked = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return Number(error?.statusCode) === 400
    && (message.includes('content filter') || message.includes('safety system'));
};

const isCandidateAcceptable = (candidate, minScore) => {
  const evaluation = candidate?.evaluation || {};
  const flags = evaluation?.flags || {};
  const componentScores = evaluation?.componentScores || {};

  return Boolean(candidate?.isConsistent)
    && Number(candidate?.consistencyScore || 0) >= minScore
    && Number(componentScores.identity || 0) >= 0.5
    && Number(componentScores.style || 0) >= 0.25
    && Number(componentScores.palette || 0) >= 0.2
    && Number(componentScores.artifacts || 0) >= 0.6
    && flags.faceStable !== false
    && flags.hairstyleStable !== false
    && flags.styleStable !== false
    && flags.paletteStable !== false
    && flags.parasiteElementsDetected !== true;
};

const normalizeVariant = ({
  generated,
  evaluation,
  prompt,
  promptSections,
  promptTrace,
  negativePrompt,
  strategy,
  constraintBundle,
  dalleParams,
  variantIndex,
  passName,
  consistencyAttempt,
  safeMode
}) => ({
  url: generated.url,
  variantIndex,
  requestId: generated.requestId || null,
  revised_prompt: generated.revised_prompt,
  referenceImageId: generated.referenceImageId || constraintBundle?.reference?.imageId || 'main-character-reference',
  generatedAt: new Date().toISOString(),
  sceneDescription: constraintBundle?.page?.sceneDescription || '',
  dalleParams,
  negativePromptUsed: negativePrompt,
  promptFinal: prompt,
  promptSections,
  promptTrace,
  generatorStrategy: strategy,
  constraintBundleSummary: summarizeConstraintBundle(constraintBundle),
  consistencyProfile: evaluation,
  evaluation,
  identityHash: promptTrace?.identityHash || constraintBundle?.identityHash || null,
  isConsistent: evaluation.isConsistent,
  consistencyScore: evaluation.score,
  weightedPenalty: evaluation.weightedPenalty || 0,
  consistencyMatchedTokens: evaluation.matchedTokens,
  consistencyAnchorRequirementMet: evaluation.anchorRequirementMet,
  consistencyAnchorMatchedTokens: evaluation.anchorMatchedTokens,
  consistencyAnchorExpectedTokens: evaluation.anchorExpectedTokens,
  detectedNonNarrativeArtifacts: evaluation.detectedNonNarrativeArtifacts || [],
  inconsistencyReasons: evaluation.inconsistencyReasons || [],
  passName,
  consistencyAttempt,
  safeMode
});

const runCandidate = async ({
  candidateIndex,
  candidateCount,
  passName,
  minAcceptanceScore,
  constraintBundle,
  requestGeneratedImage,
  dalleParams,
  maxConsistencyAttempts
}) => {
  const strategy = selectGeneratorStrategy({ passName });
  let bestVariant = null;
  let safeMode = false;
  let lastRequestError = null;

  for (let consistencyAttempt = 0; consistencyAttempt < maxConsistencyAttempts; consistencyAttempt += 1) {
    const { prompt, negativePrompt, promptSections, metadata, strategyMetadata } = prepareGeneratorRequest({
      constraintBundle,
      strategy,
      safeMode,
      consistencyAttempt,
      candidateIndex,
      candidateCount,
      maxConsistencyAttempts
    });

    let generated;
    try {
      generated = await requestGeneratedImage({
        prompt,
        strategyMetadata
      });
    } catch (requestError) {
      lastRequestError = requestError;
      if (isModerationBlocked(requestError) && !safeMode) {
        safeMode = true;
      }

      if (requestError.transient && consistencyAttempt < maxConsistencyAttempts - 1) {
        await sleep(SAFETY_RETRY_DELAY_MS);
        continue;
      }

      if (consistencyAttempt >= maxConsistencyAttempts - 1) {
        throw requestError;
      }
      continue;
    }

    const evaluation = evaluateIllustrationCandidate({
      revisedPrompt: generated.revised_prompt,
      prompt,
      promptSections,
      promptTrace: metadata?.promptTrace || null,
      constraintBundle
    });

    const variant = normalizeVariant({
      generated,
      evaluation,
      prompt,
      promptSections,
      promptTrace: metadata?.promptTrace || { identityHash: metadata?.identityHash || null },
      negativePrompt,
      strategy: strategyMetadata,
      constraintBundle,
      dalleParams,
      variantIndex: candidateIndex,
      passName,
      consistencyAttempt,
      safeMode
    });

    if (!bestVariant || variant.consistencyScore > bestVariant.consistencyScore) {
      bestVariant = variant;
    }

    if (isCandidateAcceptable(variant, minAcceptanceScore)) {
      return { bestVariant: variant, accepted: true };
    }
  }

  if (bestVariant) {
    return { bestVariant, accepted: false };
  }

  throw lastRequestError || new Error(`Illustration pipeline page ${constraintBundle?.page?.number}: aucune image exploitable générée`);
};

const runPass = async ({
  passName,
  candidateCount,
  minAcceptanceScore,
  constraintBundle,
  requestGeneratedImage,
  dalleParams
}) => {
  const variants = [];
  const attempts = [];

  for (let candidateIndex = 0; candidateIndex < candidateCount; candidateIndex += 1) {
    try {
      const result = await runCandidate({
        candidateIndex,
        candidateCount,
        passName,
        minAcceptanceScore,
        constraintBundle,
        requestGeneratedImage,
        dalleParams,
        maxConsistencyAttempts: AUTO_BEST_RESULT_MAX_CONSISTENCY_ATTEMPTS
      });

      variants.push(result.bestVariant);
      attempts.push({
        stage: 'candidate-generation',
        passName,
        candidateIndex,
        generator: result.bestVariant?.generatorStrategy?.label || null,
        accepted: result.accepted,
        score: result.bestVariant?.consistencyScore ?? null,
        status: result.accepted ? 'accepted' : 'scored'
      });
    } catch (error) {
      attempts.push({
        stage: 'candidate-generation',
        passName,
        candidateIndex,
        status: 'failed',
        error: error?.message || 'Unknown error'
      });
    }
  }

  const bestVariant = selectBestIllustrationVariant(variants);
  return {
    passName,
    variants,
    attempts,
    bestVariant,
    accepted: isCandidateAcceptable(bestVariant, minAcceptanceScore)
  };
};

export async function generateIllustrationWithAutoPipeline({
  currentProject,
  page,
  openaiServiceUrl,
  mode = 'page'
}) {
  const pageText = getPageText(page);
  const sceneDescription = await buildSceneDescription({
    pageText,
    bookSummary: currentProject.summary || currentProject.description,
    characters: currentProject.characters || [],
    targetAge: currentProject.targetAge,
    openaiServiceUrl
  });

  const preliminaryBundle = buildIllustrationConstraintBundle({
    currentProject,
    page,
    pageText,
    sceneDescription
  });
  const dalleParams = getRecommendedDalleParams(page, currentProject.bookFormat || currentProject.format || '8x10');
  const requestGeneratedImage = createImageRequester({
    openaiServiceUrl,
    constraintBundle: preliminaryBundle,
    dalleParams
  });

  const candidateCount = mode === 'batch'
    ? AUTO_BEST_RESULT_PASS1_BATCH_CANDIDATE_COUNT
    : AUTO_BEST_RESULT_VARIANT_COUNT;
  const pass2CandidateCount = mode === 'batch'
    ? AUTO_BEST_RESULT_PASS2_BATCH_CANDIDATE_COUNT
    : AUTO_BEST_RESULT_PASS2_PAGE_CANDIDATE_COUNT;

  let finalConstraintBundle = preliminaryBundle;
  const passResults = [];
  let lastError = null;

  for (let batchAttempt = 0; batchAttempt <= AUTO_BEST_RESULT_MAX_BATCH_RETRIES; batchAttempt += 1) {
    finalConstraintBundle = buildIllustrationConstraintBundle({
      currentProject,
      page,
      pageText,
      sceneDescription: finalConstraintBundle?.page?.sceneDescription || sceneDescription
    });

    const pass1 = await runPass({
      passName: 'pass-1',
      candidateCount,
      minAcceptanceScore: AUTO_BEST_RESULT_PASS1_ACCEPTANCE_SCORE,
      constraintBundle: finalConstraintBundle,
      requestGeneratedImage,
      dalleParams
    });
    passResults.push(pass1);

    if (pass1.accepted && pass1.bestVariant) {
      const selectedVariant = {
        ...pass1.bestVariant,
        batchGenerated: mode === 'batch',
        autoSelected: true,
        autoSelectedVariantIndex: pass1.bestVariant.variantIndex,
        selectionMode: 'auto-best-result',
        variants: pass1.variants,
        allVariants: pass1.variants
      };

      return {
        selectedVariant,
        variants: pass1.variants,
        scene: selectedVariant.sceneDescription,
        dalleParams,
        identityHash: finalConstraintBundle.identityHash,
        identityVersion: finalConstraintBundle.spec?.version || null,
        attempts: passResults.flatMap((result) => result.attempts),
        pipeline: {
          version: '2.0',
          passedIn: 'pass-1',
          constraintBundle: summarizeConstraintBundle(finalConstraintBundle),
          passResults
        }
      };
    }

    const pass2 = await runPass({
      passName: 'pass-2',
      candidateCount: pass2CandidateCount,
      minAcceptanceScore: AUTO_BEST_RESULT_PASS2_ACCEPTANCE_SCORE,
      constraintBundle: finalConstraintBundle,
      requestGeneratedImage,
      dalleParams
    });
    passResults.push(pass2);

    const finalPass = pass2.bestVariant ? pass2 : pass1.bestVariant ? pass1 : pass2;
    if (finalPass.bestVariant) {
      const variants = finalPass.variants.length > 0 ? finalPass.variants : [finalPass.bestVariant];
      const selectedVariant = {
        ...finalPass.bestVariant,
        batchGenerated: mode === 'batch',
        autoSelected: true,
        autoSelectedVariantIndex: finalPass.bestVariant.variantIndex,
        selectionMode: 'auto-best-result',
        variants,
        allVariants: variants
      };

      if (pass2.accepted || batchAttempt >= AUTO_BEST_RESULT_MAX_BATCH_RETRIES) {
        return {
          selectedVariant,
          variants,
          scene: selectedVariant.sceneDescription,
          dalleParams,
          identityHash: finalConstraintBundle.identityHash,
          identityVersion: finalConstraintBundle.spec?.version || null,
          attempts: passResults.flatMap((result) => result.attempts),
          pipeline: {
            version: '2.0',
            passedIn: pass2.accepted ? 'pass-2' : finalPass.passName,
            constraintBundle: summarizeConstraintBundle(finalConstraintBundle),
            passResults
          }
        };
      }
    }

    lastError = new Error(`Aucune illustration acceptable générée pour la page ${page.number} après ${batchAttempt + 1} tentative(s) pipeline.`);
  }

  throw lastError || new Error(`Échec final de génération pour la page ${page.number}`);
}
