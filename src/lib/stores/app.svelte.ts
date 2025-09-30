import type { ParsedALS } from '../types/automation';

/**
 * Transient app state that is not persisted to localStorage
 */

interface AppState {
  loadedFile: ParsedALS | null;
}

const createAppStore = () => {
  let state = $state<AppState>({
    loadedFile: null,
  });

  return {
    // Getters
    getLoadedFile() {
      return state.loadedFile;
    },

    setLoadedFile(file: ParsedALS) {
      state.loadedFile = file;
    },

    resetApp() {
      state.loadedFile = null;
    },
  };
};

export const appStore = createAppStore();
