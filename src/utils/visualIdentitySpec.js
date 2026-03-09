const SPEC_VERSION = '1.0';

const toCleanString = (value) => {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
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

const buildInvariants = ({ mainCharacter, artStyle }) => {
  const invariants = [];

  if (mainCharacter.name) {
    invariants.push(`Conserver ${mainCharacter.name} avec la meme morphologie et les memes traits.`);
  }

  if (mainCharacter.appearance) {
    invariants.push(`Apparence cle: ${mainCharacter.appearance}`);
  }

  if (mainCharacter.description) {
    invariants.push(`Description cle: ${mainCharacter.description}`);
  }

  if (mainCharacter.colorPalette.length > 0) {
    invariants.push(`Palette verrouillee: ${mainCharacter.colorPalette.join(', ')}`);
  }

  if (artStyle.id || artStyle.prompt) {
    invariants.push('Le style artistique et la texture doivent rester constants sur tout le livre.');
  }

  return invariants;
};

export const buildVisualIdentitySpec = ({ project, mainCharacterData }) => {
  const mainCharacter = {
    name: toCleanString(mainCharacterData?.name),
    appearance: toCleanString(mainCharacterData?.appearance),
    description: toCleanString(mainCharacterData?.description),
    clothing: toCleanString(mainCharacterData?.clothing),
    referencePrompt: toCleanString(mainCharacterData?.referencePrompt),
    colorPalette: normalizePalette(mainCharacterData?.colorPalette)
  };

  const artStyle = {
    id: toCleanString(project?.artStyle || project?.visualIdentity?.artisticStyle),
    prompt: toCleanString(project?.visualIdentity?.stylePrompt)
  };

  const spec = {
    version: SPEC_VERSION,
    mainCharacter,
    artStyle,
    invariants: []
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

  return {
    ok: errors.length === 0,
    errors
  };
};
