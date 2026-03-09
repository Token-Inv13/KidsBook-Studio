import React from 'react';
import { useApp } from '../context/AppContext';
import IllustrationLock from '../components/IllustrationLock';
import IllustrationsManager from '../components/IllustrationsManager';

const IllustrationsView = ({ onNavigateToCharacters, onOpenPage }) => {
  const { currentProject } = useApp();

  if (!currentProject) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-gray-500 text-lg">Aucun projet ouvert</p>
          <p className="text-gray-400 text-sm mt-2">Créez ou ouvrez un projet pour commencer</p>
        </div>
      </div>
    );
  }

  return (
    <IllustrationLock onNavigateToCharacters={onNavigateToCharacters}>
      <IllustrationsManager onOpenPage={onOpenPage} onNavigateToCharacters={onNavigateToCharacters} />
    </IllustrationLock>
  );
};

export default IllustrationsView;
