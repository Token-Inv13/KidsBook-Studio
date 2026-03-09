import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { AlertTriangle, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { resolvePageImageUrl } from '../utils/imageUrlResolver';
import { autoLayoutPage, getFormatDimensions, getReadableTextStyle, getSpreadPages, normalizeTextBlock } from '../utils/writingLayout';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const SpreadPage = ({
  page,
  format,
  side,
  onSelect,
  onUpdateText,
  luminance,
  selectedBlockId,
  draftGeometry,
  onSelectBlock,
  onStartMove,
  onStartResize,
  isActivePage,
  onStartImagePan
}) => {
  const { width, height, bleed, safeArea } = getFormatDimensions(format);

  if (!page) {
    return (
      <div className="relative bg-white/70 border border-dashed border-gray-300 rounded-xl flex items-center justify-center text-sm text-gray-400"
        style={{ width, height }}
      >
        Page vide
      </div>
    );
  }

  const imageUrl = resolvePageImageUrl(page);
  const imageTransform = page.imageTransform || { zoom: 1, offsetX: 0, offsetY: 0, fitMode: 'cover' };
  const fitMode = imageTransform.fitMode === 'contain' ? 'contain' : 'cover';
  const backgroundColor = page.template === 'double-page'
    ? (side === 'Gauche'
      ? (page.spreadBackground?.leftColor || page.pageBackground?.color || '#ffffff')
      : (page.spreadBackground?.rightColor || page.pageBackground?.color || '#ffffff'))
    : (page.pageBackground?.color || '#ffffff');

  return (
    <div
      className="relative rounded-xl shadow-xl border-2 border-gray-200 overflow-hidden cursor-pointer"
      onClick={() => {
        onSelect(page.id);
        onSelectBlock(page.id, null);
      }}
      style={{ width, height, backgroundColor }}
      data-page-id={page.id}
    >
      <div className="absolute top-2 left-2 z-30 text-xs px-2 py-1 rounded bg-black/60 text-white">
        {side} • Page {page.number}
      </div>

      <div
        className="absolute border border-dashed border-red-300 pointer-events-none"
        style={{ top: bleed, left: bleed, right: bleed, bottom: bleed }}
      />
      <div
        className="absolute border border-dashed border-green-300 pointer-events-none"
        style={{ top: bleed + safeArea, left: bleed + safeArea, right: bleed + safeArea, bottom: bleed + safeArea }}
      />

      {imageUrl && (
        <div
          className={`absolute inset-0 overflow-hidden ${isActivePage ? 'cursor-grab active:cursor-grabbing' : ''}`}
          onMouseDown={(event) => {
            if (isActivePage) {
              onStartImagePan(event, page.id);
            }
          }}
        >
          <img
            src={imageUrl}
            alt={`Page ${page.number}`}
            className="absolute inset-0 w-full h-full select-none pointer-events-none"
            draggable={false}
            style={{
              objectFit: fitMode,
              transform: `translate(${imageTransform.offsetX || 0}px, ${imageTransform.offsetY || 0}px) scale(${imageTransform.zoom || 1})`,
              transformOrigin: 'center center'
            }}
          />
        </div>
      )}

      {(page.textBlocks || []).map((block) => (
        (() => {
          const hasImage = Boolean(imageUrl);
          const normalizedBlock = normalizeTextBlock(block);
          const isSelected = selectedBlockId === block.id;
          const runtimeBlock = isSelected && draftGeometry
            ? { ...normalizedBlock, ...draftGeometry }
            : normalizedBlock;
          const readableStyle = getReadableTextStyle(runtimeBlock, luminance, hasImage);

          return (
        <div
          key={block.id}
          className={`absolute rounded border transition-colors ${
            isSelected ? 'border-indigo-500/90 ring-2 ring-indigo-300/70' : 'border-gray-300/50'
          }`}
          onClick={(event) => {
            event.stopPropagation();
            onSelectBlock(page.id, block.id);
          }}
          style={{
            left: runtimeBlock.x,
            top: runtimeBlock.y,
            width: runtimeBlock.width,
            height: runtimeBlock.height,
            fontSize: runtimeBlock.fontSize,
            fontFamily: runtimeBlock.fontFamily,
            lineHeight: runtimeBlock.lineHeight,
            textAlign: runtimeBlock.textAlign,
            color: readableStyle.color,
            backgroundColor: readableStyle.backgroundColor,
            textShadow: readableStyle.textShadow,
            WebkitTextStroke: readableStyle.WebkitTextStroke,
            padding: readableStyle.padding,
            borderRadius: readableStyle.borderRadius,
            overflow: 'hidden'
          }}
        >
          <div
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => onUpdateText(page.id, block.id, e.currentTarget.innerText)}
            className="w-full h-full outline-none whitespace-pre-wrap break-words"
          >
            {runtimeBlock.content}
          </div>
          {isSelected && (
            <>
              <button
                type="button"
                onMouseDown={(event) => onStartMove(event, page.id, runtimeBlock)}
                className="absolute -top-3 -left-3 w-6 h-6 rounded-full bg-indigo-600 text-white shadow border border-white inline-flex items-center justify-center text-xs"
                title="Déplacer"
              >
                ↕
              </button>
              <button
                type="button"
                onMouseDown={(event) => onStartResize(event, page.id, runtimeBlock)}
                className="absolute -bottom-2 -right-2 w-4 h-4 rounded-sm bg-indigo-600 border border-white shadow"
                title="Redimensionner"
              />
            </>
          )}
          {runtimeBlock.overflowWarning && (
            <div className="absolute -bottom-5 left-0 flex items-center gap-1 text-[10px] text-amber-700 bg-amber-100 px-1 rounded">
              <AlertTriangle size={10} />
              Texte trop long
            </div>
          )}
        </div>
          );
        })()
      ))}
    </div>
  );
};

const sampleImageLuminance = (url) => new Promise((resolve) => {
  if (!url) {
    resolve(null);
    return;
  }

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 24;
      canvas.height = 24;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, 24, 24);
      const data = ctx.getImageData(0, 0, 24, 24).data;

      let total = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i] / 255;
        const g = data[i + 1] / 255;
        const b = data[i + 2] / 255;
        total += (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
      }

      resolve(total / (data.length / 4));
    } catch (error) {
      resolve(null);
    }
  };
  img.onerror = () => resolve(null);
  img.src = url;
});

const BookSpreadEditor = ({
  selectedPageId,
  onSelectPage,
  className = '',
  viewportInsets = { left: 0, right: 0, top: 0, bottom: 0 },
  onPrev,
  onNext,
  spreadMeta
}) => {
  const { currentProject, updateProject } = useApp();
  const pages = currentProject?.pages || [];
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [luminanceByPage, setLuminanceByPage] = useState({});
  const [selectedTextBlock, setSelectedTextBlock] = useState({ pageId: null, blockId: null });
  const [interaction, setInteraction] = useState(null);
  const [imagePanInteraction, setImagePanInteraction] = useState(null);
  const containerRef = useRef(null);

  const spread = useMemo(
    () => getSpreadPages(pages, selectedPageId),
    [pages, selectedPageId]
  );

  const { width: pageWidth, height: pageHeight } = useMemo(
    () => getFormatDimensions(currentProject?.format),
    [currentProject?.format]
  );

  const spreadGap = 40;
  const rawSpreadWidth = pageWidth * 2 + spreadGap;
  const rawSpreadHeight = pageHeight;

  const availableWidth = Math.max(320, (viewport.width - (viewportInsets.left || 0) - (viewportInsets.right || 0)) * 0.92);
  const availableHeight = Math.max(240, viewport.height - (viewportInsets.top || 0) - (viewportInsets.bottom || 0));
  const spreadScale = Math.min(1, availableWidth / rawSpreadWidth, availableHeight / rawSpreadHeight);

  const selectedBlockData = useMemo(() => {
    if (!selectedTextBlock.pageId || !selectedTextBlock.blockId) {
      return null;
    }
    const page = pages.find((entry) => entry.id === selectedTextBlock.pageId);
    const block = page?.textBlocks?.find((entry) => entry.id === selectedTextBlock.blockId);
    return block ? normalizeTextBlock(block) : null;
  }, [pages, selectedTextBlock]);

  const selectedPageData = useMemo(
    () => pages.find((entry) => entry.id === selectedPageId) || null,
    [pages, selectedPageId]
  );

  const patchBlock = async (pageId, blockId, updates, options = {}) => {
    const { keepManual = true } = options;

    await updateProject((prevProject) => {
      const updatedPages = (prevProject.pages || []).map((entry) => {
        if (entry.id !== pageId) {
          return entry;
        }

        const updatedBlocks = (entry.textBlocks || []).map((block) => {
          if (block.id !== blockId) {
            return normalizeTextBlock(block);
          }

          const merged = normalizeTextBlock({ ...block, ...updates });
          if (keepManual && updates.layoutMode !== 'auto') {
            merged.layoutMode = 'manual';
          }
          return merged;
        });

        return autoLayoutPage(
          { ...entry, textBlocks: updatedBlocks },
          prevProject.format,
          { preserveManual: true }
        );
      });

      return { pages: updatedPages };
    });
  };

  const applyToSelectedBlock = async (updates, options = {}) => {
    if (!selectedTextBlock.pageId || !selectedTextBlock.blockId) {
      return;
    }
    await patchBlock(selectedTextBlock.pageId, selectedTextBlock.blockId, updates, options);
  };

  const patchPage = async (pageId, updates) => {
    await updateProject((prevProject) => ({
      pages: (prevProject.pages || []).map((entry) => (
        entry.id === pageId ? { ...entry, ...updates } : entry
      ))
    }));
  };

  const startInteraction = (event, pageId, block, mode) => {
    event.preventDefault();
    event.stopPropagation();

    const pageElement = event.currentTarget.closest('[data-page-id]');
    const rect = pageElement?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return;
    }

    const normalizedBlock = normalizeTextBlock(block);
    setSelectedTextBlock({ pageId, blockId: normalizedBlock.id });
    setInteraction({
      mode,
      pageId,
      blockId: normalizedBlock.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      scaleX: pageWidth / rect.width,
      scaleY: pageHeight / rect.height,
      draft: {
        x: normalizedBlock.x,
        y: normalizedBlock.y,
        width: normalizedBlock.width,
        height: normalizedBlock.height
      }
    });
  };

  const startImagePan = (event, pageId) => {
    event.preventDefault();
    event.stopPropagation();

    const pageElement = event.currentTarget.closest('[data-page-id]');
    const rect = pageElement?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return;
    }

    const page = pages.find((entry) => entry.id === pageId);
    const transform = page?.imageTransform || { zoom: 1, offsetX: 0, offsetY: 0, fitMode: 'cover' };
    setImagePanInteraction({
      pageId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      scaleX: pageWidth / rect.width,
      scaleY: pageHeight / rect.height,
      offsetX: transform.offsetX || 0,
      offsetY: transform.offsetY || 0
    });
  };

  useEffect(() => {
    if (!interaction) {
      return undefined;
    }

    const onMouseMove = (event) => {
      setInteraction((prev) => {
        if (!prev) {
          return prev;
        }

        const deltaX = (event.clientX - prev.startClientX) * prev.scaleX;
        const deltaY = (event.clientY - prev.startClientY) * prev.scaleY;

        if (prev.mode === 'move') {
          const maxX = Math.max(0, pageWidth - prev.draft.width);
          const maxY = Math.max(0, pageHeight - prev.draft.height);
          return {
            ...prev,
            draft: {
              ...prev.draft,
              x: clamp(prev.draft.x + deltaX, 0, maxX),
              y: clamp(prev.draft.y + deltaY, 0, maxY)
            },
            startClientX: event.clientX,
            startClientY: event.clientY
          };
        }

        const minWidth = 80;
        const minHeight = 44;
        const nextWidth = clamp(prev.draft.width + deltaX, minWidth, pageWidth - prev.draft.x);
        const nextHeight = clamp(prev.draft.height + deltaY, minHeight, pageHeight - prev.draft.y);

        return {
          ...prev,
          draft: {
            ...prev.draft,
            width: nextWidth,
            height: nextHeight
          },
          startClientX: event.clientX,
          startClientY: event.clientY
        };
      });
    };

    const onMouseUp = async () => {
      const current = interaction;
      setInteraction(null);
      await patchBlock(current.pageId, current.blockId, {
        x: current.draft.x,
        y: current.draft.y,
        width: current.draft.width,
        height: current.draft.height,
        layoutMode: 'manual'
      });
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [interaction, pageWidth, pageHeight]);

  useEffect(() => {
    if (!imagePanInteraction) {
      return undefined;
    }

    const onMouseMove = (event) => {
      setImagePanInteraction((prev) => {
        if (!prev) {
          return prev;
        }

        const deltaX = (event.clientX - prev.startClientX) * prev.scaleX;
        const deltaY = (event.clientY - prev.startClientY) * prev.scaleY;
        return {
          ...prev,
          offsetX: prev.offsetX + deltaX,
          offsetY: prev.offsetY + deltaY,
          startClientX: event.clientX,
          startClientY: event.clientY
        };
      });
    };

    const onMouseUp = async () => {
      const current = imagePanInteraction;
      setImagePanInteraction(null);
      await updateProject((prevProject) => ({
        pages: (prevProject.pages || []).map((entry) => {
          if (entry.id !== current.pageId) {
            return entry;
          }
          const currentTransform = entry.imageTransform || { zoom: 1, offsetX: 0, offsetY: 0, fitMode: 'cover' };
          return {
            ...entry,
            imageTransform: {
              ...currentTransform,
              offsetX: current.offsetX,
              offsetY: current.offsetY
            }
          };
        })
      }));
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [imagePanInteraction, updateProject]);

  const activeDraftGeometry = interaction && selectedTextBlock.pageId === interaction.pageId && selectedTextBlock.blockId === interaction.blockId
    ? interaction.draft
    : null;

  const activeImageTransform = selectedPageData?.imageTransform || { zoom: 1, offsetX: 0, offsetY: 0, fitMode: 'cover' };

  useEffect(() => {
    const onResize = () => {
      const bounds = containerRef.current?.getBoundingClientRect();
      if (bounds) {
        setViewport({ width: bounds.width, height: bounds.height });
      } else {
        setViewport({ width: window.innerWidth, height: window.innerHeight });
      }
    };

    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const collectLuminance = async () => {
      const targets = [spread.leftPage, spread.rightPage].filter(Boolean);
      const next = {};

      for (const page of targets) {
        const imageUrl = resolvePageImageUrl(page);
        next[page.id] = await sampleImageLuminance(imageUrl);
      }

      setLuminanceByPage((prev) => ({ ...prev, ...next }));
    };

    collectLuminance();
  }, [spread.leftPage, spread.rightPage]);

  const updateTextBlock = async (pageId, blockId, content) => {
    await updateProject((prevProject) => {
      const updatedPages = (prevProject.pages || []).map((p) => {
        if (p.id !== pageId) {
          return p;
        }

        const updatedBlocks = (p.textBlocks || []).map((block) =>
          block.id === blockId ? normalizeTextBlock({ ...block, content }) : normalizeTextBlock(block)
        );

        return autoLayoutPage(
          { ...p, textBlocks: updatedBlocks },
          prevProject.format,
          { preserveManual: true }
        );
      });

      return { pages: updatedPages };
    });
  };

  if (pages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-100">
        <div className="text-center text-gray-400">
          <BookOpen size={56} className="mx-auto mb-3 opacity-60" />
          <p>Ajoutez des pages pour afficher le livre ouvert</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`flex-1 overflow-hidden bg-gradient-to-b from-stone-100 via-stone-200 to-zinc-300 ${className}`.trim()}>
      <div className="w-full h-full flex items-center justify-center py-6 px-4 relative">
        <div
          style={{
            width: rawSpreadWidth,
            height: rawSpreadHeight,
            transform: `scale(${spreadScale})`,
            transformOrigin: 'center center'
          }}
          className="flex justify-center gap-10 items-start"
        >
          <SpreadPage
            page={spread.leftPage}
            format={currentProject.format}
            side="Gauche"
            onSelect={onSelectPage}
            onUpdateText={updateTextBlock}
            luminance={spread.leftPage ? luminanceByPage[spread.leftPage.id] : null}
            selectedBlockId={selectedTextBlock.pageId === spread.leftPage?.id ? selectedTextBlock.blockId : null}
            draftGeometry={selectedTextBlock.pageId === spread.leftPage?.id ? activeDraftGeometry : null}
            onSelectBlock={(pageId, blockId) => setSelectedTextBlock({ pageId, blockId })}
            onStartMove={(event, pageId, block) => startInteraction(event, pageId, block, 'move')}
            onStartResize={(event, pageId, block) => startInteraction(event, pageId, block, 'resize')}
            isActivePage={selectedPageId === spread.leftPage?.id}
            onStartImagePan={startImagePan}
          />
          <SpreadPage
            page={spread.rightPage}
            format={currentProject.format}
            side="Droite"
            onSelect={onSelectPage}
            onUpdateText={updateTextBlock}
            luminance={spread.rightPage ? luminanceByPage[spread.rightPage.id] : null}
            selectedBlockId={selectedTextBlock.pageId === spread.rightPage?.id ? selectedTextBlock.blockId : null}
            draftGeometry={selectedTextBlock.pageId === spread.rightPage?.id ? activeDraftGeometry : null}
            onSelectBlock={(pageId, blockId) => setSelectedTextBlock({ pageId, blockId })}
            onStartMove={(event, pageId, block) => startInteraction(event, pageId, block, 'move')}
            onStartResize={(event, pageId, block) => startInteraction(event, pageId, block, 'resize')}
            isActivePage={selectedPageId === spread.rightPage?.id}
            onStartImagePan={startImagePan}
          />
        </div>

        {selectedPageData && (
          <div className="absolute bottom-16 left-4 z-40 bg-white/95 border border-zinc-300 rounded-xl shadow-xl px-3 py-2 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-zinc-600">Image & fond page</span>

            <input
              type="range"
              min="0.7"
              max="2.5"
              step="0.05"
              value={activeImageTransform.zoom || 1}
              onChange={(event) => patchPage(selectedPageData.id, {
                imageTransform: {
                  ...activeImageTransform,
                  zoom: Number(event.target.value)
                }
              })}
              className="w-28"
              title="Zoom image"
            />

            <button
              type="button"
              onClick={() => patchPage(selectedPageData.id, {
                imageTransform: {
                  ...activeImageTransform,
                  offsetX: 0,
                  offsetY: 0
                }
              })}
              className="px-2 py-1 text-xs border border-zinc-300 rounded hover:bg-zinc-50"
            >
              Centrer
            </button>
            <button
              type="button"
              onClick={() => patchPage(selectedPageData.id, {
                imageTransform: {
                  ...activeImageTransform,
                  fitMode: 'cover'
                }
              })}
              className={`px-2 py-1 text-xs border rounded ${activeImageTransform.fitMode !== 'contain' ? 'border-indigo-500 text-indigo-700 bg-indigo-50' : 'border-zinc-300 hover:bg-zinc-50'}`}
            >
              Remplir
            </button>
            <button
              type="button"
              onClick={() => patchPage(selectedPageData.id, {
                imageTransform: {
                  ...activeImageTransform,
                  fitMode: 'contain'
                }
              })}
              className={`px-2 py-1 text-xs border rounded ${activeImageTransform.fitMode === 'contain' ? 'border-indigo-500 text-indigo-700 bg-indigo-50' : 'border-zinc-300 hover:bg-zinc-50'}`}
            >
              Ajuster
            </button>

            <div className="w-px h-5 bg-zinc-200" />

            {selectedPageData.template === 'double-page' ? (
              <>
                <label className="text-xs text-zinc-600">Fond gauche</label>
                <input
                  type="color"
                  value={selectedPageData.spreadBackground?.leftColor || selectedPageData.pageBackground?.color || '#ffffff'}
                  onChange={(event) => patchPage(selectedPageData.id, {
                    spreadBackground: {
                      ...(selectedPageData.spreadBackground || {}),
                      leftColor: event.target.value,
                      rightColor: selectedPageData.spreadBackground?.rightColor || selectedPageData.pageBackground?.color || '#ffffff'
                    }
                  })}
                  className="w-8 h-8 border border-zinc-300 rounded cursor-pointer"
                />
                <label className="text-xs text-zinc-600">Fond droit</label>
                <input
                  type="color"
                  value={selectedPageData.spreadBackground?.rightColor || selectedPageData.pageBackground?.color || '#ffffff'}
                  onChange={(event) => patchPage(selectedPageData.id, {
                    spreadBackground: {
                      ...(selectedPageData.spreadBackground || {}),
                      rightColor: event.target.value,
                      leftColor: selectedPageData.spreadBackground?.leftColor || selectedPageData.pageBackground?.color || '#ffffff'
                    }
                  })}
                  className="w-8 h-8 border border-zinc-300 rounded cursor-pointer"
                />
              </>
            ) : (
              <>
                <label className="text-xs text-zinc-600">Fond</label>
                <input
                  type="color"
                  value={selectedPageData.pageBackground?.color || '#ffffff'}
                  onChange={(event) => patchPage(selectedPageData.id, {
                    pageBackground: {
                      color: event.target.value
                    }
                  })}
                  className="w-8 h-8 border border-zinc-300 rounded cursor-pointer"
                />
              </>
            )}

            <button
              type="button"
              onClick={() => patchPage(selectedPageData.id, {
                pageBackground: { color: '#ffffff' },
                spreadBackground: null
              })}
              className="px-2 py-1 text-xs border border-zinc-300 rounded hover:bg-zinc-50"
            >
              Reset fond
            </button>
          </div>
        )}

        {selectedBlockData && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-white/96 border border-zinc-300 rounded-xl shadow-xl px-3 py-2 flex flex-wrap items-center gap-2 max-w-[90%]">
            <span className="text-xs font-semibold text-zinc-600">Bloc texte ({selectedBlockData.layoutMode === 'manual' ? 'manuel' : 'auto'})</span>

            <div className="w-px h-5 bg-zinc-200" />

            <button
              type="button"
              onClick={() => applyToSelectedBlock({ fontSize: clamp((selectedBlockData.fontSize || 16) - 1, 12, 46) })}
              className="px-2 py-1 text-xs border border-zinc-300 rounded hover:bg-zinc-50"
            >
              A-
            </button>
            <button
              type="button"
              onClick={() => applyToSelectedBlock({ fontSize: clamp((selectedBlockData.fontSize || 16) + 1, 12, 46) })}
              className="px-2 py-1 text-xs border border-zinc-300 rounded hover:bg-zinc-50"
            >
              A+
            </button>

            <button
              type="button"
              onClick={() => applyToSelectedBlock({ textAlign: 'left' })}
              className={`px-2 py-1 text-xs border rounded ${selectedBlockData.textAlign === 'left' ? 'border-indigo-500 text-indigo-700 bg-indigo-50' : 'border-zinc-300 hover:bg-zinc-50'}`}
            >
              Gauche
            </button>
            <button
              type="button"
              onClick={() => applyToSelectedBlock({ textAlign: 'center' })}
              className={`px-2 py-1 text-xs border rounded ${selectedBlockData.textAlign === 'center' ? 'border-indigo-500 text-indigo-700 bg-indigo-50' : 'border-zinc-300 hover:bg-zinc-50'}`}
            >
              Centré
            </button>

            <button
              type="button"
              onClick={() => applyToSelectedBlock({ colorMode: 'auto' })}
              className={`px-2 py-1 text-xs border rounded ${selectedBlockData.colorMode === 'auto' ? 'border-indigo-500 text-indigo-700 bg-indigo-50' : 'border-zinc-300 hover:bg-zinc-50'}`}
            >
              Couleur auto
            </button>
            <button
              type="button"
              onClick={() => applyToSelectedBlock({ colorMode: 'custom', color: '#ffffff' })}
              className={`px-2 py-1 text-xs border rounded ${selectedBlockData.colorMode === 'custom' && selectedBlockData.color === '#ffffff' ? 'border-indigo-500 text-indigo-700 bg-indigo-50' : 'border-zinc-300 hover:bg-zinc-50'}`}
            >
              Blanc
            </button>
            <button
              type="button"
              onClick={() => applyToSelectedBlock({ colorMode: 'custom', color: '#111827' })}
              className={`px-2 py-1 text-xs border rounded ${selectedBlockData.colorMode === 'custom' && selectedBlockData.color === '#111827' ? 'border-indigo-500 text-indigo-700 bg-indigo-50' : 'border-zinc-300 hover:bg-zinc-50'}`}
            >
              Noir
            </button>
            <input
              type="color"
              value={selectedBlockData.color || '#111827'}
              onChange={(event) => applyToSelectedBlock({ colorMode: 'custom', color: event.target.value })}
              className="w-8 h-8 border border-zinc-300 rounded cursor-pointer"
              title="Couleur personnalisée"
            />

            <select
              value={selectedBlockData.backdropMode || 'auto'}
              onChange={(event) => applyToSelectedBlock({ backdropMode: event.target.value })}
              className="px-2 py-1 text-xs border border-zinc-300 rounded bg-white"
              title="Bandeau"
            >
              <option value="auto">Bandeau auto</option>
              <option value="on">Bandeau on</option>
              <option value="off">Bandeau off</option>
            </select>

            <select
              value={selectedBlockData.textEffect || 'shadow'}
              onChange={(event) => applyToSelectedBlock({ textEffect: event.target.value })}
              className="px-2 py-1 text-xs border border-zinc-300 rounded bg-white"
              title="Effet texte"
            >
              <option value="shadow">Shadow</option>
              <option value="outline">Outline</option>
              <option value="none">Aucun</option>
            </select>

            <button
              type="button"
              onClick={() => applyToSelectedBlock({ layoutMode: 'auto' }, { keepManual: false })}
              className="px-2 py-1 text-xs border border-emerald-300 text-emerald-700 bg-emerald-50 rounded hover:bg-emerald-100"
            >
              Repasser en auto
            </button>
          </div>
        )}

        {typeof onPrev === 'function' && typeof onNext === 'function' && (
          <>
            <button
              onClick={onPrev}
              className="absolute top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/35 hover:bg-black/55 text-white inline-flex items-center justify-center shadow-lg backdrop-blur-sm"
              style={{ left: Math.max(8, (viewport.width - (rawSpreadWidth * spreadScale)) / 2 - 54) }}
              title="Page précédente"
            >
              <ChevronLeft size={22} />
            </button>

            <button
              onClick={onNext}
              className="absolute top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/35 hover:bg-black/55 text-white inline-flex items-center justify-center shadow-lg backdrop-blur-sm"
              style={{ right: Math.max(8, (viewport.width - (rawSpreadWidth * spreadScale)) / 2 - 54) }}
              title="Page suivante"
            >
              <ChevronRight size={22} />
            </button>

            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-xs bg-white/90 text-zinc-700 px-3 py-1 rounded-full shadow">
              Spread {spreadMeta?.count ? spreadMeta.index + 1 : 0}/{spreadMeta?.count || 0}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BookSpreadEditor;
