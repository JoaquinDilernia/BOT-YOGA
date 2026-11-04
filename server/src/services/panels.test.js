import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agentPanels, hasPanel } from './panels.js';

test('agentPanels: admin todo, sin campo solo bot, si no lo que diga panels', () => {
  assert.deepEqual(agentPanels({ role: 'admin', panels: ['bot'] }), ['bot', 'agente']);
  assert.deepEqual(agentPanels({ role: 'atencion_cliente' }), ['bot']);
  assert.deepEqual(agentPanels({ role: 'atencion_cliente', panels: ['bot', 'agente'] }), ['bot', 'agente']);
  assert.equal(hasPanel({ role: 'operador', panels: ['agente'] }, 'bot'), false);
  assert.equal(hasPanel({ role: 'operador', panels: ['agente'] }, 'agente'), true);
});
