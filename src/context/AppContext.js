import React, { createContext, useContext, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { electronBridge } from '../utils/electronBridge';
import { migrateProject, prepareProjectForSave, validateProjectSchema } from '../utils/projectSchema';

const AppContext = createContext();

const normalizeProjectShape = (project) => {
  if (!project || typeof project !== 'object') {
    return project;
  }

  return migrateProject({
    ...project,
    visualIdentitySpec: Object.prototype.hasOwnProperty.call(project, 'visualIdentitySpec')
      ? project.visualIdentitySpec
      : null
  });
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};

export const AppProvider = ({ children }) => {
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [openaiPort, setOpenaiPort] = useState(null);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [autosaveRevision, setAutosaveRevision] = useState(0);
  
  // Queue system to prevent race conditions during rapid updates
  const updateQueueRef = React.useRef(Promise.resolve());
  const latestProjectsRef = React.useRef([]);

  useEffect(() => {
    loadProjects();
    initializeOpenAI();
  }, []);

  useEffect(() => {
    latestProjectsRef.current = projects;
  }, [projects]);

  useEffect(() => {
    if (!autoSaveEnabled || !currentProject || autosaveRevision === 0) {
      return undefined;
    }

    const timer = setTimeout(async () => {
      try {
        const savedProject = await persistProjectFile(currentProject);
        const updatedProjects = latestProjectsRef.current.map((project) =>
          project.id === savedProject.id ? savedProject : normalizeProjectShape(project)
        );
        const savedProjects = await writeProjectsToStore(updatedProjects);

        setProjects(savedProjects);
      } catch (error) {
        console.error('[AppContext] Autosave failed:', error);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [autosaveRevision, currentProject, autoSaveEnabled]);

  const writeProjectsToStore = async (projectsList) => {
    const normalizedProjects = projectsList.map(normalizeProjectShape);
    await electronBridge.store.set('projects', normalizedProjects);
    return normalizedProjects;
  };

  const persistProjectFile = async (project, options = {}) => {
    const { touchUpdatedAt = true } = options;

    if (!project || !project.path) {
      return normalizeProjectShape(project);
    }

    const projectData = prepareProjectForSave(
      touchUpdatedAt
        ? {
            ...project,
            updatedAt: new Date().toISOString()
          }
        : project
    );

    const projectFile = `${project.path}/project.json`;
    await electronBridge.fs.writeFile(projectFile, JSON.stringify(projectData, null, 2));

    return projectData;
  };

  const saveProject = async (project, options = {}) => {
    const savedProject = await persistProjectFile(project, options);

    if (!savedProject?.id) {
      return savedProject;
    }

    const sourceProjects = latestProjectsRef.current;
    const nextProjects = sourceProjects.some((entry) => entry.id === savedProject.id)
      ? sourceProjects.map((entry) => (entry.id === savedProject.id ? savedProject : normalizeProjectShape(entry)))
      : [...sourceProjects, savedProject];
    const savedProjects = await writeProjectsToStore(nextProjects);

    setProjects(savedProjects);
    setCurrentProject((prevProject) =>
      prevProject?.id === savedProject.id ? savedProject : prevProject
    );

    return savedProject;
  };

  const saveProjects = async (projectsList) => {
    const normalizedProjects = await writeProjectsToStore(projectsList);
    setProjects(normalizedProjects);
    return normalizedProjects;
  };

  const initializeOpenAI = async () => {
    const port = await electronBridge.openai.getPort();
    setOpenaiPort(port);
  };

  const loadProjects = async () => {
    try {
      console.log('[AppContext] Loading projects from store...');
      const savedProjects = await electronBridge.store.get('projects');
      console.log('[AppContext] Loaded from store:', savedProjects);
      if (savedProjects && Array.isArray(savedProjects)) {
        const normalizedProjects = savedProjects.map(normalizeProjectShape);
        if (JSON.stringify(savedProjects) !== JSON.stringify(normalizedProjects)) {
          await electronBridge.store.set('projects', normalizedProjects);
        }
        console.log('[AppContext] Setting projects state with', savedProjects.length, 'projects');
        setProjects(normalizedProjects);
      } else {
        console.log('[AppContext] No valid projects found, setting empty array');
        setProjects([]);
      }
    } catch (error) {
      console.error('[AppContext] Error loading projects:', error);
      setProjects([]);
    }
  };

  const createProject = async (projectData) => {
    try {
      console.log('[AppContext] Creating new project...');
      const newProject = {
        id: uuidv4(),
        ...projectData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        pages: [],
        characters: [],
        locations: [],
        artStyle: 'watercolor',
        visualIdentitySpec: null,
        chatHistory: [],
        images: [],
        versions: []
      };

      console.log('[AppContext] New project ID:', newProject.id);

      const projectPath = `${projectData.savePath}/${newProject.id}`;
      
      try {
        await electronBridge.fs.mkdir(projectPath);
        await electronBridge.fs.mkdir(`${projectPath}/images`);
        await electronBridge.fs.mkdir(`${projectPath}/exports`);
        await electronBridge.fs.mkdir(`${projectPath}/versions`);
      } catch (fsError) {
        // Filesystem operations may fail in browser mode
      }

      newProject.path = projectPath;
      const normalizedProject = prepareProjectForSave(newProject);
      const savedProject = await persistProjectFile(normalizedProject);

      console.log('[AppContext] Current projects count:', projects.length);
      const updatedProjects = [...projects, savedProject];
      console.log('[AppContext] Updated projects count:', updatedProjects.length);
      
      await saveProjects(updatedProjects);

      console.log('[AppContext] Project created successfully');
      return savedProject;
    } catch (error) {
      console.error('[AppContext] Error creating project:', error);
      throw error;
    }
  };

  const loadProject = async (projectId) => {
    const project = projects.find(p => p.id === projectId);
    
    if (!project) {
      return null;
    }

    if (project.path) {
      const projectFile = `${project.path}/project.json`;
      
      try {
        const exists = await electronBridge.fs.exists(projectFile);
        
        if (exists) {
          const result = await electronBridge.fs.readFile(projectFile);
          if (result.success) {
            const rawProject = JSON.parse(result.data);
            const loadedProject = normalizeProjectShape(rawProject);
            const validation = validateProjectSchema(loadedProject);
            if (!validation.ok) {
              throw new Error(`Projet invalide: ${validation.errors.join(' | ')}`);
            }
            const rawSerialized = JSON.stringify(rawProject);
            const normalizedSerialized = JSON.stringify(loadedProject);
            if (rawSerialized !== normalizedSerialized) {
              await electronBridge.fs.writeFile(projectFile, JSON.stringify(loadedProject, null, 2));
            }
            setCurrentProject(loadedProject);
            return loadedProject;
          }
        }
      } catch (error) {
        // Could not load project file, using in-memory project
      }
    }
    
    const normalizedProject = normalizeProjectShape(project);
    setCurrentProject(normalizedProject);
    return normalizedProject;
  };

  const updateProject = async (updatesOrUpdater) => {
    // Add to queue to ensure sequential processing
    updateQueueRef.current = updateQueueRef.current.then(async () => {
      return new Promise((resolve) => {
        setCurrentProject(prevProject => {
          if (!prevProject) {
            resolve();
            return prevProject;
          }
          const normalizedPrevProject = normalizeProjectShape(prevProject);

          const resolvedUpdates = typeof updatesOrUpdater === 'function'
            ? updatesOrUpdater(normalizedPrevProject)
            : updatesOrUpdater;

          if (!resolvedUpdates || typeof resolvedUpdates !== 'object') {
            resolve();
            return prevProject;
          }

          console.log('[AppContext] updateProject called with updates:', Object.keys(resolvedUpdates));
          console.log('[AppContext] Current project has visualIdentity:', !!normalizedPrevProject.visualIdentity);

          const updatedProject = normalizeProjectShape({
            ...normalizedPrevProject,
            ...resolvedUpdates,
            updatedAt: new Date().toISOString()
          });

          console.log('[AppContext] Updated project has visualIdentity:', !!updatedProject.visualIdentity);

          setProjects((prevProjects) => prevProjects.map((project) =>
            project.id === updatedProject.id ? updatedProject : normalizeProjectShape(project)
          ));
          setAutosaveRevision((revision) => revision + 1);
          resolve(updatedProject);
          
          return updatedProject;
        });
      });
    });
    
    return updateQueueRef.current;
  };

  const deleteProject = async (projectId) => {
    const updatedProjects = projects.filter(p => p.id !== projectId);
    await saveProjects(updatedProjects);
    
    if (currentProject?.id === projectId) {
      setCurrentProject(null);
    }
  };

  const duplicateProject = async (projectId) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const newProject = {
      ...project,
      id: uuidv4(),
      title: `${project.title} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const projectPath = `${project.savePath}/${newProject.id}`;
    await electronBridge.fs.mkdir(projectPath);
    await electronBridge.fs.mkdir(`${projectPath}/images`);
    await electronBridge.fs.mkdir(`${projectPath}/exports`);
    await electronBridge.fs.mkdir(`${projectPath}/versions`);

    newProject.path = projectPath;
    const normalizedProject = prepareProjectForSave(newProject);
    const savedProject = await persistProjectFile(normalizedProject);

    const updatedProjects = [...projects, savedProject];
    await saveProjects(updatedProjects);

    return savedProject;
  };

  const callOpenAI = async (messages, options = {}) => {
    if (!openaiPort) {
      throw new Error('OpenAI service not initialized');
    }

    try {
      console.log('[AppContext] Calling OpenAI service on port:', openaiPort);
      
      const response = await fetch(`http://localhost:${openaiPort}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          temperature: options.temperature || 0.7,
          max_tokens: options.max_tokens || 2000
        })
      });

      if (!response.ok) {
        console.error('[AppContext] OpenAI service returned error:', response.status, response.statusText);
        throw new Error(`OpenAI service error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[AppContext] OpenAI response received:', data.success);
      
      if (!data.success) {
        throw new Error(data.error || 'OpenAI request failed');
      }

      if (currentProject && data.usage) {
        const currentUsage = currentProject.openaiUsage || { tokens: 0, cost: 0 };
        const newUsage = {
          tokens: currentUsage.tokens + data.usage.total_tokens,
          cost: currentUsage.cost + (data.usage.total_tokens * 0.00003)
        };
        await updateProject({ openaiUsage: newUsage });
      }

      return data.content;
    } catch (error) {
      console.error('[AppContext] OpenAI call failed:', error);
      if (error.message.includes('fetch')) {
        throw new Error('Impossible de contacter le service OpenAI. Vérifiez que votre clé API est configurée dans les paramètres.');
      }
      throw error;
    }
  };

  const generateImage = async (prompt, options = {}) => {
    if (!openaiPort) {
      throw new Error('OpenAI service not initialized');
    }

    const response = await fetch(`http://localhost:${openaiPort}/api/generate-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        size: options.size || '1024x1024',
        n: options.n || 1,
        quality: options.quality || 'standard',
        referenceImageId: options.referenceImageId || null,
        referenceImagePath: options.referenceImagePath || null
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Image generation failed');
    }

    return {
      url: data.url,
      revised_prompt: data.revised_prompt,
      requestId: data.requestId
    };
  };

  const openaiServiceUrl = openaiPort ? `http://localhost:${openaiPort}` : null;

  const value = {
    projects,
    currentProject,
    setCurrentProject,
    createProject,
    loadProject,
    saveProject,
    updateProject,
    deleteProject,
    duplicateProject,
    callOpenAI,
    generateImage,
    openaiServiceUrl,
    openaiPort,
    autoSaveEnabled,
    setAutoSaveEnabled
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
