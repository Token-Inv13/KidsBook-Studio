import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { User, Palette, Shirt, Sparkles, Wand2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { resolveCharacterReferenceImageUrl } from '../utils/imageUrlResolver';

const CharacterSheet = () => {
  const { currentProject, updateProject, falServiceUrl } = useApp();
  const [trainingState, setTrainingState] = useState({ status: 'idle', error: null, result: null });

  const visualIdentity = currentProject?.visualIdentity;
  const visualIdentitySpec = currentProject?.visualIdentitySpec;
  const mainCharacter = visualIdentity?.mainCharacter;
  const referenceImageUrl = resolveCharacterReferenceImageUrl(mainCharacter);
  const trainingArtifacts = visualIdentitySpec?.trainingArtifacts || mainCharacter?.trainingArtifacts || null;

  if (!visualIdentity?.validated || !mainCharacter) {
    return null;
  }

  // Additional safety check to prevent crashes during render
  if (!mainCharacter.name) {
    return null;
  }

  const sanitizeTriggerWord = (value) => {
    const cleaned = String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    return cleaned || 'kidsbook_character';
  };

  const handleTrainLoRA = async () => {
    if (!falServiceUrl) {
      setTrainingState({
        status: 'error',
        error: 'Le service fal.ai n\'est pas encore prêt.',
        result: null
      });
      return;
    }

    if (!visualIdentitySpec?.characterPack?.referenceImages?.length) {
      setTrainingState({
        status: 'error',
        error: 'Aucune image de référence disponible pour l\'entraînement.',
        result: null
      });
      return;
    }

    setTrainingState({ status: 'training', error: null, result: null });

    try {
      const response = await fetch(`${falServiceUrl}/api/train-lora`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referenceImages: visualIdentitySpec.characterPack.referenceImages,
          triggerWord: sanitizeTriggerWord(mainCharacter.name),
          steps: 1000,
          isStyle: false
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Échec de l\'entraînement LoRA');
      }

      const trainingArtifactsData = {
        provider: 'fal.ai',
        requestId: data.requestId || null,
        triggerWord: data.triggerWord || sanitizeTriggerWord(mainCharacter.name),
        status: data.status || 'completed',
        trainedAt: new Date().toISOString(),
        fal: data.artifacts || null
      };
      const nextSpec = {
        ...visualIdentitySpec,
        mainCharacter: {
          ...visualIdentitySpec.mainCharacter,
          trainingArtifacts: trainingArtifactsData
        },
        characterPack: {
          ...visualIdentitySpec.characterPack,
          trainingArtifacts: trainingArtifactsData
        },
        trainingArtifacts: trainingArtifactsData
      };

      await updateProject({
        visualIdentitySpec: nextSpec
      });

      setTrainingState({
        status: 'success',
        error: null,
        result: trainingArtifactsData
      });
    } catch (error) {
      setTrainingState({
        status: 'error',
        error: error?.message || 'Échec de l\'entraînement LoRA',
        result: null
      });
    }
  };

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

        {visualIdentitySpec?.generationPolicy && (
          <div className="mt-6 p-4 bg-zinc-50 rounded-lg border border-zinc-200">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={16} className="text-indigo-600" />
              <span className="text-sm font-semibold text-zinc-700">Politique de generation</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-zinc-600">
              <div className="bg-white rounded-md border border-zinc-200 p-3">
                <p className="font-medium text-zinc-800">Mode identite</p>
                <p>{visualIdentitySpec.generationPolicy.strictIdentityMode ? 'Strict' : 'Souple'}</p>
              </div>
              <div className="bg-white rounded-md border border-zinc-200 p-3">
                <p className="font-medium text-zinc-800">Fallback provider</p>
                <p>{visualIdentitySpec.generationPolicy.allowProviderFallback ? 'Autorise' : 'Bloque'}</p>
              </div>
              <div className="bg-white rounded-md border border-zinc-200 p-3">
                <p className="font-medium text-zinc-800">Reference pack</p>
                <p>{visualIdentitySpec.characterPack?.referenceImageCount || 0} image(s)</p>
              </div>
            </div>
          </div>
        )}

        {visualIdentitySpec?.characterPack && (
          <div className="mt-6 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
            <div className="flex items-center gap-2 mb-3">
              <Wand2 size={16} className="text-indigo-600" />
              <span className="text-sm font-semibold text-indigo-800">Entraînement LoRA fal.ai</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-indigo-900">
              <div className="bg-white rounded-md border border-indigo-200 p-3">
                <p className="font-medium text-indigo-900">Références</p>
                <p>{visualIdentitySpec.characterPack.referenceImageCount || 0} image(s)</p>
              </div>
              <div className="bg-white rounded-md border border-indigo-200 p-3">
                <p className="font-medium text-indigo-900">Trigger word</p>
                <p>{sanitizeTriggerWord(mainCharacter.name)}</p>
              </div>
              <div className="bg-white rounded-md border border-indigo-200 p-3">
                <p className="font-medium text-indigo-900">Statut</p>
                <p>{trainingArtifacts?.status || 'non entraîné'}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <button
                type="button"
                onClick={handleTrainLoRA}
                disabled={trainingState.status === 'training' || !falServiceUrl}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {trainingState.status === 'training' ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />}
                {trainingState.status === 'training' ? 'Entraînement en cours...' : 'Entraîner le LoRA'}
              </button>

              {trainingState.status === 'success' && (
                <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <CheckCircle2 size={16} />
                  <span>LoRA entraîné et enregistré dans le projet.</span>
                </div>
              )}

              {trainingState.status === 'error' && (
                <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <AlertCircle size={16} />
                  <span>{trainingState.error}</span>
                </div>
              )}

              {trainingArtifacts?.fal?.modelUrl && (
                <div className="text-xs text-indigo-900 bg-white border border-indigo-200 rounded-lg p-3 font-mono break-all">
                  <p className="font-semibold font-sans mb-1">Modèle LoRA</p>
                  <p>{trainingArtifacts.fal.modelUrl}</p>
                </div>
              )}
            </div>
          </div>
        )}

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
