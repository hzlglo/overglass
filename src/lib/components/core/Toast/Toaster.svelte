<script lang="ts">
  import classNames from 'classnames';
  import { sharedToastQueue } from './sharedToastQueue.svelte';

  let toastQueue = $derived(sharedToastQueue.getToastQueue());
  let toastStateToClassName = (type: 'success' | 'error' | 'warning' | 'info') => {
    switch (type) {
      case 'success':
        return 'alert-success';
      case 'error':
        return 'alert-error';
      case 'warning':
        return 'alert-warning';
      case 'info':
        return 'alert-info';
    }
  };
</script>

{#each toastQueue as toast}
  <div class="toast">
    <div class={classNames('alert', toastStateToClassName(toast.type))}>
      <span>{toast.message}</span>
    </div>
  </div>
{/each}
