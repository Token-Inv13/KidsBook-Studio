import { buildVisualIdentityPromptProfile } from './visualIdentitySpec';

const toCleanString = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.replace(/\s+/g, ' ').trim();
};

const toShortText = (value, max = 700) => toCleanString(value).slice(0, max);

const getTemplateInstructions = (template) => {
  const normalized = toCleanString(template).toLowerCase();

  if (normalized === 'full_illustration' || normalized === 'illustration-pleine') {
    return 'TEMPLATE: full illustration. Compose a full-page immersive scene with no reserved empty text area.';
  }

  if (normalized === 'mixed' || normalized === 'mixte') {
    return 'TEMPLATE: mixed layout. Keep a calm, readable area for later editorial text insertion without changing the character identity.';
  }

  if (normalized === 'double_page' || normalized === 'double-page') {
    return 'TEMPLATE: double page spread. Compose a continuous panoramic scene and keep critical details away from the gutter.';
  }

  return 'TEMPLATE: standard layout. Compose a clear, coherent children\'s book scene.';
};

const buildContinuityLine = (continuityContext, retryForConsistency) => {
  const parts = [];

  if (continuityContext) {
    parts.push(`CONTINUITY REFERENCE: ${toShortText(continuityContext, 420)}`);
  }

  if (retryForConsistency) {
    parts.push('STRICT RETRY MODE: preserve the exact same protagonist model from the canonical character sheet. Face, hair silhouette, age impression, and outfit identity are immutable.');
  }

  return parts.join(' ');
};

const buildReferenceLockLine = (mainCharacter) => {
  const referencePresent = Boolean(
    mainCharacter?.referenceImage ||
    mainCharacter?.referenceImagePath ||
    mainCharacter?.referenceImageBase64
  );

  if (!referencePresent) {
    return '';
  }

  return [
    'REFERENCE LOCK: use the selected visual identity image as the canonical source for every page.',
    'The main character MUST match the reference image EXACTLY in face, hair, proportions, and style.',
    'Do NOT reinterpret or redesign the character.',
    'This is the SAME character, not a variation.'
  ].join(' ');
};

const buildSafetyLine = (safeMode) => {
  if (!safeMode) {
    return '';
  }

  return 'SAFETY MODE: child-friendly scene, fully clothed characters, no nudity, no violence, no injury, no frightening content.';
};

const combinePromptSections = (sections) => {
  return sections
    .map((section) => toCleanString(section))
    .filter(Boolean)
    .join('\n\n');
};

const toTokenSet = (value) => {
  if (!value || typeof value !== 'string') {
    return [];
  }

  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  return [...new Set(
    normalized
      .toLowerCase()
      .replace(/[^a-z0-9\s\-#]/gi, ' ')
      .split(/\s+/)
      .filter((token) => token.length >= 4)
  )];
};

const extractWeightedMatches = (expectedTokens, revisedTokenSet) => {
  const matchedTokens = expectedTokens.filter((token) => revisedTokenSet.includes(token));
  const score = expectedTokens.length > 0 ? matchedTokens.length / expectedTokens.length : 1;

  return {
    expectedTokens,
    matchedTokens,
    score
  };
};

const getCharacterIdentityTokens = (character) => {
  if (!character) {
    return {
      nameTokens: [],
      faceHairTokens: [],
      ageTokens: [],
      clothingTokens: []
    };
  }

  const nameTokens = toTokenSet(character.name);
  const faceHairTokens = toTokenSet([
    character.appearance,
    character.description,
    character.referencePrompt
  ].filter(Boolean).join(' ')).slice(0, 12);
  const ageTokens = toTokenSet(character.agePhrase || character.age);
  const clothingTokens = toTokenSet([
    character.clothing,
    character.referencePrompt
  ].filter(Boolean).join(' ')).slice(0, 10);

  return {
    nameTokens,
    faceHairTokens,
    ageTokens,
    clothingTokens
  };
};

const getStyleTokens = (visualIdentity) => {
  const styleSource = [
    visualIdentity?.promptProfile?.lockedAttributes?.artStyle?.id,
    visualIdentity?.promptProfile?.lockedAttributes?.artStyle?.prompt,
    visualIdentity?.artStyle?.id,
    visualIdentity?.artStyle?.prompt,
    visualIdentity?.stylePrompt,
    visualIdentity?.artisticStyle
  ].filter(Boolean).join(' ');

  return toTokenSet(styleSource).slice(0, 12);
};

const getPaletteTokens = (visualIdentity) => {
  const palette = visualIdentity?.promptProfile?.lockedAttributes?.colorPalette
    || visualIdentity?.mainCharacter?.colorPalette
    || [];

  return Array.isArray(palette)
    ? palette.map((color) => toCleanString(color).toLowerCase()).filter(Boolean).slice(0, 8)
    : [];
};

export const buildIllustrationPrompt = ({
  spec,
  page,
  template,
  pageText,
  sceneDescription = '',
  continuityContext = '',
  additionalContext = '',
  retryForConsistency = false,
  safeMode = false
}) => {
  if (!spec) {
    throw new Error('Visual identity spec is required');
  }

  const profile = spec.promptProfile || buildVisualIdentityPromptProfile(spec);
  const mainCharacter = profile.lockedAttributes || spec.mainCharacter || {};
  const pageNarrative = toShortText(pageText, 1200);
  const sceneText = toShortText(sceneDescription, 700);
  const templateInstructions = getTemplateInstructions(template || page?.template);
  const continuityLine = buildContinuityLine(continuityContext, retryForConsistency);
  const referenceLine = buildReferenceLockLine(mainCharacter);
  const safetyLine = buildSafetyLine(safeMode);

  const promptSections = {
    invariantPrompt: profile.promptSections?.invariantPrompt || '',
    referencePrompt: profile.promptSections?.referencePrompt || referenceLine,
    stylePrompt: profile.promptSections?.stylePrompt || '',
    palettePrompt: profile.promptSections?.palettePrompt || '',
    sceneGuardPrompt: profile.promptSections?.sceneGuardPrompt || '',
    pagePrompt: pageNarrative ? `PAGE NARRATIVE: ${pageNarrative}` : '',
    scenePrompt: sceneText ? `SCENE DIRECTION: ${sceneText}` : '',
    continuityPrompt: continuityLine,
    templatePrompt: templateInstructions,
    qualityPrompt: profile.promptSections?.qualityPrompt || '',
    safetyPrompt: safetyLine,
    additionalPrompt: additionalContext ? `ADDITIONAL CONTEXT: ${toShortText(additionalContext, 500)}` : '',
    negativePrompt: profile.promptSections?.negativePrompt || ''
  };

  const prompt = combinePromptSections([
    promptSections.invariantPrompt,
    promptSections.referencePrompt,
    promptSections.stylePrompt,
    promptSections.palettePrompt,
    promptSections.sceneGuardPrompt,
    promptSections.pagePrompt,
    promptSections.scenePrompt,
    promptSections.continuityPrompt,
    promptSections.templatePrompt,
    promptSections.additionalPrompt,
    promptSections.qualityPrompt,
    promptSections.safetyPrompt
  ]);

  return {
    prompt,
    negativePrompt: promptSections.negativePrompt,
    promptSections,
    metadata: {
      artisticStyle: spec.artStyle?.prompt || spec.artStyle?.id || spec.stylePrompt || spec.artisticStyle || '',
      characterReference: spec.mainCharacter?.referenceImage || null,
      characterReferenceId: spec.mainCharacter?.referenceImageId || null,
      characterReferencePath: spec.mainCharacter?.referenceImagePath || null,
      characterReferenceBase64: spec.mainCharacter?.referenceImageBase64 ? true : false,
      colorPalette: spec.mainCharacter?.colorPalette || [],
      characterDescriptors: toTokenSet([
        mainCharacter.name,
        mainCharacter.age,
        mainCharacter.appearance,
        mainCharacter.description,
        mainCharacter.clothing,
        mainCharacter.referencePrompt
      ].filter(Boolean).join(' ')).slice(0, 12),
      retryForConsistency,
      generatedAt: new Date().toISOString(),
      identityHash: profile.identityHash,
      promptSections,
      promptOrder: profile.promptOrder,
      consistencyAnchors: profile.consistencyAnchors,
      promptTrace: {
        identityHash: profile.identityHash,
        pageNumber: page?.number || null,
        template: template || page?.template || null,
        sectionOrder: profile.promptOrder,
        referenceImageId: profile.lockedAttributes?.referenceImageId || spec.mainCharacter?.referenceImageId || null,
        referenceImagePath: profile.lockedAttributes?.referenceImagePath || spec.mainCharacter?.referenceImagePath || null,
        source: 'illustrationPromptBuilder'
      }
    }
  };
};

export const validateRevisedPromptConsistency = (input, visualIdentity) => {
  const normalizedInput = typeof input === 'string'
    ? { revisedPrompt: input, prompt: '' }
    : (input || {});
  const revisedPrompt = normalizedInput.revisedPrompt || normalizedInput.revised_prompt || '';
  const prompt = normalizedInput.prompt || normalizedInput.finalPrompt || '';
  const fallback = {
    isConsistent: true,
    score: 1,
    anchorRequirementMet: true,
    anchorMatchedTokens: [],
    anchorExpectedTokens: [],
    matchedTokens: [],
    expectedTokens: [],
    groupScores: {},
    flags: {}
  };

  if (!revisedPrompt || !visualIdentity?.mainCharacter) {
    return fallback;
  }

  const profile = visualIdentity.promptProfile || buildVisualIdentityPromptProfile(visualIdentity);
  const revisedTokenSet = toTokenSet(revisedPrompt);
  const promptTokenSet = toTokenSet(prompt);
  const identityTokens = getCharacterIdentityTokens(profile.lockedAttributes || visualIdentity.mainCharacter);
  const styleTokens = getStyleTokens(visualIdentity);
  const paletteTokens = getPaletteTokens(visualIdentity);
  const referenceConfigured = Boolean(
    profile.lockedAttributes?.referenceImage ||
    profile.lockedAttributes?.referenceImagePath ||
    profile.lockedAttributes?.referenceImageBase64
  );
  const referenceTokens = referenceConfigured ? ['reference', 'lock', 'canonical', 'visual', 'anchor'] : [];

  const groupScores = {
    name: extractWeightedMatches(identityTokens.nameTokens, revisedTokenSet),
    faceHair: extractWeightedMatches(identityTokens.faceHairTokens, revisedTokenSet),
    age: extractWeightedMatches(identityTokens.ageTokens, revisedTokenSet),
    clothing: extractWeightedMatches(identityTokens.clothingTokens, revisedTokenSet),
    style: extractWeightedMatches(styleTokens, revisedTokenSet),
    palette: extractWeightedMatches(paletteTokens, revisedTokenSet),
    referenceLock: extractWeightedMatches(referenceTokens, promptTokenSet)
  };

  const weights = {
    name: 0.05,
    faceHair: 0.3,
    age: 0.1,
    clothing: 0.1,
    style: 0.25,
    palette: 0.15,
    referenceLock: 0.05
  };

  const score = Object.entries(groupScores).reduce((sum, [group, result]) => {
    return sum + ((result.score || 0) * weights[group]);
  }, 0);

  const anchorExpectedTokens = [
    ...profile.consistencyAnchors?.faceHair || [],
    ...profile.consistencyAnchors?.style || []
  ].filter(Boolean);
  const anchorMatchedTokens = anchorExpectedTokens.filter((token) => revisedTokenSet.includes(token));
  const anchorRequirementMet = (groupScores.faceHair.score >= 0.5)
    && (styleTokens.length === 0 || groupScores.style.score >= 0.2);

  const flags = {
    faceSimilarityProxy: groupScores.faceHair.score >= 0.45,
    faceStable: groupScores.faceHair.score >= 0.45,
    hairstyleStable: groupScores.faceHair.score >= 0.45,
    ageStable: identityTokens.ageTokens.length === 0 || groupScores.age.score >= 0.5,
    clothingStable: identityTokens.clothingTokens.length === 0 || groupScores.clothing.score >= 0.45,
    styleAdherence: styleTokens.length === 0 || groupScores.style.score >= 0.25,
    styleStable: styleTokens.length === 0 || groupScores.style.score >= 0.25,
    paletteAdherence: paletteTokens.length === 0 || groupScores.palette.score >= 0.35,
    paletteStable: paletteTokens.length === 0 || groupScores.palette.score >= 0.35,
    referenceLockPresent: referenceConfigured,
    characterNameStable: identityTokens.nameTokens.length === 0 || groupScores.name.score >= 0.5
  };

  const combinedExpectedTokens = [
    ...identityTokens.nameTokens,
    ...identityTokens.faceHairTokens,
    ...identityTokens.ageTokens,
    ...identityTokens.clothingTokens,
    ...styleTokens,
    ...paletteTokens
  ];
  const combinedMatchedTokens = combinedExpectedTokens.filter((token) => revisedTokenSet.includes(token));

  return {
    isConsistent: score >= 0.55 && flags.faceSimilarityProxy && flags.styleAdherence && flags.paletteAdherence,
    score,
    anchorRequirementMet,
    anchorMatchedTokens,
    anchorExpectedTokens,
    matchedTokens: combinedMatchedTokens,
    expectedTokens: combinedExpectedTokens,
    groupScores,
    flags,
    identityHash: profile.identityHash
  };
};

export const validateVisualIdentity = (visualIdentity) => {
  if (!visualIdentity) {
    return {
      isValid: false,
      error: 'No visual identity defined'
    };
  }

  if (!visualIdentity.validated) {
    return {
      isValid: false,
      error: 'Visual identity not validated'
    };
  }

  if (!visualIdentity.artisticStyle) {
    return {
      isValid: false,
      error: 'No artistic style defined'
    };
  }

  if (!visualIdentity.mainCharacter?.referenceImage) {
    return {
      isValid: false,
      error: 'No character reference image'
    };
  }

  return {
    isValid: true
  };
};
