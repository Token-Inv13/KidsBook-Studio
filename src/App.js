import React, { useState, useEffect } from 'react';
import { AppProvider } from './context/AppContext';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import ProjectsView from './views/ProjectsView';
import WritingView from './views/WritingView';
import CharactersView from './views/CharactersView';
import IllustrationsView from './views/IllustrationsView';
import ExportView from './views/ExportView';
import SettingsModal from './components/SettingsModal';
import { electronBridge } from './utils/electronBridge';

function App() {
  const [currentView, setCurrentView] = useState('projects');
  const [showSettings, setShowSettings] = useState(false);
  const [writingFocusPageId, setWritingFocusPageId] = useState(null);
  const [sidebarCompact, setSidebarCompact] = useState(false);

  useEffect(() => {
    const checkApiKey = async () => {
      try {
        const result = await electronBridge.apiKey.get();
        if (!result || !result.success || !result.apiKey) {
          console.info('[App] No OpenAI API key found; settings remain accessible from the toolbar.');
        }
      } catch (error) {
        console.error('Error checking API key:', error);
      }
    };
    checkApiKey();
  }, []);

  const renderView = () => {
    switch (currentView) {
      case 'projects':
        return <ProjectsView />;
      case 'writing':
        return <WritingView initialSelectedPageId={writingFocusPageId} />;
      case 'characters':
        return <CharactersView />;
      case 'illustrations':
        return (
          <IllustrationsView
            onNavigateToCharacters={() => setCurrentView('characters')}
            onOpenPage={(pageId) => {
              setWritingFocusPageId(pageId);
              setCurrentView('writing');
            }}
          />
        );
      case 'export':
        return <ExportView />;
      default:
        return <ProjectsView />;
    }
  };

  return (
    <AppProvider>
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        <Sidebar
          currentView={currentView}
          onViewChange={setCurrentView}
          compact={sidebarCompact}
          onToggleCompact={() => setSidebarCompact((value) => !value)}
        />
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="shrink-0">
            <TopBar onOpenSettings={() => setShowSettings(true)} />
          </div>
          <main className="relative flex-1 min-h-0 overflow-hidden">
            <div className="absolute inset-0 overflow-hidden">
              {renderView()}
            </div>
          </main>
        </div>
        {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      </div>
    </AppProvider>
  );
}

export default App;
