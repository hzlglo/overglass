<script lang="ts">
  import Modal from '../core/Modal.svelte';
  import { CircleQuestionMarkIcon } from '@lucide/svelte';
</script>

<Modal titleString="Overglass Documentation">
  <CircleQuestionMarkIcon />
  {#snippet content()}
    <div class="mx-auto max-h-[80vh] space-y-6 overflow-y-auto p-6">
      <!-- Intro -->
      <p>
        <strong>Overglass</strong> is a web app that makes it easier to edit recorded automation.
      </p>

      <!-- Features -->
      <div class="space-y-2">
        <h2 class="text-xl font-semibold">Features</h2>
        <ul class="list-inside list-disc space-y-1">
          <li>Parameters are automatically grouped by tracks</li>
          <li>Tracks can be renamed and color-coded</li>
          <li>Mute/unmutes are displayed as ‘clips’</li>
        </ul>
      </div>

      <!-- Usage -->
      <div class="space-y-2">
        <h2 class="text-xl font-semibold">Usage</h2>
        <p class="leading-relaxed">
          Start by loading a .als file. Overglass will render the file contents, and allow you to
          add, remove, and edit automation for each track. When you're done, export the file and you
          can then work with it in Ableton.
        </p>
      </div>

      <!-- Key Shortcuts -->
      <div class="space-y-2">
        <h2 class="text-xl font-semibold">Key Shortcuts</h2>
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

      <!-- Data privacy -->
      <div class="space-y-2">
        <h2 class="text-xl font-semibold">Data privacy</h2>
        <p class="leading-relaxed">
          Overglass does not send your file to any servers. It only loads it into your web browser,
          and allows you to edit it. Your file never leaves your computer.
        </p>
      </div>
    </div>
  {/snippet}
</Modal>
