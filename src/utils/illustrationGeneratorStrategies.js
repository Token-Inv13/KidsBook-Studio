import { buildIllustrationPrompt } from './illustrationPromptBuilder';

const buildAdditionalGuidedContext = (constraintBundle, strategy) => {
  const parts = [];

  if (constraintBundle?.reference?.derivedDescriptor) {
    parts.push(`Reference-derived descriptor: ${constraintBundle.reference.derivedDescriptor}`);
  }

  if (Array.isArray(constraintBundle?.invariants) && constraintBundle.invariants.length > 0) {
    parts.push(`Locked invariants: ${constraintBundle.invariants.join(' | ')}`);
  }

  if (strategy?.mode === 'guided') {
    parts.push(constraintBundle?.guidance?.sameCharacterDirective || '');
    parts.push('Use the same face structure, same eyes, same proportions, same hairstyle silhouette, and same outfit identity.');
    parts.push(constraintBundle?.guidance?.noReinterpretationDirective || '');
  }

  return parts.filter(Boolean).join(' ');
};

const createPromptFromBundle = ({
  constraintBundle,
  strategy,
  safeMode,
  consistencyAttempt,
  candidateIndex,
  candidateCount,
  maxConsistencyAttempts
}) => {
  const continuityContext = [
    constraintBundle?.continuity?.promptLine || '',
    `Generator strategy: ${strategy.label}. Candidate ${candidateIndex + 1}/${candidateCount}.`,
    consistencyAttempt > 0 ? `Consistency retry attempt ${consistencyAttempt + 1}/${maxConsistencyAttempts}.` : '',
    safeMode ? 'Safety mode enabled: child-friendly, fully clothed, no violence, no frightening content.' : ''
  ].filter(Boolean).join(' ');

  const result = buildIllustrationPrompt({
    spec: constraintBundle.spec,
    page: {
      number: constraintBundle?.page?.number || null,
      template: constraintBundle?.page?.template || null
    },
    template: constraintBundle?.page?.template || null,
    pageText: constraintBundle?.page?.text || '',
    sceneDescription: constraintBundle?.page?.sceneDescription || '',
    continuityContext,
    additionalContext: buildAdditionalGuidedContext(constraintBundle, strategy),
    retryForConsistency: strategy.retryForConsistency || consistencyAttempt > 0,
    safeMode,
    strongReferenceMode: strategy.mode !== 'text-only'
  });

  return {
    ...result,
    strategyMetadata: {
      id: strategy.id,
      mode: strategy.mode,
      label: strategy.label,
      supportsNativeReference: strategy.supportsNativeReference
    }
  };
};

export const GENERATOR_STRATEGIES = {
  textOnlyGenerator: {
    id: 'text-only-generator',
    mode: 'text-only',
    label: 'textOnlyGenerator',
    supportsNativeReference: false,
    retryForConsistency: false
  },
  guidedGenerator: {
    id: 'guided-generator',
    mode: 'guided',
    label: 'guidedGenerator',
    supportsNativeReference: false,
    retryForConsistency: true
  },
  futureReferenceNativeGenerator: {
    id: 'future-reference-native-generator',
    mode: 'reference-native',
    label: 'futureReferenceNativeGenerator',
    supportsNativeReference: true,
    retryForConsistency: true
  }
};

export const selectGeneratorStrategy = ({ passName }) => {
  if (passName === 'pass-2') {
    return GENERATOR_STRATEGIES.guidedGenerator;
  }

  return GENERATOR_STRATEGIES.textOnlyGenerator;
};

export const prepareGeneratorRequest = ({
  constraintBundle,
  strategy,
  safeMode,
  consistencyAttempt,
  candidateIndex,
  candidateCount,
  maxConsistencyAttempts
}) => createPromptFromBundle({
  constraintBundle,
  strategy,
  safeMode,
  consistencyAttempt,
  candidateIndex,
  candidateCount,
  maxConsistencyAttempts
});
