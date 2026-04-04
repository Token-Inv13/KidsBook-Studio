/**
 * Scene Builder Utility
 * Generates concise, visual scene descriptions for image generation
 * based on page text, book summary, and characters
 */

import { createTransientOpenAIError } from './openaiServiceGuard';

const SCENE_BUILDER_TIMEOUT_MS = 60_000;

const toCleanString = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.replace(/\s+/g, ' ').trim();
};

const compactText = (value, max = 220) => toCleanString(value).slice(0, max);

const toNormalizedText = (value) => toCleanString(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const getPrimaryCharacterName = (characters = []) => {
  const firstCharacter = Array.isArray(characters)
    ? characters.find((entry) => entry && typeof entry === 'object')
    : null;

  return toCleanString(firstCharacter?.name) || 'main character';
};

const inferMood = (text = '') => {
  const lower = toNormalizedText(text);
  const moodMap = [
    ['joyeux', 'joyful'],
    ['calme', 'calm'],
    ['magique', 'magical'],
    ['mysterieux', 'mysterious'],
    ['tempete', 'stormy'],
    ['peur', 'tense'],
    ['rain', 'gentle']
  ];

  for (const [needle, mood] of moodMap) {
    if (lower.includes(needle)) {
      return mood;
    }
  }

  return 'gentle';
};

const inferSetting = (text = '', bookSummary = '') => {
  const lower = toNormalizedText(`${toCleanString(text)} ${toCleanString(bookSummary)}`);
  const settingMap = [
    ['foret', 'forest'],
    ['foret lumineuse', 'forest'],
    ['forest', 'forest'],
    ['village', 'village'],
    ['maison', 'home'],
    ['jardin', 'garden'],
    ['ecole', 'school'],
    ['plage', 'beach'],
    ['ville', 'town']
  ];

  for (const [needle, setting] of settingMap) {
    if (lower.includes(needle)) {
      return setting;
    }
  }

  return 'story scene';
};

export const buildSceneBlueprint = ({
  pageText,
  bookSummary,
  characters,
  targetAge,
  template
}) => {
  const subject = getPrimaryCharacterName(characters);
  const action = compactText(pageText, 180) || 'the character moves through the scene';
  const setting = inferSetting(pageText, bookSummary);
  const mood = inferMood(pageText);
  const composition = template === 'double_page' || template === 'double-page'
    ? 'wide panoramic spread'
    : template === 'full_illustration' || template === 'illustration-pleine'
      ? 'full-page immersive scene'
      : 'single clear scene';

  return {
    version: '1.0',
    subject,
    action,
    setting,
    mood,
    composition,
    targetAge: toCleanString(targetAge) || null,
    allowedChanges: ['background', 'framing', 'props'],
    lockedIdentity: subject,
    sourceText: compactText(pageText, 260)
  };
};

export const formatSceneBlueprint = (sceneBlueprint) => {
  if (!sceneBlueprint || typeof sceneBlueprint !== 'object') {
    return '';
  }

  return [
    `SCENE BLUEPRINT: subject=${sceneBlueprint.subject || 'main character'}`,
    `action=${sceneBlueprint.action || ''}`,
    `setting=${sceneBlueprint.setting || ''}`,
    `mood=${sceneBlueprint.mood || ''}`,
    `composition=${sceneBlueprint.composition || ''}`,
    `locked identity=${sceneBlueprint.lockedIdentity || ''}`
  ].join('; ');
};

const buildLocalSceneDescription = (sceneBlueprint) => {
  const subject = sceneBlueprint?.subject || 'Le personnage principal';
  const action = sceneBlueprint?.action || 'avance dans la scene';
  const setting = sceneBlueprint?.setting || 'un decor simple';
  const mood = sceneBlueprint?.mood || 'douce';
  const composition = sceneBlueprint?.composition || 'scene claire';

  return `${subject} ${action}. La scene se situe dans ${setting} avec une ambiance ${mood}. La composition doit rester ${composition}.`;
};

/**
 * Builds a visual scene description from page content
 * @param {Object} params - Scene building parameters
 * @param {string} params.pageText - Text content of the page
 * @param {string} params.bookSummary - Overall book summary
 * @param {Array} params.characters - List of characters
 * @param {number} params.targetAge - Target age of readers
 * @param {string} params.openaiServiceUrl - URL of OpenAI service
 * @param {string} params.template - Page template
 * @returns {Promise<{description: string, blueprint: object}>} Visual scene description and structured blueprint
 */
export async function buildSceneDescription({
  pageText,
  bookSummary,
  characters,
  targetAge,
  openaiServiceUrl,
  template
}) {
  if (!pageText || pageText.trim().length === 0) {
    throw new Error('Page text is required to build a scene description');
  }

  const sceneBlueprint = buildSceneBlueprint({
    pageText,
    bookSummary,
    characters,
    targetAge,
    template
  });

  const characterContext = characters && characters.length > 0
    ? characters.map((char) => {
        const parts = [`${char.name || 'Personnage'}`];
        if (char.role) parts.push(char.role);
        return parts.join(', ');
      }).join('\n')
    : 'Aucun personnage defini';

  if (!openaiServiceUrl) {
    return {
      description: buildLocalSceneDescription(sceneBlueprint),
      blueprint: sceneBlueprint
    };
  }

  const systemPrompt = `Tu es un expert en description visuelle pour livres jeunesse.
Ta mission : transformer le texte d'une page en une description de scene courte, visuelle et precise pour un illustrateur.

Regles strictes :
- 2 a 5 phrases maximum
- Focus sur ce qui doit etre visible (actions, decor, ambiance, composition)
- Eviter les concepts abstraits
- Utiliser un vocabulaire simple adapte a l'age cible
- Decrire la composition (premier plan, arriere-plan)
- Mentionner les couleurs et l'atmosphere si pertinent
- Etre concret et image
- Ne pas redefinir l'identite visuelle fixe du personnage principal : pas de nouvelle coiffure, pas de nouveau visage, pas de nouvelle tenue, pas de nouvelle palette
- Ne pas reinventer le style artistique`;

  const userPrompt = `Contexte du livre :
${bookSummary || 'Livre pour enfants'}

Personnages :
${characterContext}

Age cible : ${targetAge || '3-6'} ans

Cadre de scene :
${formatSceneBlueprint(sceneBlueprint)}

Texte de la page :
"${pageText}"

Genere une description de scene visuelle courte (2-5 phrases) pour cette page.
Concentre-toi sur l'action, le lieu, l'ambiance et la composition.`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SCENE_BUILDER_TIMEOUT_MS);

    let response;
    try {
      response = await fetch(`${openaiServiceUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]
        }),
        signal: controller.signal
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw createTransientOpenAIError(`Scene builder timed out after ${SCENE_BUILDER_TIMEOUT_MS}ms`, error);
      }
      throw createTransientOpenAIError('Impossible de contacter le service OpenAI pour generer la scene.', error);
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate scene description');
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to generate scene description');
    }

    const sceneDescription = data.content.trim();

    return {
      description: sceneDescription,
      blueprint: sceneBlueprint
    };
  } catch (error) {
    console.error('Scene builder error:', error);
    throw error;
  }
}

/**
 * Validates scene description quality
 * @param {string} sceneDescription - The scene description to validate
 * @returns {Object} Validation result with isValid and issues
 */
export function validateSceneDescription(sceneDescription) {
  const issues = [];

  if (!sceneDescription || sceneDescription.trim().length === 0) {
    issues.push('Scene description is empty');
  }

  if (sceneDescription.length < 20) {
    issues.push('Scene description is too short (minimum 20 characters)');
  }

  if (sceneDescription.length > 1000) {
    issues.push('Scene description is too long (maximum 1000 characters)');
  }

  const sentences = sceneDescription.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  if (sentences.length > 7) {
    issues.push('Scene description has too many sentences (maximum 7)');
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

/**
 * Extracts key visual elements from scene description
 * @param {string} sceneDescription - The scene description
 * @returns {Object} Extracted elements (characters, setting, mood, actions)
 */
export function extractVisualElements(sceneDescription) {
  const elements = {
    characters: [],
    setting: null,
    mood: null,
    actions: []
  };

  const lowerScene = toNormalizedText(sceneDescription);

  const moodKeywords = ['joyeux', 'triste', 'effrayant', 'magique', 'calme', 'excitant', 'mysteri'];
  for (const mood of moodKeywords) {
    if (lowerScene.includes(mood)) {
      elements.mood = mood;
      break;
    }
  }

  const settingKeywords = ['foret', 'maison', 'jardin', 'ecole', 'parc', 'plage', 'montagne', 'ville'];
  for (const setting of settingKeywords) {
    if (lowerScene.includes(setting)) {
      elements.setting = setting;
      break;
    }
  }

  return elements;
}
