import { CATEGORY_META } from '../../shared/category-meta';

export interface SimTheme {
  icon: string;
  vars: Record<string, string>;
}

type Rgb = [number, number, number];

const hexToRgb = (hex: string): Rgb => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const rgbToHex = ([r, g, b]: Rgb) => '#' + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');

const mix = (a: string, b: string, weightOfB: number) => {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex([0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * weightOfB) as Rgb);
};

const hslToHex = (h: number, s: number, l: number) => {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => 255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))));
  return rgbToHex([f(0), f(8), f(4)]);
};

// Subjects without a predefined palette still get a stable, distinct colour derived from their name.
const generated = (name: string) => {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  const hue = Math.abs(hash) % 360;
  return { icon: '📚', from: hslToHex(hue, 72, 60), to: hslToHex((hue + 28) % 360, 66, 42) };
};

const cache = new Map<string, SimTheme>();

export const simTheme = (name: string): SimTheme => {
  const hit = cache.get(name);
  if (hit) return hit;
  const meta = CATEGORY_META[name] ?? generated(name);
  const rgb = (hex: string) => hexToRgb(hex).join(', ');
  const theme: SimTheme = {
    icon: meta.icon,
    vars: {
      '--c1': meta.from,
      '--c2': meta.to,
      '--c1-rgb': rgb(meta.from),
      '--c2-rgb': rgb(meta.to),
      '--light': mix(meta.from, '#ffffff', 0.55),
      '--accent': mix(meta.to, '#12304d', 0.55),
      '--bg0': mix(meta.to, '#ffffff', 0.96),
      '--bg1': mix(meta.to, '#ffffff', 0.92),
      '--bg2': mix(meta.from, '#ffffff', 0.88)
    }
  };
  cache.set(name, theme);
  return theme;
};
