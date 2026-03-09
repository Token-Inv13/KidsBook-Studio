import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { X, Scissors, Loader } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const TextDistributor = ({ onClose }) => {
  const { currentProject, updateProject, callOpenAI } = useApp();
  const [longText, setLongText] = useState('');
  const [distributing, setDistributing] = useState(false);

  const handleDistribute = async () => {
    if (!longText.trim()) {
      alert('Veuillez coller votre texte.');
      return;
    }

    if (!currentProject?.pages || currentProject.pages.length === 0) {
      alert('Créez d\'abord des pages dans votre livre.');
      return;
    }

    setDistributing(true);

    try {
      const prompt = `Tu es un expert en mise en page de livres jeunesse.

Voici un texte long à distribuer sur ${currentProject.pages.length} pages :

${longText}

Découpe ce texte en ${currentProject.pages.length} parties cohérentes, adaptées à des enfants de ${currentProject.targetAge} ans.

IMPORTANT : Réponds UNIQUEMENT avec le format suivant (rien d'autre) :

PAGE 1:
[Texte pour la page 1]

PAGE 2:
[Texte pour la page 2]

(etc. pour ${currentProject.pages.length} pages)

Règles :
- Chaque page doit avoir 1 à 3 phrases maximum
- Les coupures doivent être naturelles et narratives
- Adapte le vocabulaire à l'âge ${currentProject.targetAge} ans
- Maintiens la cohérence de l'histoire`;

      const response = await callOpenAI([
        { role: 'user', content: prompt }
      ], { max_tokens: 3000 });

      const pageMatches = response.matchAll(/PAGE\s+(\d+):\s*([^\n]+(?:\n(?!PAGE\s+\d+:)[^\n]+)*)/gi);
      const distributedTexts = [];

      for (const match of pageMatches) {
        const pageNum = parseInt(match[1]);
        const text = match[2].trim();
        distributedTexts.push({ pageNum, text });
      }

      if (distributedTexts.length === 0) {
        throw new Error('Impossible de découper le texte. Veuillez réessayer.');
      }

      const updatedPages = currentProject.pages.map((page, index) => {
        const distributed = distributedTexts.find(d => d.pageNum === index + 1);
        
        if (distributed) {
          const baseWidth = currentProject.format?.unit === 'mm' 
            ? currentProject.format.width * 3.7795275591 
            : currentProject.format?.width * 96 || 816;
          
          const baseHeight = currentProject.format?.unit === 'mm' 
            ? currentProject.format.height * 3.7795275591 
            : currentProject.format?.height * 96 || 816;

          const bleed = currentProject.format?.bleed ? 12 : 0;
          const safeArea = 24;

          const newTextBlock = {
            id: uuidv4(),
            type: 'text',
            content: distributed.text,
            style: 'narration',
            x: bleed + safeArea + 40,
            y: baseHeight - 200,
            width: baseWidth - (bleed * 2) - (safeArea * 2) - 80,
            height: 120,
            fontSize: 16,
            fontFamily: 'Georgia',
            color: '#2c3e50',
            textAlign: 'left'
          };

          return {
            ...page,
            textBlocks: [...(page.textBlocks || []), newTextBlock]
          };
        }
        
        return page;
      });

      await updateProject({ pages: updatedPages });
      alert(`Texte distribué sur ${distributedTexts.length} pages avec succès !`);
      onClose();

    } catch (error) {
      console.error('Text distribution error:', error);
      alert(`Erreur : ${error.message}`);
    } finally {
      setDistributing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Scissors size={24} className="text-indigo-600" />
            <h2 className="text-2xl font-bold text-gray-800">Distribuer le texte sur les pages</h2>
          </div>
          <button
            onClick={onClose}
            disabled={distributing}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>📝 Comment ça marche :</strong> Collez votre histoire longue ci-dessous. 
              L'IA va la découper intelligemment et la répartir sur vos {currentProject?.pages?.length || 0} pages existantes.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Votre texte long
            </label>
            <textarea
              value={longText}
              onChange={(e) => setLongText(e.target.value)}
              placeholder="Collez ici votre histoire complète..."
              disabled={distributing}
              rows={12}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100 font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              {longText.length} caractères • ~{Math.ceil(longText.split(/\s+/).length / 50)} pages estimées
            </p>
          </div>

          {distributing && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Loader size={20} className="animate-spin text-indigo-600" />
                <p className="text-sm font-medium text-indigo-900">
                  Découpage intelligent en cours...
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            disabled={distributing}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
          >
            Annuler
          </button>

          <button
            onClick={handleDistribute}
            disabled={distributing || !longText.trim()}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Scissors size={18} />
            {distributing ? 'Distribution...' : 'Distribuer sur les pages'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TextDistributor;
