import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { X, Sparkles, Loader, BookOpen } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { createPageFromTemplate } from '../utils/writingLayout';
import { optimizeNarrativeProjectLayout } from '../utils/narrativeLayoutEngine';

const PAGE_BLOCK_REGEX = /Page\s+(\d+)\s*:\s*\n?\s*TEXTE\s*:\s*([\s\S]*?)\n\s*ILLUSTRATION\s*:\s*([\s\S]*?)(?=\n\s*Page\s+\d+\s*:|$)/gi;

const parsePagesFromStory = (story) => {
  const pageMap = new Map();
  const pageMatches = story.matchAll(PAGE_BLOCK_REGEX);

  for (const match of pageMatches) {
    const pageNumber = Number.parseInt(match[1], 10);
    if (!Number.isFinite(pageNumber) || pageNumber <= 0) {
      continue;
    }

    pageMap.set(pageNumber, {
      text: String(match[2] || '').trim(),
      illustration: String(match[3] || '').trim()
    });
  }

  return pageMap;
};

const StoryEngineModal = ({ onClose }) => {
  const { currentProject, updateProject, callOpenAI } = useApp();
  const [formData, setFormData] = useState({
    theme: '',
    mainCharacter: '',
    problem: '',
    moral: '',
    targetPages: Number(currentProject?.targetPages) || 24
  });
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState('');

  const handleGenerate = async () => {
    if (!formData.theme || !formData.mainCharacter || !formData.problem) {
      alert('Veuillez remplir au minimum le thème, le personnage principal et le problème.');
      return;
    }

    setGenerating(true);
    setProgress('Génération de l\'histoire...');

    try {
      const prompt = `Tu es un auteur expert de livres pour enfants de ${currentProject.targetAge} ans.

Crée une histoire complète avec les éléments suivants :
- Thème : ${formData.theme}
- Personnage principal : ${formData.mainCharacter}
- Problème rencontré : ${formData.problem}
${formData.moral ? `- Morale : ${formData.moral}` : ''}
- Type de livre : ${currentProject.bookType}
- Nombre de pages cible : ${formData.targetPages}

IMPORTANT : Structure ta réponse EXACTEMENT comme suit :

RÉSUMÉ:
[Un résumé de 2-3 phrases de l'histoire complète]

PERSONNAGES:
- [Nom personnage 1]: [Description courte]
- [Nom personnage 2]: [Description courte]
(etc.)

PAGES:
Page 1:
TEXTE: [Le texte exact à afficher sur cette page, adapté à l'âge ${currentProject.targetAge} ans]
ILLUSTRATION: [Description détaillée de l'illustration nécessaire pour cette page]

Page 2:
TEXTE: [Le texte exact à afficher sur cette page]
ILLUSTRATION: [Description détaillée de l'illustration]

(Continue pour ${formData.targetPages} pages)

Assure-toi que :
- Le langage est adapté à des enfants de ${currentProject.targetAge} ans
- Chaque page a entre 1 et 3 phrases maximum
- L'histoire a un début, un milieu et une fin claire
- Les illustrations sont décrites de manière cohérente visuellement
- L'histoire est captivante et éducative`;

      const story = await callOpenAI([
        { role: 'user', content: prompt }
      ], { max_tokens: Math.min(8000, Math.max(3000, formData.targetPages * 240)) });

      setProgress('Analyse de l\'histoire...');
      
      const summaryMatch = story.match(/RÉSUMÉ:\s*([^\n]+(?:\n[^\n]+)*?)(?=\n\n|PERSONNAGES:|$)/i);
      const summary = summaryMatch ? summaryMatch[1].trim() : '';

      const charactersSection = story.match(/PERSONNAGES:\s*([\s\S]*?)(?=\n\nPAGES:|$)/i);
      const characters = [];
      if (charactersSection) {
        const characterLines = charactersSection[1].split('\n').filter(line => line.trim().startsWith('-'));
        characterLines.forEach(line => {
          const match = line.match(/-\s*([^:]+):\s*(.+)/);
          if (match) {
            characters.push({
              id: uuidv4(),
              name: match[1].trim(),
              description: match[2].trim(),
              age: '',
              appearance: match[2].trim(),
              clothing: '',
              personality: ''
            });
          }
        });
      }

      setProgress('Création des pages...');

      const targetPages = Number(formData.targetPages) || 24;
      const pageContentMap = parsePagesFromStory(story);

      if (pageContentMap.size < targetPages) {
        const missingPageNumbers = Array.from({ length: targetPages }, (_, index) => index + 1)
          .filter((pageNumber) => !pageContentMap.has(pageNumber));

        if (missingPageNumbers.length > 0) {
          setProgress('Complétion des pages manquantes...');
          const completionPrompt = `Complète les pages manquantes d'un livre jeunesse.
Pages manquantes : ${missingPageNumbers.join(', ')}

IMPORTANT :
- Réponds UNIQUEMENT avec les pages demandées
- Utilise EXACTEMENT ce format pour chaque page :
Page X:
TEXTE: ...
ILLUSTRATION: ...
- 1 à 3 phrases par page
- Cohérence avec le thème "${formData.theme}" et le personnage "${formData.mainCharacter}".`;

          const completion = await callOpenAI([
            { role: 'user', content: completionPrompt }
          ], { max_tokens: Math.min(3500, Math.max(1200, missingPageNumbers.length * 240)) });

          const completionMap = parsePagesFromStory(completion);
          completionMap.forEach((value, key) => {
            if (!pageContentMap.has(key)) {
              pageContentMap.set(key, value);
            }
          });
        }
      }

      const pages = [];
      for (let pageNumber = 1; pageNumber <= targetPages; pageNumber += 1) {
        const pageData = pageContentMap.get(pageNumber) || {
          text: 'Texte à compléter.',
          illustration: 'Illustration à compléter.'
        };
        const text = pageData.text;
        const illustration = pageData.illustration;

        const pageTemplate = pageNumber === 1
          ? 'illustration-pleine'
          : (pageNumber % 3 === 0 ? 'double-page' : 'mixte');

        const seededPage = createPageFromTemplate(pageTemplate, pageNumber, currentProject.format, {
          illustrationPrompt: illustration
        });

        const firstBlock = seededPage.textBlocks?.[0];
        const textBlocks = firstBlock
          ? seededPage.textBlocks.map((block, index) => (index === 0 ? { ...block, content: text } : block))
          : [];

        const imageZones = (seededPage.imageZones || []).map((zone, index) => (
          index === 0 ? { ...zone, prompt: illustration } : zone
        ));

        pages.push({
          ...seededPage,
          textBlocks,
          imageZones,
          illustrationPrompt: illustration
        });
      }

      if (pages.length === 0) {
        throw new Error('Aucune page n\'a pu être extraite. Veuillez réessayer.');
      }

      setProgress('Finalisation...');

      const narrativePages = await optimizeNarrativeProjectLayout(
        { ...currentProject, pages },
        { mode: 'full' }
      );

      await updateProject({
        pages: narrativePages,
        targetPages,
        summary,
        characters,
        storyGenerated: true,
        generatedAt: new Date().toISOString()
      });

      setProgress('Histoire créée avec succès !');
      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (error) {
      console.error('Story generation error:', error);
      setProgress('');
      alert(`Erreur : ${error.message}`);
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-t-xl">
          <div className="flex items-center gap-3">
            <BookOpen size={24} />
            <h2 className="text-2xl font-bold">Créer un livre complet</h2>
          </div>
          <button
            onClick={onClose}
            disabled={generating}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>✨ Story Engine</strong> : L'IA va créer une histoire complète structurée, 
              découper automatiquement en pages et remplir votre livre.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Thème de l'histoire *
            </label>
            <input
              type="text"
              value={formData.theme}
              onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
              placeholder="Ex: L'amitié, le courage, la nature..."
              disabled={generating}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Personnage principal *
            </label>
            <input
              type="text"
              value={formData.mainCharacter}
              onChange={(e) => setFormData({ ...formData, mainCharacter: e.target.value })}
              placeholder="Ex: Un petit dragon timide, une fille curieuse..."
              disabled={generating}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Problème rencontré *
            </label>
            <textarea
              value={formData.problem}
              onChange={(e) => setFormData({ ...formData, problem: e.target.value })}
              placeholder="Ex: Il a peur de voler, elle cherche son doudou perdu..."
              disabled={generating}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Morale (optionnel)
            </label>
            <input
              type="text"
              value={formData.moral}
              onChange={(e) => setFormData({ ...formData, moral: e.target.value })}
              placeholder="Ex: Il faut croire en soi, l'entraide est importante..."
              disabled={generating}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre de pages cible
            </label>
            <select
              value={formData.targetPages}
              onChange={(e) => setFormData({ ...formData, targetPages: parseInt(e.target.value) })}
              disabled={generating}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100"
            >
              <option value={8}>8 pages</option>
              <option value={12}>12 pages</option>
              <option value={16}>16 pages</option>
              <option value={20}>20 pages</option>
              <option value={24}>24 pages</option>
              <option value={32}>32 pages</option>
            </select>
          </div>

          {generating && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Loader size={20} className="animate-spin text-indigo-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-indigo-900">{progress}</p>
                  <div className="mt-2 h-2 bg-indigo-200 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-600 rounded-full animate-pulse" style={{ width: '60%' }} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            disabled={generating}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
          >
            Annuler
          </button>

          <button
            onClick={handleGenerate}
            disabled={generating || !formData.theme || !formData.mainCharacter || !formData.problem}
            className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
          >
            <Sparkles size={18} />
            {generating ? 'Génération en cours...' : 'Générer l\'histoire'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StoryEngineModal;
