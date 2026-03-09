import { v4 as uuidv4 } from 'uuid';

export const PROJECT_SCHEMA_VERSION = 1;
export const PAGE_ILLUSTRATION_ROLE = 'page-illustration';
export const CHARACTER_REFERENCE_ROLE = 'character-reference';

const DEFAULT_BLEED_INCHES = 0.125;

const LEGACY_FORMAT_PRESETS = {
  '8.5x8.5': { id: '8.5x8.5', label: '8.5x8.5 pouces (carre jeunesse)', width: 8.5, height: 8.5, unit: 'inches' },
  '8x10': { id: '8x10', label: '8x10 pouces', width: 8, height: 10, unit: 'inches' },
  '6x9': { id: '6x9', label: '6x9 pouces', width: 6, height: 9, unit: 'inches' },
  a4: { id: 'a4', label: 'A4 (210x297mm)', width: 210, height: 297, unit: 'mm' }
};

const toFiniteNumber = (value) => {
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : value;
  return Number.isFinite(parsed) ? parsed : null;
};

const toNonEmptyString = (value) => {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
};

const inferOrientation = (width, height) => {
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return 'portrait';
  }
  if (Math.abs(width - height) < 0.001) {
    return 'square';
  }
  return width > height ? 'landscape' : 'portrait';
};

const normalizeBleed = (value, unit) => {
  if (value === true) {
    return unit === 'mm' ? 3.2 : DEFAULT_BLEED_INCHES;
  }

  if (value === false || value == null) {
    return 0;
  }

  const parsed = toFiniteNumber(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
};

const findPresetFromLegacyFormat = (format = {}) => {
  const preset = toNonEmptyString(format.id || format.preset).toLowerCase();
  if (!preset) {
    return null;
  }

  if (LEGACY_FORMAT_PRESETS[preset]) {
    return LEGACY_FORMAT_PRESETS[preset];
  }

  const matchedPreset = Object.values(LEGACY_FORMAT_PRESETS).find((candidate) => {
    const candidateLabel = candidate.label.toLowerCase();
    return preset === candidate.id.toLowerCase() || preset === candidateLabel;
  });

  return matchedPreset || null;
};

export const createCanonicalBookFormat = (input = {}) => {
  const preset = findPresetFromLegacyFormat(input);
  const unit = toNonEmptyString(input.unit || preset?.unit || 'inches').toLowerCase() === 'mm' ? 'mm' : 'inches';
  const width = toFiniteNumber(input.width) ?? preset?.width ?? 8.5;
  const height = toFiniteNumber(input.height) ?? preset?.height ?? 8.5;
  const bleed = normalizeBleed(input.bleed, unit);

  const derivedId = preset?.id || (
    unit === 'mm'
      ? `${width}x${height}mm`
      : `${width}x${height}`
  );

  const label = toNonEmptyString(input.label || input.preset || preset?.label) || (
    unit === 'mm'
      ? `${width}x${height} mm`
      : `${width}x${height} pouces`
  );

  return {
    id: derivedId,
    label,
    preset: label,
    width,
    height,
    unit,
    bleed,
    orientation: inferOrientation(width, height)
  };
};

const normalizeMetadata = (project = {}) => ({
  title: toNonEmptyString(project.metadata?.title || project.title),
  author: toNonEmptyString(project.metadata?.author || project.author),
  targetAge: toNonEmptyString(project.metadata?.targetAge || project.targetAge),
  bookType: toNonEmptyString(project.metadata?.bookType || project.bookType),
  summary: toNonEmptyString(project.metadata?.summary || project.summary),
  description: toNonEmptyString(project.metadata?.description || project.description),
  language: toNonEmptyString(project.metadata?.language) || 'fr',
  tags: Array.isArray(project.metadata?.tags) ? project.metadata.tags.filter(Boolean) : []
});

export const createProjectImageAsset = (image = {}, pageId = null) => {
  const localPath = toNonEmptyString(image.localPath || image.imageLocalPath || image.referenceImagePath);
  const url = toNonEmptyString(image.url || image.imageUrl || image.referenceImage);
  const role = toNonEmptyString(image.role) || PAGE_ILLUSTRATION_ROLE;
  const derivedId = pageId ? `${role}:${pageId}` : (role === CHARACTER_REFERENCE_ROLE ? `${CHARACTER_REFERENCE_ROLE}:main` : uuidv4());
  const id = toNonEmptyString(image.id) || derivedId;

  return {
    id,
    pageId,
    role,
    url: url || null,
    localPath: localPath || null,
    originalUrl: toNonEmptyString(image.originalUrl) || null,
    revisedPrompt: toNonEmptyString(image.revisedPrompt || image.revised_prompt) || null,
    promptFinal: toNonEmptyString(image.promptFinal) || null,
    model: toNonEmptyString(image.model) || null,
    size: toNonEmptyString(image.size) || null,
    quality: toNonEmptyString(image.quality) || null,
    requestId: toNonEmptyString(image.requestId) || null,
    generationStatus: toNonEmptyString(image.generationStatus) || 'ready',
    sourcePageId: toNonEmptyString(image.sourcePageId) || pageId || null,
    createdAt: toNonEmptyString(image.createdAt || image.selectedAt || image.generatedAt) || null
  };
};

const normalizeImageEntry = (image = {}, pageId = null) => createProjectImageAsset(image, pageId);

const normalizePage = (page = {}, index = 0) => {
  const normalizedPage = {
    ...page,
    id: toNonEmptyString(page.id) || uuidv4(),
    number: Number.isFinite(page.number) ? page.number : index + 1,
    template: toNonEmptyString(page.template) || 'mixte',
    textBlocks: Array.isArray(page.textBlocks) ? page.textBlocks : [],
    imageZones: Array.isArray(page.imageZones) ? page.imageZones : [],
    imageAssetId: toNonEmptyString(page.imageAssetId || page.illustration?.assetId) || null,
    imageUrl: toNonEmptyString(page.imageUrl) || null,
    imageLocalPath: toNonEmptyString(page.imageLocalPath) || null
  };

  if (page.illustration && typeof page.illustration === 'object') {
    normalizedPage.illustration = {
      ...page.illustration,
      assetId: toNonEmptyString(page.illustration.assetId || normalizedPage.imageAssetId) || null,
      url: toNonEmptyString(page.illustration.url) || normalizedPage.imageUrl,
      localPath: toNonEmptyString(page.illustration.localPath) || normalizedPage.imageLocalPath || null
    };
  }

  if (!normalizedPage.imageAssetId && (normalizedPage.imageUrl || normalizedPage.imageLocalPath || normalizedPage.illustration?.url || normalizedPage.illustration?.localPath)) {
    normalizedPage.imageAssetId = `${PAGE_ILLUSTRATION_ROLE}:${normalizedPage.id}`;
  }

  return normalizedPage;
};

const buildImagesIndex = (project) => {
  const images = [];

  for (const page of project.pages) {
    if (page.imageUrl || page.imageLocalPath || page.illustration?.url || page.illustration?.localPath) {
      images.push(normalizeImageEntry({
        id: page.imageAssetId || page.illustration?.assetId || undefined,
        ...page.illustration,
        role: PAGE_ILLUSTRATION_ROLE,
        imageUrl: page.imageUrl,
        imageLocalPath: page.imageLocalPath,
        sourcePageId: page.id,
        promptFinal: page.generationMeta?.promptFinal,
        model: page.generationMeta?.model,
        size: page.generationMeta?.size,
        quality: page.generationMeta?.quality,
        requestId: page.generationMeta?.requestId,
        generationStatus: 'ready',
        createdAt: page.generationMeta?.createdAt || page.illustration?.selectedAt
      }, page.id));
    }
  }

  const mainCharacter = project.visualIdentity?.mainCharacter;
  if (mainCharacter?.referenceImage || mainCharacter?.referenceImagePath) {
    images.push(normalizeImageEntry({
      id: 'main-character-reference',
      role: CHARACTER_REFERENCE_ROLE,
      referenceImage: mainCharacter.referenceImage,
      referenceImagePath: mainCharacter.referenceImagePath,
      createdAt: project.visualIdentity?.validatedAt || null
    }));
  }

  if (Array.isArray(project.images)) {
    project.images.forEach((image) => {
      const normalized = normalizeImageEntry(image, image.pageId || null);
      if (!images.some((existing) => existing.id === normalized.id)) {
        images.push(normalized);
      }
    });
  }

  return images;
};

export const migrateProject = (inputProject = {}) => {
  const project = inputProject && typeof inputProject === 'object' ? inputProject : {};
  const metadata = normalizeMetadata(project);
  const bookFormat = createCanonicalBookFormat(project.bookFormat || project.format || {});
  const pages = Array.isArray(project.pages)
    ? project.pages.map((page, index) => normalizePage(page, index))
    : [];

  const migrated = {
    ...project,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    metadata,
    bookFormat,
    format: {
      ...bookFormat,
      preset: bookFormat.label
    },
    title: metadata.title,
    author: metadata.author,
    targetAge: metadata.targetAge,
    bookType: metadata.bookType,
    summary: metadata.summary || project.summary || '',
    description: metadata.description || project.description || '',
    pages,
    characters: Array.isArray(project.characters) ? project.characters : [],
    images: [],
    visualIdentitySpec: Object.prototype.hasOwnProperty.call(project, 'visualIdentitySpec')
      ? project.visualIdentitySpec
      : null,
    generationMeta: project.generationMeta && typeof project.generationMeta === 'object'
      ? project.generationMeta
      : {},
    coverData: project.coverData && typeof project.coverData === 'object'
      ? project.coverData
      : null
  };

  migrated.images = buildImagesIndex(migrated);

  return migrated;
};

export const validateProjectSchema = (project) => {
  const errors = [];

  if (!project || typeof project !== 'object') {
    return {
      ok: false,
      errors: ['Projet invalide ou vide.']
    };
  }

  if (!Number.isInteger(project.schemaVersion) || project.schemaVersion < 1) {
    errors.push('schemaVersion est manquant ou invalide.');
  }

  if (!project.metadata || typeof project.metadata !== 'object') {
    errors.push('metadata est manquant.');
  }

  const format = project.bookFormat || project.format;
  if (!format || typeof format !== 'object') {
    errors.push('bookFormat est manquant.');
  } else {
    if (!toNonEmptyString(format.id)) {
      errors.push('bookFormat.id est requis.');
    }
    if (!Number.isFinite(format.width) || format.width <= 0) {
      errors.push('bookFormat.width doit etre un nombre positif.');
    }
    if (!Number.isFinite(format.height) || format.height <= 0) {
      errors.push('bookFormat.height doit etre un nombre positif.');
    }
    if (!['inches', 'mm'].includes(toNonEmptyString(format.unit))) {
      errors.push('bookFormat.unit doit etre "inches" ou "mm".');
    }
  }

  if (!Array.isArray(project.pages)) {
    errors.push('pages doit etre un tableau.');
  } else {
    const seenPageIds = new Set();
    project.pages.forEach((page, index) => {
      if (!page || typeof page !== 'object') {
        errors.push(`pages[${index}] est invalide.`);
        return;
      }

      if (!toNonEmptyString(page.id)) {
        errors.push(`pages[${index}].id est requis.`);
      } else if (seenPageIds.has(page.id)) {
        errors.push(`pages[${index}].id est duplique.`);
      } else {
        seenPageIds.add(page.id);
      }

      if (!Number.isFinite(page.number) || page.number <= 0) {
        errors.push(`pages[${index}].number doit etre positif.`);
      }

      if (!Array.isArray(page.textBlocks)) {
        errors.push(`pages[${index}].textBlocks doit etre un tableau.`);
      }
    });
  }

  if (!Array.isArray(project.characters)) {
    errors.push('characters doit etre un tableau.');
  }

  if (!Array.isArray(project.images)) {
    errors.push('images doit etre un tableau.');
  } else {
    const seenImageIds = new Set();
    project.images.forEach((image, index) => {
      if (!image || typeof image !== 'object') {
        errors.push(`images[${index}] est invalide.`);
        return;
      }

      if (!toNonEmptyString(image.id)) {
        errors.push(`images[${index}].id est requis.`);
      } else if (seenImageIds.has(image.id)) {
        errors.push(`images[${index}].id est duplique.`);
      } else {
        seenImageIds.add(image.id);
      }

      if (image.pageId && !project.pages.some((page) => page.id === image.pageId)) {
        errors.push(`images[${index}].pageId reference une page inconnue.`);
      }
    });
  }

  return {
    ok: errors.length === 0,
    errors
  };
};

export const prepareProjectForSave = (project) => {
  const migrated = migrateProject(project);
  const validation = validateProjectSchema(migrated);

  if (!validation.ok) {
    const error = new Error(`Projet invalide: ${validation.errors.join(' | ')}`);
    error.validationErrors = validation.errors;
    throw error;
  }

  return migrated;
};
