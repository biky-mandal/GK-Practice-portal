import { CATEGORY_META } from '../../shared/category-meta';
import { simTheme } from './simulation-theme';

const luminance = (hex: string): number => {
  const channels = [1, 3, 5].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};

const contrast = (a: string, b: string): number => {
  const values = [luminance(a), luminance(b)];
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
};

describe('Simulation light theme', () => {
  for (const name of [...Object.keys(CATEGORY_META), 'Custom subject', '']) {
    it(`provides light surfaces and readable text for "${name}"`, () => {
      const { vars } = simTheme(name);
      for (const surface of ['--bg0', '--bg1', '--bg2']) {
        expect(luminance(vars[surface])).withContext(surface).toBeGreaterThan(0.75);
        for (const text of ['#12304d', '#35506b', vars['--accent']]) {
          expect(contrast(text, vars[surface])).withContext(`${text} on ${surface}`).toBeGreaterThanOrEqual(4.5);
        }
      }
      expect(contrast('#ffffff', vars['--accent'])).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('preserves predefined subject colors and caches themes', () => {
    const theme = simTheme('Polity');
    expect(theme.icon).toBe(CATEGORY_META['Polity'].icon);
    expect(theme.vars['--c1']).toBe(CATEGORY_META['Polity'].from);
    expect(theme.vars['--c2']).toBe(CATEGORY_META['Polity'].to);
    expect(simTheme('Polity')).toBe(theme);
  });

  it('keeps generated subjects visually distinct', () => {
    expect(simTheme('Custom subject').vars['--bg2']).not.toBe(simTheme('Another subject').vars['--bg2']);
  });
});
