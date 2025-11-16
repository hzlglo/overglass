<script lang="ts">
  import '../app.css';
  import Toaster from '$lib/components/core/Toast/Toaster.svelte';
</script>

<meta name="description" content="Simplify your Elektron + Ableton workflow" />

<div class="bg-base-100 min-h-screen">
  <slot />
  <Toaster />
</div>
