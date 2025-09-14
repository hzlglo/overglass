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

export function binarySearchCeiling(arr: number[], value: number) {
  let lo = 0,
    hi = arr.length - 1;
  let result = null;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (arr[mid] >= value) {
      result = arr[mid];
      hi = mid - 1; // look for smaller ceiling
    } else {
      lo = mid + 1;
    }
  }
  console.log('binarysearchceiling snapping', value, 'to', result);
  return result;
}
export function binarySearchFloor(arr: number[], value: number) {
  let lo = 0,
    hi = arr.length - 1;
  let result = null;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (arr[mid] <= value) {
      result = arr[mid];
      lo = mid + 1; // look for larger floor
    } else {
      hi = mid - 1;
    }
  }
  console.log('binarysearchfloor snapping', value, 'to', result);
  return result;
}
