// Paneles a los que entra cada usuario: 'bot' (WhatsApp) y/o 'agente' (turnos,
// calendario, envíos, reportes y pauta de TURNOS-YOGA). Los admins, los dos;
// el resto, lo que diga su campo `panels` (sin campo: solo el bot).
// Copia de server/src/services/panels.js (el server es el que bloquea de verdad).
export function agentPanels(agent) {
  if (agent?.role === 'admin') return ['bot', 'agente'];
  return Array.isArray(agent?.panels) && agent.panels.length ? agent.panels : ['bot'];
}

export const hasPanel = (agent, panel) => agentPanels(agent).includes(panel);

// Inicio después del login: con los dos paneles, el Hub para elegir; si no, directo al suyo.
export function homePath(agent) {
  const panels = agentPanels(agent);
  if (panels.includes('bot') && panels.includes('agente')) return '/hub';
  if (panels.includes('agente')) return '/agente/lista';
  return ['admin', 'atencion_cliente'].includes(agent?.role) ? '/dashboard' : '/conversations';
}
