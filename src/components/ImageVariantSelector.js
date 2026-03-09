import React, { useState } from 'react';
import { X, Check, RefreshCw, Download } from 'lucide-react';

/**
 * ImageVariantSelector Component
 * Displays 1-4 image variants and allows user to select one
 * Used for both character generation and page illustration generation
 */
function ImageVariantSelector({ 
  variants = [], 
  onSelect, 
  onClose,
  onRegenerate,
  title = "Sélectionnez une variante",
  isGenerating = false 
}) {
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const handleSelect = (index) => {
    setSelectedIndex(index);
  };

  const handleConfirm = () => {
    if (selectedIndex !== null && variants[selectedIndex]) {
      onSelect(variants[selectedIndex], selectedIndex);
    }
  };

  const handleDownload = (variant, index) => {
    const link = document.createElement('a');
    link.href = variant.url;
    link.download = `variant-${index + 1}.png`;
    link.click();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isGenerating ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600 mb-4"></div>
              <p className="text-gray-600 text-lg">Génération des variantes en cours...</p>
              <p className="text-gray-500 text-sm mt-2">Cela peut prendre 1-2 minutes</p>
            </div>
          ) : variants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-gray-600 text-lg">Aucune variante disponible</p>
              <p className="text-gray-500 text-sm mt-2">Cliquez sur "Générer" pour créer des variantes</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {variants.map((variant, index) => (
                  <div
                    key={index}
                    className={`relative border-4 rounded-lg overflow-hidden cursor-pointer transition-all ${
                      selectedIndex === index
                        ? 'border-primary-600 shadow-lg'
                        : hoveredIndex === index
                        ? 'border-primary-300'
                        : 'border-gray-200'
                    }`}
                    onClick={() => handleSelect(index)}
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  >
                    {/* Selection indicator */}
                    {selectedIndex === index && (
                      <div className="absolute top-2 right-2 bg-primary-600 text-white rounded-full p-2 z-10">
                        <Check className="w-5 h-5" />
                      </div>
                    )}

                    {/* Variant number */}
                    <div className="absolute top-2 left-2 bg-black bg-opacity-60 text-white px-3 py-1 rounded-full text-sm font-medium z-10">
                      Variante {index + 1}
                    </div>

                    {/* Image */}
                    <img
                      src={variant.url}
                      alt={`Variante ${index + 1}`}
                      className="w-full h-auto"
                    />

                    {/* Download button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(variant, index);
                      }}
                      className="absolute bottom-2 right-2 bg-white bg-opacity-90 hover:bg-opacity-100 p-2 rounded-lg transition-all z-10"
                      title="Télécharger cette variante"
                    >
                      <Download className="w-4 h-4 text-gray-700" />
                    </button>

                    {/* Revised prompt (if available) */}
                    {variant.revised_prompt && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white p-3 text-xs">
                        <p className="line-clamp-2">{variant.revised_prompt}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-blue-800 text-sm">
                  <strong>Instructions :</strong> Cliquez sur une image pour la sélectionner, puis validez votre choix.
                  {variants.length < 4 && ' Vous pouvez générer plus de variantes si nécessaire.'}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex gap-3">
            {onRegenerate && !isGenerating && (
              <button
                onClick={onRegenerate}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Regénérer
              </button>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedIndex === null || isGenerating}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                selectedIndex === null || isGenerating
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-primary-600 text-white hover:bg-primary-700'
              }`}
            >
              Valider la sélection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ImageVariantSelector;
