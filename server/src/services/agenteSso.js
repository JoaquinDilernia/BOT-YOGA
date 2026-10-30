import crypto from 'node:crypto';

// Sesión para el Agente (panel de turnos/pauta, repo TURNOS-YOGA): el panel del
// bot pide este token y lo usa contra la API del Agente, así no hay un segundo
// login. Formato `sso.<nombre base64url>.<vence ms>.<firma>` con HMAC-SHA256 y
// el secreto compartido AGENTE_SSO_SECRET (en TURNOS-YOGA: PANEL_SSO_SECRET).
// Si cambia el formato, cambiar también TURNOS-YOGA/src/sso.js.
const TTL_MS = 12 * 3600e3;

export function signAgenteToken(name, secret, now = Date.now()) {
  const payload = `sso.${Buffer.from(String(name)).toString('base64url')}.${now + TTL_MS}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
