import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Type, Image as ImageIcon, Maximize2, Grid, Wand2, RefreshCw } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { resolvePageImageUrl } from '../utils/imageUrlResolver';
import { validateVisualIdentitySpec } from '../utils/visualIdentitySpec';
import { finalizePageIllustrationSelection } from '../utils/illustrationPersistence';
import { generateIllustrationWithAutoPipeline } from '../utils/illustrationGenerationPipeline';

const PageEditor = ({ pageId }) => {
  const { currentProject, updateProject, openaiServiceUrl, ideogramServiceUrl, falServiceUrl } = useApp();
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
        evaluation: variant.evaluation || null,
        generatorStrategy: variant.generatorStrategy || null,
        constraintBundleSummary: variant.constraintBundleSummary || null,
        generationTrace: variant.generationTrace || null,
        pageDecision: variant.pageDecision || null,
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

    if (!openaiServiceUrl) {
      setError('Le service OpenAI est en cours d\'initialisation. Réessayez dans quelques secondes.');
      return;
    }

    // Check if page has text
    const pageText = page.textBlocks?.map(b => b.content).join(' ').trim();
    if (!pageText || pageText.length < 10) {
      setError('La page doit contenir du texte pour générer une illustration.');
      return;
    }

    try {
      setIsGeneratingScene(true);
      setSceneDescription('Analyse de scene en cours...');
      setIsGeneratingVariants(true);
      const pipelineResult = await generateIllustrationWithAutoPipeline({
        currentProject,
        page,
        openaiServiceUrl,
        falServiceUrl,
        ideogramServiceUrl,
        mode: 'page'
      });
      setSceneDescription(pipelineResult.scene);
      setIsGeneratingScene(false);

      await persistIllustrationVariant(pipelineResult.selectedVariant, pipelineResult.variants);
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
              disabled={isGeneratingScene || isGeneratingVariants || !openaiServiceUrl}
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

