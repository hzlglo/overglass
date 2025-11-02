<script lang="ts">
  import Autocomplete from '$lib/components/core/Autocomplete.svelte';
  import {
    sharedGridState,
    type ParameterLaneState,
  } from '$lib/components/grid/sharedGridState.svelte';
  import type { MidiMapping } from '$lib/database/schema';
  import { createParameters } from '$lib/database/services/utils';
  import { trackDb, useTrackDbQuery } from '$lib/stores/trackDb.svelte';
  import { safeConcat } from '$lib/utils/utils';
  import Modal from '../../core/Modal.svelte';

  let {
    parameterLaneState,
    isOpen = $bindable(false),
  }: { parameterLaneState: ParameterLaneState; isOpen: boolean } = $props();

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
  )
  and device
  in (select devices.device_name
    from parameters
    join tracks on parameters.track_id = tracks.id
    join devices on tracks.device_id = devices.id
  )
`),
      [],
    ),
  );
  let availableProps: MidiMapping[] = $derived(getAvailableProps.getResult());
  let selectedParameter = $state<MidiMapping | null>(null);
</script>

<Modal titleString="Change Parameter" bind:isOpen>
  {#snippet content()}
    <div class="h-2xl flex min-h-0 w-2xl flex-col gap-2 p-4">
      <p>Select a new parameter for {parameterLaneState.parameter.parameterName}:</p>
      <div class="flex h-[400px] w-full">
        <Autocomplete
          class="w-full"
          options={availableProps.map((prop) => ({
            label: safeConcat([prop.device, prop.name, prop.categories], ' - '),
            value: prop.id,
          }))}
          onchange={(value) => {
            selectedParameter = availableProps.find((prop) => prop.id === value) ?? null;
          }}
          placeholder="Select a parameter"
        />
      </div>
      <div class="flex flex-row justify-end gap-2">
        <button
          class="btn btn-ghost"
          onclick={() => {
            isOpen = false;
          }}
        >
          Close
        </button>
        {#if selectedParameter}
          <button
            class="btn btn-primary"
            onclick={async () => {
              if (!selectedParameter) return;
              const newParameter = await createParameters(trackDb.get(), [selectedParameter]);
              const newParameterId = newParameter[0].id;
              await trackDb
                .get()
                .tracks.moveAutomationTo(parameterLaneState.parameter.id, newParameterId);
              await trackDb.get().tracks.deleteParameter(parameterLaneState.parameter.id);
              await trackDb.refreshData();
              const parameterOrder =
                sharedGridState.getParameterOrder()[parameterLaneState.track.id];
              const updatedParameterOrder = parameterOrder.map((id) =>
                id === parameterLaneState.parameter.id ? newParameterId : id,
              );
              sharedGridState.setParameterOrder(parameterLaneState.track.id, updatedParameterOrder);
              await sharedGridState.syncWithDb(trackDb.get());
              isOpen = false;
            }}
          >
            Change
          </button>
        {/if}
      </div>
    </div>
  {/snippet}
</Modal>
