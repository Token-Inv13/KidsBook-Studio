import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { X, Palette, Sparkles, Loader, Check } from 'lucide-react';
import { buildVisualIdentitySpec, validateVisualIdentitySpec } from '../utils/visualIdentitySpec';

const VisualIdentityWizard = ({ onClose }) => {
  const { currentProject, updateProject, openaiServiceUrl } = useApp();
  const [step, setStep] = useState(1);
  const [artisticStyle, setArtisticStyle] = useState('');
  const [generatingVariants, setGeneratingVariants] = useState(false);
  const [variants, setVariants] = useState([]);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [progress, setProgress] = useState('');

  if (!currentProject) {
    return null;
  }

  const styles = [
    {
      id: 'aquarelle',
      name: 'Aquarelle',
      description: 'Doux, fluide, couleurs transparentes',
      prompt: 'soft watercolor illustration, gentle washes, transparent colors, children\'s book style'
    },
    {
      id: 'pastel',
      name: 'Pastel',
      description: 'Tendre, chaleureux, textures douces',
      prompt: 'soft pastel illustration, gentle textures, warm colors, children\'s book style'
    },
    {
      id: 'crayon',
      name: 'Crayon de couleur',
      description: 'Texturé, chaleureux, dessiné à la main',
      prompt: 'colored pencil illustration, hand-drawn texture, warm sketchy style, children\'s book'
    },
    {
      id: 'cartoon',
      name: 'Cartoon doux',
      description: 'Formes rondes, couleurs vives, amical',
      prompt: 'soft cartoon illustration, rounded shapes, friendly, vibrant colors, children\'s book style'
    },
    {
      id: 'peinture',
      name: 'Peinture jeunesse',
      description: 'Riche, coloré, pictural',
      prompt: 'children\'s book painting, rich colors, painterly style, storybook illustration'
    }
  ];

  const handleStyleSelect = (style) => {
    setArtisticStyle(style);
  };

  const handleGenerateVariants = async () => {
    if (!artisticStyle) {
      alert('Veuillez choisir un style artistique.');
      return;
    }

    setGeneratingVariants(true);
    setProgress('Génération de 4 variantes du personnage principal...');
    setStep(2);

    try {
      const mainCharacter = currentProject.characters?.[0];
      if (!mainCharacter) {
        alert('Aucun personnage principal trouvé. Utilisez d\'abord le Story Engine.');
        setGeneratingVariants(false);
        return;
      }

      const selectedStyle = styles.find(s => s.id === artisticStyle);
      
      const detailedPrompt = `
Character: ${mainCharacter.name}
Age: ${mainCharacter.age || 'young'}
Appearance: ${mainCharacter.appearance || mainCharacter.description}
Clothing: ${mainCharacter.clothing || 'simple clothes'}
Personality: ${mainCharacter.personality || 'friendly'}

Style: ${selectedStyle.prompt}
View: full body character, white background, centered, children's book character design
Mood: friendly, approachable, expressive
      `.trim();

      const generatedVariants = [];
      if (!openaiServiceUrl) {
        throw new Error('Service OpenAI indisponible');
      }

      // Generate 4 variants
      for (let i = 0; i < 4; i++) {
        setProgress(`Génération de la variante ${i + 1}/4...`);
        
        try {
          const response = await fetch(`${openaiServiceUrl}/api/generate-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: detailedPrompt,
              size: '1024x1024',
              quality: 'standard',
              style: 'vivid'
            })
          });

          const data = await response.json().catch(() => ({}));
          if (!response.ok || !data.success || !data.url) {
            throw new Error(data.error || 'Failed to generate image');
          }
          
          generatedVariants.push({
            id: `variant-${i + 1}`,
            url: data.url,
            prompt: detailedPrompt,
            style: artisticStyle
          });
        } catch (error) {
          console.error(`Error generating variant ${i + 1}:`, error);
        }

        // Small delay between generations to avoid rate limits
        if (i < 3) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      setVariants(generatedVariants);
      setProgress('');
      setGeneratingVariants(false);
    } catch (error) {
      console.error('Error generating variants:', error);
      alert('Erreur lors de la génération des variantes. Vérifiez votre clé API et votre connexion.');
      setGeneratingVariants(false);
      setProgress('');
    }
  };

  const handleVariantSelect = (variant) => {
    setSelectedVariant(variant);
  };

  const handleValidateIdentity = async () => {
    if (!selectedVariant) {
      alert('Veuillez sélectionner une variante.');
      return;
    }

    setProgress('Finalisation de l\'identité visuelle...');

    try {
      const mainCharacter = currentProject.characters[0];
      
      // Extract dominant colors from the description (simplified)
      const colorPalette = extractColorPalette(mainCharacter);

      // Download and save the reference image locally (only in Electron)
      let localImagePath = selectedVariant.url;
      let imagePath = null;
      let referenceImageBase64 = null;
      let referenceImageMimeType = 'image/png';
      
      if (window.electron && window.electron.fs && window.electron.fs.downloadImage) {
        const timestamp = Date.now();
        imagePath = `${currentProject.path}/images/character_reference_${timestamp}.png`;
        
        console.log('[VisualIdentityWizard] Downloading reference image from:', selectedVariant.url);
        console.log('[VisualIdentityWizard] Target path:', imagePath);
        
        try {
          const downloadResult = await window.electron.fs.downloadImage(selectedVariant.url, imagePath);
          
          console.log('[VisualIdentityWizard] Download result:', downloadResult);
          
          if (downloadResult && downloadResult.success) {
            localImagePath = imagePath;
            console.log('[VisualIdentityWizard] Reference image saved successfully to:', imagePath);
            console.log('[VisualIdentityWizard] Using local image path:', localImagePath);
            if (window.electron.fs.readFileBase64) {
              try {
                const base64Result = await window.electron.fs.readFileBase64(imagePath);
                if (base64Result && base64Result.success && base64Result.data) {
                  referenceImageBase64 = base64Result.data;
                }
              } catch (base64Error) {
                console.warn('[VisualIdentityWizard] Unable to read reference image as base64:', base64Error);
              }
            }
          } else {
            const errorMsg = downloadResult?.error || 'Erreur inconnue';
            console.warn('[VisualIdentityWizard] Download failed, using URL directly:', errorMsg);
            localImagePath = selectedVariant.url;
            imagePath = null;
          }
        } catch (error) {
          console.error('[VisualIdentityWizard] Download error, using URL directly:', error);
          localImagePath = selectedVariant.url;
          imagePath = null;
        }
      } else {
        console.warn('[VisualIdentityWizard] Not in Electron environment, using URL directly');
        localImagePath = selectedVariant.url;
      }

      const selectedStyle = styles.find(s => s.id === artisticStyle);
      if (!selectedStyle) {
        throw new Error('Style artistique non trouvé');
      }

      const mainCharacterData = {
        ...mainCharacter,
        referenceImage: localImagePath,
        referenceImageBase64,
        referenceImageMimeType,
        referenceImageId: 'main-character-reference',
        referencePrompt: selectedVariant.prompt,
        colorPalette: colorPalette
      };
      
      // Only add referenceImagePath if we successfully downloaded the image
      if (imagePath) {
        mainCharacterData.referenceImagePath = imagePath;
      }

      const visualIdentity = {
        validated: true,
        validatedAt: new Date().toISOString(),
        artisticStyle: artisticStyle,
        stylePrompt: selectedStyle.prompt,
        mainCharacter: mainCharacterData
      };

      const spec = buildVisualIdentitySpec({
        project: {
          ...currentProject,
          artStyle: artisticStyle,
          visualIdentity
        },
        mainCharacterData
      });

      const specValidation = validateVisualIdentitySpec(spec);
      if (!specValidation.ok) {
        throw new Error(`visualIdentitySpec invalide: ${specValidation.errors.join(' | ')}`);
      }

      const updatedCharacterData = {
        ...currentProject.characters[0],
        referenceImage: localImagePath,
        referenceImageBase64,
        referenceImageMimeType,
        referenceImageId: 'main-character-reference',
        colorPalette
      };
      
      if (imagePath) {
        updatedCharacterData.referenceImagePath = imagePath;
      }

      await updateProject({
        artStyle: artisticStyle,
        visualIdentity,
        visualIdentitySpec: spec,
        characters: currentProject.characters.map((char, idx) => 
          idx === 0 ? updatedCharacterData : char
        )
      });

      alert('✅ Identité visuelle validée ! Vous pouvez maintenant générer les illustrations de vos pages.');
      onClose();
    } catch (error) {
      console.error('Error validating identity:', error);
      alert('Erreur lors de la validation.');
    }
  };

  const extractColorPalette = (character) => {
    // Simple color extraction based on description keywords
    const description = `${character.description} ${character.appearance} ${character.clothing}`.toLowerCase();
    const colors = [];

    const colorMap = {
      'rouge': '#E74C3C',
      'red': '#E74C3C',
      'bleu': '#3498DB',
      'blue': '#3498DB',
      'vert': '#27AE60',
      'green': '#27AE60',
      'jaune': '#F39C12',
      'yellow': '#F39C12',
      'orange': '#E67E22',
      'violet': '#9B59B6',
      'purple': '#9B59B6',
      'rose': '#E91E63',
      'pink': '#E91E63',
      'marron': '#8D6E63',
      'brown': '#8D6E63',
      'gris': '#95A5A6',
      'gray': '#95A5A6',
      'noir': '#34495E',
      'black': '#34495E',
      'blanc': '#ECF0F1',
      'white': '#ECF0F1'
    };

    Object.entries(colorMap).forEach(([keyword, hex]) => {
      if (description.includes(keyword) && !colors.includes(hex)) {
        colors.push(hex);
      }
    });

    // Default palette if no colors detected
    if (colors.length === 0) {
      colors.push('#3498DB', '#E74C3C', '#F39C12');
    }

    return colors.slice(0, 5); // Max 5 colors
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Palette size={28} />
            <div>
              <h2 className="text-2xl font-bold">Identité Visuelle du Livre</h2>
              <p className="text-purple-100 text-sm">
                Étape {step}/2 - {step === 1 ? 'Style artistique' : 'Sélection du personnage'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8">
          {step === 1 && (
            <div>
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  Choisissez le style artistique de votre livre
                </h3>
                <p className="text-gray-600">
                  Ce style sera appliqué à toutes les illustrations pour garantir la cohérence visuelle.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {styles.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => handleStyleSelect(style.id)}
                    className={`p-6 border-2 rounded-xl transition-all text-left ${
                      artisticStyle === style.id
                        ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                        : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-lg text-gray-800">{style.name}</h4>
                      {artisticStyle === style.id && (
                        <Check size={20} className="text-indigo-600" />
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{style.description}</p>
                  </button>
                ))}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleGenerateVariants}
                  disabled={!artisticStyle}
                  className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  <Sparkles size={20} />
                  Générer les variantes du personnage
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              {generatingVariants ? (
                <div className="text-center py-12">
                  <Loader size={48} className="mx-auto mb-4 text-indigo-600 animate-spin" />
                  <p className="text-lg font-medium text-gray-700">{progress}</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Cela peut prendre 1-2 minutes...
                  </p>
                </div>
              ) : variants.length > 0 ? (
                <div>
                  <div className="mb-6">
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">
                      Sélectionnez la variante du personnage principal
                    </h3>
                    <p className="text-gray-600">
                      Cette image servira de référence visuelle pour toutes les illustrations du livre.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-6 mb-8">
                    {variants.map((variant) => (
                      <button
                        key={variant.id}
                        onClick={() => handleVariantSelect(variant)}
                        className={`relative border-4 rounded-xl overflow-hidden transition-all ${
                          selectedVariant?.id === variant.id
                            ? 'border-indigo-600 shadow-2xl scale-105'
                            : 'border-gray-200 hover:border-indigo-300 hover:shadow-lg'
                        }`}
                      >
                        <img
                          src={variant.url}
                          alt={`Variante ${variant.id}`}
                          className="w-full h-auto"
                        />
                        {selectedVariant?.id === variant.id && (
                          <div className="absolute top-4 right-4 bg-indigo-600 text-white p-2 rounded-full">
                            <Check size={24} />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="flex justify-between">
                    <button
                      onClick={() => setStep(1)}
                      className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      ← Retour au style
                    </button>
                    <button
                      onClick={handleValidateIdentity}
                      disabled={!selectedVariant}
                      className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                      <Check size={20} />
                      Valider l'identité visuelle
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-600">Aucune variante générée.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VisualIdentityWizard;
