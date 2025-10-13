import { omit } from 'lodash';
import type { ParsedALS } from '../database/schema';

/**
 * Transient app state that is not persisted to localStorage
 */

const createAppStore = () => {
  let fileMetadata = $state<Omit<ParsedALS, 'rawXML'> | null>(null);
  // this is stored in separate raw state since it's potentially huge and doesn't need to be reactive
  let fileContents = $state.raw<ParsedALS['rawXML'] | null>(null);
  let hasUnsavedChanges = $state(false);

  return {
    // Getters
    getFileMetadata() {
      return fileMetadata;
    },
    getLoadedFile() {
      return { ...fileMetadata, rawXML: fileContents };
    },

    setLoadedFile(file: ParsedALS) {
      fileMetadata = omit(file, 'rawXML');
      // TODO read time signature from file
      fileMetadata.meter = { numerator: 4, denominator: 4 };
      fileContents = file.rawXML;
    },
    setHasUnsavedChanges(hasUnsavedChangesInner: boolean) {
      console.log('setHasUnsavedChanges', hasUnsavedChangesInner);
      hasUnsavedChanges = hasUnsavedChangesInner;
    },
    getHasUnsavedChanges() {
      return hasUnsavedChanges;
    },

    resetApp() {
      fileMetadata = null;
      fileContents = null;
    },
    updateFileMetadata(
      updater: (metadata: Omit<ParsedALS, 'rawXML'>) => Omit<ParsedALS, 'rawXML'>,
    ) {
      if (!fileMetadata) return;
      fileMetadata = updater(fileMetadata);
    },
  };
};

export const appStore = createAppStore();
