import { Router } from 'express';
import { signAgenteToken } from '../services/agenteSso.js';

const router = Router();

// GET /api/agente/session → token para la API del Agente (TURNOS-YOGA). Solo admins.
router.get('/session', (req, res) => {
  const { AGENTE_API_URL, AGENTE_SSO_SECRET } = process.env;
  if (!AGENTE_API_URL || !AGENTE_SSO_SECRET) {
    return res.status(503).json({ error: 'El Agente no está configurado (AGENTE_API_URL / AGENTE_SSO_SECRET)' });
  }
  res.json({
    token: signAgenteToken(req.agent.name || req.agent.email, AGENTE_SSO_SECRET),
    apiUrl: AGENTE_API_URL.replace(/\/+$/, ''),
  });
});

export default router;
