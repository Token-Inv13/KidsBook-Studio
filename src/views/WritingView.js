import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import PageList from '../components/PageList';
import BookSpreadEditor from '../components/BookSpreadEditor';
import AIChat from '../components/AIChat';
import BookSummaryPanel from '../components/BookSummaryPanel';
import TextDistributor from '../components/TextDistributor';
import { AlertCircle, LayoutTemplate, Scissors, Sparkles, X } from 'lucide-react';
import { createPageFromTemplate, getAdjacentSpreadPageId, getSpreadPages } from '../utils/writingLayout';
import { optimizeNarrativePageLayout, optimizeNarrativeProjectLayout } from '../utils/narrativeLayoutEngine';

const DEFAULT_WORKSPACE_HEADER_HEIGHT = 56;
const ASSISTANT_MODAL_SAFE_MARGIN = 12;

const WritingView = ({ initialSelectedPageId = null }) => {
  const { currentProject, updateProject } = useApp();
  const [selectedPageId, setSelectedPageId] = useState(null);
  const [showTextDistributor, setShowTextDistributor] = useState(false);
  const [activePanel, setActivePanel] = useState('none');
  const [bottomDrawerHeight, setBottomDrawerHeight] = useState(250);
  const [workspaceHeaderHeight, setWorkspaceHeaderHeight] = useState(DEFAULT_WORKSPACE_HEADER_HEIGHT);
  const appliedInitialSelectionRef = useRef(null);
  const bottomResizeRef = useRef(null);
  const workspaceRootRef = useRef(null);
  const workspaceHeaderRef = useRef(null);

  const pages = currentProject?.pages || [];

  const togglePanel = (panel) => {
    setActivePanel((current) => (current === panel ? 'none' : panel));
  };

  const closePanels = () => {
    setActivePanel('none');
  };

  const normalizedActivePanel = ['none', 'structure', 'summary', 'assistant'].includes(activePanel)
    ? activePanel
    : 'none';
  const showAssistantPanel = normalizedActivePanel === 'assistant';
  const showBottomDrawer = normalizedActivePanel === 'summary' && !showAssistantPanel;
  const showLeftDrawer = normalizedActivePanel === 'structure' && !showAssistantPanel && !showBottomDrawer;
  const getPanelButtonClass = (panel) => {
    const isActive = normalizedActivePanel === panel;
    return `px-3 py-2 rounded-lg border text-sm font-medium shadow-sm inline-flex items-center gap-2 transition-colors ${
      isActive
        ? 'bg-indigo-600 border-indigo-600 text-white'
        : 'bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-50'
    }`;
  };

  useEffect(() => {
    if (pages.length === 0) {
      setSelectedPageId(null);
      return;
    }

    const editorialStart = pages.find((p) => p.number === 2) || pages.find((p) => p.number >= 2) || pages[0];
    const selected = pages.find((p) => p.id === selectedPageId);

    if (
      initialSelectedPageId &&
      appliedInitialSelectionRef.current !== initialSelectedPageId &&
      pages.some((p) => p.id === initialSelectedPageId)
    ) {
      setSelectedPageId(initialSelectedPageId);
      appliedInitialSelectionRef.current = initialSelectedPageId;
      return;
    }

    if (!selectedPageId || !selected || selected.number < 2) {
      setSelectedPageId(editorialStart.id);
    }
  }, [pages, selectedPageId, initialSelectedPageId]);

  const spreadMeta = useMemo(() => {
    const spread = getSpreadPages(pages, selectedPageId);
    return { index: spread.spreadIndex, count: spread.spreadCount };
  }, [pages, selectedPageId]);

  const goToSpread = (direction) => {
    const targetId = getAdjacentSpreadPageId(pages, selectedPageId, direction);
    if (targetId) {
      setSelectedPageId(targetId);
    }
  };

  const handleAddDoublePage = async () => {
    const nextNumber = pages.length + 1;
    const first = createPageFromTemplate('double-page', nextNumber, currentProject.format);
    const second = createPageFromTemplate('double-page', nextNumber + 1, currentProject.format);

    await updateProject({ pages: [...pages, first, second] });
    setSelectedPageId(second.id);
  };

  const handleAutoLayout = async () => {
    const narrativePages = await optimizeNarrativeProjectLayout(currentProject, { mode: 'full' });
    await updateProject({ pages: narrativePages });
  };

  const handleAutoLayoutCurrentPage = async () => {
    if (!selectedPageId) {
      return;
    }

    const nextPages = [];
    for (const page of currentProject.pages || []) {
      if (page.id === selectedPageId) {
        // eslint-disable-next-line no-await-in-loop
        nextPages.push(await optimizeNarrativePageLayout(page, currentProject, { mode: 'full' }));
      } else {
        nextPages.push(page);
      }
    }

    await updateProject({ pages: nextPages });
  };

  const handleOptimizeReadability = async () => {
    const narrativePages = await optimizeNarrativeProjectLayout(currentProject, { mode: 'readability' });
    await updateProject({ pages: narrativePages });
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'ArrowRight') {
        goToSpread('next');
      } else if (event.key === 'ArrowLeft') {
        goToSpread('prev');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pages, selectedPageId]);

  useEffect(() => {
    const onMouseMove = (event) => {
      if (bottomResizeRef.current) {
        const maxHeight = Math.floor(window.innerHeight * 0.7);
        const minHeight = 160;
        const nextHeight = window.innerHeight - event.clientY;
        setBottomDrawerHeight(Math.max(minHeight, Math.min(maxHeight, nextHeight)));
      }
    };

    const onMouseUp = () => {
      bottomResizeRef.current = null;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  useEffect(() => {
    const syncWorkspaceHeaderHeight = () => {
      setWorkspaceHeaderHeight(workspaceHeaderRef.current?.offsetHeight || DEFAULT_WORKSPACE_HEADER_HEIGHT);
    };

    syncWorkspaceHeaderHeight();
    window.addEventListener('resize', syncWorkspaceHeaderHeight);
    return () => window.removeEventListener('resize', syncWorkspaceHeaderHeight);
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && activePanel === 'assistant') {
        setActivePanel('none');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activePanel]);

  if (!currentProject) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <AlertCircle size={64} className="mx-auto mb-4 text-gray-400" />
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">
            Aucun projet ouvert
          </h2>
          <p className="text-gray-500">
            Sélectionnez ou créez un projet pour commencer l'écriture
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={workspaceRootRef} className="relative w-full h-full min-h-0 overflow-hidden bg-gradient-to-b from-zinc-100 to-zinc-200 flex flex-col">
      <div ref={workspaceHeaderRef} className="sticky top-0 z-50 shrink-0 px-4 pt-3 pb-2 bg-zinc-100/90 backdrop-blur-sm border-b border-zinc-200">
        <div className="inline-flex items-center gap-2 p-1 rounded-xl bg-white/70 border border-zinc-200 shadow-sm">
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.stopPropagation();
              togglePanel('structure');
            }}
            className={getPanelButtonClass('structure')}
          >
            Structure
          </button>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.stopPropagation();
              togglePanel('summary');
            }}
            className={getPanelButtonClass('summary')}
          >
            Résumé
          </button>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.stopPropagation();
              togglePanel('assistant');
            }}
            className={getPanelButtonClass('assistant')}
          >
            <Sparkles size={14} /> Assistant
          </button>
        </div>
      </div>

      <div className="workspaceContent relative flex-1 min-h-0 overflow-hidden">
        <BookSpreadEditor
          selectedPageId={selectedPageId}
          onSelectPage={setSelectedPageId}
          className="h-full"
          viewportInsets={{
            left: 24,
            right: 24,
            top: 24,
            bottom: 28
          }}
          onPrev={() => goToSpread('prev')}
          onNext={() => goToSpread('next')}
          spreadMeta={spreadMeta}
        />
      </div>

      <aside
        className={`absolute left-0 top-0 h-full z-40 bg-white border-r border-zinc-200 shadow-2xl transform transition-transform duration-300 ${
          showLeftDrawer ? 'pointer-events-auto' : 'pointer-events-none'
        } ${
          showLeftDrawer ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ width: 320 }}
      >
        <div className="h-full flex flex-col">
          <div className="px-3 py-2 border-b border-zinc-200 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-zinc-600">Structure</span>
            <button
              onMouseDown={(event) => event.preventDefault()}
              onClick={closePanels}
              className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-zinc-300 hover:bg-zinc-100"
              title="Fermer le panneau Structure"
            >
              <X size={14} />
            </button>
          </div>

          <PageList
            selectedPageId={selectedPageId}
            onSelectPage={(id) => {
              setSelectedPageId(id);
            }}
            className="w-full h-full border-r-0"
          />
        </div>
      </aside>

      {showBottomDrawer && (
        <aside
          className="absolute left-0 right-0 bottom-0 z-50 bg-white border-t border-zinc-200 shadow-2xl"
          style={{ height: bottomDrawerHeight }}
        >
        <div
          onMouseDown={() => {
            bottomResizeRef.current = { active: true };
          }}
          className="h-4 flex items-center justify-center cursor-ns-resize border-b border-zinc-200"
        >
          <div className="w-14 h-1.5 rounded-full bg-zinc-300" />
        </div>
        <div className="h-10 border-b border-zinc-200 px-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-600">Résumé</span>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={closePanels}
            className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-zinc-300 hover:bg-zinc-100"
            title="Fermer le panneau Résumé"
          >
            <X size={14} />
          </button>
        </div>
        <div className="h-[calc(100%-56px)] overflow-y-auto p-4 flex gap-3">
          <div className="flex-1 min-w-0 overflow-y-auto">
            <BookSummaryPanel />
          </div>
          <div className="w-64 shrink-0 flex flex-col gap-2">
            <button
              onClick={handleAddDoublePage}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-indigo-300 text-indigo-700 rounded-lg hover:bg-indigo-50"
            >
              <LayoutTemplate size={16} /> Ajouter double-page
            </button>
            <button
              onClick={handleAutoLayoutCurrentPage}
              className="w-full px-3 py-2 border border-emerald-300 text-emerald-800 rounded-lg hover:bg-emerald-50"
            >
              Réappliquer page active
            </button>
            <button
              onClick={handleAutoLayout}
              className="w-full px-3 py-2 border border-amber-300 text-amber-800 rounded-lg hover:bg-amber-50"
            >
              Réappliquer tout le livre
            </button>
            <button
              onClick={handleOptimizeReadability}
              className="w-full px-3 py-2 border border-sky-300 text-sky-800 rounded-lg hover:bg-sky-50"
            >
              Optimiser la lisibilité
            </button>
            <button
              onClick={() => setShowTextDistributor(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <Scissors size={16} /> Distribuer du texte
            </button>
          </div>
        </div>
        </aside>
      )}

      {showAssistantPanel && (
        <div
          className="absolute inset-x-0 bottom-0 z-[70] bg-zinc-900/30 backdrop-blur-[1px]"
          style={{
            top: workspaceHeaderHeight + ASSISTANT_MODAL_SAFE_MARGIN
          }}
          onClick={closePanels}
        >
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={closePanels}
            className="absolute top-0 right-3 z-[80] w-8 h-8 rounded-md bg-zinc-900/90 text-white border border-white/20 hover:bg-zinc-800 inline-flex items-center justify-center"
            title="Fermer l'assistant"
          >
            <X size={14} />
          </button>

          <aside
            className="absolute left-1/2 -translate-x-1/2 top-0 w-[min(960px,calc(100%-24px))] h-full bg-white border border-zinc-300 rounded-xl shadow-2xl overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="h-full max-h-[inherit] flex flex-col overflow-hidden">
              <div className="sticky top-0 z-20 h-10 bg-zinc-900 text-white px-3 flex items-center justify-between">
                <span className="text-xs font-semibold inline-flex items-center gap-2"><Sparkles size={14} /> Assistant IA</span>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={closePanels}
                  className="w-6 h-6 rounded hover:bg-white/20 inline-flex items-center justify-center"
                  title="Fermer"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-hidden">
                <AIChat selectedPageId={selectedPageId} className="w-full h-full border-l-0" />
              </div>
            </div>
          </aside>
        </div>
      )}

      {showTextDistributor && (
        <TextDistributor onClose={() => setShowTextDistributor(false)} />
      )}
    </div>
  );
};

export default WritingView;
