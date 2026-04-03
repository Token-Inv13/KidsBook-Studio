import React from 'react';
import { useApp } from '../context/AppContext';
import { Settings, AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import { resolvePageImageUrl } from '../utils/imageUrlResolver';

const TopBar = ({ onOpenSettings }) => {
  const { currentProject } = useApp();

  const kdpStatusClasses = {
    green: {
      container: 'bg-emerald-50 border border-emerald-200',
      icon: 'text-emerald-600',
      text: 'text-emerald-700'
    },
    yellow: {
      container: 'bg-amber-50 border border-amber-200',
      icon: 'text-amber-600',
      text: 'text-amber-700'
    },
    red: {
      container: 'bg-rose-50 border border-rose-200',
      icon: 'text-rose-600',
      text: 'text-rose-700'
    }
  };

  const getKDPStatus = () => {
    if (!currentProject) return null;

    const issues = [];
    
    if (!currentProject.pages || currentProject.pages.length === 0) {
      issues.push('Aucune page créée');
    }

    const pagesWithoutImages = currentProject.pages?.filter(p => !resolvePageImageUrl(p)).length || 0;
    if (pagesWithoutImages > 0) {
      issues.push(`${pagesWithoutImages} page(s) sans illustration`);
    }

    if (issues.length === 0) {
      return { status: 'ok', color: 'green', icon: CheckCircle, text: 'Prêt' };
    } else if (issues.length <= 2) {
      return { status: 'warning', color: 'yellow', icon: AlertTriangle, text: 'Avertissements', issues };
    } else {
      return { status: 'error', color: 'red', icon: AlertCircle, text: 'Erreurs', issues };
    }
  };

  const kdpStatus = getKDPStatus();

  return (
    <div className="h-16 bg-white/95 border-b border-zinc-200 flex items-center justify-between px-6 shadow-sm backdrop-blur-sm">
      <div className="flex items-center gap-6">
        {currentProject ? (
          <>
            <div>
              <h2 data-testid="current-project-title" className="text-lg font-semibold text-gray-800">{currentProject.title}</h2>
              <p className="text-sm text-gray-500">Par {currentProject.author}</p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full font-medium border border-indigo-100">
                {currentProject.bookFormat?.label || currentProject.format?.preset || 'Format non défini'}
              </div>
              <div className="text-gray-600">
                {currentProject.pages?.length || 0} pages
              </div>
              <div className="text-gray-600">
                Âge: {currentProject.targetAge || 'Non défini'}
              </div>
            </div>
          </>
        ) : (
          <div className="text-gray-500">Aucun projet ouvert</div>
        )}
      </div>

      <div className="flex items-center gap-4">
        {kdpStatus && (
          <div data-testid="kdp-status" className={`flex items-center gap-2 px-4 py-2 rounded-lg ${kdpStatusClasses[kdpStatus.color].container}`}>
            <kdpStatus.icon size={18} className={kdpStatusClasses[kdpStatus.color].icon} />
            <span className={`text-sm font-medium ${kdpStatusClasses[kdpStatus.color].text}`}>
              KDP: {kdpStatus.text}
            </span>
          </div>
        )}
        
        <button
          onClick={onOpenSettings}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="Paramètres"
        >
          <Settings size={20} className="text-gray-600" />
        </button>
      </div>
    </div>
  );
};

export default TopBar;
