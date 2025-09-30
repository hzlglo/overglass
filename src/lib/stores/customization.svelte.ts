import { browser } from '$app/environment';
import { fromPairs } from 'lodash';
import type { Track } from '$lib/database/schema';
import { colorOptions, getRandomColor } from '$lib/components/colors/colorOptions';

/**
 * Display settings that are persisted to localStorage
 */

// Types for customization data
export interface TrackCustomization {
  rawTrackName: string;
  userEnteredName?: string;
  color?: string;
}

export interface FileCustomization {
  trackCustomizations: Record<string, TrackCustomization>; // trackId -> customization
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

const createCustomizationStore = () => {
  let state = $state<CustomizationState>(getStoredState());
  let currentFile = $state<string | null>(null);

  return {
    get() {
      return currentFile ? state.fileCustomizations[currentFile] : null;
    },
    initializeTrackCustomizations(tracks: Track[]) {
      if (!currentFile) {
        throw new Error('No file is currently loaded. Call initializeFile() first.');
      }
      for (const track of tracks) {
        if (!state.fileCustomizations[currentFile].trackCustomizations[track.id]) {
          state.fileCustomizations[currentFile].trackCustomizations[track.id] = {
            rawTrackName: track.trackName,
            color: getRandomColor(),
          };
        }
      }
    },
    randomizeTrackColors() {
      if (!currentFile) {
        return;
      }
      for (const track of Object.values(
        state.fileCustomizations[currentFile].trackCustomizations,
      )) {
        track.color = getRandomColor();
      }
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

    // Setters
    setTrackName(trackId: string, userEnteredName: string) {
      if (!currentFile) {
        throw new Error('No file is currently loaded. Call initializeFile() first.');
      }
      if (!state.fileCustomizations[currentFile].trackCustomizations[trackId]) {
        throw new Error('Track not found. Call initializeTrackCustomizations() first.');
      }

      state.fileCustomizations[currentFile].trackCustomizations[trackId].userEnteredName =
        userEnteredName;
      saveStateToStorage(state);
    },

    setTrackColor(trackId: string, color: string) {
      if (!currentFile) {
        throw new Error('No file is currently loaded. Call initializeFile() first.');
      }

      if (!state.fileCustomizations[currentFile].trackCustomizations[trackId]) {
        throw new Error('Track not found. Call initializeTrackCustomizations() first.');
      }

      state.fileCustomizations[currentFile].trackCustomizations[trackId].color = color;
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
