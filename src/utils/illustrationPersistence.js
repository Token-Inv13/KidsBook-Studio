import { electronBridge } from './electronBridge';
import { toFileUrl } from './imageUrlResolver';
import { createProjectImageAsset, PAGE_ILLUSTRATION_ROLE } from './projectSchema';

const DEFAULT_MIN_FILE_SIZE_BYTES = 10 * 1024;

const ensureElectronImagePersistence = (bridge = electronBridge) => {
  if (!(bridge?.isElectronMode?.() && bridge?.fs?.downloadImage && bridge?.fs?.stat)) {
    throw new Error('La validation finale d\'une illustration nécessite l\'application desktop Electron.');
  }
};

const validateDownloadedImageFile = async (filePath, bridge = electronBridge) => {
  const statResult = await bridge.fs.stat(filePath);
  if (!statResult?.success || !statResult?.isFile) {
    throw new Error(statResult?.error || 'Le fichier image téléchargé est introuvable.');
  }

  if (Number(statResult.size) < DEFAULT_MIN_FILE_SIZE_BYTES) {
    throw new Error(`Le fichier image téléchargé est invalide ou trop petit (${statResult.size} octets).`);
  }
};

const buildProjectImagePath = (project, page, timestamp) => {
  return `${project.path}/images/page_${page.number}_${timestamp}.png`;
};

const fromFileUrl = (fileUrl) => {
  if (typeof fileUrl !== 'string' || !fileUrl.startsWith('file://')) {
    return null;
  }

  const normalized = decodeURIComponent(fileUrl.replace(/^file:\/\//, ''));
  if (/^\/[A-Za-z]:\//.test(normalized)) {
    return normalized.slice(1);
  }

  return normalized;
};

const upsertProjectImage = (images = [], nextImage) => {
  const filtered = images.filter((image) => image.id !== nextImage.id);
  return [...filtered, nextImage];
};

const normalizeStoredVariants = (variants = []) => {
  if (!Array.isArray(variants)) {
    return [];
  }

  return variants
    .filter((variant) => variant && typeof variant === 'object' && typeof variant.url === 'string' && variant.url.trim())
    .map((variant, index) => ({
      ...variant,
      variantIndex: Number.isInteger(variant.variantIndex) ? variant.variantIndex : index
    }));
};

const hydrateSelectedVariantWithLocalFile = ({
  variants,
  variant,
  generationMeta,
  localFileUrl,
  localPath,
  sourceUrl
}) => {
  const selectedVariantIndex = Number.isInteger(variant?.variantIndex)
    ? variant.variantIndex
    : (Number.isInteger(generationMeta?.autoSelectedVariantIndex) ? generationMeta.autoSelectedVariantIndex : null);

  return variants.map((candidate, index) => {
    const matchesSelectedIndex = selectedVariantIndex !== null && index === selectedVariantIndex;
    const matchesSourceUrl = candidate.url === sourceUrl || candidate.originalUrl === sourceUrl;

    if (!matchesSelectedIndex && !matchesSourceUrl) {
      return candidate;
    }

    return {
      ...candidate,
      url: localFileUrl,
      localPath,
      originalUrl: candidate.originalUrl || sourceUrl
    };
  });
};

export const buildIllustrationSelectionState = ({
  page,
  localFileUrl,
  localPath,
  sourceUrl,
  variant,
  generationMeta,
  timestamp
}) => {
  const assetId = `${PAGE_ILLUSTRATION_ROLE}:${page.id}`;
  const selectedAt = timestamp;
  const storedVariants = normalizeStoredVariants(
    variant?.variants || variant?.allVariants || generationMeta?.variants || []
  );
  const hydratedStoredVariants = hydrateSelectedVariantWithLocalFile({
    variants: storedVariants,
    variant,
    generationMeta,
    localFileUrl,
    localPath,
    sourceUrl
  });

  const imageAsset = createProjectImageAsset({
    id: assetId,
    pageId: page.id,
    role: PAGE_ILLUSTRATION_ROLE,
    url: localFileUrl,
    localPath,
    originalUrl: sourceUrl,
    revisedPrompt: variant?.revised_prompt || variant?.revisedPrompt || null,
    promptFinal: generationMeta?.promptFinal || null,
    model: generationMeta?.model || null,
    size: generationMeta?.size || variant?.dalleParams?.size || null,
    quality: generationMeta?.quality || variant?.dalleParams?.quality || 'standard',
    requestId: generationMeta?.requestId || variant?.requestId || null,
    promptSections: generationMeta?.promptSections || variant?.promptSections || null,
    promptTrace: generationMeta?.promptTrace || variant?.promptTrace || null,
    sceneSpec: generationMeta?.sceneSpec || variant?.sceneSpec || null,
    generationPolicy: generationMeta?.generationPolicy || variant?.generationPolicy || null,
    consistencyProfile: generationMeta?.consistencyProfile || variant?.consistencyProfile || null,
    evaluation: generationMeta?.evaluation || variant?.evaluation || null,
    generatorStrategy: generationMeta?.generatorStrategy || variant?.generatorStrategy || null,
    constraintBundleSummary: generationMeta?.constraintBundleSummary || variant?.constraintBundleSummary || null,
    generationTrace: generationMeta?.generationTrace || variant?.generationTrace || null,
    pageDecision: generationMeta?.pageDecision || variant?.pageDecision || null,
    identityHash: generationMeta?.identityHash || variant?.identityHash || null,
    referenceImageId: generationMeta?.referenceImageId || variant?.referenceImageId || null,
    generationStatus: 'ready',
    sourcePageId: page.id,
    createdAt: selectedAt
  }, page.id);

  const illustration = {
    id: assetId,
    assetId,
    url: localFileUrl,
    localPath,
    originalUrl: sourceUrl,
    sceneDescription: variant?.sceneDescription || null,
    revised_prompt: variant?.revised_prompt || variant?.revisedPrompt || null,
    selectedAt,
    variantIndex: Number.isInteger(variant?.variantIndex) ? variant.variantIndex : null,
    dalleParams: variant?.dalleParams || null,
    consistencyScore: variant?.consistencyScore ?? null,
    consistencyMatchedTokens: Array.isArray(variant?.consistencyMatchedTokens) ? variant.consistencyMatchedTokens : [],
    consistencyAnchorRequirementMet: typeof variant?.consistencyAnchorRequirementMet === 'boolean'
      ? variant.consistencyAnchorRequirementMet
      : null,
    consistencyAnchorMatchedTokens: Array.isArray(variant?.consistencyAnchorMatchedTokens) ? variant.consistencyAnchorMatchedTokens : [],
    consistencyAnchorExpectedTokens: Array.isArray(variant?.consistencyAnchorExpectedTokens) ? variant.consistencyAnchorExpectedTokens : [],
    negativePromptUsed: variant?.negativePromptUsed || null,
    batchGenerated: Boolean(variant?.batchGenerated),
    autoSelected: Boolean(variant?.autoSelected ?? generationMeta?.autoSelected),
    selectionMode: generationMeta?.selectionMode || variant?.selectionMode || null,
    fallbackAccepted: Boolean(generationMeta?.fallbackAccepted ?? variant?.fallbackAccepted),
    fallbackReason: generationMeta?.fallbackReason || variant?.fallbackReason || null,
    finalDecisionType: generationMeta?.finalDecisionType || variant?.finalDecisionType || null,
    autoSelectedVariantIndex: Number.isInteger(generationMeta?.autoSelectedVariantIndex)
      ? generationMeta.autoSelectedVariantIndex
      : (Number.isInteger(variant?.autoSelectedVariantIndex) ? variant.autoSelectedVariantIndex : null),
    variants: hydratedStoredVariants,
    allVariants: hydratedStoredVariants,
    promptSections: variant?.promptSections || null,
    promptTrace: variant?.promptTrace || null,
    sceneSpec: variant?.sceneSpec || generationMeta?.sceneSpec || null,
    generationPolicy: generationMeta?.generationPolicy || variant?.generationPolicy || null,
    consistencyProfile: variant?.consistencyProfile || null,
    evaluation: variant?.evaluation || null,
    generatorStrategy: variant?.generatorStrategy || null,
    constraintBundleSummary: variant?.constraintBundleSummary || null,
    identityHash: variant?.identityHash || null,
    referenceImageId: variant?.referenceImageId || null
  };

  return { imageAsset, illustration };
};

export async function finalizePageIllustrationSelection({
  currentProject,
  page,
  variant,
  updateProject,
  generationMeta = {},
  bridge = electronBridge
}) {
  if (!currentProject?.path) {
    throw new Error('Projet invalide: chemin de projet introuvable.');
  }

  if (!page?.id) {
    throw new Error('Page invalide: impossible d\'associer l\'illustration.');
  }

  const sourceUrl = String(variant?.url || '').trim();
  const explicitLocalPath = String(variant?.localPath || '').trim();
  if (!sourceUrl) {
    throw new Error('Illustration invalide: URL source manquante.');
  }

  ensureElectronImagePersistence(bridge);

  const timestamp = new Date().toISOString();
  let localPath = explicitLocalPath || fromFileUrl(sourceUrl);

  if (!localPath) {
    localPath = buildProjectImagePath(currentProject, page, Date.now());
    const downloadResult = await bridge.fs.downloadImage(sourceUrl, localPath);

    if (!downloadResult?.success) {
      throw new Error(downloadResult?.error || 'Le téléchargement local de l\'illustration a échoué.');
    }
  }

  await validateDownloadedImageFile(localPath, bridge);
  const storedVariants = normalizeStoredVariants(
    variant?.variants || variant?.allVariants || generationMeta?.variants || []
  );

  const localFileUrl = toFileUrl(localPath);
  const hydratedStoredVariants = hydrateSelectedVariantWithLocalFile({
    variants: storedVariants,
    variant,
    generationMeta,
    localFileUrl,
    localPath,
    sourceUrl
  });
  const { imageAsset, illustration } = buildIllustrationSelectionState({
    page,
    localFileUrl,
    localPath,
    sourceUrl,
    variant,
    generationMeta,
    timestamp
  });

  const nextGenerationMeta = {
    ...generationMeta,
    localPath,
    localUrl: localFileUrl,
    sourceUrl,
    createdAt: generationMeta?.createdAt || timestamp,
    updatedAt: timestamp,
    status: 'ready',
    variants: hydratedStoredVariants,
    selectionMode: generationMeta?.selectionMode || variant?.selectionMode || null,
    fallbackAccepted: Boolean(generationMeta?.fallbackAccepted ?? variant?.fallbackAccepted),
    fallbackReason: generationMeta?.fallbackReason || variant?.fallbackReason || null,
    finalDecisionType: generationMeta?.finalDecisionType || variant?.finalDecisionType || null,
    autoSelected: Boolean(generationMeta?.autoSelected ?? variant?.autoSelected),
    autoSelectedVariantIndex: Number.isInteger(generationMeta?.autoSelectedVariantIndex)
      ? generationMeta.autoSelectedVariantIndex
      : (Number.isInteger(variant?.autoSelectedVariantIndex) ? variant.autoSelectedVariantIndex : null),
    promptSections: generationMeta?.promptSections || variant?.promptSections || null,
    promptTrace: generationMeta?.promptTrace || variant?.promptTrace || null,
    sceneSpec: generationMeta?.sceneSpec || variant?.sceneSpec || null,
    generationPolicy: generationMeta?.generationPolicy || variant?.generationPolicy || null,
    consistencyProfile: generationMeta?.consistencyProfile || variant?.consistencyProfile || null,
    evaluation: generationMeta?.evaluation || variant?.evaluation || null,
    generatorStrategy: generationMeta?.generatorStrategy || variant?.generatorStrategy || null,
    constraintBundleSummary: generationMeta?.constraintBundleSummary || variant?.constraintBundleSummary || null,
    generationTrace: generationMeta?.generationTrace || variant?.generationTrace || null,
    pageDecision: generationMeta?.pageDecision || variant?.pageDecision || null,
    identityHash: generationMeta?.identityHash || variant?.identityHash || null,
    referenceImageId: generationMeta?.referenceImageId || variant?.referenceImageId || null
  };

  await updateProject((prevProject) => {
    const updatedImages = upsertProjectImage(prevProject.images || [], imageAsset);
    const updatedPages = (prevProject.pages || []).map((candidate) => {
      if (candidate.id !== page.id) {
        return candidate;
      }

      return {
        ...candidate,
        imageAssetId: imageAsset.id,
        imageUrl: localFileUrl,
        imageLocalPath: localPath,
        illustration,
        generationMeta: {
          ...(candidate.generationMeta || {}),
          ...nextGenerationMeta
        }
      };
    });

    return {
      pages: updatedPages,
      images: updatedImages
    };
  });

  return {
    imageAsset,
    illustration
  };
}
