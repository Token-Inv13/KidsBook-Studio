import { buildIllustrationPrompt, validateRevisedPromptConsistency } from './illustrationPromptBuilder';
import { buildVisualIdentityPromptProfile } from './visualIdentitySpec';

/**
 * Backward-compatible wrapper for legacy callers.
 * The new prompt hierarchy lives in illustrationPromptBuilder.
 */
export const buildImagePrompt = (basePrompt, visualIdentity, options = {}) => {
  if (!visualIdentity) {
    throw new Error('Visual identity is required');
  }

  const profile = visualIdentity.promptProfile || buildVisualIdentityPromptProfile(visualIdentity);
  const response = buildIllustrationPrompt({
    spec: {
      ...visualIdentity,
      promptProfile: profile
    },
    page: options.page || null,
    template: options.template || options.page?.template,
    pageText: basePrompt,
    sceneDescription: options.sceneDescription || '',
    continuityContext: options.additionalContext || '',
    retryForConsistency: Boolean(options.retryForConsistency),
    safeMode: Boolean(options.safeMode),
    additionalContext: options.additionalContext || ''
  });

  return {
    prompt: response.prompt,
    metadata: {
      ...response.metadata,
      promptSections: response.promptSections
    }
  };
};

export { validateRevisedPromptConsistency };
