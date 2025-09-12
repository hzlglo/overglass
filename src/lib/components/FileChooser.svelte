<script lang="ts">
  interface FileChooserProps {
    fileName: string;
    loading: boolean;
    error: string | null;
    onFileSelect: (file: File) => void;
    onLoadSet: () => void;
    onDebugFile: () => void;
  }

  let { fileName, loading, error, onFileSelect, onLoadSet, onDebugFile }: FileChooserProps =
    $props();

  function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      onFileSelect(target.files[0]);
    }
  }
</script>

<div class="card bg-base-200 mb-8 shadow-xl">
  <div class="card-body">
    <h2 class="card-title">Load Ableton Live Set</h2>
    <div class="form-control">
      <label class="label">
        <span class="label-text">Select .als file</span>
      </label>
      <input
        type="file"
        accept=".als"
        class="file-input file-input-bordered w-full max-w-xs"
        onchange={handleFileSelect}
      />
      {#if fileName}
        <div class="mt-4">
          <div class="alert alert-info">
            <span>Selected: {fileName}</span>
          </div>
          <div class="mt-2 flex gap-2">
            <button class="btn btn-primary" onclick={onLoadSet} disabled={loading}>
              {#if loading}
                <span class="loading loading-spinner loading-sm"></span>
                Parsing...
              {:else}
                Load Set
              {/if}
            </button>
            <button class="btn btn-outline btn-secondary" onclick={onDebugFile}>
              Debug File
            </button>
          </div>
        </div>
      {/if}

      {#if error}
        <div class="alert alert-error mt-4">
          <span>{error}</span>
        </div>
      {/if}
    </div>
  </div>
</div>
