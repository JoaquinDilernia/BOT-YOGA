import { historyToMessages, AGENT_PREFIX } from './historyMessages.js';
import https from 'https';
import { getDb } from './firebase.service.js';

const MODEL = 'claude-sonnet-5';
// Caché de prompt: escribir cuesta 1.25x la entrada (TTL 5 min), leer 0.1x.
const PRICING = { inputPerMTok: 2.00, outputPerMTok: 10.00, cacheWritePerMTok: 2.50, cacheReadPerMTok: 0.20 };

function logUsage(usage, type) {
  if (!usage?.input_tokens && !usage?.cache_read_input_tokens) return;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const costUSD =
    (usage.input_tokens / 1e6) * PRICING.inputPerMTok +
    (cacheWrite / 1e6) * PRICING.cacheWritePerMTok +
    (cacheRead / 1e6) * PRICING.cacheReadPerMTok +
    (usage.output_tokens / 1e6) * PRICING.outputPerMTok;
  getDb().collection('bot-yoga_usage_logs').add({
    service: 'claude',
    model: MODEL,
    inputTokens: usage.input_tokens, // sólo la parte NO cacheada
    cacheWriteTokens: cacheWrite,
    cacheReadTokens: cacheRead,
    outputTokens: usage.output_tokens,
    costUSD: Math.round(costUSD * 1e6) / 1e6,
    type,
    createdAt: new Date(),
  }).catch(err => console.error('[claude] Error logging usage to Firestore:', err.message));
}

// Yoga y Patitas (2026-11-11): el cliente reescribió la KB (scripts/seed-kb-carpetas.mjs).
// El bot ya NO deriva al panel con [ESCALAR]: resuelve casi todo, y solo
// cumpleaños/eventos, quejas legales y casos extremos van al WhatsApp del
// equipo. Cambios, devoluciones y reenvío de entradas, al mail.

const EQUIPO_WA = '+54 9 11 3046-1804';

const HANDOFF_INSTRUCTIONS = `

IMPORTANTE — QUÉ RESOLVÉS VOS Y QUÉ DERIVÁS: Resolvé vos todo lo que se pueda con la información de la empresa y las herramientas (fechas, sede, horarios, precios, lugares libres, carrito, promos, gift cards, cómo es la clase, adopción, estado de un pedido).
"Derivar" significa pasarle el WhatsApp del equipo (${EQUIPO_WA}), y solo en estos casos:
- Cumpleaños, eventos privados, grupos, empresas o equipos grandes.
- Queja formal o tema legal (reclamo, defensa del consumidor, denuncia).
- Caso extremo que no podés resolver con tu información después de intentarlo (por ejemplo, pagó y el pedido no aparece).
Cambios de fecha, devoluciones y reenvío de la entrada o del código de gift card: explicá la política en una o dos líneas según la información de la empresa y que lo pida por mail a hola@yogaypatitas.com.ar con el número de pedido. Nunca prometas un cambio ni una devolución.
Nunca pidas datos de tarjeta ni claves. No uses marcadores como [ESCALAR]: este chat no se pasa a una persona.

IMPORTANTE — CIERRE: Si la consulta está completamente resuelta y el cliente se despidió, empezá tu respuesta con [CERRAR]. Si tu respuesta termina con una pregunta, NO uses [CERRAR] — estás esperando que el cliente conteste.
Ejemplo: "[CERRAR] ¡Con mucho gusto! Si necesitás algo más, escribinos por acá cuando quieras."`;

// Extrae el texto de la respuesta recorriendo los bloques de `content` en vez
// de asumir que el bloque [0] es siempre de tipo texto — con claude-sonnet-5,
// un system prompt largo (como el de este bot) le hace anteponer un bloque
// `thinking`, y asumir [0] devuelve undefined y tira el bot entero abajo sin
// avisarle nada al cliente (ver incidente BOT-ALTORANCHO 2026-09-01, [[project-bots]]).
function extractText(response) {
  return (response.content ?? [])
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('')
    .trim();
}

function callAnthropicAPIOnce(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
      },
    }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode !== 200) {
          const err = new Error(`Anthropic API ${res.statusCode}: ${data}`);
          err.statusCode = res.statusCode;
          err.retryAfter = res.headers['retry-after'];
          return reject(err);
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse Anthropic response: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const CLAUDE_MAX_RETRIES = 5;

async function callAnthropicAPI(payload) {
  let lastErr;
  for (let attempt = 1; attempt <= CLAUDE_MAX_RETRIES; attempt++) {
    try {
      return await callAnthropicAPIOnce(payload);
    } catch (err) {
      lastErr = err;
      const retryable = !err.statusCode || err.statusCode === 429 || err.statusCode === 529 || err.statusCode >= 500;
      if (!retryable || attempt === CLAUDE_MAX_RETRIES) throw err;
      const waitMs = err.retryAfter ? parseInt(err.retryAfter, 10) * 1000 : Math.min(1000 * 2 ** (attempt - 1), 15000);
      console.warn(`[claude] Retry ${attempt}/${CLAUDE_MAX_RETRIES} tras error: ${err.message} — esperando ${waitMs}ms`);
      await new Promise(r => setTimeout(r, waitMs));
    }
  }
  throw lastErr;
}

export async function generateConversationSummary(messages) {
  if (!messages?.length) return 'Sin mensajes para resumir.';
  const formatted = messages
    .map(m => {
      const who = m.role === 'user' ? 'Cliente' : m.role === 'admin' ? 'Agente' : 'Bot';
      return `${who}: ${m.content ?? ''}`;
    })
    .join('\n');

  const response = await callAnthropicAPI({
    model: MODEL,
    max_tokens: 350,
    system: 'Generás resúmenes breves de conversaciones de atención al cliente en español rioplatense. Respondés SOLO con el resumen, sin encabezados ni listas.',
    messages: [{
      role: 'user',
      content: `Generá un resumen de 2 a 4 oraciones de esta conversación. Incluí: el motivo principal de la consulta y cómo terminó (resuelto, derivado a agente, pendiente).\n\nConversación:\n${formatted}`,
    }],
  });
  logUsage(response.usage, 'summary');
  return extractText(response);
}

// Defaults si el doc de config no existe (los usa también config.routes.js)
export const DEFAULT_BOT_NAME = 'Patitas';
export const DEFAULT_BUSINESS_NAME = 'Yoga y Patitas';
export const DEFAULT_PERSONALITY = `Sos el asistente virtual de Yoga y Patitas: clases de yoga con perritos. Respondés consultas sobre las clases, fechas, horarios, lugares disponibles, gift cards y compras.
Tenés una onda cálida, alegre y cercana — como alguien del equipo al que le encantan los perros — sin exagerar con los emojis (uno de vez en cuando, 🐶🧘 van bien). Vas al grano.
Usás español rioplatense (vos, etc.). Nunca sonás robótico ni genérico.
Si no sabés algo, lo decís honestamente y ofrecés derivar a alguien del equipo.
Nunca inventás información sobre clases, fechas, horarios, lugares, precios, pedidos o los perritos — solo usás los datos que te den.`;

export async function generateBotResponse(userMessage, conversationHistory, context = {}) {
  const {
    knowledgeBase = '', orderInfo = null, orderRef = null, orderFromCache = false,
    customerContext = null, availableLabels = [], customerTags = [], botConfig = {}, imageData = null, areas = [],
    tools = [], runTool = null,
  } = context;

  const systemContent = buildSystemPrompt(botConfig, knowledgeBase, orderInfo, orderRef, customerContext, availableLabels, areas, customerTags, tools.length > 0, orderFromCache);
  const messages = buildMessages(conversationHistory, userMessage, imageData);

  // Loop de tool-use (mismo patrón que Selvaggio): mientras Claude pida tools,
  // se ejecutan y se le devuelven los resultados. El turno del asistente se
  // reenvía con su `content` COMPLETO (incluidos los bloques thinking) y todos
  // los tool_result van juntos en un único mensaje de usuario.
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await callAnthropicAPI({
      model: MODEL,
      max_tokens: 2048,
      system: systemContent,
      messages,
      ...(tools.length && { tools }),
    });
    logUsage(response.usage, round === 0 ? 'bot_reply' : 'bot_reply_tool');

    if (response.stop_reason !== 'tool_use' || !runTool) return extractText(response);

    const calls = response.content.filter(b => b.type === 'tool_use');
    const results = await Promise.all(calls.map(async (call) => {
      let output;
      try {
        output = await runTool(call.name, call.input ?? {});
      } catch (err) {
        output = { error: err.message };
      }
      console.log(`[claude] tool ${call.name}`, JSON.stringify(call.input), '→', JSON.stringify(output).slice(0, 300));
      return {
        type: 'tool_result',
        tool_use_id: call.id,
        content: JSON.stringify(output),
        ...(output?.error && { is_error: true }),
      };
    }));
    messages.push({ role: 'assistant', content: response.content });
    messages.push({ role: 'user', content: results });
  }

  console.warn('[claude] Se alcanzó el máximo de rondas de tools sin respuesta final');
  return 'Perdón, se me complicó revisar eso. ¿Me lo repetís o preferís que te pase con alguien del equipo?';
}

const MAX_TOOL_ROUNDS = 4;

function buildSystemPrompt(botConfig = {}, knowledgeBase, orderInfo, orderRef, customerContext, availableLabels = [], areas = [], customerTags = [], hasClasesTool = false, orderFromCache = false) {
  const botName = botConfig.botName || DEFAULT_BOT_NAME;
  const businessName = botConfig.businessName || DEFAULT_BUSINESS_NAME;
  const personality = botConfig.botPersonality || DEFAULT_PERSONALITY;

  let prompt = `Sos el asistente virtual de ${businessName}. Tu nombre es ${botName}.\n${personality}`;
  // Fuera de `personality` a propósito: botPersonality se puede pisar desde
  // el panel y estas reglas tienen que valer siempre.
  prompt += `\n\nREGLA — LOS LUGARES SE COMPRAN EN LA WEB: Por este chat no se reservan, apartan ni guardan lugares y no se toman pagos. Las clases (y las gift cards) se compran únicamente en la tienda online. Nunca digas que "anotaste" a alguien ni que le guardás un lugar — si quiere ir, mandale el link de la clase o, mejor, el carrito armado con armar_carrito: la compra la termina en la web y ahí queda confirmado su lugar.`;
  prompt += `\n\nFORMATO: Escribís para WhatsApp. Para negrita usá UN solo asterisco (*así*), nunca dos (**así**) — no uses títulos con # ni otro markdown.`;
  prompt += HANDOFF_INSTRUCTIONS;
  prompt += `\n\nIMPORTANTE — MENSAJES DEL EQUIPO: Los mensajes que empiezan con "${AGENT_PREFIX}" los escribió alguien del equipo, no vos. Tomá lo que dicen como hecho (si dicen que ya resolvieron algo, está resuelto). Si el cliente solo agradece o confirma algo que el equipo ya resolvió, no vuelvas a derivar: respondé corto y cerrá con [CERRAR]. Nunca repitas ese prefijo en tu respuesta.`;
  if (knowledgeBase) {
    prompt += `\n\n--- INFORMACIÓN DE LA EMPRESA ---\n${knowledgeBase}`;
    prompt += `\n\nIMPORTANTE — USO DE ESTA INFORMACIÓN: Es TU ÚNICA fuente de verdad sobre servicios, precios, procesos y políticas. Antes de responder CUALQUIER consulta, revisá esta sección completa primero. Si algo aplica, compartilo directamente aunque el cliente no lo pida explícitamente. Si la consulta no está cubierta acá, NUNCA inventes ni supongas una respuesta — decí que no tenés esa info y dale lo más útil que tengas (un link, dónde verlo en la web). Derivá solo si el cliente quiere hablar con alguien o si hace falta que el equipo haga algo.
Los items marcados con 🔥 son promociones, novedades o servicios que queremos impulsar activamente: mencionalos cuando la charla toque algo relacionado (clases, turnos, precios, o si el cliente está por decidir), aunque no pregunte por eso puntualmente. No hace falta que el tema calce exacto — la idea es aprovechar la oportunidad. Eso sí, no lo repitas en cada mensaje: si ya lo mencionaste en esta conversación, no lo vuelvas a meter salvo que el cliente pregunte de nuevo.`;
  }
  // Caché de prompt: `prompt` junta lo que es IGUAL para todos los clientes y
  // va en un bloque cacheado (~10% del costo); `dyn` junta lo que cambia por
  // cliente/mensaje (perfil, pedido, stock, ficha) y va al final, sin caché.
  // No meter nada variable en `prompt`: rompe el caché para todos.
  let dyn = '';
  if (customerContext) dyn += `\n\n--- PERFIL DEL CONTACTO ---\n${customerContext}`;

  prompt += `\n\nREGLA CRÍTICA SOBRE PEDIDOS: NUNCA inventes, sugieras ni adivines números de pedido, fechas, productos o clientes. Toda la información de pedidos que compartís tiene que venir EXCLUSIVAMENTE de la sección "INFORMACIÓN DEL PEDIDO CONSULTADO" de este prompt — si esa sección no está presente, es porque no hay datos reales, y ahí no podés afirmar ni sugerir que encontraste un pedido, aunque el número se parezca a algo mencionado antes. Si el cliente menciona un pedido/compra y no tenés información del pedido en este prompt, pedile el número de pedido (puede mandarlo con o sin "#", solo el número alcanza) para buscarlo. Si no lo tiene a mano o ya lo buscaste y no apareció, como último recurso pedile el email con el que compró.`;
  if (orderInfo) {
    dyn += `\n\n--- INFORMACIÓN DEL PEDIDO CONSULTADO ---\n${JSON.stringify(orderInfo, null, 2)}`;
    dyn += orderFromCache
      ? `\n\nEste es el pedido del que se viene hablando en esta conversación (consultado en Tienda Nube hace un rato). Seguí usándolo con normalidad: no te desdigas de lo que ya le informaste al cliente.`
      : `\n\nEsta información se acaba de consultar en este mismo turno y es la más actualizada que existe. Si en mensajes anteriores dijiste que no encontrabas el pedido, ESO YA NO APLICA — ahora sí lo tenés, usalo con normalidad.`;
    dyn += `\n\nGuía para interpretar el pedido:
- Cada pedido es una compra de lugares para una clase (fecha y horario en los productos) o una gift card.
- pago "pagado" → la compra está confirmada y el lugar es suyo; la entrada le llega por mail al email de la compra (si no la ve, que revise spam/promociones).
- pago "pendiente de pago" → el lugar todavía no está confirmado: falta acreditar el pago.
- estado "cancelado" o pago "anulado"/"reembolsado" → no tiene lugar; si pregunta por la devolución, derivá.
- Ignorá cualquier dato de envío o tracking: acá no se envía nada físico.
- Si hay nota en el pedido, tenerla en cuenta para dar contexto.`;
  } else if (orderRef) {
    dyn += `\n\n--- BÚSQUEDA DE PEDIDO "#${orderRef}" ---\nSe intentó buscar este pedido en Tienda Nube AHORA MISMO y NO se encontró ningún resultado. No existe. No inventes un número, fecha, cliente o producto alternativo por más que "te suene" a algo — decile honestamente al cliente que no lo encontraste. Pedile que confirme bien el número de pedido, o como alternativa el email con el que compró.`;
  }
  if (hasClasesTool) {
    prompt += `\n\n--- CLASES (fechas, horarios y lugares) ---
Tenés la herramienta buscar_clases, que consulta la tienda online EN VIVO: próximas clases con fecha, lugar, horarios, lugares libres, precio y link.
- Usala SIEMPRE que pregunten cuándo hay clases, horarios, si quedan lugares, dónde son o cuánto salen. Nunca digas fechas, horarios, lugares libres ni precios de memoria o de mensajes viejos: consultá.
- Si preguntan por un día o un mes puntual, pasá desde/hasta (YYYY-MM-DD). La herramienta te dice qué día es hoy.
- "Completa" = no quedan lugares en ese horario: ofrecé otro horario u otra fecha. "Quedan N lugares" se puede decir tal cual (ayuda a que no se lo pierdan); con "Hay lugares" no digas cantidades.
- Si no hay clases publicadas para lo que busca, decilo y contale que las fechas nuevas se publican en la tienda; no inventes próximas fechas.
- Mostrá las opciones cortas y claras: fecha, lugar y horarios con lugares, sin listar todo si preguntó por algo puntual.

--- LINKS Y CARRITO ---
- Cada clase trae "Link:" — pasalo tal cual cuando informás una clase (nunca lo inventes ni lo armes vos).
- [producto_id …] y [variante_id …] son de uso interno: nunca se los muestres al cliente.
- Cuando el cliente elige fecha y horario, preguntale para cuántas personas (si no lo dijo) y usá armar_carrito con esa variante (horario) y la cantidad de lugares. Mandale ese link: "Te dejo el carrito listo 👉 <link>" y en la línea siguiente que al abrirlo complete sus datos y pague para confirmar su lugar.
- Si armar_carrito devuelve un error (sin lugares para esa cantidad, etc.), contale qué pasó y ofrecé otro horario o fecha.
- Ojo: cada vez que se abre, el link SUMA lo que trae al carrito (abrirlo dos veces duplica). Si cambia de horario o cantidad, no mandes otro link: decile que lo ajuste en el carrito (con − / + o el tachito), o que lo vacíe y le armás uno nuevo.`;
  }
  if (availableLabels.length) {
    prompt += `\n\n--- ETIQUETAS ---\nDEBÉS etiquetar SIEMPRE esta conversación con al menos 1 etiqueta usando [LABEL:nombre] en tu respuesta (invisible para el cliente).
Etiquetas disponibles: ${availableLabels.join(', ')}.
Si ninguna aplica, creá una nueva con [NEW_LABEL:nombre] (ej: [NEW_LABEL:Consulta técnica]).
Guía:
- [LABEL:Lead] → interesado nuevo, todavía no es cliente.
- [LABEL:Consulta] → preguntas generales sobre servicios o funcionamiento.
- [LABEL:Soporte] → cliente existente con una duda o problema puntual.
- [LABEL:Reclamo] → queja o insatisfacción.
Podés combinar varias etiquetas si aplica.`;
  }

  // --- Tags de CONTACTO (persisten entre conversaciones, sirven para segmentar
  //     difusiones). A diferencia de las etiquetas de conversación, NO son
  //     obligatorios: solo taggeás si el mensaje da una señal clara.
  {
    const guide = (botConfig.customerTagsGuide || '').trim();
    const existing = (customerTags || []).filter(Boolean);
    prompt += `\n\n--- TAGS DE CONTACTO ---
Si en el mensaje aparece una señal CLARA sobre quién es este cliente, agregale un tag con [TAG:nombre] (invisible para el cliente). NO inventes si no hay señal — es opcional.
Categorías:
- Interés: Clase con perritos, Gift card, Cumpleaños / evento privado, Empresas.
- Perfil: Primera vez, Ya vino a una clase, Viene con amigos, Tiene perro.
- Comportamiento: Recurrente, Reclamó.`;
    if (existing.length) prompt += `\nTags que ya se usan (reusá estos si aplican, respetando cómo están escritos): ${existing.join(', ')}.`;
    prompt += `\nSi ninguno encaja y la señal es clara, creá uno con [NEW_TAG:nombre].`;
    if (guide) prompt += `\nGuía del negocio:\n${guide}`;
  }

  const blocks = [{ type: 'text', text: prompt, cache_control: { type: 'ephemeral' } }];
  if (dyn.trim()) blocks.push({ type: 'text', text: dyn.trim() });
  return blocks;
}

function buildMessages(conversationHistory, newMessage, imageData = null) {
  const messages = historyToMessages(conversationHistory ?? []);
  if (imageData) {
    messages.push({
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: imageData.mimeType, data: imageData.base64 } },
        { type: 'text', text: newMessage || 'Describí esta imagen en el contexto de la consulta del cliente.' },
      ],
    });
  } else {
    messages.push({ role: 'user', content: newMessage });
  }
  return messages;
}
