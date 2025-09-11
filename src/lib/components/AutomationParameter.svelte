<script lang="ts">
  import AutomationCurve from './AutomationCurve.svelte';

  interface AutomationParameterProps {
    parameter: {
      parameter_id: string;
      parameter_name: string;
      parameter_path: string;
      min_value: number;
      max_value: number;
      point_count: number;
      min_time: number;
      max_time: number;
    };
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
        {parameter.parameter_name || `Param ${parameter.parameter_id.split('_').pop()}`}
      </div>
      <div class="flex items-center gap-2">
        <span class="text-base-content/60 font-mono text-xs">
          {parameter.point_count} pts
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
          >{parameter.min_value?.toFixed(2)} - {parameter.max_value?.toFixed(2)}</span
        >
      </div>
      <div class="flex justify-between">
        <span>Time:</span>
        <span class="font-mono"
          >{parameter.min_time?.toFixed(1)}s - {parameter.max_time?.toFixed(1)}s</span
        >
      </div>
    </div>
  </div>

  <!-- Expanded curve view -->
  {#if isExpanded}
    <div class="px-3 pb-3">
      <AutomationCurve
        parameterId={parameter.parameter_id}
        parameterName={parameter.parameter_name ||
          `Parameter ${parameter.parameter_id.split('_').pop()}`}
        minValue={parameter.min_value}
        maxValue={parameter.max_value}
        minTime={parameter.min_time}
        maxTime={parameter.max_time}
        width={500}
        height={200}
      />
    </div>
  {/if}
</div>
