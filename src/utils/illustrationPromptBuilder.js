const toCleanString = (value) => {
  if (typeof value !== 'string') {
    return '';
  }
  return value.replace(/\s+/g, ' ').trim();
};

const toShortText = (value, max = 700) => toCleanString(value).slice(0, max);

const normalizeSpec = (spec) => {
  const mainCharacter = spec?.mainCharacter || {
    name: spec?.character?.name || '',
    appearance: spec?.character?.appearance || '',
    description: spec?.character?.description || '',
    clothing: spec?.character?.clothing || '',
    referencePrompt: spec?.referencePrompt || '',
    colorPalette: Array.isArray(spec?.palette) ? spec.palette : []
  };

  return {
    artStyle: {
      id: toCleanString(spec?.artStyle?.id),
      prompt: toCleanString(spec?.artStyle?.prompt)
    },
    mainCharacter: {
      name: toCleanString(mainCharacter?.name),
      appearance: toCleanString(mainCharacter?.appearance),
      description: toCleanString(mainCharacter?.description),
      clothing: toCleanString(mainCharacter?.clothing),
      referencePrompt: toShortText(mainCharacter?.referencePrompt, 900),
      colorPalette: Array.isArray(mainCharacter?.colorPalette)
        ? mainCharacter.colorPalette.map((color) => toCleanString(color)).filter(Boolean)
        : []
    },
    invariants: Array.isArray(spec?.invariants)
      ? spec.invariants.map((item) => toCleanString(item)).filter(Boolean)
      : []
  };
};

const getTemplateInstructions = (template) => {
  const normalized = toCleanString(template).toLowerCase();

  if (normalized === 'full_illustration' || normalized === 'illustration-pleine') {
    return 'Template: pleine illustration. Composer une image pleine page, immersive, sans zone vide prevue pour du texte ajoute.';
  }

  if (normalized === 'mixed' || normalized === 'mixte') {
    return 'Template: mixte. Composer une scene lisible en reservant une zone calme et peu detaillee pour insertion du texte editorial.';
  }

  if (normalized === 'double_page' || normalized === 'double-page') {
    return 'Template: double-page. Composer une scene panoramique continue sur deux pages, en evitant les details critiques dans la gouttiere centrale.';
  }

  return 'Template: standard. Composer une scene claire et coherent avec une mise en page jeunesse.';
};

export const buildIllustrationPrompt = ({ spec, page, template, pageText }) => {
  const normalized = normalizeSpec(spec);
  const styleLabel = normalized.artStyle.prompt || normalized.artStyle.id || 'children book illustration style';
  const palette = normalized.mainCharacter.colorPalette.join(', ');
  const appearance = normalized.mainCharacter.appearance || 'appearance not specified';
  const description = normalized.mainCharacter.description || 'description not specified';
  const referencePrompt = normalized.mainCharacter.referencePrompt || 'reference prompt unavailable';
  const invariants = normalized.invariants.length > 0
    ? normalized.invariants.map((rule, index) => `${index + 1}. ${rule}`).join(' ')
    : '1. Keep visual consistency with the established character identity.';
  const sceneContext = toShortText(pageText, 1000) || 'No page text provided.';
  const templateInstructions = getTemplateInstructions(template || page?.template);

  const promptParts = [
    `Page ${page?.number || '?'}, illustration de livre jeunesse.`,
    `Style artistique (spec.artStyle): ${styleLabel}.`,
    `Palette a respecter (spec.mainCharacter.colorPalette): ${palette || 'not specified'}.`,
    `C - Appearance (spec.mainCharacter.appearance): ${appearance}.`,
    `C - Description (spec.mainCharacter.description): ${description}.`,
    `Ancre referencePrompt (spec.mainCharacter.referencePrompt): ${referencePrompt}.`,
    `Invariants (spec.invariants): ${invariants}.`,
    'Anti-divergence rules: same character, same outfit, same face, same proportions.',
    'Image rules: no text, no watermark.',
    templateInstructions,
    `Contexte scene depuis le texte de page: ${sceneContext}. Decrire la scene visuellement (actions, lieu, ambiance) sans aucun texte visible dans limage.`
  ];

  const negativePrompt = [
    'text',
    'letters',
    'caption',
    'watermark',
    'logo',
    'signature',
    'different character design',
    'different outfit',
    'different face proportions'
  ].join(', ');

  return {
    prompt: promptParts.join(' '),
    negativePrompt
  };
};

