<script lang="ts">
  import { midiStore } from '$lib/stores/midiStore.svelte';
  import { PlusIcon, UploadIcon, DownloadIcon, TrashIcon, EditIcon } from '@lucide/svelte';
  import AgGrid from '../core/AgGrid.svelte';
  import type { GridApi } from 'ag-grid-community';
  import { omit } from 'lodash';

  let devices = $derived(midiStore.getAllDeviceNames());
  let selectedDevice = $state<string | null>(null);
  const PARAMETER_NAME_COLUMN = 'Parameter Name';
  let { rows, cols } = $derived.by(() => {
    if (!selectedDevice) return { rows: [], cols: [] };
    const mapping = midiStore.getDeviceMapping(selectedDevice);
    let cols = new Set<string>([PARAMETER_NAME_COLUMN]);
    let rows = [];
    for (const [parameterName, midiMappings] of Object.entries(mapping)) {
      for (const key of Object.keys(midiMappings)) {
        cols.add(key);
      }
      rows.push({ [PARAMETER_NAME_COLUMN]: parameterName, ...midiMappings });
    }
    return {
      rows,
      cols: Array.from(cols).map((col) => ({ field: col, headerName: col, editable: true })),
    };
  });

  function downloadCSV() {
    if (!selectedDevice) return;
    const csv = midiStore.exportToCSV(selectedDevice);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedDevice}-midi-mappings.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  let fileInputRef = $state<HTMLInputElement>();
  function handleFileUpload(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      if (!selectedDevice) return;
      try {
        const csvData = e.target?.result as string;
        console.log('csvData', csvData);
        midiStore.importFromCSV(csvData, selectedDevice);
        alert('MIDI mappings imported successfully!');
      } catch (error) {
        alert(`Failed to import CSV: ${error}`);
      }
    };
    reader.readAsText(file);

    // Reset file input
    if (fileInputRef) fileInputRef.value = '';
  }
  let gridApi = $state<GridApi | null>(null);
  $effect(() => {
    gridApi?.addEventListener('cellValueChanged', (event) => {
      if (!selectedDevice) return;
      if (event.colDef.field === PARAMETER_NAME_COLUMN) {
        midiStore.deleteMidiChannel(selectedDevice, event.oldValue);
      }
      midiStore.setMidiMappings(
        selectedDevice,
        event.node.data[PARAMETER_NAME_COLUMN],
        omit(event.node.data, PARAMETER_NAME_COLUMN),
      );
    });
  });
</script>

<div class="flex flex-col gap-6 p-4">
  <div class="flex items-center justify-between">
    <h2 class="text-2xl font-bold">MIDI Channel Mappings</h2>
    <div class="flex flex-row items-center gap-2">
      <button class="btn btn-error" onclick={() => midiStore.clearAllMappings()}>
        Clear all mappings
      </button>
    </div>
  </div>

  <div class="flex flex-row items-center gap-2">
    <span class="">Select a device</span>
    <select class="select select-primary" bind:value={selectedDevice}>
      {#each devices as device}
        <option value={device}>{device}</option>
      {/each}
    </select>
    {#if selectedDevice}
      <input
        type="file"
        class="file-input file-input-bordered"
        accept=".csv"
        bind:this={fileInputRef}
        onchange={handleFileUpload}
      />
      <button class="btn btn-ghost" onclick={downloadCSV}>Download</button>
    {/if}
  </div>

  {#if selectedDevice}
    <div class="h-[50vh] w-full">
      <AgGrid {rows} columns={cols} bind:gridApi />
    </div>
  {/if}
</div>
