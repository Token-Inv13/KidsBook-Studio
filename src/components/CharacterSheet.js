import React from 'react';
import { useApp } from '../context/AppContext';
import { User, Palette, Shirt, Sparkles } from 'lucide-react';
import { resolveCharacterReferenceImageUrl } from '../utils/imageUrlResolver';

const CharacterSheet = () => {
  const { currentProject } = useApp();

  const visualIdentity = currentProject?.visualIdentity;
  const mainCharacter = visualIdentity?.mainCharacter;
  const referenceImageUrl = resolveCharacterReferenceImageUrl(mainCharacter);

  if (!visualIdentity?.validated || !mainCharacter) {
    return null;
  }

  // Additional safety check to prevent crashes during render
  if (!mainCharacter.name) {
    return null;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4">
        <div className="flex items-center gap-2">
          <User size={20} />
          <h3 className="font-semibold">Fiche Personnage Principal</h3>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Reference Image */}
          <div>
            <div className="border-2 border-indigo-200 rounded-lg overflow-hidden mb-3">
              {referenceImageUrl ? (
                <img
                  src={referenceImageUrl}
                  alt={mainCharacter.name}
                  data-testid="character-reference-image"
                  className="w-full h-auto"
                />
              ) : (
                <div className="w-full h-48 bg-gray-100 flex items-center justify-center text-sm text-gray-500">
                  Image de référence indisponible
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Sparkles size={16} className="text-indigo-600" />
              <span>Image de référence officielle</span>
            </div>
          </div>

          {/* Character Details */}
          <div className="space-y-4">
            {/* Name */}
            <div>
              <h4 className="text-lg font-bold text-gray-800 mb-1">
                {mainCharacter.name}
              </h4>
              {mainCharacter.age && (
                <p className="text-sm text-gray-600">Âge : {mainCharacter.age}</p>
              )}
            </div>

            {/* Description */}
            {mainCharacter.description && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <User size={16} className="text-gray-600" />
                  <span className="text-sm font-semibold text-gray-700">Description</span>
                </div>
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                  {mainCharacter.description}
                </p>
              </div>
            )}

            {/* Appearance */}
            {mainCharacter.appearance && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={16} className="text-gray-600" />
                  <span className="text-sm font-semibold text-gray-700">Apparence</span>
                </div>
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                  {mainCharacter.appearance}
                </p>
              </div>
            )}

            {/* Clothing */}
            {mainCharacter.clothing && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Shirt size={16} className="text-gray-600" />
                  <span className="text-sm font-semibold text-gray-700">Vêtements</span>
                </div>
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                  {mainCharacter.clothing}
                </p>
              </div>
            )}

            {/* Color Palette */}
            {mainCharacter.colorPalette && mainCharacter.colorPalette.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Palette size={16} className="text-gray-600" />
                  <span className="text-sm font-semibold text-gray-700">Palette couleurs</span>
                </div>
                <div className="flex gap-2">
                  {mainCharacter.colorPalette.map((color, idx) => (
                    <div
                      key={idx}
                      className="w-10 h-10 rounded-lg border-2 border-gray-200 shadow-sm"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Artistic Style */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Palette size={16} className="text-gray-600" />
                <span className="text-sm font-semibold text-gray-700">Style artistique</span>
              </div>
              <p className="text-sm text-gray-600 bg-indigo-50 p-3 rounded-lg border border-indigo-200">
                {visualIdentity.artisticStyle}
              </p>
            </div>
          </div>
        </div>

        {/* Technical Info (collapsed) */}
        <details className="mt-6">
          <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
            Informations techniques
          </summary>
          <div className="mt-2 p-3 bg-gray-50 rounded-lg text-xs text-gray-600 font-mono">
            <p><strong>Style prompt:</strong> {visualIdentity.stylePrompt}</p>
            <p className="mt-1"><strong>Validé le:</strong> {new Date(visualIdentity.validatedAt).toLocaleString('fr-FR')}</p>
          </div>
        </details>
      </div>
    </div>
  );
};

export default CharacterSheet;
