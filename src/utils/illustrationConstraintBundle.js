import { stableHash } from './hash';
import { validateVisualIdentitySpec } from './visualIdentitySpec';

const toCleanString = (value) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '');

const compactText = (value, max = 420) => toCleanString(value).slice(0, max);

const getContinuityContext = (pages, page) => {
  const previousIllustration = (pages || [])
    .filter((candidate) => (candidate.number || 0) < (page.number || 0))
    .sort((left, right) => (right.number || 0) - (left.number || 0))
    .find((candidate) => candidate?.illustration?.revised_prompt || candidate?.illustrationPrompt);

  if (!previousIllustration) {
    return {
      previousPageNumber: null,
      previousRevisedPrompt: '',
      promptLine: ''
    };
  }

  const previousRevisedPrompt = previousIllustration?.illustration?.revised_prompt || previousIllustration?.illustrationPrompt || '';
  return {
    previousPageNumber: previousIllustration.number || null,
    previousRevisedPrompt,
    promptLine: `Continuity reference from previous validated page: ${compactText(previousRevisedPrompt, 420)}`
  };
};

const buildReferenceDerivedDescriptor = (mainCharacter = {}) => {
  const fragments = [
    mainCharacter.referencePrompt,
    mainCharacter.appearance,
    mainCharacter.description,
    mainCharacter.clothing
  ]
    .map((value) => compactText(value, 240))
    .filter(Boolean);

  return fragments.join(' | ');
};

const buildNegativeConstraints = (spec = {}) => {
  const promptNegative = spec?.promptProfile?.promptSections?.negativePrompt || '';
  return promptNegative
    .split(',')
    .map((entry) => toCleanString(entry))
    .filter(Boolean);
};

export const buildIllustrationConstraintBundle = ({
  currentProject,
  page,
  pageText,
  sceneDescription,
  sceneSpec = null
}) => {
  const specValidation = validateVisualIdentitySpec(currentProject?.visualIdentitySpec);
  if (!specValidation.ok) {
    throw new Error(`visualIdentitySpec invalide: ${specValidation.errors.join(' | ')}`);
  }

  const spec = currentProject.visualIdentitySpec;
  const mainCharacter = spec?.mainCharacter || {};
  const identityHash = stableHash(spec);
  const continuity = getContinuityContext(currentProject?.pages || [], page);
  const referenceDerivedDescriptor = buildReferenceDerivedDescriptor(mainCharacter);
  const generationPolicy = spec?.generationPolicy || spec?.promptProfile?.generationPolicy || null;

  return {
    version: '2.1',
    identityHash,
    spec,
    generationPolicy,
    characterPack: spec?.characterPack || null,
    stylePack: spec?.stylePack || null,
    trainingArtifacts: spec?.trainingArtifacts || null,
    sceneSpec: sceneSpec || null,
    page: {
      id: page?.id || null,
      number: page?.number || null,
      template: page?.template || null,
      text: pageText,
      sceneDescription: compactText(sceneDescription, 700)
    },
    reference: {
      imageId: mainCharacter.referenceImageId || 'main-character-reference',
      imagePath: mainCharacter.referenceImagePath || null,
      imageUrl: mainCharacter.referenceImage || null,
      hasReferenceImage: Boolean(mainCharacter.referenceImage || mainCharacter.referenceImagePath || mainCharacter.referenceImageBase64),
      derivedDescriptor: referenceDerivedDescriptor
    },
    invariants: Array.isArray(spec?.invariants) ? spec.invariants : [],
    style: {
      id: spec?.artStyle?.id || null,
      prompt: spec?.artStyle?.prompt || null
    },
    palette: Array.isArray(mainCharacter?.colorPalette) ? mainCharacter.colorPalette : [],
    negatives: buildNegativeConstraints(spec),
    continuity,
    guidance: {
      sameCharacterDirective: 'The character MUST be visually identical to the reference image.',
      noReinterpretationDirective: 'This is not a reinterpretation and not a new version of the character.',
      futureNativeReferenceReady: true
    },
    futureVisualScoring: {
      referenceComparisonReady: Boolean(mainCharacter.referenceImage || mainCharacter.referenceImagePath || mainCharacter.referenceImageBase64),
      interPageComparisonReady: Boolean(continuity.previousRevisedPrompt),
      externalVisualRerankerReady: true
    }
  };
};

export const summarizeConstraintBundle = (bundle) => ({
  version: bundle?.version || '2.1',
  identityHash: bundle?.identityHash || null,
  pageNumber: bundle?.page?.number || null,
  template: bundle?.page?.template || null,
  referenceImageId: bundle?.reference?.imageId || null,
  hasReferenceImage: Boolean(bundle?.reference?.hasReferenceImage),
  referenceDerivedDescriptor: bundle?.reference?.derivedDescriptor || '',
  characterPackId: bundle?.characterPack?.id || null,
  characterReferenceCount: Number(bundle?.characterPack?.referenceImageCount || 0),
  multiReferenceReady: Boolean(bundle?.characterPack?.multiReferenceReady),
  trainingArtifacts: bundle?.trainingArtifacts || null,
  stylePackId: bundle?.stylePack?.id || null,
  invariantCount: Array.isArray(bundle?.invariants) ? bundle.invariants.length : 0,
  palette: Array.isArray(bundle?.palette) ? bundle.palette : [],
  continuityFromPage: bundle?.continuity?.previousPageNumber || null,
  sceneSpec: bundle?.sceneSpec || null,
  generationPolicy: bundle?.generationPolicy || null,
  futureVisualScoring: bundle?.futureVisualScoring || null
});
