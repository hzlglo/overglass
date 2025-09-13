<script lang="ts">
  import type { Parameter, ParameterStats } from '$lib/database/schema';
  import AutomationCurve from './AutomationCurve.svelte';

  interface AutomationParameterProps {
    parameter: Parameter & ParameterStats;
    isExpanded?: boolean;
    onToggle?: () => void;
  }

  let { parameter, isExpanded = false, onToggle }: AutomationParameterProps = $props();
</script>

<div class="bg-base-200 rounded-lg text-sm">
  <!-- Parameter header (clickable) -->
  <div
    class="hover:bg-base-300 cursor-pointer rounded-lg p-3 transition-colors"
    onclick={onToggle}
    role="button"
    tabindex="0"
    onkeydown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onToggle?.();
      }
    }}
  >
    <div class="flex items-center justify-between">
      <div class="text-base-content/70 text-xs font-medium tracking-wide uppercase">
        {parameter.parameterName || `Param ${parameter.id.split('_').pop()}`}
      </div>
      <div class="flex items-center gap-2">
        <span class="text-base-content/60 font-mono text-xs">
          {parameter.pointCount} pts
        </span>
        <div class="text-base-content/60">
          {#if isExpanded}
            ▼
          {:else}
            ▶
          {/if}
        </div>
      </div>
    </div>

    <!-- Summary stats -->
    <div class="text-base-content/60 mt-2 space-y-1 text-xs">
      <div class="flex justify-between">
        <span>Range:</span>
        <span class="font-mono"
          >{parameter.minValue?.toFixed(2)} - {parameter.maxValue?.toFixed(2)}</span
        >
      </div>
      <div class="flex justify-between">
        <span>Time:</span>
        <span class="font-mono"
          >{parameter.minTime?.toFixed(1)}s - {parameter.maxTime?.toFixed(1)}s</span
        >
      </div>
    </div>
  </div>

  <!-- Expanded curve view -->
  {#if isExpanded}
    <div class="px-3 pb-3">
      <AutomationCurve
        parameterId={parameter.id}
        parameterName={parameter.parameterName || `Parameter ${parameter.id.split('_').pop()}`}
        minValue={parameter.minValue}
        maxValue={parameter.maxValue}
        minTime={parameter.minTime}
        maxTime={parameter.maxTime}
        width={500}
        height={200}
      />
    </div>
  {/if}
</div>
