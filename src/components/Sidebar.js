import React from 'react';
import { 
  PanelLeftClose,
  PanelLeftOpen,
  FolderOpen, 
  BookOpen, 
  Users, 
  Image, 
  FileCheck 
} from 'lucide-react';

const Sidebar = ({ currentView, onViewChange, compact = false, onToggleCompact }) => {
  const menuItems = [
    { id: 'projects', label: 'Projets', icon: FolderOpen },
    { id: 'writing', label: 'Écriture', icon: BookOpen },
    { id: 'characters', label: 'Personnages', icon: Users },
    { id: 'illustrations', label: 'Illustrations', icon: Image },
    { id: 'export', label: 'Export KDP', icon: FileCheck }
  ];

  return (
    <div className={`${compact ? 'w-[60px]' : 'w-64'} bg-gradient-to-b from-indigo-950 via-indigo-900 to-indigo-800 text-white flex flex-col shadow-2xl transition-all duration-300`}>
      <div className={`${compact ? 'p-2' : 'p-4'} border-b border-indigo-700/70 flex items-center ${compact ? 'justify-center' : 'justify-between'} gap-2`}>
        {!compact && (
          <div>
            <h1 className="text-lg font-bold">KidsBook Studio</h1>
            <p className="text-indigo-200 text-xs mt-1">Création de livres jeunesse</p>
          </div>
        )}

        <button
          onClick={onToggleCompact}
          className="w-8 h-8 rounded-md border border-indigo-400/40 bg-indigo-900/45 hover:bg-indigo-700/70 inline-flex items-center justify-center transition-colors"
          title={compact ? 'Déployer la sidebar' : 'Réduire la sidebar'}
        >
          {compact ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>
      
      <nav className={`${compact ? 'p-2' : 'p-4'} flex-1`}>
        {menuItems.map(item => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              title={compact ? item.label : undefined}
              className={`
                w-full relative flex items-center ${compact ? 'justify-center' : 'gap-3'} ${compact ? 'px-2' : 'px-4'} py-3 rounded-xl mb-2
                transition-all duration-200
                ${isActive 
                  ? 'bg-white text-indigo-900 shadow-lg' 
                  : 'text-indigo-100 hover:bg-indigo-700/45 hover:text-white'
                }
              `}
            >
              {isActive && !compact && (
                <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-full bg-indigo-500" />
              )}
              <Icon size={20} />
              {!compact && <span className="font-medium">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className={`${compact ? 'p-2' : 'p-4'} border-t border-indigo-700/70`}> 
        {!compact && (
          <div className="text-xs text-indigo-300">
            <p>Version 0.1.0</p>
            <p className="mt-1">© 2026 KidsBook Studio</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
