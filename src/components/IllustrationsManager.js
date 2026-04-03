import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Wand2, Play, Pause, RotateCcw, CheckCircle, XCircle, Clock, AlertCircle, RefreshCw, ExternalLink, Image, Info, X } from 'lucide-react';
import illustrationQueue from '../utils/illustrationQueue';
import ImageVariantSelector from './ImageVariantSelector';
import { resolvePageImageUrl } from '../utils/imageUrlResolver';
import { getDynamicTableHeight, getVirtualWindow, shouldUseVirtualization } from '../utils/illustrationsListLayout';
import { validateVisualIdentitySpec } from '../utils/visualIdentitySpec';
import { finalizePageIllustrationSelection } from '../utils/illustrationPersistence';
import { generateIllustrationWithAutoPipeline } from '../utils/illustrationGenerationPipeline';

/**
 * IllustrationsManager Component
 * Manages batch illustration generation with queue system
 * Shows status for all pages and allows batch generation
 */
function IllustrationsManager({ onOpenPage, onNavigateToCharacters }) {
  const { currentProject, updateProject, openaiServiceUrl } = useApp();
  const [queueProgress, setQueueProgress] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentProcessingPageId, setCurrentProcessingPageId] = useState(null);
  const [showVariantSelector, setShowVariantSelector] = useState(false);
  const [currentVariants, setCurrentVariants] = useState([]);
  const [currentPage, setCurrentPage] = useState(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoPage, setInfoPage] = useState(null);
  const [error, setError] = useState(null);
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  const [tableScrollTop, setTableScrollTop] = useState(0);
  const tableScrollRef = useRef(null);

  const sortedPages = useMemo(() => {
    return [...(currentProject?.pages || [])].sort((a, b) => (a.number || 0) - (b.number || 0));
  }, [currentProject?.pages]);

  const tableHeight = useMemo(
    () => getDynamicTableHeight(viewportHeight, { reservedHeight: error ? 490 : 440 }),
    [viewportHeight, error]
  );

  const virtualized = shouldUseVirtualization(sortedPages.length);
  const rowHeight = 86;
  const virtualWindow = useMemo(() => {
    if (!virtualized) {
      return {
        startIndex: 0,
        endIndex: sortedPages.length,
        topPadding: 0,
        bottomPadding: 0
      };
    }

    return getVirtualWindow({
      scrollTop: tableScrollTop,
      rowHeight,
      containerHeight: tableHeight,
      totalRows: sortedPages.length,
      overscan: 8
    });
  }, [virtualized, tableScrollTop, tableHeight, sortedPages.length]);

  const visiblePages = useMemo(
    () => sortedPages.slice(virtualWindow.startIndex, virtualWindow.endIndex),
    [sortedPages, virtualWindow.startIndex, virtualWindow.endIndex]
  );

  const identitySpecStatus = useMemo(
    () => validateVisualIdentitySpec(currentProject?.visualIdentitySpec),
    [currentProject?.visualIdentitySpec]
  );

  const identitySpecErrors = useMemo(() => {
    if (identitySpecStatus.ok) {
      return [];
    }

    return identitySpecStatus.errors
      .map((error) => {
        if (error.includes('referencePrompt')) {
          return 'Reference personnage manquante.';
        }
        if (error.includes('colorPalette')) {
          return 'Palette couleur du personnage manquante.';
        }
        if (error.includes('appearance') || error.includes('description')) {
          return 'Apparence/description du personnage principal manquante.';
        }
        if (error.includes('artStyle')) {
          return 'Style artistique manquant.';
        }
        if (error.includes('invariants')) {
          return 'Regles de coherence (invariants) manquantes.';
        }
        return error;
      })
      .slice(0, 3);
  }, [identitySpecStatus]);

  const displayedIdentityErrors = identitySpecErrors.length > 0
    ? identitySpecErrors
    : ['Identite visuelle non validee.'];

  useEffect(() => {
    const onResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener('resize', onResize);

    // Set up queue callbacks
    illustrationQueue.setOnProgress((progress) => {
      setQueueProgress(progress);
      const activeItem = progress.queue?.[progress.currentIndex];
      setCurrentProcessingPageId(activeItem?.page?.id || null);
    });

    illustrationQueue.setOnComplete((results, errors) => {
      setIsProcessing(false);
      setCurrentProcessingPageId(null);
      if (errors.length > 0) {
        setError(`${errors.length} page(s) ont échoué lors de la génération.`);
      }
    });

    illustrationQueue.setOnError((page, error) => {
      console.error(`Error generating illustration for page ${page.number}:`, error);
    });

    return () => {
      window.removeEventListener('resize', onResize);
      illustrationQueue.reset();
    };
  }, []);

  const getAvailableVariants = (page) => {
    const illustrationVariants = page?.illustration?.variants;
    if (Array.isArray(illustrationVariants) && illustrationVariants.length > 0) {
      return illustrationVariants;
    }

    const legacyVariants = page?.illustration?.allVariants;
    if (Array.isArray(legacyVariants) && legacyVariants.length > 0) {
      return legacyVariants;
    }

    if (Array.isArray(page?.illustrationVariants) && page.illustrationVariants.length > 0) {
      return page.illustrationVariants;
    }

    const previewImageUrl = resolvePageImageUrl(page);
    if (previewImageUrl) {
      return [{ url: previewImageUrl, revised_prompt: page?.illustration?.revised_prompt || '' }];
    }

    return [];
  };

  const handleOpenPage = (page) => {
    if (typeof onOpenPage === 'function') {
      onOpenPage(page.id);
    }
  };

  const handleRegeneratePage = async (page) => {
    if (!identitySpecStatus.ok) {
      setError(`visualIdentitySpec invalide: ${identitySpecStatus.errors.join(' | ')}`);
      return;
    }

    try {
      setError(null);
      setCurrentProcessingPageId(page.id);
      await generateIllustrationForPage(page, 0);
    } catch (regenerateError) {
      setError(regenerateError.message || `Échec de régénération pour la page ${page.number}`);
    } finally {
      setCurrentProcessingPageId(null);
    }
  };

  const handleViewVariants = (page) => {
    const variants = getAvailableVariants(page);
    if (variants.length === 0) {
      setError(`Aucune variante disponible pour la page ${page.number}`);
      return;
    }

    setCurrentVariants(variants);
    setCurrentPage(page);
    setShowVariantSelector(true);
  };

  const handleShowGenerationInfo = (page) => {
    setInfoPage(page);
    setShowInfoModal(true);
  };

  const getPageStatus = (page) => {
    const hasIllustration = !!resolvePageImageUrl(page);
    
    if (hasIllustration) {
      return 'completed';
    }
    
    const queueItem = queueProgress?.queue?.find(item => item.page.id === page.id);
    if (queueItem) {
      return queueItem.status;
    }

    // Check if page can have illustration
    const template = page.template;
    // Support both English and French template names
    const hasImageZone = template === 'full_illustration' || template === 'illustration-pleine' ||
                         template === 'mixed' || template === 'mixte' ||
                         template === 'double_page' || template === 'double-page';
    if (hasImageZone) {
      return 'missing';
    }

    return 'not_applicable';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'processing':
      case 'retrying':
        return <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-gray-400" />;
      case 'missing':
        return <AlertCircle className="w-5 h-5 text-orange-500" />;
      default:
        return null;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'completed':
        return 'Illustration générée';
      case 'processing':
        return 'Génération en cours...';
      case 'retrying':
        return 'Nouvelle tentative...';
      case 'failed':
        return 'Échec';
      case 'pending':
        return 'En attente';
      case 'missing':
        return 'Manquante';
      case 'not_applicable':
        return 'Pas d\'illustration';
      default:
        return 'Inconnu';
    }
  };

  const generateIllustrationForPage = async (page, index) => {
    // Validate visual identity spec
    const specValidation = validateVisualIdentitySpec(currentProject.visualIdentitySpec);
    if (!specValidation.ok) {
      throw new Error(`visualIdentitySpec invalide: ${specValidation.errors.join(' | ')}`);
    }
    const pipelineResult = await generateIllustrationWithAutoPipeline({
      currentProject,
      page,
      openaiServiceUrl,
      mode: 'batch'
    });

    const selectedVariant = pipelineResult.selectedVariant;
    const generationMeta = {
      requestId: selectedVariant.requestId || null,
      promptFinal: selectedVariant.promptFinal || null,
      revisedPrompt: selectedVariant.revised_prompt || '',
      createdAt: selectedVariant.generatedAt || new Date().toISOString(),
      model: null,
      size: pipelineResult.dalleParams.size,
      quality: 'standard',
      identityHash: selectedVariant.identityHash || pipelineResult.identityHash || null,
      identityVersion: pipelineResult.identityVersion || null,
      referenceImageId: selectedVariant.referenceImageId || currentProject.visualIdentitySpec?.mainCharacter?.referenceImageId || 'main-character-reference',
      promptSections: selectedVariant.promptSections || null,
      promptTrace: selectedVariant.promptTrace || null,
      consistencyProfile: selectedVariant.consistencyProfile || null,
      evaluation: selectedVariant.evaluation || null,
      generatorStrategy: selectedVariant.generatorStrategy || null,
      constraintBundleSummary: selectedVariant.constraintBundleSummary || null,
      attempts: pipelineResult.attempts,
      variants: pipelineResult.variants,
      selectionMode: 'auto-best-result',
      fallbackAccepted: Boolean(pipelineResult.fallbackAccepted ?? selectedVariant.fallbackAccepted),
      fallbackReason: pipelineResult.fallbackReason || selectedVariant.fallbackReason || null,
      finalDecisionType: pipelineResult.finalDecisionType || selectedVariant.finalDecisionType || 'accepted',
      autoSelected: true,
      autoSelectedVariantIndex: selectedVariant.autoSelectedVariantIndex ?? selectedVariant.variantIndex ?? 0,
      pipeline: pipelineResult.pipeline
    };

    console.log('[IllustrationsManager] Persisting final illustration for page', page.number);
    const { illustration } = await finalizePageIllustrationSelection({
      currentProject,
      page,
      variant: selectedVariant,
      generationMeta,
      updateProject
    });
    console.log('[IllustrationsManager] Illustration saved successfully');

    return illustration;
  };

  const handleGenerateAll = async () => {
    console.log('[IllustrationsManager] Starting generation...');
    setError(null);

    // Validate visual identity spec first
    console.log('[IllustrationsManager] Validating visualIdentitySpec:', currentProject.visualIdentitySpec);
    const specValidation = validateVisualIdentitySpec(currentProject.visualIdentitySpec);
    console.log('[IllustrationsManager] Spec validation result:', specValidation);
    
    if (!specValidation.ok) {
      const errorMsg = `visualIdentitySpec invalide: ${specValidation.errors.join(' | ') || 'Veuillez d\'abord valider l\'identité visuelle dans la section Personnages.'}`;
      console.error('[IllustrationsManager]', errorMsg);
      setError(errorMsg);
      return;
    }

    // Get pages that need illustrations
    const pagesToGenerate = currentProject.pages.filter(page => {
      const template = page.template;
      // Support both English and French template names
      const hasImageZone = template === 'full_illustration' || template === 'illustration-pleine' ||
                           template === 'mixed' || template === 'mixte' ||
                           template === 'double_page' || template === 'double-page';
      const hasIllustration = !!resolvePageImageUrl(page);
      const hasText = page.textBlocks?.some(b => b.content?.trim().length > 10);
      
      return hasImageZone && !hasIllustration && hasText;
    });

    if (pagesToGenerate.length === 0) {
      setError('Aucune page à générer. Toutes les pages ont déjà des illustrations ou n\'ont pas de texte.');
      return;
    }

    // Add pages to queue
    illustrationQueue.addPages(pagesToGenerate);
    setIsProcessing(true);

    // Start processing
    await illustrationQueue.start(generateIllustrationForPage);
  };

  const handlePause = () => {
    illustrationQueue.pause();
    setIsProcessing(false);
  };

  const handleResume = async () => {
    setIsProcessing(true);
    await illustrationQueue.resume(generateIllustrationForPage);
  };

  const handleReset = () => {
    illustrationQueue.reset();
    setQueueProgress(null);
    setCurrentProcessingPageId(null);
    setIsProcessing(false);
    setError(null);
  };

  if (!currentProject) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Aucun projet ouvert</p>
      </div>
    );
  }

  const stats = {
    total: currentProject.pages?.length || 0,
    completed: currentProject.pages?.filter(p => resolvePageImageUrl(p)).length || 0,
    missing: currentProject.pages?.filter(p => {
      const template = p.template;
      // Support both English and French template names
      const hasImageZone = template === 'full_illustration' || template === 'illustration-pleine' ||
                           template === 'mixed' || template === 'mixte' ||
                           template === 'double_page' || template === 'double-page';
      return hasImageZone && !resolvePageImageUrl(p);
    }).length || 0
  };

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-b from-zinc-50 to-zinc-100">
      {/* Header */}
      <div className="bg-white/90 border-b border-zinc-200 px-6 py-5 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-zinc-800">Gestion des illustrations</h2>
            <p className="text-zinc-600 mt-1">Générez les illustrations pour toutes les pages de votre livre</p>
          </div>

          <div className="flex gap-3">
            {isProcessing ? (
              <button
                onClick={handlePause}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-colors shadow-sm"
              >
                <Pause className="w-5 h-5" />
                Pause
              </button>
            ) : queueProgress && queueProgress.currentIndex < queueProgress.total ? (
              <button
                onClick={handleResume}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors shadow-sm"
              >
                <Play className="w-5 h-5" />
                Reprendre
              </button>
            ) : (
              <button
                onClick={handleGenerateAll}
                disabled={stats.missing === 0 || !identitySpecStatus.ok}
                data-testid="generate-all-illustrations"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Wand2 className="w-5 h-5" />
                Générer toutes les pages manquantes
              </button>
            )}

            {queueProgress && (
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-zinc-600 text-white rounded-xl hover:bg-zinc-700 transition-colors shadow-sm"
              >
                <RotateCcw className="w-5 h-5" />
                Réinitialiser
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-200">
            <div className="text-3xl font-bold text-zinc-800">{stats.total}</div>
            <div className="text-sm text-zinc-600">Pages totales</div>
          </div>
          <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
            <div className="text-3xl font-bold text-emerald-600">{stats.completed}</div>
            <div className="text-sm text-zinc-600">Illustrations générées</div>
          </div>
          <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
            <div className="text-3xl font-bold text-amber-600">{stats.missing}</div>
            <div className="text-sm text-zinc-600">Illustrations manquantes</div>
          </div>
        </div>

        {/* Progress bar */}
        {queueProgress && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Progression: {queueProgress.completed}/{queueProgress.total}
              </span>
              <span className="text-sm text-gray-600">{queueProgress.percentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-primary-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${queueProgress.percentage}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div data-testid="illustrations-error" className="bg-red-50 border border-red-200 rounded-xl p-4 m-6 shadow-sm">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {!identitySpecStatus.ok && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 m-6 shadow-sm">
          <p className="text-amber-900 font-semibold">Generation bloquee: identite visuelle invalide</p>
          <ul className="mt-2 text-sm text-amber-800 list-disc list-inside space-y-1">
            {displayedIdentityErrors.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ul>
          {onNavigateToCharacters && (
            <button
              onClick={onNavigateToCharacters}
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
            >
              Valider l'identite visuelle
            </button>
          )}
        </div>
      )}

      {/* Page list */}
      <div className="flex-1 p-6 min-h-0">
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm h-full flex flex-col overflow-hidden">
          <div
            ref={tableScrollRef}
            className="overflow-y-auto overflow-x-hidden"
            style={{ height: tableHeight }}
            onScroll={(event) => setTableScrollTop(event.currentTarget.scrollTop)}
            data-testid="illustrations-table-scroll"
          >
            <table className="w-full table-fixed">
            <thead className="sticky top-0 z-20 bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="w-[90px] px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Page
                </th>
                <th className="w-[130px] px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Template
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Texte
                </th>
                <th className="w-[180px] px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="w-[110px] px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Aperçu
                </th>
                <th className="w-[290px] px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-zinc-200">
              {virtualized && virtualWindow.topPadding > 0 && (
                <tr>
                  <td colSpan={6} style={{ height: virtualWindow.topPadding }} />
                </tr>
              )}

              {visiblePages.map((page) => {
                const status = getPageStatus(page);
                const pageText = page.textBlocks?.map(b => b.content).join(' ').trim();
                const previewImageUrl = resolvePageImageUrl(page);
                const canGenerate = status !== 'not_applicable';
                
                return (
                  <tr key={page.id} className={`${currentProcessingPageId === page.id ? 'bg-blue-50' : 'hover:bg-zinc-50/70'} transition-colors`}>
                    <td className="px-4 py-3 whitespace-nowrap align-top">
                      <div className="text-sm font-medium text-gray-900">Page {page.number}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap align-top">
                      <span className="text-sm text-gray-600">{page.template || 'Non défini'}</span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="text-sm text-gray-600 truncate">
                        {pageText || 'Pas de texte'}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap align-top">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(status)}
                        <span className="text-sm text-gray-700">{getStatusText(status)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap align-top">
                      {previewImageUrl && (
                        <img
                          src={previewImageUrl}
                          alt={`Page ${page.number}`}
                          className="w-16 h-16 object-cover rounded border border-gray-200"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap align-top">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleOpenPage(page)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-zinc-300 rounded-md hover:bg-zinc-50"
                          data-testid={`open-page-${page.number}`}
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Ouvrir page
                        </button>
                        <button
                          onClick={() => handleRegeneratePage(page)}
                          disabled={!canGenerate || isProcessing || !identitySpecStatus.ok}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-indigo-300 text-indigo-700 rounded-md hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          data-testid={`regenerate-page-${page.number}`}
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> Regénérer
                        </button>
                        <button
                          onClick={() => handleViewVariants(page)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-zinc-300 rounded-md hover:bg-zinc-50"
                          data-testid={`variants-page-${page.number}`}
                        >
                          <Image className="w-3.5 h-3.5" /> Voir variantes
                        </button>
                        <button
                          onClick={() => handleShowGenerationInfo(page)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-zinc-300 rounded-md hover:bg-zinc-50"
                          data-testid={`infos-page-${page.number}`}
                        >
                          <Info className="w-3.5 h-3.5" /> Infos
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {virtualized && virtualWindow.bottomPadding > 0 && (
                <tr>
                  <td colSpan={6} style={{ height: virtualWindow.bottomPadding }} />
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {/* Variant selector modal */}
      {showVariantSelector && (
        <ImageVariantSelector
          variants={currentVariants}
          onSelect={async (variant, index) => {
            try {
              if (!currentPage) {
                throw new Error('Page courante introuvable pour la sélection de variante.');
              }

              setError(null);
              await finalizePageIllustrationSelection({
                currentProject,
                page: currentPage,
                variant: {
                  ...variant,
                  variantIndex: index,
                  batchGenerated: false,
                  autoSelected: false,
                  selectionMode: 'manual-review',
                  variants: currentVariants,
                  allVariants: currentVariants
                },
                generationMeta: {
                  ...(currentPage.generationMeta || {}),
                  requestId: variant.requestId || currentPage.generationMeta?.requestId || null,
                  promptFinal: variant.promptFinal || currentPage.generationMeta?.promptFinal || null,
                  revisedPrompt: variant.revised_prompt || currentPage.generationMeta?.revisedPrompt || '',
                  createdAt: currentPage.generationMeta?.createdAt || new Date().toISOString(),
                  model: currentPage.generationMeta?.model || null,
                  size: variant.dalleParams?.size || currentPage.generationMeta?.size || null,
                  quality: variant.dalleParams?.quality || currentPage.generationMeta?.quality || 'standard',
                  status: 'ready',
                  variants: currentVariants,
                  selectionMode: 'manual-review',
                  autoSelected: false,
                  autoSelectedVariantIndex: index
                },
                updateProject
              });
              setShowVariantSelector(false);
              setCurrentVariants([]);
              setCurrentPage(null);
            } catch (selectionError) {
              setError(selectionError.message || 'Impossible de retenir cette variante.');
            }
          }}
          onClose={() => {
            setShowVariantSelector(false);
            setCurrentVariants([]);
            setCurrentPage(null);
          }}
          title={`Sélectionnez une illustration pour la page ${currentPage?.number}`}
        />
      )}

      {showInfoModal && (
        <div className="fixed inset-0 bg-black/45 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-zinc-200 px-5 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-zinc-800">
                Infos de generation - Page {infoPage?.number || '?'}
              </h3>
              <button
                onClick={() => {
                  setShowInfoModal(false);
                  setInfoPage(null);
                }}
                className="p-1.5 rounded-md hover:bg-zinc-100"
                aria-label="Fermer"
              >
                <X className="w-4 h-4 text-zinc-700" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 text-sm">
              <div>
                <p className="text-zinc-500">requestId</p>
                <p className="font-mono text-zinc-800 break-all">{infoPage?.generationMeta?.requestId || 'N/A'}</p>
              </div>

              <div>
                <p className="text-zinc-500">identityHash</p>
                <p className="font-mono text-zinc-800 break-all">{infoPage?.generationMeta?.identityHash || 'N/A'}</p>
              </div>

              <div className="border border-zinc-200 rounded-lg">
                <div className="px-3 py-2 bg-zinc-50 font-medium text-zinc-700">attempts</div>
                <div className="p-3 space-y-1 text-xs text-zinc-800">
                  {(infoPage?.generationMeta?.attempts || []).length === 0 && <p>N/A</p>}
                  {(infoPage?.generationMeta?.attempts || []).map((item, idx) => (
                    <p key={`${item.attempt}-${idx}`} className="font-mono break-all">
                      {`#${item.attempt} - ${item.status}${item.error ? ` - ${item.error}` : ''}`}
                    </p>
                  ))}
                </div>
              </div>

              <details className="border border-zinc-200 rounded-lg">
                <summary className="cursor-pointer px-3 py-2 bg-zinc-50 font-medium text-zinc-700">
                  promptFinal
                </summary>
                <pre className="p-3 whitespace-pre-wrap break-words text-xs leading-5 text-zinc-800">
                  {infoPage?.generationMeta?.promptFinal || 'N/A'}
                </pre>
              </details>

              <div className="border border-zinc-200 rounded-lg">
                <div className="px-3 py-2 bg-zinc-50 font-medium text-zinc-700">revisedPrompt</div>
                <pre className="p-3 whitespace-pre-wrap break-words text-xs leading-5 text-zinc-800">
                  {infoPage?.generationMeta?.revisedPrompt || 'N/A'}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default IllustrationsManager;

