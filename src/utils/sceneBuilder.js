/**
 * Scene Builder Utility
 * Generates concise, visual scene descriptions for image generation
 * based on page text, book summary, and characters
 */

import { createTransientOpenAIError } from './openaiServiceGuard';

/**
 * Builds a visual scene description from page content
 * @param {Object} params - Scene building parameters
 * @param {string} params.pageText - Text content of the page
 * @param {string} params.bookSummary - Overall book summary
 * @param {Array} params.characters - List of characters
 * @param {number} params.targetAge - Target age of readers
 * @param {string} params.openaiServiceUrl - URL of OpenAI service
 * @returns {Promise<string>} Visual scene description (2-5 sentences)
 */
const SCENE_BUILDER_TIMEOUT_MS = 60_000;

export async function buildSceneDescription({
  pageText,
  bookSummary,
  characters,
  targetAge,
  openaiServiceUrl
}) {
  if (!pageText || pageText.trim().length === 0) {
    throw new Error('Page text is required to build a scene description');
  }

  if (!openaiServiceUrl) {
    throw createTransientOpenAIError('Le service OpenAI est en cours d\'initialisation. Relancez la génération dans quelques secondes.');
  }

  // Build character context without fixed visual details
  const characterContext = characters && characters.length > 0
    ? characters.map((char) => {
        const parts = [`${char.name || 'Personnage'}`];
        if (char.role) parts.push(char.role);
        return parts.join(', ');
      }).join('\n')
    : 'Aucun personnage défini';

  // Build the prompt for scene generation
  const systemPrompt = `Tu es un expert en description visuelle pour livres jeunesse.
Ta mission : transformer le texte d'une page en une description de scène courte, visuelle et précise pour un illustrateur.

Règles strictes :
- 2 à 5 phrases maximum
- Focus sur ce qui doit être VISIBLE (actions, décor, ambiance, composition)
- Éviter les concepts abstraits
- Utiliser un vocabulaire simple adapté à l'âge cible
- Décrire la composition (premier plan, arrière-plan)
- Mentionner les couleurs et l'atmosphère si pertinent
- Être concret et imagé
- Ne pas redéfinir l'identité visuelle fixe du personnage principal : pas de nouvelle coiffure, pas de nouveau visage, pas de nouvelle tenue, pas de nouvelle palette
- Ne pas réinventer le style artistique`;

  const userPrompt = `Contexte du livre :
${bookSummary || 'Livre pour enfants'}

Personnages :
${characterContext}

Âge cible : ${targetAge || '3-6'} ans

Texte de la page :
"${pageText}"

Génère une description de scène visuelle courte (2-5 phrases) pour cette page.
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
      throw createTransientOpenAIError('Impossible de contacter le service OpenAI pour générer la scène.', error);
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

    return sceneDescription;
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

  const lowerScene = sceneDescription.toLowerCase();

  const moodKeywords = ['joyeux', 'triste', 'effrayant', 'magique', 'calme', 'excitant', 'mystérieux'];
  for (const mood of moodKeywords) {
    if (lowerScene.includes(mood)) {
      elements.mood = mood;
      break;
    }
  }

  const settingKeywords = ['forêt', 'maison', 'jardin', 'école', 'parc', 'plage', 'montagne', 'ville'];
  for (const setting of settingKeywords) {
    if (lowerScene.includes(setting)) {
      elements.setting = setting;
      break;
    }
  }

  return elements;
}
