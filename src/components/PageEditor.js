import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Type, Image as ImageIcon, Maximize2, Grid, Wand2, RefreshCw } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { validateRevisedPromptConsistency } from '../utils/imagePromptBuilder';
import { buildSceneDescription } from '../utils/sceneBuilder';
import { getRecommendedDalleParams } from '../utils/imageRatioCalculator';
import { resolvePageImageUrl } from '../utils/imageUrlResolver';
import { buildIllustrationPrompt } from '../utils/illustrationPromptBuilder';
import {
  AUTO_BEST_RESULT_MAX_CONSISTENCY_ATTEMPTS,
  AUTO_BEST_RESULT_VARIANT_COUNT,
  selectBestIllustrationVariant
} from '../utils/illustrationAutoPipeline';
import { validateVisualIdentitySpec } from '../utils/visualIdentitySpec';
import { finalizePageIllustrationSelection } from '../utils/illustrationPersistence';

const PageEditor = ({ pageId }) => {
  const { currentProject, updateProject, openaiServiceUrl } = useApp();
  const [showGuides, setShowGuides] = useState(true);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [isGeneratingScene, setIsGeneratingScene] = useState(false);
  const [isGeneratingVariants, setIsGeneratingVariants] = useState(false);
  const [, setSceneDescription] = useState('');
  const [error, setError] = useState(null);

  const page = currentProject?.pages?.find(p => p.id === pageId);
  const format = currentProject?.format;
  const pageImageUrl = resolvePageImageUrl(page);

  if (!pageId || !page) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-100">
        <div className="text-center text-gray-400">
          <Type size={64} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg">Sélectionnez une page pour commencer</p>
        </div>
      </div>
    );
  }

  const handleAddTextBlock = async () => {
    const newBlock = {
      id: uuidv4(),
      type: 'text',
      content: 'Nouveau texte...',
      style: 'narration',
      x: 50,
      y: 50,
      width: 300,
      height: 100,
      fontSize: 16,
      fontFamily: 'Arial',
      color: '#000000'
    };

    const updatedPages = currentProject.pages.map(p => 
      p.id === pageId 
        ? { ...p, textBlocks: [...(p.textBlocks || []), newBlock] }
        : p
    );

    await updateProject({ pages: updatedPages });
    setSelectedBlock(newBlock.id);
  };

  const handleUpdateBlock = async (blockId, updates) => {
    const updatedPages = currentProject.pages.map(p => 
      p.id === pageId 
        ? {
            ...p,
            textBlocks: p.textBlocks.map(b => 
              b.id === blockId ? { ...b, ...updates } : b
            )
          }
        : p
    );

    await updateProject({ pages: updatedPages });
  };

  const handleDeleteBlock = async (blockId) => {
    const updatedPages = currentProject.pages.map(p => 
      p.id === pageId 
        ? {
            ...p,
            textBlocks: p.textBlocks.filter(b => b.id !== blockId)
          }
        : p
    );

    await updateProject({ pages: updatedPages });
    setSelectedBlock(null);
  };

  const persistIllustrationVariant = async (variant, allVariants = []) => {
    const storedVariants = allVariants.map((candidate, index) => ({
      ...candidate,
      variantIndex: Number.isInteger(candidate?.variantIndex) ? candidate.variantIndex : index
    }));
    const selectedVariantIndex = storedVariants.findIndex((candidate) => candidate.url === variant.url);

    await finalizePageIllustrationSelection({
      currentProject,
      page,
      variant: {
        ...variant,
        variantIndex: selectedVariantIndex >= 0 ? selectedVariantIndex : 0,
        batchGenerated: false,
        autoSelected: true,
        autoSelectedVariantIndex: selectedVariantIndex >= 0 ? selectedVariantIndex : 0,
        selectionMode: 'auto-best-result',
        variants: storedVariants,
        allVariants: storedVariants
      },
      generationMeta: {
        requestId: variant.requestId || null,
        promptFinal: variant.promptFinal || null,
        revisedPrompt: variant.revised_prompt || '',
        createdAt: variant.generatedAt || new Date().toISOString(),
        model: null,
        size: variant.dalleParams?.size || null,
        quality: variant.dalleParams?.quality || 'standard',
        status: 'ready',
        referenceImageId: variant.referenceImageId || currentProject.visualIdentitySpec?.mainCharacter?.referenceImageId || 'main-character-reference',
        promptSections: variant.promptSections || null,
        promptTrace: variant.promptTrace || null,
        consistencyProfile: variant.consistencyProfile || null,
        identityHash: variant.identityHash || null,
        variants: storedVariants,
        selectionMode: 'auto-best-result',
        autoSelected: true,
        autoSelectedVariantIndex: selectedVariantIndex >= 0 ? selectedVariantIndex : 0
      },
      updateProject
    });
  };

  const handleGenerateIllustration = async () => {
    setError(null);
    
    // Validate visual identity spec
    const specValidation = validateVisualIdentitySpec(currentProject.visualIdentitySpec);
    if (!specValidation.ok) {
      setError(`visualIdentitySpec invalide: ${specValidation.errors.join(' | ')}`);
      return;
    }

    // Check if page has text
    const pageText = page.textBlocks?.map(b => b.content).join(' ').trim();
    if (!pageText || pageText.length < 10) {
      setError('La page doit contenir du texte pour générer une illustration.');
      return;
    }

    try {
      // Step 1: Build scene description
      setIsGeneratingScene(true);
      const scene = await buildSceneDescription({
        pageText,
        bookSummary: currentProject.summary || currentProject.description,
        characters: currentProject.characters || [],
        targetAge: currentProject.targetAge,
        openaiServiceUrl
      });
      setSceneDescription(scene);
      setIsGeneratingScene(false);

      // Step 2: Generate variants internally and auto-select the best result
      setIsGeneratingVariants(true);
      const variants = [];
      const dalleParams = getRecommendedDalleParams(page, currentProject.bookFormat || currentProject.format || '8x10');
      const previousReferencePrompt = (currentProject.pages || [])
        .filter((candidate) => (candidate.number || 0) < (page.number || 0))
        .sort((a, b) => (b.number || 0) - (a.number || 0))
        .map((candidate) => candidate?.illustration?.revised_prompt || candidate?.illustrationPrompt)
        .find(Boolean);
      const continuityContext = previousReferencePrompt
        ? `Continuity reference from previous validated page: ${String(previousReferencePrompt).replace(/\s+/g, ' ').trim().slice(0, 420)}`
        : '';

      const requestGeneratedImage = async (prompt) => {
        const referenceCharacter = currentProject.visualIdentitySpec?.mainCharacter || {};
        const response = await fetch(`${openaiServiceUrl}/api/generate-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            size: dalleParams.size,
            quality: 'standard',
            referenceImageId: referenceCharacter.referenceImageId || 'main-character-reference',
            referenceImagePath: referenceCharacter.referenceImagePath || null
          })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const statusCode = payload.statusCode || response.status;
          const requestId = payload.requestId ? ` [req:${payload.requestId}]` : '';
          const baseMessage = payload.error || `Erreur lors de la génération (${statusCode})`;
          const transientError = statusCode >= 500 || statusCode === 429;
          const error = new Error(`${baseMessage}${requestId}`);
          error.transient = transientError;
          error.statusCode = statusCode;
          throw error;
        }

        return payload;
      };
      
      const minFallbackConsistencyScore = 0.35;
      const minFallbackConsistencyScoreWithStrongAnchors = 0.18;

      for (let i = 0; i < AUTO_BEST_RESULT_VARIANT_COUNT; i++) {
        let data = null;
        let consistency = { isConsistent: true, score: 1, matchedTokens: [], expectedTokens: [] };
        const maxConsistencyAttempts = AUTO_BEST_RESULT_MAX_CONSISTENCY_ATTEMPTS;
        let bestCandidate = null;
        let safeMode = false;
        let negativePromptUsed = '';
        let finalPromptUsed = '';
        let promptSectionsUsed = null;
        let promptTraceUsed = null;
        let consistencyProfileUsed = null;

        for (let attempt = 0; attempt < maxConsistencyAttempts; attempt += 1) {
          const { prompt: imagePrompt, negativePrompt, promptSections, metadata } = buildIllustrationPrompt({
            spec: currentProject.visualIdentitySpec,
            page,
            template: page.template,
            pageText,
            sceneDescription: scene,
            continuityContext: [
              continuityContext,
              `Variant ${i + 1} for page ${page.number}.`,
              attempt > 0 ? `Consistency retry attempt ${attempt + 1}/${maxConsistencyAttempts}.` : '',
              safeMode ? 'Safety mode enabled: child-friendly, fully clothed, no violence, no frightening content.' : ''
            ].filter(Boolean).join(' '),
            retryForConsistency: attempt > 0,
            safeMode
          });
          negativePromptUsed = negativePrompt;
          finalPromptUsed = imagePrompt;
          promptSectionsUsed = promptSections;
          promptTraceUsed = metadata?.promptTrace || {
            identityHash: metadata?.identityHash || null
          };
          consistencyProfileUsed = metadata?.consistencyAnchors || null;

          let generated;
          try {
            generated = await requestGeneratedImage(imagePrompt);
          } catch (requestError) {
            const message = String(requestError?.message || '').toLowerCase();
            const moderationBlocked = Number(requestError?.statusCode) === 400 &&
              (message.includes('content filter') || message.includes('safety system'));

            if (moderationBlocked && !safeMode) {
              safeMode = true;
              console.warn(`[PageEditor] Variant ${i + 1} blocked by safety filter, retrying with safe mode.`);
            }

            const hasNextAttempt = attempt < maxConsistencyAttempts - 1;
            console.warn(`[PageEditor] Variant ${i + 1} API error: ${requestError.message}`);
            if (hasNextAttempt && requestError.transient) {
              await new Promise((resolve) => setTimeout(resolve, 1500));
              continue;
            }
            if (!hasNextAttempt) {
              break;
            }
            continue;
          }

          consistency = validateRevisedPromptConsistency({
            revisedPrompt: generated.revised_prompt,
            prompt: imagePrompt,
            promptSections,
            promptTrace: metadata?.promptTrace || null
          }, currentProject.visualIdentity);
          consistencyProfileUsed = consistency;

          if (!bestCandidate || consistency.score > bestCandidate.consistency.score) {
            bestCandidate = { generated, consistency, prompt: imagePrompt };
          }

          if (consistency.isConsistent) {
            data = generated;
            break;
          }

          const hasNextAttempt = attempt < maxConsistencyAttempts - 1;
          const retryLabel = hasNextAttempt ? `retry ${attempt + 2}/${maxConsistencyAttempts}` : 'no retry left';
          const anchorDebug = consistency.anchorExpectedTokens?.length
            ? `anchors ${consistency.anchorMatchedTokens?.length || 0}/${consistency.anchorExpectedTokens.length}`
            : 'anchors n/a';
          console.warn(
            `[PageEditor] Variant ${i + 1} consistency low (score: ${consistency.score.toFixed(2)}, ${anchorDebug}), ${retryLabel}`
          );
        }

        const bestAnchorExpected = bestCandidate?.consistency?.anchorExpectedTokens?.length || 0;
        const bestAnchorMatched = bestCandidate?.consistency?.anchorMatchedTokens?.length || 0;
        const strongAnchorMatch = bestAnchorExpected > 0 && bestAnchorMatched === bestAnchorExpected;
        const passesFallbackThreshold = bestCandidate
          ? (bestCandidate.consistency.score >= minFallbackConsistencyScore ||
            (strongAnchorMatch && bestCandidate.consistency.score >= minFallbackConsistencyScoreWithStrongAnchors))
          : false;

        if (!data && bestCandidate && passesFallbackThreshold) {
          data = bestCandidate.generated;
          consistency = bestCandidate.consistency;
          finalPromptUsed = bestCandidate.prompt || finalPromptUsed;
          console.warn(
            `[PageEditor] Variant ${i + 1}: accepting best candidate (score ${consistency.score.toFixed(2)}, anchorRequirementMet=${consistency.anchorRequirementMet}).`
          );
        }

        if (!data) {
          console.warn(`[PageEditor] Variant ${i + 1} skipped: no usable image generated.`);
          continue;
        }

        variants.push({
          url: data.url,
          variantIndex: i,
          requestId: data.requestId || null,
          revised_prompt: data.revised_prompt,
          referenceImageId: data.referenceImageId || currentProject.visualIdentitySpec?.mainCharacter?.referenceImageId || 'main-character-reference',
          generatedAt: new Date().toISOString(),
          sceneDescription: scene,
          dalleParams,
          negativePromptUsed,
          promptFinal: finalPromptUsed,
          promptSections: promptSectionsUsed,
          promptTrace: promptTraceUsed,
          consistencyProfile: consistencyProfileUsed,
          identityHash: promptTraceUsed?.identityHash || null,
          isConsistent: consistency.isConsistent,
          consistencyScore: consistency.score,
          consistencyMatchedTokens: consistency.matchedTokens,
          consistencyAnchorRequirementMet: consistency.anchorRequirementMet,
          consistencyAnchorMatchedTokens: consistency.anchorMatchedTokens,
          consistencyAnchorExpectedTokens: consistency.anchorExpectedTokens,
          detectedNonNarrativeArtifacts: consistency.detectedNonNarrativeArtifacts || [],
          inconsistencyReasons: consistency.inconsistencyReasons || []
        });
      }

      if (variants.length === 0) {
        throw new Error('Aucune variante valide générée. Le prompt est probablement bloqué par les filtres de sécurité ou la cohérence est insuffisante.');
      }

      const bestVariant = selectBestIllustrationVariant(variants);
      if (!bestVariant) {
        throw new Error('Impossible de sélectionner automatiquement une illustration exploitable.');
      }

      await persistIllustrationVariant(bestVariant, variants);
      setIsGeneratingVariants(false);
      setSceneDescription('');

    } catch (err) {
      console.error('Illustration generation error:', err);
      setError(err.message);
      setIsGeneratingScene(false);
      setIsGeneratingVariants(false);
    }
  };

  const handleRegenerateIllustration = () => {
    handleGenerateIllustration();
  };

  const canGenerateIllustration = () => {
    // Check if page template supports images
    const template = page.template;
    return template === 'full_illustration' || template === 'illustration-pleine' ||
           template === 'mixed' || template === 'mixte' ||
           template === 'double_page' || template === 'double-page';
  };

  const pageWidth = format?.unit === 'mm' 
    ? format.width * 3.7795275591 
    : format?.width * 96 || 816;
  
  const pageHeight = format?.unit === 'mm' 
    ? format.height * 3.7795275591 
    : format?.height * 96 || 816;

  const bleedSize = format?.bleed ? 12 : 0;
  const safeArea = 24;

  const selectedBlockData = page.textBlocks?.find(b => b.id === selectedBlock);

  return (
    <div className="flex-1 flex flex-col bg-gray-100">
      <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="font-semibold text-gray-800">Page {page.number}</h3>
          <span className={`text-sm px-3 py-1 rounded-full ${
            page.position === 'left' 
              ? 'bg-blue-100 text-blue-700' 
              : 'bg-purple-100 text-purple-700'
          }`}>
            {page.position === 'left' ? 'Gauche' : 'Droite'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGuides(!showGuides)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              showGuides ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            <Grid size={16} />
            Guides
          </button>
          
          <button
            onClick={handleAddTextBlock}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Type size={16} />
            Texte
          </button>

          {canGenerateIllustration() && (
            <button
              onClick={page.illustration ? handleRegenerateIllustration : handleGenerateIllustration}
              disabled={isGeneratingScene || isGeneratingVariants}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {page.illustration ? (
                <><RefreshCw size={16} /> Regénérer</>
              ) : (
                <><Wand2 size={16} /> Générer illustration</>
              )}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mx-4 mt-4">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {(isGeneratingScene || isGeneratingVariants) && (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mx-4 mt-4">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <p className="text-blue-700 text-sm font-medium">
              {isGeneratingScene && 'Création de la description de scène...'}
              {isGeneratingVariants && 'Génération automatique, contrôle de cohérence et sélection du meilleur résultat...'}
            </p>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-8 flex items-center justify-center">
        <div 
          className="relative bg-white shadow-2xl"
          style={{
            width: `${pageWidth}px`,
            height: `${pageHeight}px`
          }}
        >
          {showGuides && format?.bleed && (
            <div 
              className="absolute border-2 border-dashed border-red-300 pointer-events-none"
              style={{
                top: `${bleedSize}px`,
                left: `${bleedSize}px`,
                right: `${bleedSize}px`,
                bottom: `${bleedSize}px`
              }}
            />
          )}

          {showGuides && (
            <div 
              className="absolute border-2 border-dashed border-green-400 pointer-events-none"
              style={{
                top: `${bleedSize + safeArea}px`,
                left: `${bleedSize + safeArea}px`,
                right: `${bleedSize + safeArea}px`,
                bottom: `${bleedSize + safeArea}px`
              }}
            />
          )}

          {pageImageUrl && (
            <img 
              src={pageImageUrl}
              alt={`Page ${page.number}`}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}

          {page.textBlocks?.map(block => (
            <div
              key={block.id}
              onClick={() => setSelectedBlock(block.id)}
              className={`absolute cursor-move border-2 transition-all ${
                selectedBlock === block.id 
                  ? 'border-indigo-500 bg-indigo-50/50' 
                  : 'border-transparent hover:border-gray-300'
              }`}
              style={{
                left: `${block.x}px`,
                top: `${block.y}px`,
                width: `${block.width}px`,
                height: `${block.height}px`,
                fontSize: `${block.fontSize}px`,
                fontFamily: block.fontFamily,
                color: block.color,
                padding: '8px',
                overflow: 'hidden'
              }}
            >
              <div 
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => handleUpdateBlock(block.id, { content: e.target.innerText })}
                className="w-full h-full outline-none"
              >
                {block.content}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedBlockData && (
        <div className="bg-white border-t border-gray-200 p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">Style</label>
              <select
                value={selectedBlockData.style}
                onChange={(e) => handleUpdateBlock(selectedBlock, { style: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
              >
                <option value="narration">Narration</option>
                <option value="dialogue">Dialogue</option>
                <option value="titre">Titre</option>
                <option value="morale">Morale</option>
              </select>
            </div>

            <div className="w-24">
              <label className="block text-xs font-medium text-gray-700 mb-1">Taille</label>
              <input
                type="number"
                value={selectedBlockData.fontSize}
                onChange={(e) => handleUpdateBlock(selectedBlock, { fontSize: parseInt(e.target.value) })}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="w-32">
              <label className="block text-xs font-medium text-gray-700 mb-1">Couleur</label>
              <input
                type="color"
                value={selectedBlockData.color}
                onChange={(e) => handleUpdateBlock(selectedBlock, { color: e.target.value })}
                className="w-full h-9 border border-gray-300 rounded cursor-pointer"
              />
            </div>

            <button
              onClick={() => handleDeleteBlock(selectedBlock)}
              className="px-4 py-2 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors"
            >
              Supprimer
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PageEditor;

