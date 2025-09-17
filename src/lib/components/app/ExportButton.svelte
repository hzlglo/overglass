<script lang="ts">
  import { automationDb } from '../../stores/database.svelte';
  import { appStore } from '../../stores/app.svelte';
  import { ALSWriter } from '../../parsers/alsWriter';

  interface ExportButtonProps {
    class?: string;
  }

  let { class: className = 'btn btn-outline btn-sm' }: ExportButtonProps = $props();

  let isExporting = $state(false);

  async function handleExport() {
    if (isExporting || !appStore.loadedFile) return;

    try {
      isExporting = true;
      console.log('🚀 Starting export with edited database data...');

      // Ensure database is initialized
      if (!automationDb.isInitialized()) {
        throw new Error('Database not initialized. Please load a file first.');
      }

      // Create writer instance with current database
      const writer = new ALSWriter(automationDb.get());

      // Export the current database state back to ALS format
      // This uses the edited data, not the original
      const exportFileName = `${appStore.loadedFile.name}_edited.als`;
      const exportedFile = await writer.writeALSFile(appStore.loadedFile, exportFileName);

      // Create download link and trigger download
      const url = URL.createObjectURL(exportedFile);
      const a = document.createElement('a');
      a.href = url;
      a.download = exportFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log(`✅ Export completed: ${exportFileName}`);
    } catch (error) {
      console.error('❌ Export failed:', error);
      // Could add toast notification here
    } finally {
      isExporting = false;
    }
  }
</script>

<button class={className} onclick={handleExport} disabled={isExporting || !appStore.loadedFile}>
  {isExporting ? 'Exporting...' : 'Export ALS'}
</button>
