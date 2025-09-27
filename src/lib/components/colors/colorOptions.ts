import { getThemeColor } from '$lib/utils/utils';
import { formatHex, converter } from 'culori';

// Use OKLCh (perceptually uniform color space)
export const toOklch = converter('oklch');
export const toHex = formatHex;

// Generate palette: 8 categories × 6 shades
function generatePalette(baseHex: string) {
  const base = toOklch(baseHex);

  const numCategories = 8;
  const numShades = 6;

  // Spread hues evenly around the circle
  const step = 360 / numCategories;

  const categories = Array.from({ length: numCategories }, (_, i) => {
    let h = (base.h + i * step) % 360; // rotate hue
    return { l: base.l, c: base.c, h };
  });

  // For each category, make 6 shades by varying lightness
  const shades = categories.map((cat) => {
    return Array.from({ length: numShades }, (_, j) => {
      const lightness = 0.9 - (j * (0.9 - 0.3)) / (numShades - 1);
      return toHex({ mode: 'oklch', l: lightness, c: cat.c, h: cat.h });
    });
  });

  return shades; // 2D array: [category][shade]
}

export const colorOptions = generatePalette(getThemeColor('success'));
