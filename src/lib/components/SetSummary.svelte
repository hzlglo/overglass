<script lang="ts">
  import type { ParsedALS } from '$lib/types/automation';

  interface SetSummaryProps {
    parsedSet: ParsedALS;
  }

  let { parsedSet }: SetSummaryProps = $props();

  let totalParameters = $derived(
    parsedSet.set.elektron.reduce(
      (sum, device) =>
        sum + device.tracks.reduce((tSum, track) => tSum + track.automationEnvelopes.length, 0),
      0,
    ),
  );
</script>

<div class="mt-6">
  <h3 class="mb-3 flex items-center gap-2 text-lg font-semibold">📊 Parsed Data Summary</h3>
  <div class="stats stats-horizontal shadow">
    <div class="stat">
      <div class="stat-title">BPM</div>
      <div class="stat-value text-primary">{parsedSet.set.bpm}</div>
    </div>
    <div class="stat">
      <div class="stat-title">Elektron Devices</div>
      <div class="stat-value text-secondary">{parsedSet.set.elektron.length}</div>
    </div>
    <div class="stat">
      <div class="stat-title">Total Parameters</div>
      <div class="stat-value text-accent">{totalParameters}</div>
    </div>
  </div>
</div>
