import { getThemeColor } from '$lib/utils/utils';
import { formatHex, converter, interpolate } from 'culori';
import { random } from 'lodash';

// Use OKLCh (perceptually uniform color space)
export const toOklch = converter('oklch');
export const toHex = formatHex;
// import { toOklch, toHex, interpolate } from 'culori';

type PaletteOptions = {
  backgroundHex: string; // light or dark background
  contentHex: string; // opposite of background
  themePrimaryHex: string; // anchor point
  numCategories?: number;
  numShades?: number;
};

export function generatePalette({
  backgroundHex,
  contentHex,
  themePrimaryHex,
  numCategories = 8,
  numShades = 6,
}: PaletteOptions) {
  const background = toOklch(backgroundHex)!;
  const content = toOklch(contentHex)!;
  const themePrimary = toOklch(themePrimaryHex)!;

  // Sweep hues from warm (20° ~ red-orange) to cool (240° ~ blue)
  const startHue = 20;
  const endHue = 320;
  const hueStep = (endHue - startHue) / (numCategories - 1);

  const categories = Array.from({ length: numCategories }, (_, i) => {
    const h = startHue + i * hueStep;
    return { l: themePrimary.l, c: themePrimary.c, h };
  });

  const shades = categories.map((cat) => {
    return Array.from({ length: numShades }, (_, j) => {
      // Position relative to midpoint
      const t = j / (numShades - 1); // 0 → light side, 1 → dark side

      // Interpolate lightness around themePrimary
      const lightness =
        t < 0.5
          ? themePrimary.l + (0.9 - themePrimary.l) * (1 - 2 * t) // lighter
          : themePrimary.l - (themePrimary.l - 0.2) * (2 * t - 1); // darker

      // Blend slightly toward content but never fully
      const towardContent = interpolate([cat, content], 'oklch');
      const target = towardContent(0.2); // pull 30% toward content color

      const adjusted = {
        ...cat,
        l: lightness,
        h: target?.h ?? cat.h,
      };

      // Ensure contrast from background
      if (Math.abs(adjusted.l - background.l) < 0.2) {
        adjusted.l = background.l > 0.5 ? adjusted.l - 0.2 : adjusted.l + 0.2; // push away from background
      }

      return toHex({ mode: 'oklch', ...adjusted });
    });
  });
  return shades;
}

export let colorOptions: string[][] = [];
export const regenerateColorOptions = () => {
  if (getThemeColor('base-100') === '') {
    console.log('failed to regenerate color options...');
    return;
  }
  colorOptions = generatePalette({
    backgroundHex: getThemeColor('base-100'),
    contentHex: getThemeColor('base-content'),
    themePrimaryHex: getThemeColor('primary'),
  });
};
regenerateColorOptions();

export const getRandomColor = (index: number) => {
  return colorOptions[index % colorOptions.length][random(colorOptions[0].length - 1)];
};
