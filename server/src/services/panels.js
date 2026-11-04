// Paneles a los que entra cada usuario: 'bot' (WhatsApp) y/o 'agente' (turnos,
// calendario, envíos, reportes y pauta de TURNOS-YOGA). Los admins, los dos;
// el resto, lo que diga su campo `panels` (sin campo: solo el bot).
// Copia en client/src/lib/panels.js (para el menú; el que bloquea es el server).
export function agentPanels(agent) {
  if (agent?.role === 'admin') return ['bot', 'agente'];
  return Array.isArray(agent?.panels) && agent.panels.length ? agent.panels : ['bot'];
}

export const hasPanel = (agent, panel) => agentPanels(agent).includes(panel);
