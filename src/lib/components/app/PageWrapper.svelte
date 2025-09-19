<script lang="ts">
  import Navbar from '$lib/components/app/Navbar.svelte';
  import { appStore } from '$lib/stores/app.svelte';
  import type { Snippet } from 'svelte';
  import '../../../app.css';
  let { children, hideNavbar }: { children: Snippet; hideNavbar?: boolean } = $props();
</script>

<div class="bg-base-100 h-screen w-screen">
  <!-- Main Application Screen -->
  <div class="flex h-screen w-screen flex-col">
    {#if !hideNavbar}
      <!-- Top Navbar -->
      <Navbar
        projectName={appStore.loadedFile?.name || 'Untitled Project'}
        bpm={appStore.loadedFile?.bpm || 120}
      />
    {/if}

    <!-- Main Content Area -->
    <div class="flex min-h-0 w-screen flex-1 flex-col px-3">
      {@render children()}
    </div>
  </div>
</div>
