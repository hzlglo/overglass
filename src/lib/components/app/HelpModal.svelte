<script lang="ts">
  import Modal from '../core/Modal.svelte';
  import { InfoIcon } from '@lucide/svelte';
</script>

<Modal titleString="How to use Overglass">
  <InfoIcon />
  {#snippet content()}
    <div class="mx-auto max-h-[80vh] space-y-6 overflow-y-auto p-6">
      <div class="space-y-2">
        <h2 class="text-xl font-semibold">While editing</h2>
        <ul class="list-inside list-disc space-y-1">
          <li>Right-click anywhere to see available actions</li>
          <li>
            <strong>Double-click</strong> on a point to remove it. Double-click anywhere else to add
            an automation point.
          </li>
          <li>
            <kbd class="kbd">⌘+a</kbd> to select all points + mutes
          </li>
          <li>
            <kbd class="kbd">Backspace</kbd> or
            <kbd class="kbd">Delete</kbd> to delete selected points + mutes
          </li>
          <li>
            Hold <kbd class="kbd">⌘</kbd> while moving points to bypass lock-to-grid behavior and set
            points anywhere in the timeline.
          </li>
        </ul>
      </div>
    </div>
  {/snippet}
</Modal>
