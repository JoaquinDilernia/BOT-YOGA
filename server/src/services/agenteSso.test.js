import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signAgenteToken } from './agenteSso.js';

// Mismo vector que TURNOS-YOGA/test/sso.test.js: si este cambia, el Agente deja de aceptar el token
test('signAgenteToken: formato que verifica el Agente', () => {
  assert.equal(
    signAgenteToken('Marcos', 'secreto', 1_000_000),
    'sso.TWFyY29z.44200000.Suc3zMc3tNDIgk4rBxLD3TAjmhBtgJ0X8hz1jxd71jw',
  );
});
