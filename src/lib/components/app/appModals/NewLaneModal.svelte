<script lang="ts">
  import AgGrid from '$lib/components/core/AgGrid.svelte';
  import type { MidiMapping } from '$lib/database/schema';
  import { trackDb, useTrackDbQuery } from '$lib/stores/trackDb.svelte';
  import { safeConcat } from '$lib/utils/utils';
  import type { ColDef } from 'ag-grid-community';
  import Modal from '../../core/Modal.svelte';
  import { createParameters } from '$lib/database/services/utils';

  let {
    initialName = $bindable(''),
    isOpen = $bindable(false),
  }: { initialName: string; isOpen: boolean } = $props();

  type TableData = MidiMapping & {
    label: string;
  };
  let getAvailableProps = $derived(
    useTrackDbQuery(
      (db) =>
        db.run(`
  SELECT * FROM midi_mappings
  where (device, param_id)
  not in (select devices.device_name, parameters.vst_parameter_id 
    from parameters
    join tracks on parameters.track_id = tracks.id
    join devices on tracks.device_id = devices.id
  )`),
      [],
    ),
  );
  let availableProps: TableData[] = $derived(getAvailableProps.getResult());
  let searchRegex = $derived(() => {
    if (!initialName) return null;
    // Replace every space with .*
    const escapedInput = initialName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regexString = escapedInput.replace(/ /g, '.*');
    try {
      return new RegExp(regexString, 'i');
    } catch (e: any) {
      return null;
    }
  });
  let filteredAvailableProps: TableData[] = $derived(
    availableProps
      .map((prop) => ({
        ...prop,
        label: safeConcat([prop.device, prop.name, prop.categories], ' - '),
      }))
      .filter((prop) => searchRegex()?.test(prop.label)),
  );
  $inspect('NewLaneModal', { availableProps, filteredAvailableProps });
  const columns: ColDef<TableData>[] = [
    { field: 'device' },
    { field: 'name' },
    { field: 'categories' },
  ];
  let selectedRows: TableData[] = $state([]);
</script>

<Modal titleString="New Lane" bind:isOpen>
  {#snippet content()}
    <div class="h-2xl flex min-h-0 w-2xl flex-col gap-2 p-4">
      <div class="flex flex-col gap-2">
        <input type="text" class="input" bind:value={initialName} />
      </div>
      <div class="flex h-[400px] w-full">
        <AgGrid
          {columns}
          rows={filteredAvailableProps}
          gridOptions={{
            rowSelection: {
              mode: 'multiRow',
            },
            getRowId: (params) => params.data.id,
            onRowSelected: (params) => {
              selectedRows = params.api.getSelectedRows();
            },
          }}
        />
      </div>
      <div class="flex justify-end">
        <button
          class="btn btn-ghost"
          onclick={() => {
            isOpen = false;
          }}
        >
          Close
        </button>
        <button
          class="btn btn-primary"
          onclick={async () => {
            await createParameters(trackDb.get(), selectedRows);
            isOpen = false;
          }}>Add</button
        >
      </div>
    </div>
  {/snippet}
</Modal>
