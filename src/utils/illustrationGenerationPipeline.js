import { buildSceneDescription } from './sceneBuilder';
import { getRecommendedDalleParams } from './imageRatioCalculator';
import { buildIllustrationPrompt, validateRevisedPromptConsistency } from './illustrationPromptBuilder';
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
import { stableHash } from './hash';
import { validateVisualIdentitySpec } from './visualIdentitySpec';

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

const getContinuityContext = (pages, page) => {
  const previousReferencePrompt = (pages || [])
    .filter((candidate) => (candidate.number || 0) < (page.number || 0))
    .sort((a, b) => (b.number || 0) - (a.number || 0))
    .map((candidate) => candidate?.illustration?.revised_prompt || candidate?.illustrationPrompt)
    .find(Boolean);

  return previousReferencePrompt
    ? `Continuity reference from previous validated page: ${String(previousReferencePrompt).replace(/\s+/g, ' ').trim().slice(0, 420)}`
    : '';
};

const createImageRequester = ({ openaiServiceUrl, spec, dalleParams }) => {
  return async (prompt) => {
    const referenceCharacter = spec?.mainCharacter || {};
    const response = await fetch(`${openaiServiceUrl}/api/generate-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        size: dalleParams.size,
        quality: 'standard',
        referenceImageId: referenceCharacter.referenceImageId || 'main-character-reference',
        referenceImagePath: referenceCharacter.referenceImagePath || null
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
  const flags = candidate?.consistencyProfile?.flags || {};
  return Boolean(candidate?.isConsistent)
    && Number(candidate?.consistencyScore || 0) >= minScore
    && flags.faceStable !== false
    && flags.hairstyleStable !== false
    && flags.styleStable !== false
    && flags.paletteStable !== false
    && flags.parasiteElementsDetected !== true;
};

const normalizeVariant = ({
  generated,
  consistency,
  scene,
  dalleParams,
  prompt,
  promptSections,
  promptTrace,
  negativePrompt,
  identityHash,
  referenceImageId,
  variantIndex,
  passName,
  consistencyAttempt,
  safeMode
}) => ({
  url: generated.url,
  variantIndex,
  requestId: generated.requestId || null,
  revised_prompt: generated.revised_prompt,
  referenceImageId,
  generatedAt: new Date().toISOString(),
  sceneDescription: scene,
  dalleParams,
  negativePromptUsed: negativePrompt,
  promptFinal: prompt,
  promptSections,
  promptTrace,
  consistencyProfile: consistency,
  identityHash: promptTrace?.identityHash || identityHash || null,
  isConsistent: consistency.isConsistent,
  consistencyScore: consistency.score,
  weightedPenalty: consistency.weightedPenalty || 0,
  consistencyMatchedTokens: consistency.matchedTokens,
  consistencyAnchorRequirementMet: consistency.anchorRequirementMet,
  consistencyAnchorMatchedTokens: consistency.anchorMatchedTokens,
  consistencyAnchorExpectedTokens: consistency.anchorExpectedTokens,
  detectedNonNarrativeArtifacts: consistency.detectedNonNarrativeArtifacts || [],
  inconsistencyReasons: consistency.inconsistencyReasons || [],
  passName,
  consistencyAttempt,
  safeMode
});

const runCandidate = async ({
  candidateIndex,
  candidateCount,
  passName,
  minAcceptanceScore,
  retryForConsistency,
  strictReferenceMode,
  page,
  pageText,
  scene,
  continuityContext,
  spec,
  requestGeneratedImage,
  dalleParams,
  identityHash,
  maxConsistencyAttempts,
  logPrefix
}) => {
  let bestVariant = null;
  let safeMode = false;
  let lastRequestError = null;

  for (let consistencyAttempt = 0; consistencyAttempt < maxConsistencyAttempts; consistencyAttempt += 1) {
    const { prompt, negativePrompt, promptSections, metadata } = buildIllustrationPrompt({
      spec,
      page,
      template: page.template,
      pageText,
      sceneDescription: scene,
      continuityContext: [
        continuityContext,
        `Pipeline pass ${passName}. Candidate ${candidateIndex + 1}/${candidateCount}.`,
        consistencyAttempt > 0 ? `Consistency retry attempt ${consistencyAttempt + 1}/${maxConsistencyAttempts}.` : '',
        safeMode ? 'Safety mode enabled: child-friendly, fully clothed, no violence, no frightening content.' : ''
      ].filter(Boolean).join(' '),
      retryForConsistency,
      safeMode,
      strongReferenceMode: strictReferenceMode
    });

    let generated;
    try {
      generated = await requestGeneratedImage(prompt);
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

    const consistency = validateRevisedPromptConsistency({
      revisedPrompt: generated.revised_prompt,
      prompt,
      promptSections,
      promptTrace: metadata?.promptTrace || null
    }, spec);

    const variant = normalizeVariant({
      generated,
      consistency,
      scene,
      dalleParams,
      prompt,
      promptSections,
      promptTrace: metadata?.promptTrace || { identityHash: metadata?.identityHash || null },
      negativePrompt,
      identityHash,
      referenceImageId: generated.referenceImageId || spec?.mainCharacter?.referenceImageId || 'main-character-reference',
      variantIndex: candidateIndex,
      passName,
      consistencyAttempt,
      safeMode
    });

    if (!bestVariant || variant.consistencyScore > bestVariant.consistencyScore) {
      bestVariant = variant;
    }

    if (isCandidateAcceptable(variant, minAcceptanceScore)) {
      return {
        bestVariant: variant,
        accepted: true
      };
    }
  }

  if (bestVariant) {
    return {
      bestVariant,
      accepted: false
    };
  }

  throw lastRequestError || new Error(`${logPrefix}: aucune image exploitable générée`);
};

const runPass = async ({
  passName,
  candidateCount,
  minAcceptanceScore,
  retryForConsistency,
  strictReferenceMode,
  context
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
        retryForConsistency,
        strictReferenceMode,
        ...context
      });

      variants.push(result.bestVariant);
      attempts.push({
        passName,
        candidateIndex,
        status: result.accepted ? 'accepted' : 'scored'
      });
    } catch (error) {
      attempts.push({
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
  const specValidation = validateVisualIdentitySpec(currentProject?.visualIdentitySpec);
  if (!specValidation.ok) {
    throw new Error(`visualIdentitySpec invalide: ${specValidation.errors.join(' | ')}`);
  }

  const spec = currentProject.visualIdentitySpec;
  const identityHash = stableHash(spec);
  const identityVersion = spec?.version || null;
  const pageText = getPageText(page);
  const scene = await buildSceneDescription({
    pageText,
    bookSummary: currentProject.summary || currentProject.description,
    characters: currentProject.characters || [],
    targetAge: currentProject.targetAge,
    openaiServiceUrl
  });

  const dalleParams = getRecommendedDalleParams(page, currentProject.bookFormat || currentProject.format || '8x10');
  const continuityContext = getContinuityContext(currentProject.pages, page);
  const requestGeneratedImage = createImageRequester({ openaiServiceUrl, spec, dalleParams });
  const candidateCount = mode === 'batch'
    ? AUTO_BEST_RESULT_PASS1_BATCH_CANDIDATE_COUNT
    : AUTO_BEST_RESULT_VARIANT_COUNT;
  const pass2CandidateCount = mode === 'batch'
    ? AUTO_BEST_RESULT_PASS2_BATCH_CANDIDATE_COUNT
    : AUTO_BEST_RESULT_PASS2_PAGE_CANDIDATE_COUNT;

  const context = {
    page,
    pageText,
    scene,
    continuityContext,
    spec,
    requestGeneratedImage,
    dalleParams,
    identityHash,
    maxConsistencyAttempts: AUTO_BEST_RESULT_MAX_CONSISTENCY_ATTEMPTS,
    logPrefix: `Illustration pipeline page ${page.number}`
  };

  const passResults = [];
  let lastError = null;

  for (let batchAttempt = 0; batchAttempt <= AUTO_BEST_RESULT_MAX_BATCH_RETRIES; batchAttempt += 1) {
    const pass1 = await runPass({
      passName: 'pass-1',
      candidateCount,
      minAcceptanceScore: AUTO_BEST_RESULT_PASS1_ACCEPTANCE_SCORE,
      retryForConsistency: batchAttempt > 0,
      strictReferenceMode: false,
      context
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
        scene,
        dalleParams,
        identityHash,
        identityVersion,
        attempts: passResults.flatMap((result) => result.attempts),
        pipeline: {
          passedIn: 'pass-1',
          passResults
        }
      };
    }

    const pass2 = await runPass({
      passName: 'pass-2',
      candidateCount: pass2CandidateCount,
      minAcceptanceScore: AUTO_BEST_RESULT_PASS2_ACCEPTANCE_SCORE,
      retryForConsistency: true,
      strictReferenceMode: true,
      context
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
          scene,
          dalleParams,
          identityHash,
          identityVersion,
          attempts: passResults.flatMap((result) => result.attempts),
          pipeline: {
            passedIn: pass2.accepted ? 'pass-2' : finalPass.passName,
            passResults
          }
        };
      }
    }

    lastError = new Error(`Aucune illustration acceptable générée pour la page ${page.number} après ${batchAttempt + 1} tentative(s) pipeline.`);
  }

  throw lastError || new Error(`Échec final de génération pour la page ${page.number}`);
}
