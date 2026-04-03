import { stableHash } from './hash';

const SPEC_VERSION = '2.0';
const PACK_VERSION = '1.0';

const toCleanString = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.replace(/\s+/g, ' ').trim();
};

const normalizePalette = (palette) => {
  if (!Array.isArray(palette)) {
    return [];
  }

  const cleaned = palette
    .map((color) => toCleanString(color))
    .filter(Boolean);

  return [...new Set(cleaned)].slice(0, 8);
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

const extractAnchorTokens = (value) => {
  return toTokenSet(value)
    .filter((token) => /[a-z0-9]/i.test(token))
    .slice(0, 12);
};

const FACE_HAIR_KEYWORDS = [
  'hair', 'hairstyle', 'bang', 'fringe', 'curl', 'curly', 'straight', 'ponytail', 'braid', 'bob',
  'face', 'facial', 'eyes', 'eye', 'cheek', 'cheeks', 'nose', 'smile', 'round', 'oval', 'freckle',
  'skin', 'brunette', 'blonde', 'auburn', 'brown',
  'cheveux', 'coiffure', 'frange', 'boucle', 'queue', 'tresse', 'visage', 'yeux', 'joue', 'nez',
  'sourire', 'rond', 'ovale', 'peau', 'brun', 'chatain', 'rousse'
];

const isFaceHairAnchorToken = (token) => {
  return FACE_HAIR_KEYWORDS.some((keyword) => token.includes(keyword) || keyword.includes(token));
};

const buildCharacterLockLine = (mainCharacter) => {
  const fragments = [];
  const agePhrase = mainCharacter.age ? buildAgePhrase(mainCharacter.age) : '';

  if (mainCharacter.name) {
    fragments.push(`hero ${mainCharacter.name}`);
  }

  if (agePhrase) {
    fragments.push(`age impression ${agePhrase}`);
  }

  if (mainCharacter.appearance) {
    fragments.push(`face and body cues ${mainCharacter.appearance}`);
  }

  if (mainCharacter.description) {
    fragments.push(`core character notes ${mainCharacter.description}`);
  }

  if (mainCharacter.clothing) {
    fragments.push(`signature outfit ${mainCharacter.clothing}`);
  }

  const coreText = fragments.length > 0 ? fragments.join(', ') : 'validated main character';

  return `VISUAL IDENTITY LOCK: keep the same ${coreText} on every page. Preserve face shape, hairstyle silhouette, hair color, skin tone, age impression, body proportions, and signature outfit details. The main character MUST match the reference image EXACTLY in face, hair, proportions, and style. Do NOT reinterpret or redesign the character. This is the SAME character, not a variation.`;
};

const buildAgePhrase = (age) => {
  const cleanedAge = toCleanString(age);
  if (!cleanedAge) {
    return '';
  }

  if (/^\d+$/.test(cleanedAge)) {
    return `${cleanedAge}-year-old`;
  }

  if (/^\d+\s*-\s*\d+$/.test(cleanedAge)) {
    return `${cleanedAge.replace(/\s*/g, '')}-year-old`;
  }

  return cleanedAge
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/gi, '')
    .toLowerCase();
};

const buildPaletteLine = (palette) => {
  if (!palette.length) {
    return '';
  }

  return `PALETTE LOCK: keep the validated palette dominant across the whole book: ${palette.join(', ')}. Only use the provided palette. Avoid introducing new dominant colors. Use these tones as the stable color guide and avoid introducing a competing palette.`;
};

const buildStyleLine = (artStyle) => {
  if (!artStyle.id && !artStyle.prompt) {
    return '';
  }

  const styleLabel = artStyle.prompt || artStyle.id;
  return `STYLE LOCK: maintain a constant children's-book art direction: ${styleLabel}. Do not drift into a different rendering mode, medium, or level of realism from page to page. Do not change rendering style between pages.`;
};

const buildSceneGuardLine = () => {
  return 'SCENE LIMIT: the scene may vary, but only the action, background, framing, and composition may change. The character identity, age impression, hairstyle, outfit, palette, and art style must stay fixed.';
};

const buildQualityLine = () => {
  return 'QUALITY RULES: coherent chapter-to-chapter character continuity, no random redesign, no alternative character design, no extra unrelated props, no text, no watermark, no logo, no palette chart, no style drift, no face drift, no hairstyle drift, and no eye-style drift.';
};

const buildNegativePrompt = () => {
  return [
    'text',
    'letters',
    'caption',
    'watermark',
    'logo',
    'signature',
    'palette chart',
    'color chart',
    'different face',
    'different hairstyle',
    'different eye style',
    'different age',
    'different outfit',
    'alternative character design',
    'style drift',
    'palette drift',
    'semi 3d',
    'photorealistic',
    'busy clutter'
  ].join(', ');
};

const buildInvariants = ({ mainCharacter, artStyle }) => {
  const invariants = [];

  if (mainCharacter.name) {
    invariants.push(`Conserver ${mainCharacter.name} avec la meme morphologie et les memes traits.`);
  }

  if (mainCharacter.age) {
    invariants.push(`Age apparent verrouille: ${mainCharacter.age}.`);
  }

  if (mainCharacter.appearance) {
    invariants.push(`Visage / silhouette cle: ${mainCharacter.appearance}`);
  }

  if (mainCharacter.description) {
    invariants.push(`Description cle: ${mainCharacter.description}`);
  }

  if (mainCharacter.clothing) {
    invariants.push(`Tenue / silhouette signature: ${mainCharacter.clothing}`);
  }

  if (mainCharacter.referenceImage || mainCharacter.referenceImagePath || mainCharacter.referenceImageBase64) {
    invariants.push('Reference image lock: the selected visual identity image is canonical and must be replicated exactly.');
  }

  if (mainCharacter.colorPalette.length > 0) {
    invariants.push(`Palette verrouillee: ${mainCharacter.colorPalette.join(', ')}`);
  }

  if (artStyle.id || artStyle.prompt) {
    invariants.push('Le style artistique, le rendu et la texture doivent rester constants sur tout le livre.');
  }

  return invariants;
};

const buildCharacterPack = ({ mainCharacter, promptProfile, validatedAt }) => {
  const canonicalReference = {
    imageId: mainCharacter.referenceImageId || 'main-character-reference',
    url: mainCharacter.referenceImage || null,
    path: mainCharacter.referenceImagePath || null,
    base64: mainCharacter.referenceImageBase64 || null,
    mimeType: mainCharacter.referenceImageMimeType || 'image/png'
  };

  return {
    version: PACK_VERSION,
    id: `character-pack:${promptProfile.identityHash}`,
    packType: 'character',
    validatedAt,
    identityHash: promptProfile.identityHash,
    canonicalReference,
    referenceImages: [canonicalReference].filter((entry) => entry.url || entry.path || entry.base64),
    invariants: [
      promptProfile.promptSections?.invariantPrompt || '',
      promptProfile.promptSections?.referencePrompt || '',
      ...(Array.isArray(mainCharacter.colorPalette) ? mainCharacter.colorPalette.map((color) => `Palette anchor: ${color}`) : [])
    ].filter(Boolean),
    descriptors: {
      name: mainCharacter.name || '',
      age: mainCharacter.age || '',
      appearance: mainCharacter.appearance || '',
      description: mainCharacter.description || '',
      clothing: mainCharacter.clothing || '',
      referencePrompt: mainCharacter.referencePrompt || ''
    },
    promptAnchors: {
      faceHair: promptProfile.consistencyAnchors?.faceHair || [],
      age: promptProfile.consistencyAnchors?.age || [],
      clothing: promptProfile.consistencyAnchors?.clothing || []
    }
  };
};

const buildStylePack = ({ mainCharacter, artStyle, promptProfile, validatedAt }) => {
  const canonicalStyleReference = {
    imageId: mainCharacter.referenceImageId || 'main-character-reference',
    url: mainCharacter.referenceImage || null,
    path: mainCharacter.referenceImagePath || null,
    base64: mainCharacter.referenceImageBase64 || null,
    mimeType: mainCharacter.referenceImageMimeType || 'image/png'
  };

  return {
    version: PACK_VERSION,
    id: `style-pack:${promptProfile.identityHash}`,
    packType: 'style',
    validatedAt,
    identityHash: promptProfile.identityHash,
    artStyle: {
      id: artStyle.id || '',
      prompt: artStyle.prompt || ''
    },
    palette: Array.isArray(mainCharacter.colorPalette) ? mainCharacter.colorPalette : [],
    renderingRules: [
      promptProfile.promptSections?.stylePrompt || '',
      promptProfile.promptSections?.palettePrompt || '',
      promptProfile.promptSections?.sceneGuardPrompt || '',
      promptProfile.promptSections?.qualityPrompt || ''
    ].filter(Boolean),
    referenceImages: [canonicalStyleReference].filter((entry) => entry.url || entry.path || entry.base64),
    styleReferenceMode: 'reuses-character-reference-until-dedicated-style-reference-exists'
  };
};

export const buildVisualIdentityPromptProfile = (spec = {}) => {
  const normalizedMainCharacter = {
    name: toCleanString(spec?.mainCharacter?.name || spec?.character?.name),
    age: toCleanString(spec?.mainCharacter?.age || spec?.character?.age),
    appearance: toCleanString(spec?.mainCharacter?.appearance || spec?.character?.appearance),
    description: toCleanString(spec?.mainCharacter?.description || spec?.character?.description),
    clothing: toCleanString(spec?.mainCharacter?.clothing || spec?.character?.clothing),
    referencePrompt: toCleanString(spec?.mainCharacter?.referencePrompt || spec?.referencePrompt),
    referenceImage: toCleanString(spec?.mainCharacter?.referenceImage || spec?.character?.referenceImage),
    referenceImagePath: toCleanString(spec?.mainCharacter?.referenceImagePath || spec?.character?.referenceImagePath),
    referenceImageBase64: toCleanString(spec?.mainCharacter?.referenceImageBase64 || spec?.character?.referenceImageBase64),
    referenceImageMimeType: toCleanString(spec?.mainCharacter?.referenceImageMimeType || spec?.character?.referenceImageMimeType),
    referenceImageId: toCleanString(spec?.mainCharacter?.referenceImageId || spec?.character?.referenceImageId),
    colorPalette: normalizePalette(spec?.mainCharacter?.colorPalette || spec?.palette)
  };

  const artStyle = {
    id: toCleanString(spec?.artStyle?.id || spec?.artisticStyle),
    prompt: toCleanString(spec?.artStyle?.prompt || spec?.stylePrompt)
  };

  const identityHash = stableHash({
    version: SPEC_VERSION,
    mainCharacter: {
      name: normalizedMainCharacter.name,
      age: normalizedMainCharacter.age,
      appearance: normalizedMainCharacter.appearance,
      description: normalizedMainCharacter.description,
      clothing: normalizedMainCharacter.clothing,
      referencePrompt: normalizedMainCharacter.referencePrompt,
      referenceImagePath: normalizedMainCharacter.referenceImagePath,
      referenceImageId: normalizedMainCharacter.referenceImageId,
      colorPalette: normalizedMainCharacter.colorPalette
    },
    artStyle
  });

  const faceHairAnchors = extractAnchorTokens([
    normalizedMainCharacter.appearance,
    normalizedMainCharacter.description,
    normalizedMainCharacter.referencePrompt
  ].filter(Boolean).join(' ')).filter(isFaceHairAnchorToken).slice(0, 8);

  const agePhrase = buildAgePhrase(normalizedMainCharacter.age);
  const ageAnchors = agePhrase ? extractAnchorTokens(`age impression ${agePhrase}`) : [];
  const clothingAnchors = extractAnchorTokens([
    normalizedMainCharacter.clothing,
    normalizedMainCharacter.referencePrompt
  ].filter(Boolean).join(' '));
  const styleAnchors = extractAnchorTokens([
    artStyle.id,
    artStyle.prompt
  ].filter(Boolean).join(' '));
  const paletteAnchors = normalizedMainCharacter.colorPalette.map((color) => toCleanString(color)).filter(Boolean);

  const invariantPrompt = buildCharacterLockLine(normalizedMainCharacter);
  const referencePrompt = normalizedMainCharacter.referenceImage || normalizedMainCharacter.referenceImagePath || normalizedMainCharacter.referenceImageBase64
    ? 'REFERENCE LOCK: use the selected visual identity image as the canonical visual anchor for every page.'
    : '';
  const stylePrompt = buildStyleLine(artStyle);
  const palettePrompt = buildPaletteLine(normalizedMainCharacter.colorPalette);
  const sceneGuardPrompt = buildSceneGuardLine();
  const qualityPrompt = buildQualityLine();
  const negativePrompt = buildNegativePrompt();

  return {
    version: SPEC_VERSION,
    identityHash,
    promptOrder: [
      'invariantPrompt',
      'referencePrompt',
      'stylePrompt',
      'palettePrompt',
      'sceneGuardPrompt',
      'pagePrompt',
      'scenePrompt',
      'continuityPrompt',
      'templatePrompt',
      'qualityPrompt',
      'safetyPrompt'
    ],
    promptSections: {
      invariantPrompt,
      referencePrompt,
      stylePrompt,
      palettePrompt,
      sceneGuardPrompt,
      qualityPrompt,
      negativePrompt
    },
    consistencyAnchors: {
      faceHair: faceHairAnchors,
      age: ageAnchors,
      clothing: clothingAnchors,
      style: styleAnchors,
      palette: paletteAnchors
    },
    lockedAttributes: {
      name: normalizedMainCharacter.name,
      age: normalizedMainCharacter.age,
      agePhrase,
      appearance: normalizedMainCharacter.appearance,
      description: normalizedMainCharacter.description,
      clothing: normalizedMainCharacter.clothing,
      referenceImage: normalizedMainCharacter.referenceImage,
      referenceImagePath: normalizedMainCharacter.referenceImagePath,
      referenceImageBase64: normalizedMainCharacter.referenceImageBase64,
      referenceImageMimeType: normalizedMainCharacter.referenceImageMimeType,
      referenceImageId: normalizedMainCharacter.referenceImageId,
      colorPalette: normalizedMainCharacter.colorPalette,
      artStyle
    }
  };
};

export const buildVisualIdentitySpec = ({ project, mainCharacterData }) => {
  const mainCharacter = {
    name: toCleanString(mainCharacterData?.name),
    age: toCleanString(mainCharacterData?.age),
    appearance: toCleanString(mainCharacterData?.appearance),
    description: toCleanString(mainCharacterData?.description),
    clothing: toCleanString(mainCharacterData?.clothing),
    referencePrompt: toCleanString(mainCharacterData?.referencePrompt),
    referenceImage: toCleanString(mainCharacterData?.referenceImage),
    referenceImagePath: toCleanString(mainCharacterData?.referenceImagePath),
    referenceImageBase64: toCleanString(mainCharacterData?.referenceImageBase64),
    referenceImageMimeType: toCleanString(mainCharacterData?.referenceImageMimeType),
    referenceImageId: toCleanString(mainCharacterData?.referenceImageId),
    colorPalette: normalizePalette(mainCharacterData?.colorPalette)
  };

  const artStyle = {
    id: toCleanString(project?.artStyle || project?.visualIdentity?.artisticStyle),
    prompt: toCleanString(project?.visualIdentity?.stylePrompt)
  };

  const promptProfile = buildVisualIdentityPromptProfile({
    mainCharacter,
    artStyle
  });
  const validatedAt = new Date().toISOString();

  const spec = {
    version: SPEC_VERSION,
    mainCharacter,
    artStyle,
    invariants: [],
    promptProfile,
    characterPack: buildCharacterPack({
      mainCharacter,
      promptProfile,
      validatedAt
    }),
    stylePack: buildStylePack({
      mainCharacter,
      artStyle,
      promptProfile,
      validatedAt
    })
  };

  spec.invariants = buildInvariants({
    mainCharacter,
    artStyle
  });

  return spec;
};

export const validateVisualIdentitySpec = (spec) => {
  const errors = [];

  if (!spec || typeof spec !== 'object') {
    return {
      ok: false,
      errors: ['visualIdentitySpec est manquant.']
    };
  }

  const mainCharacter = spec.mainCharacter || spec.character;
  if (!mainCharacter || typeof mainCharacter !== 'object') {
    errors.push('mainCharacter est requis.');
  } else if (!toCleanString(mainCharacter.appearance) && !toCleanString(mainCharacter.description)) {
    errors.push('mainCharacter.appearance ou mainCharacter.description est requis.');
  }

  const referencePrompt = toCleanString(mainCharacter?.referencePrompt || spec.referencePrompt);
  if (!referencePrompt) {
    errors.push('mainCharacter.referencePrompt est requis.');
  }

  const referenceImage = toCleanString(mainCharacter?.referenceImage || spec.referenceImage);
  const referenceImagePath = toCleanString(mainCharacter?.referenceImagePath || spec.referenceImagePath);
  const referenceImageBase64 = toCleanString(mainCharacter?.referenceImageBase64 || spec.referenceImageBase64);
  if (!referenceImage && !referenceImagePath && !referenceImageBase64) {
    errors.push('mainCharacter.referenceImage, referenceImagePath ou referenceImageBase64 est requis.');
  }

  const colorPalette = Array.isArray(mainCharacter?.colorPalette)
    ? mainCharacter.colorPalette
    : spec.palette;
  if (!Array.isArray(colorPalette) || colorPalette.length === 0) {
    errors.push('mainCharacter.colorPalette doit contenir au moins une couleur.');
  }

  const styleId = toCleanString(spec.artStyle?.id);
  const stylePrompt = toCleanString(spec.artStyle?.prompt);
  if (!styleId && !stylePrompt) {
    errors.push('artStyle.id ou artStyle.prompt est requis.');
  }

  if (!Array.isArray(spec.invariants) || spec.invariants.length === 0) {
    errors.push('invariants doit contenir au moins une regle.');
  }

  if (spec.promptProfile && typeof spec.promptProfile === 'object') {
    const sections = spec.promptProfile.promptSections || {};
    if (!toCleanString(sections.invariantPrompt)) {
      errors.push('promptProfile.promptSections.invariantPrompt est requis.');
    }
    if ((referenceImage || referenceImagePath || referenceImageBase64) && !toCleanString(sections.referencePrompt)) {
      errors.push('promptProfile.promptSections.referencePrompt est requis.');
    }
    if (!toCleanString(sections.stylePrompt) && !styleId && !stylePrompt) {
      errors.push('promptProfile.promptSections.stylePrompt est requis.');
    }
    if (!toCleanString(sections.sceneGuardPrompt)) {
      errors.push('promptProfile.promptSections.sceneGuardPrompt est requis.');
    }
  }

  return {
    ok: errors.length === 0,
    errors
  };
};
