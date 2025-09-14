import type { LaneDisplay } from '$lib/components/gridDisplayState.svelte';

export type themeColor =
  | 'primary'
  | 'primary-content'
  | 'secondary'
  | 'secondary-content'
  | 'accent'
  | 'accent-content'
  | 'neutral-content'
  | 'base-100'
  | 'base-200'
  | 'base-300'
  | 'base-content'
  | 'info'
  | 'info-content'
  | 'success'
  | 'success-content'
  | 'warning'
  | 'warning-content'
  | 'error'
  | 'error-content';
export function getThemeColor(name: themeColor) {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(`--color-${name}`)
    .trim();
  return value;
}
