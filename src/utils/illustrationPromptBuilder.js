import { buildVisualIdentityPromptProfile } from './visualIdentitySpec';

const GLOBAL_NEGATIVE_CONSTRAINTS = [
  'No color palette panel',
  'No UI elements',
  'No design sheet',
  'No reference board',
  'No presentation board',
  'No split layout',
  'No multi-panel composition',
  'No grids',
  'No labels or callouts',
  'No studio sheet backdrop',
  'No multiple character variations in the same image',
  'No layout or concept art presentation'
];

const FINAL_ILLUSTRATION_RULE = 'The image must look like a final children\'s book illustration, not a concept sheet or design board.';

const NON_NARRATIVE_ARTIFACT_PATTERNS = [
  {
    key: 'colorPalettePanel',
    label: 'color palette panel',
    pattern: /\b(color palette panel|palette panel|palette chart|color chart|color swatches?|swatch sheet|swatch panel)\b/i
  },
  {
    key: 'uiElements',
    label: 'UI elements',
    pattern: /\b(ui elements?|user interface|interface overlay|toolbar|sidebar|hud|app screen|menu screen)\b/i
  },
  {
    key: 'designSheet',
    label: 'design sheet',
    pattern: /\b(design sheet|character sheet|model sheet|concept sheet)\b/i
  },
  {
    key: 'referenceBoard',
    label: 'reference board',
    pattern: /\b(reference board|mood board|inspiration board|reference sheet)\b/i
  },
  {
    key: 'gridLayout',
    label: 'grid layout',
    pattern: /\b(character sheet grid|grid layout|panel grid|layout grid|gridded layout|thumbnail grid|storybook grid)\b/i
  },
  {
    key: 'multipleCharacterVariations',
    label: 'multiple character variations',
    pattern: /\b(multiple character variations?|character variations?|character lineup|turnaround sheet|pose sheet|multiple poses)\b/i
  },
  {
    key: 'conceptPresentation',
    label: 'layout or concept art presentation',
    pattern: /\b(layout presentation|layout board|concept art presentation|concept board|presentation board|design presentation|art presentation board)\b/i
  },
  {
    key: 'calloutLabels',
    label: 'callout labels',
    pattern: /\b(labeled callouts?|annotation(?:s)?|annotated arrows?|labeled diagram|notes around the character|editorial callouts?)\b/i
  },
  {
    key: 'multiPanelComposition',
    label: 'multi-panel composition',
    pattern: /\b(triptych|diptych|split screen|split layout|three views|multi-panel|panel composition|front[,/ ]+side[,/ ]+back view|front and side view|front side back turnaround)\b/i
  },
  {
    key: 'repetitiveComposition',
    label: 'repetitive composition',
    pattern: /\b(repeating panels?|repeated poses?|same character repeated|multiple copies of the character|lineup of poses|pose lineup)\b/i
  },
  {
    key: 'nonNarrativeBackdrop',
    label: 'non-narrative backdrop',
    pattern: /\b(plain studio backdrop|white seamless background|product backdrop|catalog background|showcase board|studio sheet|sheet-like composition|backdrop studio)\b/i
  }
];

const HARD_REJECT_ARTIFACT_KEYS = new Set([
  'colorPalettePanel',
  'uiElements',
  'designSheet',
  'referenceBoard',
  'gridLayout',
  'conceptPresentation',
  'calloutLabels',
  'multiPanelComposition',
  'nonNarrativeBackdrop'
]);

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
    'The character MUST be visually identical to the reference image.',
    'Use the same face structure, same eyes, same proportions, same hairstyle silhouette, and same outfit identity.',
    'Do not create a new version of the character.',
    'This is not a reinterpretation.',
    'Do NOT reinterpret or redesign the character.',
    'This is the SAME character, not a variation.'
  ].join(' ');
};

const buildReferenceDerivedDescriptionLine = (mainCharacter) => {
  const referenceDerivedFragments = [
    mainCharacter?.referencePrompt,
    mainCharacter?.appearance,
    mainCharacter?.description,
    mainCharacter?.clothing
  ]
    .map((value) => toShortText(value, 260))
    .filter(Boolean);

  if (referenceDerivedFragments.length === 0) {
    return '';
  }

  return `REFERENCE-DERIVED CHARACTER DESCRIPTION: ${referenceDerivedFragments.join(' | ')}. Preserve these reference-derived traits exactly.`;
};

const buildSafetyLine = (safeMode) => {
  if (!safeMode) {
    return '';
  }

  return 'SAFETY MODE: keep a gentle, age-appropriate children\'s storybook moment with everyday clothing, friendly expressions, calm body language, soft atmosphere, and a simple readable composition focused on one reassuring scene.';
};

const buildFragileCaseLine = (fragileConsistencyMode) => {
  if (!fragileConsistencyMode) {
    return '';
  }

  return [
    'FRAGILE CASE LOCK: prioritize character identity over spectacle or novelty.',
    'Keep the exact same face, hair silhouette, body proportions, and outfit silhouette as the canonical reference.',
    'Use a single final-book composition, not a board, sheet, layout, presentation, split screen, or multi-panel image.',
    'No labels, no callouts, no grids, no UI-like elements, no palette display, no reference-sheet framing.',
    'Keep the art style and palette tightly locked, with a simple scene interpretation and minimal extra props.'
  ].join(' ');
};

const combinePromptSections = (sections) => {
  return sections
    .map((section) => toCleanString(section))
    .filter(Boolean)
    .join('\n\n');
};

const combineNegativePromptSections = (sections) => {
  const entries = sections
    .flatMap((section) => toCleanString(section).split(','))
    .map((entry) => toCleanString(entry))
    .filter(Boolean);

  return [...new Set(entries)].join(', ');
};

const buildFinalIllustrationLine = () => {
  return `FINAL ILLUSTRATION RULE: ${FINAL_ILLUSTRATION_RULE}`;
};

const buildGlobalNegativeConstraintLine = () => {
  return `GLOBAL NEGATIVE CONSTRAINTS: ${GLOBAL_NEGATIVE_CONSTRAINTS.join('; ')}.`;
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

const explicitDriftPenaltyRules = [
  {
    key: 'faceDrift',
    label: 'face drift',
    pattern: /\b(different face|new face|changed face|older face|younger face)\b/i,
    penalty: 0.35
  },
  {
    key: 'hairDrift',
    label: 'hair drift',
    pattern: /\b(different hair|new hairstyle|different hairstyle|blue hair|green hair|purple hair)\b/i,
    penalty: 0.3
  },
  {
    key: 'styleDrift',
    label: 'style drift',
    pattern: /\b(photorealistic|3d render|semi 3d|anime style|oil painting|comic book style)\b/i,
    penalty: 0.3
  },
  {
    key: 'parasiteElements',
    label: 'parasite elements',
    pattern: /\b(logo|watermark|palette chart|character sheet|concept board|ui elements?|reference board|split layout|multi-panel)\b/i,
    penalty: 0.4
  }
];

const getExplicitDriftPenalties = (value) => {
  const normalized = toCleanString(value);
  if (!normalized) {
    return [];
  }

  return explicitDriftPenaltyRules.reduce((matches, rule) => {
    const match = normalized.match(rule.pattern);
    if (!match) {
      return matches;
    }

    return [
      ...matches,
      {
        key: rule.key,
        label: rule.label,
        match: match[0],
        penalty: rule.penalty
      }
    ];
  }, []);
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

const detectNonNarrativeArtifactPatterns = (value) => {
  const normalized = toCleanString(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (!normalized) {
    return [];
  }

  const isNegatedArtifactMention = (matchIndex) => {
    const contextStart = Math.max(0, matchIndex - 120);
    const context = normalized.slice(contextStart, matchIndex);
    const clauseStart = Math.max(
      context.lastIndexOf('.'),
      context.lastIndexOf('!'),
      context.lastIndexOf('?'),
      context.lastIndexOf('\n')
    );
    const clause = clauseStart >= 0 ? context.slice(clauseStart + 1) : context;

    return /\b(no|without|avoid|excluding|exclude|omit|sans|pas de|aucun(?:e)?|do not include|don't include|not a|not an)\b/i.test(clause);
  };

  return NON_NARRATIVE_ARTIFACT_PATTERNS.reduce((matches, rule) => {
    const matched = normalized.match(rule.pattern);

    if (!matched) {
      return matches;
    }

    const matchIndex = normalized.search(rule.pattern);
    if (matchIndex >= 0 && isNegatedArtifactMention(matchIndex)) {
      return matches;
    }

    return [
      ...matches,
      {
        key: rule.key,
        label: rule.label,
        match: matched[0]
      }
    ];
  }, []);
};

const getHardRejectedArtifacts = (artifacts = []) => {
  return artifacts.filter((artifact) => HARD_REJECT_ARTIFACT_KEYS.has(artifact.key));
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
  safeMode = false,
  strongReferenceMode = false,
  fragileConsistencyMode = false
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
  const referenceDerivedDescription = buildReferenceDerivedDescriptionLine(mainCharacter);
  const safetyLine = buildSafetyLine(safeMode);
  const fragileCaseLine = buildFragileCaseLine(fragileConsistencyMode);
  const finalIllustrationPrompt = buildFinalIllustrationLine();
  const negativeConstraintPrompt = buildGlobalNegativeConstraintLine();
  const policyPrompt = profile.promptSections?.policyPrompt || '';
  const strongReferenceLine = strongReferenceMode
    ? 'STRONG VISUAL MATCH MODE: treat the reference image as a hard visual constraint. Keep the exact same face geometry, eye shape, hair silhouette, outfit silhouette, and body proportions. Reject any redesign, age shift, style shift, parasite element, or non-narrative composition.'
    : '';
  const promptOrder = [
    'invariantPrompt',
    'referencePrompt',
    'referenceDerivedDescription',
    'strongReferencePrompt',
    'stylePrompt',
    'palettePrompt',
    'fragileConsistencyPrompt',
    'sceneGuardPrompt',
    'policyPrompt',
    'pagePrompt',
    'scenePrompt',
    'continuityPrompt',
    'templatePrompt',
    'additionalPrompt',
    'finalIllustrationPrompt',
    'negativeConstraintPrompt',
    'qualityPrompt',
    'safetyPrompt'
  ];

  const promptSections = {
    invariantPrompt: profile.promptSections?.invariantPrompt || '',
    referencePrompt: profile.promptSections?.referencePrompt || referenceLine,
    referenceDerivedDescription,
    strongReferencePrompt: strongReferenceLine,
    stylePrompt: profile.promptSections?.stylePrompt || '',
    palettePrompt: profile.promptSections?.palettePrompt || '',
    fragileConsistencyPrompt: fragileCaseLine,
    sceneGuardPrompt: profile.promptSections?.sceneGuardPrompt || '',
    policyPrompt,
    pagePrompt: pageNarrative ? `PAGE NARRATIVE: ${pageNarrative}` : '',
    scenePrompt: sceneText ? `SCENE DIRECTION: ${sceneText}` : '',
    continuityPrompt: continuityLine,
    templatePrompt: templateInstructions,
    finalIllustrationPrompt,
    negativeConstraintPrompt,
    qualityPrompt: profile.promptSections?.qualityPrompt || '',
    safetyPrompt: safetyLine,
    additionalPrompt: additionalContext ? `ADDITIONAL CONTEXT: ${toShortText(additionalContext, 500)}` : '',
    negativePrompt: combineNegativePromptSections([
      profile.promptSections?.negativePrompt || '',
      GLOBAL_NEGATIVE_CONSTRAINTS.join(', ')
    ])
  };

  const prompt = combinePromptSections([
    promptSections.invariantPrompt,
    promptSections.referencePrompt,
    promptSections.referenceDerivedDescription,
    promptSections.strongReferencePrompt,
    promptSections.stylePrompt,
    promptSections.palettePrompt,
    promptSections.fragileConsistencyPrompt,
    promptSections.sceneGuardPrompt,
    promptSections.policyPrompt,
    promptSections.pagePrompt,
    promptSections.scenePrompt,
    promptSections.continuityPrompt,
    promptSections.templatePrompt,
    promptSections.additionalPrompt,
    promptSections.finalIllustrationPrompt,
    promptSections.negativeConstraintPrompt,
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
      strongReferenceMode,
      fragileConsistencyMode,
      generatedAt: new Date().toISOString(),
      identityHash: profile.identityHash,
      promptSections,
      promptOrder,
      consistencyAnchors: profile.consistencyAnchors,
      promptTrace: {
        identityHash: profile.identityHash,
        pageNumber: page?.number || null,
        template: template || page?.template || null,
        sectionOrder: promptOrder,
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
    weightedPenalty: 0,
    hardRejected: false,
    hardRejectedArtifacts: [],
    anchorRequirementMet: true,
    anchorMatchedTokens: [],
    anchorExpectedTokens: [],
    matchedTokens: [],
    expectedTokens: [],
    detectedNonNarrativeArtifacts: [],
    explicitDriftPenalties: [],
    inconsistencyReasons: [],
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

  const rawScore = Object.entries(groupScores).reduce((sum, [group, result]) => {
    return sum + ((result.score || 0) * weights[group]);
  }, 0);
  const detectedNonNarrativeArtifacts = detectNonNarrativeArtifactPatterns(revisedPrompt);
  const hasNonNarrativeArtifacts = detectedNonNarrativeArtifacts.length > 0;
  const hardRejectedArtifacts = getHardRejectedArtifacts(detectedNonNarrativeArtifacts);
  const hardRejectSeverity = hardRejectedArtifacts.length >= 2
    || (hardRejectedArtifacts.length >= 1 && detectedNonNarrativeArtifacts.length >= 3)
    ? 'strong'
    : hardRejectedArtifacts.length >= 1
      ? 'penalized'
      : 'none';
  const hardRejected = hardRejectSeverity === 'strong';
  const explicitDriftPenalties = getExplicitDriftPenalties(revisedPrompt);
  const weightedPenalty = explicitDriftPenalties.reduce((sum, entry) => sum + entry.penalty, 0)
    + (hardRejected ? 1.1 : hardRejectSeverity === 'penalized' ? 0.52 : 0)
    + (hasNonNarrativeArtifacts ? Math.max(0.55, detectedNonNarrativeArtifacts.length * 0.2) : 0)
    + (groupScores.faceHair.score < 0.55 ? 0.42 : 0)
    + (groupScores.faceHair.score < 0.4 ? 0.24 : 0)
    + (groupScores.clothing.score < 0.2 && identityTokens.clothingTokens.length > 0 ? 0.12 : 0)
    + (groupScores.style.score < 0.2 && styleTokens.length > 0 ? 0.18 : 0)
    + (groupScores.palette.score < 0.2 && paletteTokens.length > 0 ? 0.12 : 0);
  const score = Math.max(0, rawScore - weightedPenalty);

  const anchorExpectedTokens = [
    ...profile.consistencyAnchors?.faceHair || [],
    ...profile.consistencyAnchors?.style || []
  ].filter(Boolean);
  const anchorMatchedTokens = anchorExpectedTokens.filter((token) => revisedTokenSet.includes(token));
  const anchorRequirementMet = (groupScores.faceHair.score >= 0.55)
    && (styleTokens.length === 0 || groupScores.style.score >= 0.2);

  const flags = {
    faceSimilarityProxy: groupScores.faceHair.score >= 0.55,
    faceStable: groupScores.faceHair.score >= 0.55,
    hairstyleStable: groupScores.faceHair.score >= 0.55,
    ageStable: identityTokens.ageTokens.length === 0 || groupScores.age.score >= 0.5,
    clothingStable: identityTokens.clothingTokens.length === 0 || groupScores.clothing.score >= 0.45,
    styleAdherence: styleTokens.length === 0 || groupScores.style.score >= 0.25,
    styleStable: styleTokens.length === 0 || groupScores.style.score >= 0.25,
    paletteAdherence: paletteTokens.length === 0 || groupScores.palette.score >= 0.35,
    paletteStable: paletteTokens.length === 0 || groupScores.palette.score >= 0.35,
    finalIllustrationPresentation: !hasNonNarrativeArtifacts,
    parasiteElementsDetected: hasNonNarrativeArtifacts,
    hardArtifactReject: hardRejected,
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
  const inconsistencyReasons = detectedNonNarrativeArtifacts.map((artifact) => {
    return `Detected ${artifact.label} pattern in revised prompt: "${artifact.match}"`;
  });
  hardRejectedArtifacts.forEach((artifact) => {
    inconsistencyReasons.push(`Hard reject artifact detected: ${artifact.label}`);
  });
  explicitDriftPenalties.forEach((entry) => {
    inconsistencyReasons.push(`Detected ${entry.label} signal in revised prompt: "${entry.match}"`);
  });

  return {
    isConsistent: !hardRejected
      && score >= 0.74
      && flags.faceSimilarityProxy
      && flags.clothingStable
      && flags.styleAdherence
      && flags.paletteAdherence
      && flags.finalIllustrationPresentation
      && explicitDriftPenalties.length === 0,
    score,
    weightedPenalty,
    hardRejected,
    hardRejectSeverity,
    hardRejectedArtifacts,
    anchorRequirementMet,
    anchorMatchedTokens,
    anchorExpectedTokens,
    matchedTokens: combinedMatchedTokens,
    expectedTokens: combinedExpectedTokens,
    detectedNonNarrativeArtifacts,
    explicitDriftPenalties,
    inconsistencyReasons,
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
