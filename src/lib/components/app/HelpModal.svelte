<script lang="ts">
  import Modal from '../core/Modal.svelte';
  import { InfoIcon } from '@lucide/svelte';
</script>

<Modal titleString="How to use Overglass">
  <button class="btn btn-ghost btn-sm btn-square" title="Show documentation" onclick={() => {}}>
    <InfoIcon />
  </button>
  {#snippet content()}
    <div class="prose">
      <div class="p-2">
        <h3 class="mt-4 mb-2 text-lg font-semibold">Selection & Editing</h3>
        <ul class="list-disc space-y-1 pl-5">
          <li><strong>Drag</strong> within the timeline to select multiple points or clips.</li>
          <li><kbd class="kbd">⌘+A</kbd> — select all points and mutes.</li>
          <li>
            Once multiple points are selected, <strong>drag</strong> any one to move them all.
          </li>
          <li>
            Points are <strong>locked to the grid</strong> by default. Hold <kbd class="kbd">⌘</kbd>
            while dragging to freely position them.
          </li>
          <li><strong>Right-click</strong> anywhere on the timeline to see available actions.</li>
        </ul>

        <h3 class="mb-2 text-lg font-semibold">Adding & Removing Automation</h3>
        <ul class="list-disc space-y-1 pl-5">
          <li>
            <strong>Double-click</strong> on a point to remove it. Double-click anywhere else to add
            a new automation point.
          </li>
          <li>
            <strong>Double-click</strong> in a track to add a clip. Double-click on a clip to split it
            into two clips.
          </li>
          <li>
            <kbd class="kbd">Backspace</kbd> or <kbd class="kbd">Delete</kbd> — delete selected points
            and mutes.
          </li>
        </ul>
        <h3 class="mt-4 mb-2 text-lg font-semibold">Navigation & Zoom</h3>
        <ul class="list-disc space-y-1 pl-5">
          <li><strong>Pinch</strong> or <kbd class="kbd">⌘+Scroll</kbd> to zoom in and out.</li>
          <li>
            <strong>Drag</strong> the top or bottom timeline to scroll horizontally, or use your trackpad’s
            horizontal scroll.
          </li>
          <li><kbd class="kbd">⌘+F</kbd> — filter lanes by name.</li>
        </ul>
        <a
          class="link"
          href="https://docs.google.com/document/d/121NUcaH3U1NsMa1u3bYBQZxF1vooAETfR9-7-fkNyQ8/edit?usp=sharing"
          target="_blank"
          tabindex="-1"
        >
          Read the docs
        </a>
      </div>
    </div>
  {/snippet}
</Modal>
