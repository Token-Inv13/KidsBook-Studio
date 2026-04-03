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
import {
  fallbackImageProvider,
  imageProviderIdeogram,
  imageProviderOpenAI,
  selectPrimaryImageProvider
} from './imageProviders';
import { electronBridge } from './electronBridge';
import { createTransientOpenAIError, waitForOpenAIServiceReady } from './openaiServiceGuard';
import { createTransientIdeogramError, waitForIdeogramServiceReady } from './ideogramServiceGuard';

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

const normalizeProviderImagePayload = (payload, fallback = {}) => {
  const images = Array.isArray(payload?.images) ? payload.images : [];
  const firstImage = images[0] || {};

  return {
    url: payload?.url || firstImage.url || null,
    revised_prompt: payload?.revised_prompt || firstImage.revised_prompt || firstImage.prompt || fallback.prompt || '',
    requestId: payload?.requestId || fallback.requestId || null,
    images: images.length > 0 ? images : (payload?.url ? [{ url: payload.url }] : [])
  };
};

const createProviderRequestRunner = ({
  provider,
  providerId,
  dalleParams,
  operation = 'generate'
}) => {
  const isTransientStatus = (statusCode) => {
    const numericStatus = Number(statusCode) || 0;
    return numericStatus >= 500 || numericStatus === 429 || numericStatus === 503 || numericStatus === 504;
  };

  return async ({ prompt, strategyMetadata, mode, candidateIndex, selectedImage, variantIndex, constraintBundle }) => {
    const activeConstraintBundle = constraintBundle || {};
    const reference = activeConstraintBundle?.reference || {};
    const referenceImage = selectedImage || reference.imagePath || reference.imageUrl || null;
    const requestOptions = {
      prompt,
      dalleParams,
      constraintBundle: {
        ...activeConstraintBundle,
        selectedImage
      },
      strategyMetadata,
      referenceImageId: reference.imageId || 'main-character-reference',
      referenceImagePath: reference.imagePath || null,
      selectedImage,
      variantIndex: Number.isInteger(variantIndex) ? variantIndex : candidateIndex || 0,
      mode
    };

    if (providerId === 'ideogram') {
      requestOptions.constraintBundle = {
        ...activeConstraintBundle,
        selectedImage: referenceImage
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), IMAGE_REQUEST_TIMEOUT_MS);

    try {
      const payload = operation === 'remix'
        ? await provider.remixCandidate(requestOptions, { signal: controller.signal })
        : await provider.generateCandidate(requestOptions, { signal: controller.signal });
      return normalizeProviderImagePayload(payload, { prompt });
    } catch (error) {
      if (error?.name === 'AbortError') {
        const timeoutError = new Error(`Image generation request timed out after ${IMAGE_REQUEST_TIMEOUT_MS}ms`);
        timeoutError.transient = true;
        timeoutError.statusCode = 504;
        throw timeoutError;
      }

      if (providerId === 'openai') {
        if (isTransientStatus(error?.statusCode || error?.status)) {
          throw createTransientOpenAIError('Impossible de contacter le service OpenAI pour générer l\'illustration.', error);
        }

        throw error;
      }

      if (isTransientStatus(error?.statusCode || error?.status)) {
        throw createTransientIdeogramError('Impossible de contacter le service Ideogram pour générer l\'illustration.', error);
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
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

const isFallbackEligible = (candidate) => {
  if (!candidate) {
    return false;
  }

  return candidate.hardRejectSeverity !== 'strong'
    && candidate.evaluation?.hardRejectSeverity !== 'strong';
};

const selectBestFallbackVariant = (variants = []) => {
  const preferredFallback = selectBestIllustrationVariant(variants.filter(isFallbackEligible));
  return preferredFallback || selectBestIllustrationVariant(variants);
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
    `[illustrationPipeline] Page ${pageNumber}: ${reason} -> fallback triggered (${decisionType}), fallback used, batch continues after fallback. hardRejectSeverity=${variant.hardRejectSeverity || variant.evaluation?.hardRejectSeverity || 'none'}`
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
  providerId,
  minAcceptanceScore,
  constraintBundle,
  requestGeneratedImage,
  dalleParams,
  maxConsistencyAttempts
}) => {
  const strategy = selectGeneratorStrategy({ passName, providerId });
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
        strategyMetadata,
        constraintBundle
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
  providerId,
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
        providerId,
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
  const bestFallbackVariant = selectBestFallbackVariant(variants);

  if (variants.length === 0) {
    console.warn(
      `[illustrationPipeline] Page ${constraintBundle?.page?.number}: all candidates rejected in ${passName}; no candidate survived request generation.`
    );
  } else if (!isCandidateAcceptable(bestVariant, minAcceptanceScore)) {
    console.warn(
      `[illustrationPipeline] Page ${constraintBundle?.page?.number}: all candidates rejected in ${passName}; bestScore=${Number(bestVariant?.consistencyScore || 0).toFixed(3)} hardRejectSeverity=${bestVariant?.hardRejectSeverity || 'none'}.`
    );
  }

  return {
    passName,
    variants,
    attempts,
    bestVariant,
    bestFallbackVariant,
    accepted: isCandidateAcceptable(bestVariant, minAcceptanceScore)
  };
};

const runRemixPass = async ({
  providerId,
  minAcceptanceScore,
  constraintBundle,
  requestRemixImage,
  dalleParams,
  baseVariant
}) => {
  if (!requestRemixImage || !baseVariant) {
    return null;
  }

  const strategy = selectGeneratorStrategy({ passName: 'pass-2', providerId });
  const { prompt, negativePrompt, promptSections, metadata, strategyMetadata } = prepareGeneratorRequest({
    constraintBundle,
    strategy,
    safeMode: Boolean(baseVariant.safeMode),
    fragileConsistencyMode: true,
    consistencyAttempt: 0,
    candidateIndex: baseVariant.variantIndex ?? 0,
    candidateCount: 1,
    maxConsistencyAttempts: 1
  });

  const generated = await requestRemixImage({
    prompt,
    strategyMetadata,
    mode: 'remix',
    candidateIndex: baseVariant.variantIndex ?? 0,
    selectedImage: baseVariant.url || baseVariant.localPath || baseVariant.originalUrl || constraintBundle?.reference?.imagePath || constraintBundle?.reference?.imageUrl || null,
    variantIndex: baseVariant.variantIndex ?? 0,
    constraintBundle
  });

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
    variantIndex: baseVariant.variantIndex ?? 0,
    passName: 'remix',
    consistencyAttempt: 0,
    safeMode: true
  });

  return {
    variant,
    accepted: isCandidateAcceptable(variant, minAcceptanceScore)
  };
};

export async function generateIllustrationWithAutoPipeline({
  currentProject,
  page,
  openaiServiceUrl,
  ideogramServiceUrl,
  mode = 'page'
}) {
  const runtimeConfig = await getRuntimePipelineConfig();
  await waitForOpenAIServiceReady(openaiServiceUrl);
  const primaryProviderId = selectPrimaryImageProvider({ ideogramServiceUrl, openaiServiceUrl });
  if (primaryProviderId === 'ideogram') {
    await waitForIdeogramServiceReady(ideogramServiceUrl);
  }
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
  const primaryProvider = primaryProviderId === 'ideogram'
    ? imageProviderIdeogram({ serviceUrl: ideogramServiceUrl })
    : imageProviderOpenAI({ serviceUrl: openaiServiceUrl });
  const secondaryProviderId = fallbackImageProvider(primaryProviderId);
  const secondaryProvider = secondaryProviderId === 'ideogram'
    ? imageProviderIdeogram({ serviceUrl: ideogramServiceUrl })
    : secondaryProviderId === 'openai'
      ? imageProviderOpenAI({ serviceUrl: openaiServiceUrl })
      : null;
  const requestGeneratedImage = createProviderRequestRunner({
    provider: primaryProvider,
    providerId: primaryProviderId,
    dalleParams
  });
  const requestRemixImage = primaryProvider.supportsRemix
    ? createProviderRequestRunner({
        provider: primaryProvider,
        providerId: primaryProviderId,
        dalleParams,
        operation: 'remix'
      })
    : null;
  const requestFallbackImage = secondaryProvider
    ? createProviderRequestRunner({
        provider: secondaryProvider,
        providerId: secondaryProviderId,
        dalleParams
      })
    : null;

  const candidateCount = mode === 'batch'
    ? runtimeConfig.pass1BatchCandidateCount
    : runtimeConfig.variantCount;
  const pass2CandidateCount = mode === 'batch'
    ? runtimeConfig.pass2BatchCandidateCount
    : runtimeConfig.pass2PageCandidateCount;
  const maxConsistencyAttempts = mode === 'batch' ? 1 : runtimeConfig.maxConsistencyAttempts;

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
      providerId: primaryProviderId,
      minAcceptanceScore: AUTO_BEST_RESULT_PASS1_ACCEPTANCE_SCORE,
      constraintBundle: finalConstraintBundle,
      requestGeneratedImage,
      dalleParams,
      maxConsistencyAttempts
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
          version: '3.0',
          passedIn: 'pass-1',
          constraintBundle: summarizeConstraintBundle(finalConstraintBundle),
          passResults
        }
      };
    }

    const pass2 = await runPass({
      passName: 'pass-2',
      candidateCount: pass2CandidateCount,
      providerId: primaryProviderId,
      minAcceptanceScore: AUTO_BEST_RESULT_PASS2_ACCEPTANCE_SCORE,
      constraintBundle: finalConstraintBundle,
      requestGeneratedImage,
      dalleParams,
      maxConsistencyAttempts
    });
    passResults.push(pass2);

    if (!pass2.accepted && requestRemixImage) {
      const remixSource = pass2.bestVariant || pass1.bestVariant || null;
      if (remixSource) {
        try {
          const remixResult = await runRemixPass({
            providerId: primaryProviderId,
            minAcceptanceScore: AUTO_BEST_RESULT_PASS2_ACCEPTANCE_SCORE,
            constraintBundle: finalConstraintBundle,
            requestRemixImage,
            dalleParams,
            baseVariant: remixSource
          });

          if (remixResult?.variant) {
            passResults.push({
              passName: 'remix',
              variants: [remixResult.variant],
              attempts: [{
                stage: 'remix',
                providerId: primaryProviderId,
                accepted: remixResult.accepted,
                score: remixResult.variant?.consistencyScore ?? null,
                status: remixResult.accepted ? 'accepted' : 'scored'
              }],
              bestVariant: remixResult.variant,
              bestFallbackVariant: remixResult.variant,
              accepted: remixResult.accepted
            });

            if (remixResult.accepted) {
              const selectedVariant = {
                ...remixResult.variant,
                batchGenerated: mode === 'batch',
                autoSelected: true,
                autoSelectedVariantIndex: remixResult.variant.variantIndex,
                selectionMode: 'auto-best-result',
                variants: [remixResult.variant],
                allVariants: [remixResult.variant]
              };

              return {
                selectedVariant,
                variants: [remixResult.variant],
                scene: selectedVariant.sceneDescription,
                dalleParams,
                identityHash: finalConstraintBundle.identityHash,
                identityVersion: finalConstraintBundle.spec?.version || null,
                fallbackAccepted: false,
                fallbackReason: null,
                finalDecisionType: 'accepted',
                attempts: passResults.flatMap((result) => result.attempts),
                pipeline: {
                  version: '3.0',
                  passedIn: 'remix',
                  constraintBundle: summarizeConstraintBundle(finalConstraintBundle),
                  passResults
                }
              };
            }
          }
        } catch (error) {
          passResults.push({
            passName: 'remix',
            variants: [],
            attempts: [{
              stage: 'remix',
              providerId: primaryProviderId,
              status: 'failed',
              error: error?.message || 'Unknown remix error'
            }],
            bestVariant: null,
            bestFallbackVariant: null,
            accepted: false
          });
        }
      }
    }

    if (!pass2.accepted && requestFallbackImage) {
      const fallbackPass = await runPass({
        passName: 'pass-1',
        candidateCount: 1,
        providerId: secondaryProviderId,
        minAcceptanceScore: AUTO_BEST_RESULT_PASS1_ACCEPTANCE_SCORE,
        constraintBundle: finalConstraintBundle,
        requestGeneratedImage: requestFallbackImage,
        dalleParams,
        maxConsistencyAttempts: 1
      });
      passResults.push(fallbackPass);

      if (fallbackPass.bestVariant) {
        const currentBestFallback = bestFallbackCandidate?.variant
          ? selectBestIllustrationVariant([bestFallbackCandidate.variant, fallbackPass.bestVariant])
          : fallbackPass.bestVariant;

        if (currentBestFallback === fallbackPass.bestVariant) {
          bestFallbackCandidate = {
            variant: fallbackPass.bestVariant,
            variants: fallbackPass.variants,
            passName: secondaryProviderId
          };
        }
      }

      if (fallbackPass.accepted && fallbackPass.bestVariant) {
        const selectedVariant = {
          ...fallbackPass.bestVariant,
          batchGenerated: mode === 'batch',
          autoSelected: true,
          autoSelectedVariantIndex: fallbackPass.bestVariant.variantIndex,
          selectionMode: 'auto-best-result',
          variants: fallbackPass.variants,
          allVariants: fallbackPass.variants
        };

        return {
          selectedVariant,
          variants: fallbackPass.variants,
          scene: selectedVariant.sceneDescription,
          dalleParams,
          identityHash: finalConstraintBundle.identityHash,
          identityVersion: finalConstraintBundle.spec?.version || null,
          fallbackAccepted: true,
          fallbackReason: 'primary provider failed, fallback provider accepted',
          finalDecisionType: 'fallback',
          attempts: passResults.flatMap((result) => result.attempts),
          pipeline: {
            version: '3.0',
            passedIn: secondaryProviderId,
            constraintBundle: summarizeConstraintBundle(finalConstraintBundle),
            passResults
          }
        };
      }
    }

    const finalPass = pass2.bestVariant ? pass2 : pass1.bestVariant ? pass1 : pass2;
    if (finalPass.bestVariant) {
      const variants = finalPass.variants.length > 0 ? finalPass.variants : [finalPass.bestVariant];
      const fallbackSourceVariant = finalPass.bestFallbackVariant || null;
      const currentBestFallback = bestFallbackCandidate?.variant && fallbackSourceVariant
        ? selectBestIllustrationVariant([bestFallbackCandidate.variant, fallbackSourceVariant])
        : (fallbackSourceVariant || bestFallbackCandidate?.variant || null);

      if (currentBestFallback && currentBestFallback === fallbackSourceVariant) {
        bestFallbackCandidate = {
          variant: fallbackSourceVariant,
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
            : (fallbackSourceVariant?.safeMode || bestFallbackCandidate?.variant?.safeMode)
              ? 'safe mode fallback accepted'
              : 'all candidates rejected -> fallback triggered';
          const fallbackDecision = buildFallbackDecision(fallbackSourceVariant || bestFallbackCandidate?.variant, fallbackReason, {
            mode,
            pageNumber: page.number,
            attempts: passResults.flatMap((result) => result.attempts),
            pipelineVersion: '3.0'
          });

          if (!fallbackDecision) {
            console.warn(
              `[illustrationPipeline] Page ${page.number}: all candidates rejected and no fallback-eligible candidate exists.`
            );
          } else {
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
                version: '3.0',
                passedIn: finalPass.passName,
                constraintBundle: summarizeConstraintBundle(finalConstraintBundle),
                passResults
              }
            };
          }
        } else {
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
              version: '3.0',
              passedIn: 'pass-2',
              constraintBundle: summarizeConstraintBundle(finalConstraintBundle),
              passResults
            }
          };
        }
      }

      if (mode === 'batch' && (fallbackSourceVariant || bestFallbackCandidate?.variant)) {
        const fallbackReason = pass2.variants.length === 0 && pass1.variants.length > 0
          ? 'batch mode: safe mode produced no strictly acceptable candidate; using least bad pass-1 candidate'
          : (fallbackSourceVariant?.safeMode || bestFallbackCandidate?.variant?.safeMode)
            ? 'batch mode: safe mode fallback accepted without extra retry loop'
            : 'batch mode: best available candidate accepted as fallback without extra retry loop';
        const fallbackDecision = buildFallbackDecision(fallbackSourceVariant || bestFallbackCandidate?.variant, fallbackReason, {
          mode,
          pageNumber: page.number,
          attempts: passResults.flatMap((result) => result.attempts),
          pipelineVersion: '3.0'
        });

        if (fallbackDecision) {
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
              version: '3.0',
              passedIn: finalPass.passName,
              constraintBundle: summarizeConstraintBundle(finalConstraintBundle),
              passResults
            }
          };
        }
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
        pipelineVersion: '3.0'
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
          version: '3.0',
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
