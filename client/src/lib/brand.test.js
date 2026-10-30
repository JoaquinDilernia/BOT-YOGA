import { describe, it, expect } from 'vitest';
import { normalizeHex, brandVars } from './brand.js';

describe('brand', () => {
  it('normalizeHex', () => {
    expect(normalizeHex('#6b8f6f')).toBe('#6b8f6f');
    expect(normalizeHex('#abc')).toBe('#aabbcc');
    expect(normalizeHex('verde')).toBe('#6b8f6f');
    expect(normalizeHex('')).toBe('#6b8f6f');
    expect(normalizeHex(null)).toBe('#6b8f6f');
  });
  it('brandVars', () => {
    expect(brandVars('#6b8f6f')['--brand']).toBe('#6b8f6f');
    expect(brandVars('#000000')['--brand-soft']).toMatch(/^#[0-9a-f]{6}$/);
    expect(brandVars('#000000')['--brand-ink']).toMatch(/^#[0-9a-f]{6}$/);
  });
});
