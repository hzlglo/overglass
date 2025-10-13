<script lang="ts">
  import { Dialog } from 'bits-ui';
  import type { Snippet } from 'svelte';

  let {
    children,
    content,
    titleString,
  }: { children: Snippet; content: Snippet; titleString?: string } = $props();
</script>

<Dialog.Root>
  <Dialog.Trigger class="btn btn-ghost btn-sm btn-square">
    {@render children()}
  </Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Overlay
      class="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 bg-base-300/70 fixed inset-0 z-50"
    />
    <Dialog.Content
      class="card bg-base-100 card-border data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 w-lg translate-x-[-50%] translate-y-[-50%] outline-hidden"
    >
      <div class="card-body max-h-[80vh] gap-0 overflow-y-auto">
        <Dialog.Title class="card-title border-base-content/20 border-b pb-2">
          {titleString}
        </Dialog.Title>
        {@render content()}
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
