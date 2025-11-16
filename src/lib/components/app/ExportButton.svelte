<script lang="ts">
  import { trackDb } from '../../stores/trackDb.svelte';
  import { appStore } from '../../stores/app.svelte';
  import { ALSWriter } from '../../parsers/alsWriter';
  import { filenameTimestamp } from '../../utils/utils';
  import { appConfigStore } from '$lib/stores/customization.svelte';
  interface ExportButtonProps {
    class?: string;
  }

  let { class: className = 'btn btn-outline btn-sm mr-3' }: ExportButtonProps = $props();

  let isExporting = $state(false);

  const fileMetadata = $derived(appStore.getFileMetadata());

  async function handleExport() {
    const loadedFile = appStore.getLoadedFile();
    if (isExporting || !loadedFile) return;

    try {
      isExporting = true;
      console.log('🚀 Starting export with edited database data...');

      // Ensure database is initialized
      if (!trackDb.isInitialized()) {
        throw new Error('Database not initialized. Please load a file first.');
      }

      // Create writer instance with current database
      const writer = new ALSWriter(trackDb.get());

      // Export the current database state back to ALS format
      // This uses the edited data, not the original
      const cleanedFileName = loadedFile.name?.replace(/_overglass.*/g, '') ?? 'overglass';
      const exportFileName = `${cleanedFileName}_overglass_${filenameTimestamp()}.als`;
      const exportedFile = await writer.writeALSFile(loadedFile, exportFileName);
      appConfigStore.copyConfigToNewfile(exportFileName);

      // Create download link and trigger download
      const url = URL.createObjectURL(exportedFile);
      const a = document.createElement('a');
      a.href = url;
      a.download = exportFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      appStore.setHasUnsavedChanges(false);

      console.log(`✅ Export completed: ${exportFileName}`);
    } catch (error) {
      console.error('❌ Export failed:', error);
      // Could add toast notification here
    } finally {
      isExporting = false;
    }
  }

  // https://stackoverflow.com/questions/10311341/confirmation-before-closing-of-tab-browser
  function onBeforeUnload(e: BeforeUnloadEvent) {
    if (appStore.getHasUnsavedChanges()) {
      e.preventDefault();
      e.returnValue = '';
      return;
    }

    delete e['returnValue'];
  }
  $effect(() => {
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  });
</script>

<button
  title="Export the current project as a new .als file"
  class={className}
  onclick={handleExport}
  disabled={isExporting || !fileMetadata}
>
  {isExporting ? 'Exporting...' : 'Export ALS'}
</button>
