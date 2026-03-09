import React from 'react';
import { useApp } from '../context/AppContext';
import { Lock, Palette, ArrowRight } from 'lucide-react';

const IllustrationLock = ({ children, showMessage = true, onNavigateToCharacters }) => {
  const { currentProject } = useApp();

  const hasVisualIdentity = currentProject?.visualIdentity?.validated;

  if (hasVisualIdentity) {
    return children;
  }

  if (!showMessage) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-xl p-6">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
            <Lock size={24} className="text-amber-600" />
          </div>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            Identité visuelle requise
          </h3>
          <p className="text-gray-700 mb-4">
            Pour garantir la cohérence visuelle de votre livre, vous devez d'abord créer 
            l'identité visuelle dans la section <strong>Personnages</strong>.
          </p>
          <p className="text-sm text-gray-600 mb-4">
            L'identité visuelle définit :
          </p>
          <ul className="text-sm text-gray-600 space-y-1 mb-4 ml-4">
            <li>• Le style artistique du livre (aquarelle, pastel, etc.)</li>
            <li>• L'apparence officielle du personnage principal</li>
            <li>• La palette de couleurs dominante</li>
          </ul>
          {onNavigateToCharacters && (
            <button
              onClick={onNavigateToCharacters}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all shadow-md"
            >
              <Palette size={18} />
              Créer l'identité visuelle
              <ArrowRight size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default IllustrationLock;
