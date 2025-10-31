import { compact } from 'lodash';

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

export function transpose<T>(array: T[][]) {
  return array[0].map((_, i) => array.map((row) => row[i]));
}

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${value}`);
}
export function filenameTimestamp(date = new Date()) {
  return date
    .toLocaleString(undefined, {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    .replace(/[/:,\s]+/g, '-');
}

export function safeConcat(strs: (string | null | undefined)[], separator: string = ' ') {
  return compact(strs).join(separator);
}
