/**
 * Electron Bridge - Provides safe access to Electron APIs
 * Falls back to mock implementations when running in browser mode
 */

const isElectron = () => {
  return typeof window !== 'undefined' && window.electron;
};

// Mock implementations for browser mode
const mockStore = {
  get: async (key) => {
    const data = localStorage.getItem(`electron-store-${key}`);
    return data ? JSON.parse(data) : null;
  },
  set: async (key, value) => {
    localStorage.setItem(`electron-store-${key}`, JSON.stringify(value));
    return true;
  },
  delete: async (key) => {
    localStorage.removeItem(`electron-store-${key}`);
    return true;
  }
};

const mockApiKey = {
  get: async () => {
    const key = localStorage.getItem('mock-api-key');
    return { success: true, hasApiKey: Boolean(key) };
  },
  set: async (apiKey) => {
    localStorage.setItem('mock-api-key', apiKey);
    return { success: true };
  },
  delete: async () => {
    localStorage.removeItem('mock-api-key');
    return { success: true };
  }
};

const mockIdeogramApiKey = {
  get: async () => {
    const key = localStorage.getItem('mock-ideogram-api-key');
    return { success: true, hasApiKey: Boolean(key) };
  },
  set: async (apiKey) => {
    localStorage.setItem('mock-ideogram-api-key', apiKey);
    return { success: true };
  },
  delete: async () => {
    localStorage.removeItem('mock-ideogram-api-key');
    return { success: true };
  }
};

const mockFalApiKey = {
  get: async () => {
    const key = localStorage.getItem('mock-fal-api-key');
    return { success: true, hasApiKey: Boolean(key) };
  },
  set: async (apiKey) => {
    localStorage.setItem('mock-fal-api-key', apiKey);
    return { success: true };
  },
  delete: async () => {
    localStorage.removeItem('mock-fal-api-key');
    return { success: true };
  }
};

const mockOpenAI = {
  getPort: async () => {
    return 3001; // Default port
  }
};

const mockIdeogram = {
  getPort: async () => {
    return 3002; // Default port
  }
};

const mockFal = {
  getPort: async () => {
    return 3003; // Default port
  }
};

const mockDialog = {
  selectFolder: async () => {
    alert('Sélection de dossier non disponible en mode navigateur');
    return null;
  }
};

const mockFS = {
  readFile: async (path) => {
    console.warn('File system not available in browser mode');
    return { success: false, error: 'Not available in browser mode' };
  },
  readFileBase64: async (path) => {
    console.warn('File system not available in browser mode');
    return { success: false, error: 'Not available in browser mode' };
  },
  writeFile: async (path, data) => {
    console.warn('File system not available in browser mode');
    return { success: false, error: 'Not available in browser mode' };
  },
  mkdir: async (path) => {
    console.warn('File system not available in browser mode');
    return { success: false, error: 'Not available in browser mode' };
  },
  exists: async (path) => {
    return false;
  },
  stat: async (path) => {
    return { success: false, error: 'Not available in browser mode' };
  },
  readdir: async (path) => {
    return { success: false, error: 'Not available in browser mode' };
  }
};

const mockSaveFile = async ({ filename, data, filters }) => {
  console.log('Saving file in browser mode:', filename);
  // Create a download link as fallback
  const blob = data instanceof Blob ? data : new Blob([data], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return { success: true, path: filename };
};

// Export safe bridge
export const electronBridge = {
  get store() {
    return isElectron() ? window.electron.store : mockStore;
  },
  get apiKey() {
    return isElectron() ? window.electron.apiKey : mockApiKey;
  },
  get ideogramApiKey() {
    return isElectron() ? window.electron.ideogramApiKey : mockIdeogramApiKey;
  },
  get falApiKey() {
    return isElectron() ? window.electron.falApiKey : mockFalApiKey;
  },
  get openai() {
    return isElectron() ? window.electron.openai : mockOpenAI;
  },
  get ideogram() {
    return isElectron() ? window.electron.ideogram : mockIdeogram;
  },
  get fal() {
    return isElectron() ? window.electron.fal : mockFal;
  },
  get app() {
    return isElectron() && window.electron.app ? window.electron.app : {
      getProjectsPath: async () => './projects',
      getUserDataPath: async () => './userdata',
      getRuntimeFlags: async () => ({ isE2E: false, useLocalBuild: false })
    };
  },
  get dialog() {
    return isElectron() ? window.electron.dialog : mockDialog;
  },
  get fs() {
    return isElectron() ? window.electron.fs : mockFS;
  },
  saveFile: async (options) => {
    return isElectron() && typeof window.electron.saveFile === 'function'
      ? window.electron.saveFile(options)
      : mockSaveFile(options);
  },
  isElectronMode: isElectron
};

export default electronBridge;
