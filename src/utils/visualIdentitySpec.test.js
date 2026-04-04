/** @jest-environment node */

import {
  buildVisualIdentityPromptProfile,
  buildVisualIdentitySpec,
  validateVisualIdentitySpec
} from './visualIdentitySpec';

describe('visualIdentitySpec', () => {
  const baseProject = {
    artStyle: 'aquarelle',
    visualIdentity: {
      stylePrompt: 'soft watercolor illustration, gentle washes, children\'s book style'
    }
  };

  const mainCharacterData = {
    name: 'Mia',
    age: '6',
    appearance: 'round face, freckles, brown bob haircut',
    description: 'friendly child with a bright smile',
    clothing: 'yellow raincoat',
    referencePrompt: 'canonical character sheet',
    referenceImagePath: '/tmp/reference.png',
    referenceImages: [
      {
        url: 'https://example.com/reference-alt.png',
        mimeType: 'image/png'
      }
    ],
    trainingArtifacts: {
      provider: 'fal.ai',
      triggerWord: 'mia_kidsbook'
    },
    colorPalette: ['#F2C14E', '#4A90E2']
  };

  test('builds a prompt profile with explicit identity, style, palette and scene guards', () => {
    const profile = buildVisualIdentityPromptProfile({
      mainCharacter: mainCharacterData,
      artStyle: {
        id: 'aquarelle',
        prompt: 'soft watercolor illustration, gentle washes, children\'s book style'
      }
    });

    expect(profile.identityHash).toMatch(/^[0-9a-f]{8}$/);
    expect(profile.promptSections.invariantPrompt).toContain('Mia');
    expect(profile.promptSections.invariantPrompt).toContain('6-year-old');
    expect(profile.promptSections.stylePrompt).toContain('soft watercolor illustration');
    expect(profile.promptSections.palettePrompt).toContain('#F2C14E');
    expect(profile.promptSections.referencePrompt).toContain('canonical visual anchor');
    expect(profile.promptSections.sceneGuardPrompt).toContain('scene may vary');
    expect(profile.consistencyAnchors.faceHair.length).toBeGreaterThan(0);
    expect(profile.consistencyAnchors.age).toContain('6-year-old');
  });

  test('buildVisualIdentitySpec persists the derived prompt profile', () => {
    const spec = buildVisualIdentitySpec({
      project: baseProject,
      mainCharacterData
    });

    expect(spec.version).toBe('2.1');
    expect(spec.promptProfile).toBeDefined();
    expect(spec.generationPolicy).toBeDefined();
    expect(spec.characterPack).toBeDefined();
    expect(spec.stylePack).toBeDefined();
    expect(spec.characterPack.canonicalReference.imageId).toBe('main-character-reference');
    expect(spec.characterPack.referenceImageCount).toBe(2);
    expect(spec.characterPack.trainingReady).toBe(true);
    expect(spec.characterPack.multiReferenceReady).toBe(true);
    expect(spec.trainingArtifacts).toBeDefined();
    expect(spec.trainingArtifacts.provider).toBe('fal.ai');
    expect(spec.stylePack.referenceImages).toHaveLength(1);
    expect(spec.promptProfile.promptSections.policyPrompt).toContain('strict identity mode');
    expect(spec.promptProfile.promptSections.qualityPrompt).toContain('no text');
    expect(spec.invariants).toContain('Palette verrouillee: #F2C14E, #4A90E2');
    expect(spec.invariants).toContain('Reference image lock: the selected visual identity image is canonical and must be replicated exactly.');
    expect(spec.generationPolicy.allowProviderFallback).toBe(false);
  });

  test('validateVisualIdentitySpec accepts enriched prompt profiles', () => {
    const spec = buildVisualIdentitySpec({
      project: baseProject,
      mainCharacterData
    });

    const validation = validateVisualIdentitySpec(spec);

    expect(validation.ok).toBe(true);
    expect(validation.errors).toEqual([]);
  });
});
