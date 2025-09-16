import { sharedXScale } from '$lib/components/grid/sharedXScale.svelte';
import type { ParsedALS } from '../types/automation';

type AppScreen = 'file-chooser' | 'main';

interface AppState {
  currentScreen: AppScreen;
  loadedFile: ParsedALS | null;
  showDebugger: boolean;
}

const createAppStore = () => {
  let state = $state<AppState>({
    currentScreen: 'file-chooser',
    loadedFile: null,
    showDebugger: false,
  });

  return {
    // Getters
    get currentScreen() {
      return state.currentScreen;
    },
    get loadedFile() {
      return state.loadedFile;
    },
    get showDebugger() {
      return state.showDebugger;
    },

    // Actions
    setScreen(screen: AppScreen) {
      state.currentScreen = screen;
    },

    setLoadedFile(file: ParsedALS) {
      state.loadedFile = file;
      state.currentScreen = 'main';
    },

    toggleDebugger() {
      state.showDebugger = !state.showDebugger;
    },

    resetApp() {
      state.currentScreen = 'file-chooser';
      state.loadedFile = null;
      state.showDebugger = false;
    },
  };
};

export const appStore = createAppStore();
