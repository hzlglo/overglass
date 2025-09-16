import { browser } from '$app/environment';
import { automationDb } from './database.svelte';

// Types for customization data
export interface TrackCustomization {
  userEnteredName?: string;
  color?: string;
}

export interface FileCustomization {
  trackCustomizations: Record<string, TrackCustomization>; // trackName -> customization
  lastOpened: Date;
}

export interface CustomizationState {
  fileCustomizations: Record<string, FileCustomization>; // fileName -> file customization
}

const STORAGE_KEY = 'overglass-customization';

function getStoredState(): CustomizationState {
  if (!browser) {
    return { fileCustomizations: {} };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Convert lastOpened strings back to Date objects
      Object.values(parsed.fileCustomizations || {}).forEach((fileCustom: any) => {
        if (fileCustom.lastOpened) {
          fileCustom.lastOpened = new Date(fileCustom.lastOpened);
        }
      });
      return parsed;
    }
  } catch (error) {
    console.warn('Failed to load customization state from localStorage:', error);
  }

  return { fileCustomizations: {} };
}

function saveStateToStorage(state: CustomizationState): void {
  if (!browser) return;
  console.log('Saving state to localStorage:', state);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Failed to save customization state to localStorage:', error);
  }
}

async function getTrackName(trackId: string): Promise<string> {
  return (await automationDb.get().tracks.getTrackById(trackId))?.trackName || '';
}

const createCustomizationStore = () => {
  let state = $state<CustomizationState>(getStoredState());
  let currentFile = $state<string | null>(null);

  return {
    // Getters
    getState() {
      return state;
    },

    getCurrentFile() {
      return currentFile;
    },
    setCurrentFile(fileName: string) {
      currentFile = fileName;
      if (!state.fileCustomizations[fileName]) {
        state.fileCustomizations[fileName] = {
          trackCustomizations: {},
          lastOpened: new Date(),
        };
      } else {
        state.fileCustomizations[fileName].lastOpened = new Date();
      }
      saveStateToStorage(state);
    },

    getFileCustomization(fileName: string): FileCustomization | null {
      return state.fileCustomizations[fileName] || null;
    },

    async getTrackCustomization(trackId: string): Promise<TrackCustomization | null> {
      if (!currentFile) {
        throw new Error('No file is currently loaded. Call setCurrentFile() first.');
      }
      const fileCustom = state.fileCustomizations[currentFile];
      if (!fileCustom) return null;
      const trackName = await getTrackName(trackId);
      return fileCustom.trackCustomizations[trackName] || null;
    },

    async getTrackDisplayName(trackId: string, defaultName: string): Promise<string> {
      const trackName = await getTrackName(trackId);
      const trackCustom = await this.getTrackCustomization(trackName);
      return trackCustom?.userEnteredName || defaultName;
    },

    async getTrackColor(trackId: string): Promise<string | undefined> {
      const trackName = await getTrackName(trackId);
      const trackCustom = await this.getTrackCustomization(trackName);
      return trackCustom?.color;
    },

    getLastOpened(): Date | null {
      if (!currentFile) {
        throw new Error('No file is currently loaded. Call setCurrentFile() first.');
      }
      const fileCustom = state.fileCustomizations[currentFile];
      return fileCustom?.lastOpened || null;
    },

    getRecentFiles(): Array<{ fileName: string; lastOpened: Date }> {
      return Object.entries(state.fileCustomizations)
        .map(([fileName, fileCustom]) => ({
          fileName,
          lastOpened: fileCustom.lastOpened,
        }))
        .sort((a, b) => b.lastOpened.getTime() - a.lastOpened.getTime());
    },

    // Setters
    async setTrackName(trackId: string, userEnteredName: string): Promise<void> {
      if (!currentFile) {
        throw new Error('No file is currently loaded. Call initializeFile() first.');
      }
      const trackName = await getTrackName(trackId);
      if (!state.fileCustomizations[currentFile].trackCustomizations[trackName]) {
        state.fileCustomizations[currentFile].trackCustomizations[trackName] = {};
      }

      state.fileCustomizations[currentFile].trackCustomizations[trackName].userEnteredName =
        userEnteredName;
      saveStateToStorage(state);
    },

    async setTrackColor(trackId: string, color: string): Promise<void> {
      if (!currentFile) {
        throw new Error('No file is currently loaded. Call initializeFile() first.');
      }
      const trackName = await getTrackName(trackId);

      if (!state.fileCustomizations[currentFile].trackCustomizations[trackName]) {
        state.fileCustomizations[currentFile].trackCustomizations[trackName] = {};
      }

      state.fileCustomizations[currentFile].trackCustomizations[trackName].color = color;
      saveStateToStorage(state);
    },

    // Utility methods
    clearFileCustomizations(fileName: string): void {
      delete state.fileCustomizations[fileName];
    },

    clearAllCustomizations(): void {
      state.fileCustomizations = {};
      // reset current file to empty state
      if (currentFile) {
        this.setCurrentFile(currentFile);
      }
      saveStateToStorage(state);
    },

    // Export/Import for backup/restore
    exportCustomizations(): string {
      return JSON.stringify(state, null, 2);
    },

    importCustomizations(jsonData: string): void {
      try {
        const imported = JSON.parse(jsonData);
        // Validate and convert dates
        Object.values(imported.fileCustomizations || {}).forEach((fileCustom: any) => {
          if (fileCustom.lastOpened) {
            fileCustom.lastOpened = new Date(fileCustom.lastOpened);
          }
        });
        state = imported;
      } catch (error) {
        throw new Error('Invalid customization data: ' + error);
      }
    },

    // Debug helpers
    getStorageSize(): number {
      if (!browser) return 0;
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? stored.length : 0;
    },

    getFileCount(): number {
      return Object.keys(state.fileCustomizations).length;
    },
  };
};

export const appConfigStore = createCustomizationStore();
