import { describe, expect, it } from 'vitest';
import { resolveCardTheme } from './cardTheme';

describe('resolveCardTheme', () => {
  it('follows the card color identity in automatic mode', () => {
    expect(resolveCardTheme(['R'], 'auto', 'signature', 'minimal').accent).toBe('#b24832');
    expect(resolveCardTheme(['U'], 'auto', 'modern', 'minimal').accent).toBe('#6fb7ff');
  });

  it('builds a two-color gradient for modern multicolor cards', () => {
    const theme = resolveCardTheme(['W', 'U'], 'auto', 'modern', 'minimal');
    expect(theme.accent).toBe('#f5e6ad');
    expect(theme.accent2).toBe('#6fb7ff');
  });

  it('uses the 1993 gold frame for multicolor cards', () => {
    const theme = resolveCardTheme(['W', 'U'], 'auto', 'classic', 'minimal');
    expect(theme.accent).toBe('#dfc47c');
    expect(theme.accent2).toBe('#dfc47c');
  });

  it('lets a manual color override the card identity', () => {
    const theme = resolveCardTheme(['W', 'U'], 'R', 'modern', 'minimal');
    expect(theme.accent).toBe('#ff8a68');
    expect(theme.accent2).toBe('#ff8a68');
  });

  it('picks a readable title ink on dark frames', () => {
    expect(resolveCardTheme(['B'], 'auto', 'classic', 'minimal').titleInk).toBe('#faf3e3');
    expect(resolveCardTheme(['W'], 'auto', 'classic', 'minimal').titleInk).toBe('#191510');
  });

  it('falls back to colorless for cards without a color identity', () => {
    const theme = resolveCardTheme([], 'auto', 'modern', 'minimal');
    expect(theme.accent).toBe('#d6d1c5');
    expect(theme.accent2).toBe('#d6d1c5');
  });
});
