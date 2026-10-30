# BOT-YOGA

Panel + bot de WhatsApp para **Yoga y Patitas** (clases de yoga con perritos,
yogaypatitas.com.ar, TiendaNube store 8045626).

Clonado de BOT-ENTRENO (bb41e97). Mismo panel tipo WhatsApp, áreas,
difusiones, KB, estadísticas, etc.

## Un solo panel: Hub → Bot / Agente

Al entrar, los **admins** ven un Hub (mismo patrón que Selvaggio) con dos tarjetas:

- **Bot de WhatsApp**: lo de siempre (conversaciones, contactos, difusiones, config…).
- **Agente**: las pantallas de TURNOS-YOGA (Turnos, Calendario, Envíos de entradas,
  Pauta, Reportes) copiadas a `client/src/agente/`, con el mismo menú lateral y la
  paleta del bot (`agente.css` mapea los tokens de Yoga a los del bot, todo bajo `.agente`).
  Muestra las dos tiendas (perritos y gatitos).

Operadores y atención al cliente van directo al bot (no ven el Agente).

El backend del Agente **sigue siendo TURNOS-YOGA** (su Railway + Postgres): este
panel le pega a su API. Sin segundo login: `GET /api/agente/session` (solo admins)
firma un token `sso.…` con `AGENTE_SSO_SECRET`, y TURNOS-YOGA lo acepta con el mismo
valor en `PANEL_SSO_SECRET` (`src/sso.js` allá, `agenteSso.js` acá; mismo vector de test
en los dos repos).

Si se agrega una pantalla nueva en TURNOS-YOGA, copiarla a `client/src/agente/components/`,
sumarla a `AGENTE_SECTIONS` y traer sus estilos a `agente.css`.

## El bot

- Solo WhatsApp por ahora (Instagram apagado en Config).
- `buscar_clases`: lee el catálogo de TiendaNube en vivo (cada producto =
  fecha "Sábado 7 de Noviembre • Palermo", cada variante = horario, stock = lugares
  libres) + gift cards / "Festejá tu Cumple". Ver `server/src/services/clases.js`
  (`parseProductName` es copia de la de TURNOS-YOGA).
- `armar_carrito`: cart-link con el horario elegido y la cantidad de personas.
- Pedidos = entradas: el bot busca el pedido por número/email y explica el estado;
  las entradas las manda por mail TURNOS-YOGA.
- Defaults (nombre "Patitas", personalidad, bienvenida) en `claude.service.js`;
  se pisan desde Config.

## Stack

- **Frontend**: React + Vite + CSS Modules (Agente: CSS global bajo `.agente` + lucide-react)
- **Backend**: Node.js (ESM) + Express
- **Database**: Firebase Firestore (proyecto compartido `pedidos-lett-2`, colecciones con prefijo `bot-yoga_`)
- **AI**: Claude API (Anthropic)
- **Mensajería**: Meta Cloud API (WhatsApp Business)

## Pendiente de setup

- [ ] Número de WhatsApp de Yoga y Patitas en Meta (su propio portfolio): `META_*`
      en el Railway del bot — nunca reusar las de otro bot. Webhook → `/api/webhook`.
- [ ] `ANTHROPIC_API_KEY` y `OPENAI_API_KEY` (audios) en Railway.
- [ ] Railway nuevo para `server/` con las env de `server/.env.example`
      (TiendaNube de perritos, Firebase, `JWT_SECRET`, `ADMIN_*`, `FRONTEND_URL`,
      `AGENTE_API_URL` = URL pública de TURNOS-YOGA, `AGENTE_SSO_SECRET`).
- [ ] En el Railway de TURNOS-YOGA: `PANEL_SSO_SECRET` (= `AGENTE_SSO_SECRET`) y
      sumar el dominio del panel nuevo a `FRONTEND_URL`.
- [ ] Front: `client/dist` a Hostinger (subdominio del panel), con `VITE_API_URL`.
- [ ] Cargar la Knowledge Base: dirección exacta (Mario Bravo 1029, Palermo),
      qué llevar, duración, edad mínima, si se puede ir con el propio perro,
      política de cambios/devoluciones, cumpleaños/eventos privados, WhatsApp humano.
- [ ] Áreas del equipo (a quién deriva el bot) y usuarios.

## Cómo correr localmente

```bash
# Backend del bot
cd server && npm install && npm run dev   # puerto 3001

# Panel
cd client && npm install && npm run dev   # puerto 5173

# Agente (en TURNOS-YOGA), con el mismo secreto que AGENTE_SSO_SECRET
PANEL_SSO_SECRET=... FRONTEND_URL=http://localhost:5173 node --env-file=.env server.js   # puerto 3000
```

Completá `server/.env` y `client/.env` a partir de sus `.env.example` antes de arrancar.
