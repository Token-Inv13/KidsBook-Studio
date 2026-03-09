/**
 * Builds a complete DALL-E prompt with visual identity context
 * This ensures all generated images maintain visual coherence
 */

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
      .replace(/[^a-z0-9\s\-]/gi, ' ')
      .split(/\s+/)
      .filter(token => token.length >= 4)
  )];
};

const CONSISTENCY_MIN_SCORE = 0.45;

const toShortText = (value, max = 280) => {
  if (!value || typeof value !== 'string') {
    return '';
  }

  return value.replace(/\s+/g, ' ').trim().slice(0, max);
};

const getCharacterDescriptors = (character) => {
  if (!character) {
    return [];
  }

  const combined = [
    character.name,
    character.age ? `${character.age} years old` : null,
    character.appearance,
    character.description,
    character.clothing,
    character.referencePrompt
  ]
    .filter(Boolean)
    .join(' ');

  return toTokenSet(combined).slice(0, 12);
};

const HAIR_FACE_ANCHOR_KEYWORDS = [
  'hair', 'hairstyle', 'bang', 'fringe', 'curl', 'curly', 'straight', 'ponytail', 'braid', 'bob',
  'face', 'facial', 'eyes', 'eye', 'cheek', 'cheeks', 'nose', 'smile', 'round', 'oval', 'freckle',
  'skin', 'brunette', 'blonde', 'auburn',
  'cheveux', 'coiffure', 'frange', 'boucle', 'queue', 'tresse', 'visage', 'yeux', 'joue', 'nez',
  'sourire', 'rond', 'ovale', 'peau', 'brun', 'chatain', 'rousse'
];

const GENERIC_ANCHOR_TOKENS = new Set([
  'hair', 'hairstyle', 'face', 'facial', 'eyes', 'eye', 'cheek', 'cheeks', 'nose', 'skin',
  'cheveux', 'coiffure', 'visage', 'yeux', 'joue', 'joues', 'nez', 'peau'
]);

const isHairFaceAnchorToken = (token) => {
  return HAIR_FACE_ANCHOR_KEYWORDS.some(keyword => token.includes(keyword) || keyword.includes(token));
};

const getHairFaceAnchorTokens = (character) => {
  if (!character) {
    return [];
  }

  const combined = [
    character.appearance,
    character.description,
    character.referencePrompt
  ]
    .filter(Boolean)
    .join(' ');

  return toTokenSet(combined)
    .filter(isHairFaceAnchorToken)
    .filter(token => !GENERIC_ANCHOR_TOKENS.has(token))
    .slice(0, 8);
};

export const buildImagePrompt = (basePrompt, visualIdentity, options = {}) => {
  if (!visualIdentity) {
    throw new Error('Visual identity is required');
  }

  if (!visualIdentity.stylePrompt && !visualIdentity.artisticStyle) {
    throw new Error('Visual identity must have an artistic style');
  }

  const {
    includeCharacter = true,
    sceneDescription = '',
    additionalContext = '',
    retryForConsistency = false,
    safeMode = false
  } = options;

  const parts = [];

  // 1. Artistic style (mandatory)
  const stylePrompt = visualIdentity.stylePrompt || visualIdentity.artisticStyle;
  parts.push(stylePrompt);

  // 2. Main character reference (if included)
  if (includeCharacter && visualIdentity.mainCharacter) {
    const char = visualIdentity.mainCharacter;
    const hairFaceAnchors = getHairFaceAnchorTokens(char);
    
    // Build very detailed character description for consistency
    const characterDetails = [];
    
    // Name and basic description
    if (char.name) {
      characterDetails.push(`Character named ${char.name}`);
    }
    
    // Physical appearance - be very specific
    if (char.appearance) {
      characterDetails.push(char.appearance);
    } else if (char.description) {
      characterDetails.push(char.description);
    }
    
    // Clothing - important for visual consistency
    if (char.clothing) {
      characterDetails.push(`wearing ${char.clothing}`);
    }
    
    // Age if specified
    if (char.age) {
      characterDetails.push(`${char.age} years old`);
    }
    
    // Add strict character identity lock for coherence across pages
    const characterDesc = characterDetails.filter(Boolean).join(', ');
    parts.push(`Character identity lock: ${characterDesc}. Keep the same face shape, hairstyle, hair color, skin tone, age impression, body proportions, and signature clothing details on every page.`);

    const referenceSheet = toShortText(char.referencePrompt, 400);
    if (referenceSheet) {
      parts.push(`Canonical character sheet reference: ${referenceSheet}`);
    }

    if (char.name) {
      parts.push(`The protagonist is ${char.name}. Keep the same child design across pages.`);
    }

    if (hairFaceAnchors.length > 0) {
      parts.push(`Hair and face anchors to preserve: ${hairFaceAnchors.join(', ')}`);
    }

    // Color palette reference with emphasis
    if (char.colorPalette && char.colorPalette.length > 0) {
      parts.push(`Use these exact character colors: ${char.colorPalette.join(', ')}`);
    }

    parts.push('Continuity requirements: preserve hair color, skin tone, hairstyle silhouette, facial proportions, age impression, and signature outfit identity.');
  }

  // 3. Scene description
  if (sceneDescription) {
    parts.push(`Scene: ${sceneDescription}`);
  }

  // 4. Base prompt (the specific illustration request)
  parts.push(basePrompt);

  // 5. Additional context
  if (additionalContext) {
    parts.push(additionalContext);
  }

  // 6. Quality markers
  parts.push('children\'s book illustration, high quality, professional, same art direction and character model as previous pages');

  if (retryForConsistency) {
    parts.push('CONSISTENCY RETRY MODE: strict character fidelity override. Recreate the exact same protagonist model from the canonical character sheet. Hair silhouette, face proportions, eyes, and hairstyle details are immutable.');
  }

  if (safeMode) {
    parts.push('Safety constraints: child-friendly scene, fully clothed characters, no nudity, no violence, no injury, no medical context, no frightening content.');
  }

  // Build final prompt
  const finalPrompt = parts.join('. ');

  return {
    prompt: finalPrompt,
    metadata: {
      artisticStyle: visualIdentity.artisticStyle,
      characterReference: visualIdentity.mainCharacter?.referenceImage,
      colorPalette: visualIdentity.mainCharacter?.colorPalette,
      characterDescriptors: getCharacterDescriptors(visualIdentity.mainCharacter),
      retryForConsistency,
      generatedAt: new Date().toISOString()
    }
  };
};

export const validateRevisedPromptConsistency = (revisedPrompt, visualIdentity) => {
  const fallback = {
    isConsistent: true,
    score: 1,
    anchorRequirementMet: true,
    anchorMatchedTokens: [],
    anchorExpectedTokens: [],
    matchedTokens: [],
    expectedTokens: []
  };

  if (!revisedPrompt || !visualIdentity?.mainCharacter) {
    return fallback;
  }

  const expectedTokens = getCharacterDescriptors(visualIdentity.mainCharacter);
  if (expectedTokens.length === 0) {
    return fallback;
  }

  const revisedTokenSet = toTokenSet(revisedPrompt);
  const matchedTokens = expectedTokens.filter(token => revisedTokenSet.includes(token));
  const score = matchedTokens.length / expectedTokens.length;

  const anchorExpectedTokens = getHairFaceAnchorTokens(visualIdentity.mainCharacter);
  const anchorMatchedTokens = anchorExpectedTokens.filter(token => revisedTokenSet.includes(token));
  const minAnchorMatches = Math.min(2, anchorExpectedTokens.length);
  const anchorRequirementMet = minAnchorMatches === 0 || anchorMatchedTokens.length >= minAnchorMatches;

  return {
    isConsistent: score >= CONSISTENCY_MIN_SCORE && anchorRequirementMet,
    score,
    anchorRequirementMet,
    anchorMatchedTokens,
    anchorExpectedTokens,
    matchedTokens,
    expectedTokens
  };
};

/**
 * Validates that visual identity is ready for image generation
 */
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

/**
 * Example usage:
 * 
 * const { prompt, metadata } = buildImagePrompt(
 *   'The hero discovers a magical forest',
 *   project.visualIdentity,
 *   {
 *     includeCharacter: true,
 *     sceneDescription: 'sunny afternoon, tall trees, mystical atmosphere',
 *     additionalContext: 'wide angle view'
 *   }
 * );
 * 
 * // Use prompt with DALL-E API
 * const image = await generateImage(prompt);
 * 
 * // Store metadata with the image
 * saveImage(image, metadata);
 */
