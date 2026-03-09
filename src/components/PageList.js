import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, GripVertical, Trash2 } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import PageTemplateSelector from './PageTemplateSelector';
import { resolvePageImageUrl } from '../utils/imageUrlResolver';
import { createPageFromTemplate } from '../utils/writingLayout';

const PageList = ({ selectedPageId, onSelectPage, className = '' }) => {
  const { currentProject, updateProject } = useApp();
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);

  const pages = currentProject?.pages || [];

  const handleAddPage = async (template) => {
    const newPage = createPageFromTemplate(
      template,
      pages.length + 1,
      currentProject.format
    );

    await updateProject({
      pages: [...pages, newPage]
    });

    onSelectPage(newPage.id);
    setShowTemplateSelector(false);
  };

  const handleDeletePage = async (pageId, e) => {
    e.stopPropagation();
    if (window.confirm('Supprimer cette page ?')) {
      const updatedPages = pages.filter(p => p.id !== pageId).map((p, idx) => ({
        ...p,
        number: idx + 1,
        position: idx % 2 === 0 ? 'left' : 'right'
      }));

      await updateProject({ pages: updatedPages });

      if (selectedPageId === pageId) {
        onSelectPage(updatedPages[0]?.id || null);
      }
    }
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    const items = Array.from(pages);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const updatedPages = items.map((p, idx) => ({
      ...p,
      number: idx + 1,
      position: idx % 2 === 0 ? 'left' : 'right'
    }));

    await updateProject({ pages: updatedPages });
  };

  return (
    <div className={`w-64 bg-white border-r border-gray-200 flex flex-col ${className}`.trim()}>
      <div className="p-4 border-b border-gray-200">
        <button
          onClick={() => setShowTemplateSelector(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus size={18} />
          Nouvelle Page
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="pages">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef}>
                {pages.map((page, index) => {
                  const previewImageUrl = resolvePageImageUrl(page);

                  return (
                  <Draggable key={page.id} draggableId={page.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        onClick={() => onSelectPage(page.id)}
                        className={`
                          mb-2 p-3 rounded-lg border-2 cursor-pointer transition-all
                          ${selectedPageId === page.id
                            ? 'border-indigo-600 bg-indigo-50'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                          }
                          ${snapshot.isDragging ? 'shadow-lg' : ''}
                        `}
                      >
                        <div className="flex items-center gap-2">
                          <div {...provided.dragHandleProps}>
                            <GripVertical size={16} className="text-gray-400" />
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-800">
                                Page {page.number}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                page.position === 'left' 
                                  ? 'bg-blue-100 text-blue-700' 
                                  : 'bg-purple-100 text-purple-700'
                              }`}>
                                {page.position === 'left' ? 'G' : 'D'}
                              </span>
                            </div>
                            
                            {previewImageUrl && (
                              <div className="mt-2 h-16 bg-gray-100 rounded overflow-hidden">
                                <img 
                                  src={previewImageUrl}
                                  alt={`Page ${page.number}`}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            
                            {page.textBlocks && page.textBlocks.length > 0 && (
                              <p className="text-xs text-gray-500 mt-1 truncate">
                                {page.textBlocks[0].content.substring(0, 30)}...
                              </p>
                            )}
                          </div>

                          <button
                            onClick={(e) => handleDeletePage(page.id, e)}
                            className="p-1 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 size={14} className="text-red-500" />
                          </button>
                        </div>
                      </div>
                    )}
                  </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {pages.length === 0 && (
          <div className="text-center text-gray-400 mt-8">
            <p className="text-sm">Aucune page</p>
            <p className="text-xs mt-1">Cliquez sur "Nouvelle Page"</p>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-200 text-xs text-gray-500">
        {pages.length} page{pages.length > 1 ? 's' : ''}
      </div>

      {showTemplateSelector && (
        <PageTemplateSelector 
          onSelect={handleAddPage}
          onClose={() => setShowTemplateSelector(false)}
        />
      )}
    </div>
  );
};

export default PageList;
