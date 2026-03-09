import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { BookOpen, RefreshCw, Loader } from 'lucide-react';

const BookSummaryPanel = () => {
  const { currentProject, updateProject, callOpenAI } = useApp();
  const [generating, setGenerating] = useState(false);
  const [summary, setSummary] = useState('');

  useEffect(() => {
    if (currentProject?.summary) {
      setSummary(currentProject.summary);
    }
  }, [currentProject]);

  const generateSummary = async () => {
    if (!currentProject?.pages || currentProject.pages.length === 0) {
      alert('Ajoutez des pages avec du texte avant de générer un résumé.');
      return;
    }

    setGenerating(true);

    try {
      const pagesText = currentProject.pages
        .map(p => {
          const text = p.textBlocks?.map(b => b.content).join(' ') || '';
          return `Page ${p.number}: ${text}`;
        })
        .join('\n');

      const charactersText = currentProject.characters?.length > 0
        ? currentProject.characters.map(c => `- ${c.name}: ${c.description}`).join('\n')
        : 'Aucun personnage défini';

      const prompt = `Tu es un assistant narratif pour livres jeunesse.

Voici les informations du livre :
Titre: ${currentProject.title}
Auteur: ${currentProject.author}
Âge cible: ${currentProject.targetAge} ans
Type: ${currentProject.bookType}

Personnages:
${charactersText}

Contenu des pages:
${pagesText}

Génère un résumé narratif complet de ce livre en 3-4 phrases. 
Ce résumé servira de mémoire pour l'assistant IA afin de maintenir la cohérence de l'histoire.
Inclus les personnages principaux, le problème central et la résolution.`;

      const generatedSummary = await callOpenAI([
        { role: 'user', content: prompt }
      ], { max_tokens: 500 });

      setSummary(generatedSummary);
      await updateProject({ summary: generatedSummary });

    } catch (error) {
      console.error('Summary generation error:', error);
      alert(`Erreur : ${error.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleManualEdit = async (newSummary) => {
    setSummary(newSummary);
    await updateProject({ summary: newSummary });
  };

  if (!currentProject) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BookOpen size={18} className="text-indigo-600" />
          <h3 className="font-semibold text-gray-800">Résumé du livre</h3>
        </div>
        <button
          onClick={generateSummary}
          disabled={generating}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          title="Générer/Régénérer le résumé"
        >
          {generating ? (
            <Loader size={14} className="animate-spin" />
          ) : (
            <RefreshCw size={14} />
          )}
          {generating ? 'Génération...' : 'Générer'}
        </button>
      </div>

      {summary ? (
        <textarea
          value={summary}
          onChange={(e) => handleManualEdit(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
          rows={4}
          placeholder="Le résumé apparaîtra ici..."
        />
      ) : (
        <div className="text-sm text-gray-500 italic py-3 text-center">
          Aucun résumé généré. Cliquez sur "Générer" pour créer un résumé automatique.
        </div>
      )}

      <p className="text-xs text-gray-500 mt-2">
        💡 Ce résumé aide l'IA à maintenir la cohérence narrative de votre livre.
      </p>
    </div>
  );
};

export default BookSummaryPanel;
