import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Users, AlertCircle, Palette, Sparkles } from 'lucide-react';
import CharacterSheet from '../components/CharacterSheet';
import VisualIdentityWizard from '../components/VisualIdentityWizard';
import { validateVisualIdentitySpec } from '../utils/visualIdentitySpec';

const CharactersView = () => {
  const { currentProject } = useApp();
  const [showIdentityWizard, setShowIdentityWizard] = useState(false);

  if (!currentProject) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <AlertCircle size={64} className="mx-auto mb-4 text-gray-400" />
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">
            Aucun projet ouvert
          </h2>
          <p className="text-gray-500">
            Sélectionnez ou créez un projet pour gérer les personnages
          </p>
        </div>
      </div>
    );
  }

  const visualIdentitySpecValidation = validateVisualIdentitySpec(currentProject.visualIdentitySpec);
  const hasVisualIdentity = currentProject.visualIdentity?.validated || visualIdentitySpecValidation.ok;
  const hasCharacters = currentProject.characters && currentProject.characters.length > 0;

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-zinc-50 to-zinc-100">
      {/* Header */}
      <div className="bg-white/90 border-b border-zinc-200 px-6 py-5 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-800 flex items-center gap-3">
              <Users size={30} />
              Personnages & Identité Visuelle
            </h1>
            <p className="text-zinc-600 mt-1">
              Gérez l'identité visuelle et les personnages de votre livre
            </p>
          </div>

          {hasCharacters && !hasVisualIdentity && (
            <button
              onClick={() => setShowIdentityWizard(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:from-violet-700 hover:to-indigo-700 transition-all shadow-md"
            >
              <Palette size={20} />
              Créer l'identité visuelle
            </button>
          )}

          {hasVisualIdentity && (
            <button
              onClick={() => setShowIdentityWizard(true)}
              className="inline-flex items-center gap-2 px-4 py-2 border border-indigo-300 text-indigo-700 rounded-xl bg-white hover:bg-indigo-50 transition-colors"
            >
              <Sparkles size={18} />
              Modifier l'identité
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {!hasCharacters ? (
          <div className="max-w-2xl mx-auto text-center py-12">
            <Users size={64} className="mx-auto mb-4 text-gray-400" />
            <h2 className="text-2xl font-semibold text-gray-700 mb-2">
              Aucun personnage défini
            </h2>
            <p className="text-gray-600 mb-6">
              Utilisez le <strong>Story Engine</strong> pour générer automatiquement votre histoire et vos personnages.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
              <p className="text-sm text-blue-800">
                💡 <strong>Astuce :</strong> Le Story Engine crée automatiquement les personnages de votre histoire.
                Une fois créés, vous pourrez définir leur identité visuelle ici.
              </p>
            </div>
          </div>
        ) : !hasVisualIdentity ? (
          <div className="max-w-3xl mx-auto">
            <div className="bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200 rounded-2xl p-8 text-center mb-6 shadow-sm">
              <Palette size={64} className="mx-auto mb-4 text-purple-600" />
              <h2 className="text-2xl font-bold text-gray-800 mb-3">
                Créez l'identité visuelle de votre livre
              </h2>
              <p className="text-gray-700 mb-6 max-w-xl mx-auto">
                Avant de générer des illustrations, définissez le style artistique et l'apparence
                de votre personnage principal pour garantir la cohérence visuelle de tout le livre.
              </p>
              <button
                onClick={() => setShowIdentityWizard(true)}
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg text-lg font-semibold"
              >
                <Sparkles size={24} />
                Démarrer le wizard d'identité visuelle
              </button>
            </div>

            <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-4">Personnages détectés :</h3>
              <div className="space-y-3">
                {currentProject.characters.map((char, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Users size={20} className="text-indigo-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-800">{char.name}</h4>
                      {char.description && (
                        <p className="text-sm text-gray-600 mt-1">{char.description}</p>
                      )}
                      {idx === 0 && (
                        <span className="inline-block mt-2 px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">
                          Personnage principal
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            {visualIdentitySpecValidation.ok && (
              <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 text-green-800">
                  <Sparkles size={20} />
                  <span className="font-semibold">Identité visuelle validée</span>
                </div>
                <p className="text-sm text-green-700 mt-1">
                  Toutes les illustrations de pages utiliseront automatiquement cette référence pour garantir la cohérence.
                </p>
              </div>
            )}

            <CharacterSheet />

            {currentProject.characters.length > 1 && (
              <div className="mt-6 bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                <h3 className="font-semibold text-gray-800 mb-4">Autres personnages :</h3>
                <div className="space-y-3">
                  {currentProject.characters.slice(1).map((char, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                        <Users size={20} className="text-gray-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-800">{char.name}</h4>
                        {char.description && (
                          <p className="text-sm text-gray-600 mt-1">{char.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showIdentityWizard && (
        <VisualIdentityWizard onClose={() => setShowIdentityWizard(false)} />
      )}
    </div>
  );
};

export default CharactersView;
