import { Router } from 'express';
import { getDb } from '../services/firebase.service.js';
import { requireAtLeastAtencionCliente } from '../middleware/requireAuth.js';
import { DEFAULT_BOT_NAME, DEFAULT_BUSINESS_NAME, DEFAULT_PERSONALITY } from '../services/claude.service.js';

const router = Router();
const CONFIG_DOC = 'bot_config';

router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const doc = await db.collection('bot-yoga_config').doc(CONFIG_DOC).get();
    const config = doc.exists ? doc.data() : getDefaultConfig();
    res.json({ config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/', requireAtLeastAtencionCliente, async (req, res) => {
  try {
    const db = getDb();
    await db.collection('bot-yoga_config').doc(CONFIG_DOC).set(
      { ...req.body, updatedAt: new Date() },
      { merge: true }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Solo lo necesario para pintar el panel con la marca (sin el resto de la config).
export const brandRouter = Router();
brandRouter.get('/', async (req, res) => {
  try {
    const doc = await getDb().collection('bot-yoga_config').doc(CONFIG_DOC).get();
    const c = doc.exists ? doc.data() : getDefaultConfig();
    res.json({
      botName: c.botName ?? null,
      brandColor: c.brandColor ?? null,
      businessName: c.businessName ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function getDefaultConfig() {
  return {
    businessName: DEFAULT_BUSINESS_NAME,
    botName: DEFAULT_BOT_NAME,
    botPersonality: DEFAULT_PERSONALITY,
    welcomeMessage: '¡Hola! 🐶🧘 Soy Patitas, el asistente de Yoga y Patitas. ¿En qué te ayudo?',
    offHoursMessage: '¡Hola! Ahora estamos fuera de horario, pero te respondemos apenas podamos. Mientras tanto contame en qué te ayudo 🐶',
    businessHours: {
      enabled: false,
      timezone: 'America/Argentina/Buenos_Aires',
      schedule: {
        monday: { open: '09:00', close: '18:00', active: true },
        tuesday: { open: '09:00', close: '18:00', active: true },
        wednesday: { open: '09:00', close: '18:00', active: true },
        thursday: { open: '09:00', close: '18:00', active: true },
        friday: { open: '09:00', close: '18:00', active: true },
        saturday: { open: '10:00', close: '14:00', active: true },
        sunday: { open: null, close: null, active: false },
      },
    },
    channels: { whatsapp: true, instagram: false },
  };
}

export default router;
