import React from 'react';
import { Image, Type, Columns, Maximize2 } from 'lucide-react';

const PageTemplateSelector = ({ onSelect, onClose }) => {
  const templates = [
    {
      id: 'illustration-pleine',
      name: 'Illustration pleine page',
      description: 'Grande image avec texte en bas',
      icon: Image,
      preview: 'bg-gradient-to-b from-blue-200 to-blue-100'
    },
    {
      id: 'texte-court',
      name: 'Texte court',
      description: 'Texte centré, idéal pour les titres',
      icon: Type,
      preview: 'bg-gradient-to-br from-purple-200 to-pink-100'
    },
    {
      id: 'mixte',
      name: 'Mixte (image + texte)',
      description: 'Image en haut, texte en bas',
      icon: Columns,
      preview: 'bg-gradient-to-b from-green-200 to-yellow-100'
    },
    {
      id: 'double-page',
      name: 'Double page',
      description: 'Image plein écran avec texte superposé',
      icon: Maximize2,
      preview: 'bg-gradient-to-br from-orange-200 to-red-100'
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800">Choisir un type de page</h2>
          <p className="text-sm text-gray-600 mt-1">Sélectionnez le template qui correspond à votre vision</p>
        </div>

        <div className="p-6 grid grid-cols-2 gap-4">
          {templates.map(template => {
            const Icon = template.icon;
            return (
              <button
                key={template.id}
                onClick={() => onSelect(template.id)}
                className="group relative overflow-hidden rounded-xl border-2 border-gray-200 hover:border-indigo-500 transition-all hover:shadow-xl"
              >
                <div className={`h-48 ${template.preview} flex items-center justify-center`}>
                  <Icon size={64} className="text-white opacity-50 group-hover:opacity-70 transition-opacity" />
                </div>
                <div className="p-4 bg-white">
                  <h3 className="font-semibold text-gray-800 mb-1">{template.name}</h3>
                  <p className="text-sm text-gray-600">{template.description}</p>
                </div>
                <div className="absolute inset-0 border-4 border-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl pointer-events-none" />
              </button>
            );
          })}
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
};

export default PageTemplateSelector;
