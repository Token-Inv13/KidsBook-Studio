import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AppProvider, useApp } from './AppContext';

jest.mock('../utils/electronBridge', () => {
  const store = {
    get: jest.fn(),
    set: jest.fn()
  };

  const fs = {
    writeFile: jest.fn(),
    readFile: jest.fn(),
    exists: jest.fn(),
    mkdir: jest.fn()
  };

  return {
    electronBridge: {
      store,
      fs,
      openai: {
        getPort: jest.fn()
      },
      ideogram: {
        getPort: jest.fn()
      },
      app: {
        getProjectsPath: jest.fn(),
        getUserDataPath: jest.fn()
      },
      dialog: {
        selectFolder: jest.fn()
      }
    }
  };
});

const { electronBridge } = require('../utils/electronBridge');

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const baseProject = {
  id: 'project-1',
  title: 'Livre test',
  author: 'Auteur test',
  targetAge: '3-5',
  bookType: 'histoire du soir',
  path: 'C:/tmp/project-1',
  savePath: 'C:/tmp',
  createdAt: '2026-03-26T20:00:00.000Z',
  updatedAt: '2026-03-26T20:00:00.000Z',
  format: {
    id: '8.5x8.5',
    label: '8.5x8.5',
    preset: '8.5x8.5',
    width: 8.5,
    height: 8.5,
    unit: 'inches',
    bleed: 0.125
  },
  pages: [
    {
      id: 'page-1',
      number: 1,
      template: 'mixte',
      textBlocks: [
        {
          id: 'text-1',
          content: 'Bonjour',
          x: 120,
          y: 120,
          width: 200,
          height: 80
        }
      ],
      imageZones: []
    }
  ],
  characters: [],
  locations: [],
  images: [],
  versions: [],
  metadata: {
    title: 'Livre test',
    author: 'Auteur test',
    targetAge: '3-5',
    bookType: 'histoire du soir',
    summary: '',
    description: '',
    language: 'fr',
    tags: []
  },
  bookFormat: {
    id: '8.5x8.5',
    label: '8.5x8.5',
    preset: '8.5x8.5',
    width: 8.5,
    height: 8.5,
    unit: 'inches',
    bleed: 0.125,
    orientation: 'square'
  },
  schemaVersion: 1,
  visualIdentitySpec: null,
  generationMeta: {},
  coverData: null
};

function TestHarness() {
  const { projects, currentProject, loadProject, updateProject } = useApp();

  return (
    <div>
      <div data-testid="project-count">{projects.length}</div>
      <div data-testid="current-title">{currentProject?.title || ''}</div>
      <button type="button" onClick={() => loadProject(baseProject.id)}>
        Charger
      </button>
      <button type="button" onClick={() => updateProject({ summary: 'Resume modifie' })}>
        Modifier
      </button>
    </div>
  );
}

describe('AppProvider autosave', () => {
  beforeEach(() => {
    jest.useFakeTimers();

    electronBridge.store.get.mockResolvedValue([baseProject]);
    electronBridge.store.set.mockResolvedValue(true);
    electronBridge.openai.getPort.mockResolvedValue(3001);
    electronBridge.ideogram.getPort.mockResolvedValue(3002);
    electronBridge.fs.exists.mockResolvedValue(true);
    electronBridge.fs.readFile.mockResolvedValue({
      success: true,
      data: JSON.stringify(baseProject)
    });
    electronBridge.fs.writeFile.mockResolvedValue({ success: true });
    electronBridge.fs.mkdir.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  test('does not autosave an unchanged project after load, but persists after update', async () => {
    render(
      <AppProvider>
        <TestHarness />
      </AppProvider>
    );

    await waitFor(() => expect(screen.getByTestId('project-count').textContent).toBe('1'));

    await act(async () => {
      fireEvent.click(screen.getByText('Charger'));
    });

    await waitFor(() => expect(screen.getByTestId('current-title').textContent).toBe('Livre test'));

    electronBridge.fs.writeFile.mockClear();
    electronBridge.store.set.mockClear();

    await act(async () => {
      jest.advanceTimersByTime(2500);
      await flushPromises();
    });

    expect(electronBridge.fs.writeFile).not.toHaveBeenCalled();
    expect(electronBridge.store.set).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByText('Modifier'));
    });

    await act(async () => {
      jest.advanceTimersByTime(2000);
      await flushPromises();
    });

    await waitFor(() => expect(electronBridge.fs.writeFile).toHaveBeenCalledTimes(1));
    expect(electronBridge.store.set).toHaveBeenCalledTimes(1);
  });
});
