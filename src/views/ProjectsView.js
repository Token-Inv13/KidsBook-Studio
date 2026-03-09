import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, FolderOpen, Copy, Trash2, Edit2, Calendar, Sparkles } from 'lucide-react';
import ProjectWizard from '../components/ProjectWizard';
import StoryEngineModal from '../components/StoryEngineModal';

const ProjectsView = () => {
  const { projects, loadProject, deleteProject, duplicateProject, currentProject } = useApp();
  const [showWizard, setShowWizard] = useState(false);
  const [showStoryEngine, setShowStoryEngine] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredProjects = projects.filter(p => 
    p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.author.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenProject = async (projectId) => {
    await loadProject(projectId);
  };

  const handleDeleteProject = async (projectId, e) => {
    e.stopPropagation();
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce projet ?')) {
      await deleteProject(projectId);
    }
  };

  const handleDuplicateProject = async (projectId, e) => {
    e.stopPropagation();
    await duplicateProject(projectId);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-zinc-50 to-zinc-100">
      <div className="bg-white/90 border-b border-zinc-200 px-6 py-5 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-800">Mes Projets</h1>
          <div className="flex gap-3">
            {currentProject && (
              <button
                onClick={() => setShowStoryEngine(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl hover:from-indigo-700 hover:to-violet-700 transition-all shadow-md"
              >
                <Sparkles size={20} />
                Créer un livre complet
              </button>
            )}
            <button
              onClick={() => setShowWizard(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-md"
            >
              <Plus size={20} />
              Nouveau Projet
            </button>
          </div>
        </div>
        
        <input
          type="text"
          placeholder="Rechercher un projet..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2.5 border border-zinc-300 rounded-xl bg-white/90 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <FolderOpen size={64} className="mb-4 opacity-50" />
            <p className="text-xl mb-2">
              {projects.length === 0 ? 'Aucun projet créé' : 'Aucun projet trouvé'}
            </p>
            <p className="text-sm">
              {projects.length === 0 ? 'Créez votre premier livre pour enfants' : 'Essayez une autre recherche'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map(project => (
              <div
                key={project.id}
                onClick={() => handleOpenProject(project.id)}
                className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer overflow-hidden border border-zinc-200 hover:border-indigo-300 hover:-translate-y-0.5"
              >
                <div className="h-40 bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 flex items-center justify-center">
                  <div className="text-white text-center">
                    <h3 className="text-2xl font-bold mb-2">{project.title}</h3>
                    <p className="text-white/85">Par {project.author}</p>
                  </div>
                </div>
                
                <div className="p-4">
                  <div className="flex items-center gap-2 text-sm text-zinc-600 mb-3">
                    <Calendar size={14} />
                    <span>Modifié le {formatDate(project.updatedAt)}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-md text-xs font-medium border border-indigo-100">
                      {project.targetAge}
                    </span>
                    <span className="px-2 py-1 bg-violet-50 text-violet-700 rounded-md text-xs font-medium border border-violet-100">
                      {project.bookType}
                    </span>
                    <span className="px-2 py-1 bg-sky-50 text-sky-700 rounded-md text-xs font-medium border border-sky-100">
                      {project.pages?.length || 0} pages
                    </span>
                  </div>

                  <div className="flex gap-2 pt-3 border-t border-zinc-200">
                    <button
                      onClick={(e) => handleDuplicateProject(project.id, e)}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors"
                      title="Dupliquer"
                    >
                      <Copy size={14} />
                      Dupliquer
                    </button>
                    <button
                      onClick={(e) => handleDeleteProject(project.id, e)}
                      className="flex items-center justify-center gap-1 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showWizard && <ProjectWizard onClose={() => setShowWizard(false)} />}
      {showStoryEngine && <StoryEngineModal onClose={() => setShowStoryEngine(false)} />}
    </div>
  );
};

export default ProjectsView;
