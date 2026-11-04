import { describe, it, expect } from 'vitest';
import { homePath } from './panels.js';

describe('homePath', () => {
  it('Hub con los dos paneles, directo al suyo si tiene uno', () => {
    expect(homePath({ role: 'admin' })).toBe('/hub');
    expect(homePath({ role: 'atencion_cliente', panels: ['bot', 'agente'] })).toBe('/hub');
    expect(homePath({ role: 'operador', panels: ['agente'] })).toBe('/agente/lista');
    expect(homePath({ role: 'atencion_cliente' })).toBe('/dashboard');
    expect(homePath({ role: 'operador' })).toBe('/conversations');
  });
});
