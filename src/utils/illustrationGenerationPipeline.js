import { getRecommendedDalleParams } from './imageRatioCalculator';
import { buildSceneDescription } from './sceneBuilder';
import {
  AUTO_BEST_RESULT_MAX_BATCH_RETRIES,
  AUTO_BEST_RESULT_MAX_CONSISTENCY_ATTEMPTS,
  AUTO_BEST_RESULT_MIN_CLOTHING_SCORE,
  AUTO_BEST_RESULT_MIN_FACE_SCORE,
  AUTO_BEST_RESULT_MIN_PALETTE_SCORE,
  AUTO_BEST_RESULT_MIN_STYLE_SCORE,
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
import { electronBridge } from './electronBridge';

const PAGE_MIN_TEXT_LENGTH = 10;
const SAFETY_RETRY_DELAY_MS = 1500;
const IMAGE_REQUEST_TIMEOUT_MS = 150_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getRuntimePipelineConfig = async () => {
  try {
    const flags = await electronBridge.app.getRuntimeFlags();
    if (flags?.isE2E) {
      return {
        isE2E: true,
        maxConsistencyAttempts: 1,
        maxBatchRetries: 0,
        pass1BatchCandidateCount: 1,
        pass2BatchCandidateCount: 1,
        pass2PageCandidateCount: 1,
        variantCount: 1,
        forcedImageSize: '1024x1024'
      };
    }
  } catch (error) {
    console.warn('[illustrationPipeline] Unable to read runtime flags:', error?.message || error);
  }

  return {
    isE2E: false,
    maxConsistencyAttempts: AUTO_BEST_RESULT_MAX_CONSISTENCY_ATTEMPTS,
    maxBatchRetries: AUTO_BEST_RESULT_MAX_BATCH_RETRIES,
    pass1BatchCandidateCount: AUTO_BEST_RESULT_PASS1_BATCH_CANDIDATE_COUNT,
    pass2BatchCandidateCount: AUTO_BEST_RESULT_PASS2_BATCH_CANDIDATE_COUNT,
    pass2PageCandidateCount: AUTO_BEST_RESULT_PASS2_PAGE_CANDIDATE_COUNT,
    variantCount: AUTO_BEST_RESULT_VARIANT_COUNT,
    forcedImageSize: null
  };
};

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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), IMAGE_REQUEST_TIMEOUT_MS);

    let response;
    try {
      response = await fetch(`${openaiServiceUrl}/api/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          size: dalleParams.size,
          quality: 'standard',
          referenceImageId: reference.imageId || 'main-character-reference',
          referenceImagePath: reference.imagePath || null,
          generatorMode: strategyMetadata?.mode || 'text-only'
        }),
        signal: controller.signal
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        const timeoutError = new Error(`Image generation request timed out after ${IMAGE_REQUEST_TIMEOUT_MS}ms`);
        timeoutError.transient = true;
        timeoutError.statusCode = 504;
        throw timeoutError;
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

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
  const groupScores = evaluation?.groupScores || {};

  return Boolean(candidate?.isConsistent)
    && evaluation?.hardRejected !== true
    && Number(candidate?.consistencyScore || 0) >= minScore
    && Number(componentScores.identity || 0) >= 0.66
    && Number(componentScores.style || 0) >= AUTO_BEST_RESULT_MIN_STYLE_SCORE
    && Number(componentScores.palette || 0) >= AUTO_BEST_RESULT_MIN_PALETTE_SCORE
    && Number(componentScores.artifacts || 0) >= 0.7
    && Number(groupScores.faceHair?.score || 0) >= AUTO_BEST_RESULT_MIN_FACE_SCORE
    && Number(groupScores.clothing?.score || 0) >= AUTO_BEST_RESULT_MIN_CLOTHING_SCORE
    && flags.faceStable !== false
    && flags.hairstyleStable !== false
    && flags.styleStable !== false
    && flags.paletteStable !== false
    && flags.parasiteElementsDetected !== true;
};

const shouldEscalateToSafeMode = (candidate, minAcceptanceScore) => {
  const evaluation = candidate?.evaluation || {};
  const componentScores = evaluation?.componentScores || {};
  const groupScores = evaluation?.groupScores || {};
  const flags = evaluation?.flags || {};

  return evaluation?.hardRejected === true
    || Number(candidate?.consistencyScore || 0) < minAcceptanceScore
    || Number(componentScores.identity || 0) < 0.66
    || Number(groupScores.faceHair?.score || 0) < AUTO_BEST_RESULT_MIN_FACE_SCORE
    || Number(groupScores.clothing?.score || 0) < AUTO_BEST_RESULT_MIN_CLOTHING_SCORE
    || flags.faceStable === false
    || flags.hairstyleStable === false
    || flags.parasiteElementsDetected === true;
};

const buildFallbackDecision = (variant, reason, { mode, pageNumber, attempts, pipelineVersion }) => {
  if (!variant) {
    return null;
  }

  const decisionType = variant.safeMode ? 'safe-mode-fallback' : 'fallback';
  const metadata = {
    fallbackAccepted: true,
    fallbackReason: reason,
    finalDecisionType: decisionType
  };

  console.warn(
    `[illustrationPipeline] Page ${pageNumber}: ${reason} -> fallback triggered (${decisionType}), batch continues after fallback.`
  );
  console.info(
    `[illustrationPipeline] Page ${pageNumber}: fallback accepted with score=${Number(variant.consistencyScore || 0).toFixed(3)} safeMode=${variant.safeMode ? 'true' : 'false'} mode=${mode}.`
  );

  return {
    selectedVariant: {
      ...variant,
      ...metadata
    },
    fallbackAccepted: true,
    fallbackReason: reason,
    finalDecisionType: decisionType,
    attempts,
    pipelineVersion
  };
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
  hardRejected: evaluation.hardRejected || false,
  hardRejectSeverity: evaluation.hardRejectSeverity || 'none',
  hardRejectedArtifacts: evaluation.hardRejectedArtifacts || [],
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
      fragileConsistencyMode: safeMode || passName === 'pass-2' || consistencyAttempt > 0,
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

    if (!safeMode && shouldEscalateToSafeMode(variant, minAcceptanceScore)) {
      safeMode = true;
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
  dalleParams,
  maxConsistencyAttempts
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
        maxConsistencyAttempts
      });

      variants.push(result.bestVariant);
      attempts.push({
        stage: 'candidate-generation',
        passName,
        candidateIndex,
        generator: result.bestVariant?.generatorStrategy?.label || null,
        accepted: result.accepted,
        fallbackCandidate: !result.accepted,
        score: result.bestVariant?.consistencyScore ?? null,
        safeMode: Boolean(result.bestVariant?.safeMode),
        hardRejected: Boolean(result.bestVariant?.hardRejected),
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
  const runtimeConfig = await getRuntimePipelineConfig();
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
  const recommendedDalleParams = getRecommendedDalleParams(page, currentProject.bookFormat || currentProject.format || '8x10');
  const dalleParams = {
    ...recommendedDalleParams,
    size: runtimeConfig.forcedImageSize || recommendedDalleParams.size
  };
  const requestGeneratedImage = createImageRequester({
    openaiServiceUrl,
    constraintBundle: preliminaryBundle,
    dalleParams
  });

  const candidateCount = mode === 'batch'
    ? runtimeConfig.pass1BatchCandidateCount
    : runtimeConfig.variantCount;
  const pass2CandidateCount = mode === 'batch'
    ? runtimeConfig.pass2BatchCandidateCount
    : runtimeConfig.pass2PageCandidateCount;

  let finalConstraintBundle = preliminaryBundle;
  const passResults = [];
  let lastError = null;
  let bestFallbackCandidate = null;

  for (let batchAttempt = 0; batchAttempt <= runtimeConfig.maxBatchRetries; batchAttempt += 1) {
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
      dalleParams,
      maxConsistencyAttempts: runtimeConfig.maxConsistencyAttempts
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
        fallbackAccepted: false,
        fallbackReason: null,
        finalDecisionType: 'accepted',
        attempts: passResults.flatMap((result) => result.attempts),
        pipeline: {
          version: '2.5',
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
      dalleParams,
      maxConsistencyAttempts: runtimeConfig.maxConsistencyAttempts
    });
    passResults.push(pass2);

    const finalPass = pass2.bestVariant ? pass2 : pass1.bestVariant ? pass1 : pass2;
    if (finalPass.bestVariant) {
      const variants = finalPass.variants.length > 0 ? finalPass.variants : [finalPass.bestVariant];
      const currentBestFallback = bestFallbackCandidate?.variant
        ? selectBestIllustrationVariant([bestFallbackCandidate.variant, finalPass.bestVariant])
        : finalPass.bestVariant;

      if (currentBestFallback === finalPass.bestVariant) {
        bestFallbackCandidate = {
          variant: finalPass.bestVariant,
          variants,
          passName: finalPass.passName
        };
      }

      const selectedVariant = {
        ...finalPass.bestVariant,
        batchGenerated: mode === 'batch',
        autoSelected: true,
        autoSelectedVariantIndex: finalPass.bestVariant.variantIndex,
        selectionMode: 'auto-best-result',
        variants,
        allVariants: variants
      };

      if (pass2.accepted || batchAttempt >= runtimeConfig.maxBatchRetries) {
        if (!pass2.accepted) {
          const fallbackReason = pass2.variants.length === 0 && pass1.variants.length > 0
            ? 'safe mode produced no strictly acceptable candidate; reusing least bad pass-1 candidate'
            : finalPass.bestVariant.safeMode
              ? 'safe mode fallback accepted'
              : 'all candidates rejected -> fallback triggered';
          const fallbackDecision = buildFallbackDecision(finalPass.bestVariant, fallbackReason, {
            mode,
            pageNumber: page.number,
            attempts: passResults.flatMap((result) => result.attempts),
            pipelineVersion: '2.5'
          });

          return {
            selectedVariant: fallbackDecision.selectedVariant,
            variants,
            scene: selectedVariant.sceneDescription,
            dalleParams,
            identityHash: finalConstraintBundle.identityHash,
            identityVersion: finalConstraintBundle.spec?.version || null,
            fallbackAccepted: fallbackDecision.fallbackAccepted,
            fallbackReason: fallbackDecision.fallbackReason,
            finalDecisionType: fallbackDecision.finalDecisionType,
            attempts: fallbackDecision.attempts,
            pipeline: {
              version: '2.5',
              passedIn: finalPass.passName,
              constraintBundle: summarizeConstraintBundle(finalConstraintBundle),
              passResults
            }
          };
        }

        return {
          selectedVariant,
          variants,
          scene: selectedVariant.sceneDescription,
          dalleParams,
          identityHash: finalConstraintBundle.identityHash,
          identityVersion: finalConstraintBundle.spec?.version || null,
          fallbackAccepted: false,
          fallbackReason: null,
          finalDecisionType: 'accepted',
          attempts: passResults.flatMap((result) => result.attempts),
          pipeline: {
            version: '2.5',
            passedIn: pass2.accepted ? 'pass-2' : finalPass.passName,
            constraintBundle: summarizeConstraintBundle(finalConstraintBundle),
            passResults
          }
        };
      }
    }

    if (batchAttempt >= runtimeConfig.maxBatchRetries && bestFallbackCandidate?.variant) {
      const fallbackReason = bestFallbackCandidate.variant.safeMode
        ? 'safe mode fallback accepted'
        : 'all candidates rejected -> fallback triggered';
      const fallbackDecision = buildFallbackDecision(bestFallbackCandidate.variant, fallbackReason, {
        mode,
        pageNumber: page.number,
        attempts: passResults.flatMap((result) => result.attempts),
        pipelineVersion: '2.5'
      });

      return {
        selectedVariant: fallbackDecision.selectedVariant,
        variants: bestFallbackCandidate.variants,
        scene: bestFallbackCandidate.variant.sceneDescription,
        dalleParams,
        identityHash: finalConstraintBundle.identityHash,
        identityVersion: finalConstraintBundle.spec?.version || null,
        fallbackAccepted: fallbackDecision.fallbackAccepted,
        fallbackReason: fallbackDecision.fallbackReason,
        finalDecisionType: fallbackDecision.finalDecisionType,
        attempts: fallbackDecision.attempts,
        pipeline: {
          version: '2.5',
          passedIn: bestFallbackCandidate.passName,
          constraintBundle: summarizeConstraintBundle(finalConstraintBundle),
          passResults
        }
      };
    }

    lastError = new Error(`Aucune illustration acceptable générée pour la page ${page.number} après ${batchAttempt + 1} tentative(s) pipeline.`);
  }

  throw lastError || new Error(`?chec final de g?n?ration pour la page ${page.number}`);
}
