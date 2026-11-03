import { parseReasonMarker } from './escalationReasons.js';
import { generateBotResponse, BOT_AUTONOMOUS } from './claude.service.js';
import { endsWithQuestion } from './closeGuard.js';
import { getKnowledgeBasePrompt } from './knowledge.service.js';
import {
  getOrCreateConversation,
  appendMessage,
  getConversationHistory,
  updateConversationStatus,
  updateHumanMode,
  updateAssignment,
  dispatchConversation,
  setUrgentFlag,
  addLabelToConversation,
} from './conversation.service.js';
import { sendWhatsAppMessage, sendInstagramMessage, downloadMediaAsBase64, downloadMetaMedia } from './meta.service.js';
import { transcribeAudio } from './transcription.service.js';
import { getOrCreateCustomer, buildCustomerContext, linkCustomerFromOrder, addTagsToCustomer, listAllTags } from './customer.service.js';
import { getAllLabels, createLabel } from './label.service.js';
import { getActiveAreas } from './area.service.js';
import { getDb } from './firebase.service.js';
import { toWaContactId } from './phone.js';
import { findOrder, findOrdersByEmail, formatOrderStatus, getProductById, getPublishedProducts } from './tiendanube.service.js';
import { buildClases, filterClases, formatClases } from './clases.js';
import { createCartLink } from './cart.js';
import { withCartUtm } from './cartAttribution.js';
import { recordBotCart } from './botCart.service.js';

const URGENCY_KEYWORDS = [
  /urgente/i, /urgencia/i, /reclamo/i, /estafa/i, /fraude/i,
  /muy enojad/i, /indignado/i, /hablar con una persona/i, /quiero hablar/i,
];

// Captura números de pedido de Tienda Nube. A diferencia de BOT-ALTORANCHO
// (que tiene Odoo con prefijos S/TN), Entreno es pura tienda online: todo
// pedido es un número puro. El número puede venir con o sin "#" y en
// cualquier parte del mensaje (ver [[project-bots]] por el patrón original).
const ORDER_REF_TOKEN = /#?(\d{3,})\b/;
const ORDER_BARE_NUMBER = /^#?(\d{3,})$/;
const ORDER_KEYWORD = /\b(pedido|orden|compra|n[uú]mero)\b/i;
const ORDER_INTENT_NO_NUMBER_PATTERNS = [
  /tracking/i,
  /donde\s*(está|esta)\s*(mi|el)\s*pedido/i,
  /estado\s*(de|del)\s*(mi|el)?\s*pedido/i,
  /cuándo\s*(llega|llega)/i,
  /mi\s+compra\b/i,
  /compr[eé]\s+(?:algo|un|una|el|la)\b/i,
];

// Returns true if current Argentina time is within business hours
export function isWithinBusinessHours(botConfig = {}) {
  const tz = 'America/Argentina/Buenos_Aires';
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
  const day = now.getDay(); // 0=Sun, 1=Mon ... 6=Sat
  const hour = now.getHours();
  const minute = now.getMinutes();
  const timeMin = hour * 60 + minute;

  const startH = botConfig.businessHoursStart ?? 9;
  const endH   = botConfig.businessHoursEnd   ?? 18;
  const days   = botConfig.businessDays        ?? [1, 2, 3, 4, 5]; // lun-vie

  return days.includes(day) && timeMin >= startH * 60 && timeMin < endH * 60;
}

function buildEscalationMessage(areaName, botConfig = {}) {
  const within = isWithinBusinessHours(botConfig);
  const startH = botConfig.businessHoursStart ?? 9;
  const endH   = botConfig.businessHoursEnd   ?? 18;
  const hoursStr = `${startH}:00 a ${endH}:00hs, lunes a viernes`;
  const label = areaName ? `*${areaName}*` : 'nuestro equipo';

  if (within) {
    return `Tu consulta fue derivada a ${label} 👋\n\nUn agente va a atenderte en breve. Por favor aguardá unos minutos.\n\n🕐 Horario de atención: ${hoursStr}.`;
  } else {
    return `Tu consulta fue derivada a ${label} 👋\n\nEn este momento estamos fuera del horario de atención (${hoursStr}). Tu mensaje fue registrado y un agente te va a responder cuando retomemos.\n\n¡Gracias por tu paciencia!`;
  }
}

function parseEscalationMarker(text, areas = []) {
  const markers = areas.map(a => ({
    re: new RegExp(`\\[ESCALAR_${a.id.toUpperCase()}\\]`, 'i'),
    assignTo: a.id,
  }));
  // Fallback genérico — si hay una sola área va a esa (si no, la derivación
  // quedaba sin asignar y no la veía nadie); con varias queda sin asignar
  // hasta que un agente la tome manualmente.
  markers.push({ re: /\[ESCALAR\]/i, assignTo: areas.length === 1 ? areas[0].id : null });

  for (const { re, assignTo } of markers) {
    if (!re.test(text)) continue;
    const withoutLine = text.replace(/^[^\n]*\[ESCALAR[^\]]*\][^\n]*\n?/mi, '').trim();
    const cleanText = withoutLine || text.replace(re, '').trim();
    return { shouldEscalate: true, assignTo, cleanText };
  }
  return { shouldEscalate: false, assignTo: null, cleanText: text };
}

function parseCloseMarker(text) {
  if (/\[CERRAR\]/i.test(text)) {
    return { shouldClose: true, cleanText: text.replace(/\[CERRAR\]\s*/i, '').trim() };
  }
  return { shouldClose: false, cleanText: text };
}

function parseLabelMarkers(text) {
  const labels = [...text.matchAll(/\[LABEL:([^\]]+)\]/gi)].map(m => m[1].trim());
  const newLabels = [...text.matchAll(/\[NEW_LABEL:([^\]]+)\]/gi)].map(m => m[1].trim());
  const cleanText = text.replace(/\[(NEW_)?LABEL:[^\]]+\]/gi, '').trim();
  return { labels, newLabels, cleanText };
}

// [TAG:nombre]     -> agrega un tag EXISTENTE al contacto (doc de customers)
// [NEW_TAG:nombre] -> tag nuevo (mismo efecto de guardado; el split existe solo
//                     para poder loguear/distinguir como en los labels)
//
// Los tags de contacto persisten entre conversaciones y se usan para segmentar
// difusiones — distinto de los [LABEL:...], que clasifican la conversación.
function parseCustomerTagMarkers(text) {
  const s = typeof text === 'string' ? text : '';
  const tags = [...s.matchAll(/\[TAG:\s*([^\]]+?)\s*\]/gi)].map(m => m[1].trim()).filter(Boolean);
  const newTags = [...s.matchAll(/\[NEW_TAG:\s*([^\]]+?)\s*\]/gi)].map(m => m[1].trim()).filter(Boolean);
  const cleanText = s.replace(/\[(NEW_)?TAG:\s*[^\]]+?\s*\]/gi, '').replace(/[ \t]{2,}/g, ' ').trim();
  return { tags, newTags, cleanText };
}

// Claude escribe negrita en Markdown estándar (**texto**), pero WhatsApp
// solo reconoce un asterisco de cada lado (*texto*) — con doble asterisco
// el cliente ve los asteriscos literales en vez de texto en negrita.
function toWhatsAppBold(text) {
  return text.replace(/\*\*(.+?)\*\*/g, '*$1*');
}

// WhatsApp suele mandar mensajes de un mismo contacto en ráfagas de a
// segundos (varias burbujas separadas). Cada una llega como un webhook HTTP
// independiente y Express los procesa en paralelo, así que sin esta cola
// dos mensajes casi simultáneos disparan dos llamadas a Claude en paralelo
// con el mismo historial de partida. Serializamos por contactId.
const contactLocks = new Map();

export function processIncomingMessage(msg) {
  // Canonicalizar el teléfono ni bien entra. Meta manda el "from" de los
  // números argentinos a veces con el 9 de celular y a veces sin él; si no
  // lo normalizamos acá, la respuesta del cliente cae en un documento de
  // conversación distinto al de la plantilla que le mandamos y se ve como
  // dos chats separados. Solo aplica a WhatsApp — el "from" de Instagram
  // es un ID de usuario, no un teléfono.
  if (msg.channel === 'whatsapp' && msg.from) {
    const canonical = toWaContactId(msg.from);
    if (canonical) msg = { ...msg, from: canonical };
  }
  const contactId = msg.from;
  const previous = contactLocks.get(contactId) ?? Promise.resolve();
  const current = previous
    .catch(() => {})
    .then(() => processIncomingMessageInternal(msg))
    .finally(() => {
      if (contactLocks.get(contactId) === current) contactLocks.delete(contactId);
    });
  contactLocks.set(contactId, current);
  return current;
}

const REPLY_PREVIEW_MAX = 80;

function resolveReplyTo(history, replyToWaMsgId) {
  if (!replyToWaMsgId) return null;
  const original = history.find(m => m.waMsgId === replyToWaMsgId);
  if (!original) return null;
  const content = original.content ?? '';
  const preview = content.length > REPLY_PREVIEW_MAX
    ? `${content.slice(0, REPLY_PREVIEW_MAX)}…`
    : content;
  return { preview, role: original.role };
}

async function processIncomingMessageInternal(msg) {
  const { channel, from, type, mediaId, mediaUrl, contactName, messageId, replyToWaMsgId } = msg;
  let { text } = msg; // un audio transcripto pasa a ser el texto del mensaje
  // Datos del adjunto que se guardan junto al mensaje para que el panel pueda
  // mostrarlo (nombre del archivo, tipo, y la URL de CDN si vino de Instagram).
  const mediaFields = {
    mediaId: mediaId ?? null,
    ...(mediaUrl && { mediaUrl }),
    ...(msg.fileName && { fileName: msg.fileName }),
    ...(msg.mimeType && { mimeType: msg.mimeType }),
  };

  let conversation, history, knowledgeBase, customer, availableLabels, configDoc, areas, customerTags;
  try {
    [conversation, history, knowledgeBase, customer, availableLabels, configDoc, areas, customerTags] = await Promise.all([
      getOrCreateConversation(from, channel, contactName),
      getConversationHistory(from),
      getKnowledgeBasePrompt().catch(() => ''),
      getOrCreateCustomer(from, channel, contactName),
      getAllLabels().catch(() => []),
      getDb().collection('bot-yoga_config').doc('bot_config').get().catch(() => ({ exists: false, data: () => ({}) })),
      getActiveAreas().catch(() => []),
      listAllTags().catch(() => []),
    ]);
  } catch (err) {
    console.error('[bot] Error cargando contexto para', from, err.message);
    return;
  }
  const botConfig = configDoc.exists ? configDoc.data() : {};
  console.log(`[bot] Contexto cargado para ${from} — humanMode: ${conversation.humanMode}, status: ${conversation.status}`);
  const replyTo = resolveReplyTo(history, replyToWaMsgId);

  // Auto-reopen archived/resolved conversations when a new message arrives → always goes to bot
  const isArchived = ['resolved', 'bot_archived'].includes(conversation.status)
    || conversation.status === 'urgent'; // legacy urgent status
  if (isArchived) {
    const previousStatus = conversation.status;
    await Promise.all([
      updateConversationStatus(from, 'bot'),
      updateHumanMode(from, false),
      updateAssignment(from, null),
      // Arranca un ciclo nuevo: una derivación de una charla anterior no tiene
      // que hacer que esta cuente como "resuelta por agente" (statsAggregate).
      getDb().collection('bot-yoga_conversations').doc(from).update({ cycleStartedAt: new Date() }),
    ]);
    conversation.status = 'bot';
    conversation.humanMode = false;
    conversation.assignedTo = null;
    console.log(`[bot] Conversación ${from} reabierta automáticamente desde '${previousStatus}'`);
  }

  if (conversation.humanMode) {
    const SAVEABLE_MEDIA = { image: true, audio: true, video: true, document: true, sticker: true };
    if (SAVEABLE_MEDIA[type]) {
      const contentMap = {
        image:    text?.trim() ? `[Imagen] ${text}` : '[Imagen recibida]',
        audio:    '[Audio recibido]',
        video:    '[Video recibido]',
        document: msg.fileName ? `[Archivo: ${msg.fileName}]` : '[Archivo recibido]',
        sticker:  '[Sticker]',
      };
      const caption = type !== 'image' && text?.trim() ? ` ${text.trim()}` : '';
      await appendMessage(from, {
        role: 'user',
        content: contentMap[type] + caption,
        mediaType: type,
        ...mediaFields,
        contactName,
        messageId,
        ...(replyTo && { replyTo }),
      });
    } else if (text?.trim()) {
      await appendMessage(from, { role: 'user', content: text, contactName, messageId, ...(replyTo && { replyTo }) });
    }
    console.log(`[bot] humanMode activo para ${from} — bot silenciado`);
    return;
  }

  // --- Non-text type handling ---
  // Notas de voz: se transcriben y el bot las contesta como texto. Si no se
  // pudo transcribir, se avisa como antes.
  let yaGuardado = false;
  if (type === 'audio') {
    const transcript = await transcribeIncomingAudio({ mediaId, mediaUrl });
    if (transcript) {
      await appendMessage(from, { role: 'user', content: '[Audio recibido]', transcript, mediaType: 'audio', ...mediaFields, contactName, messageId, ...(replyTo && { replyTo }) });
      text = `[Audio transcripto] ${transcript}`;
      yaGuardado = true;
      console.log(`[bot] Audio de ${from} transcripto (${transcript.length} chars)`);
    }
  }
  if (type === 'audio' && !yaGuardado) {
    const prevAudios = history.filter(m => m.role === 'user' && m.mediaType === 'audio').length;
    const audioUserMsg = '[Audio recibido]';
    await appendMessage(from, { role: 'user', content: audioUserMsg, mediaType: 'audio', ...mediaFields, contactName, messageId, ...(replyTo && { replyTo }) });

    let reply;
    if (prevAudios >= 1) {
      reply = 'Entiendo que preferís los audios — lamentablemente no puedo escucharlos. ¿Querés que te pase con un agente que pueda ayudarte mejor?';
      await setUrgentFlag(from, true);
    } else {
      reply = 'Hola! Recibí tu audio pero no puedo escucharlo 🎙️ ¿Podés contarme por escrito en qué te ayudo?';
    }
    await appendMessage(from, { role: 'assistant', content: reply });
    if (channel === 'whatsapp') await sendWhatsAppMessage(from, reply);
    else if (channel === 'instagram') await sendInstagramMessage(from, reply);
    return;
  }

  // Videos/stickers sin texto: el bot no tiene nada que contestar, pero se
  // guardan igual — antes se descartaban y el agente nunca los veía.
  if ((type === 'video' || type === 'sticker') && !text?.trim()) {
    await appendMessage(from, { role: 'user', content: type === 'video' ? '[Video recibido]' : '[Sticker]', mediaType: type, ...mediaFields, contactName, messageId, ...(replyTo && { replyTo }) });
    return;
  }

  if (type === 'document') {
    const reply = 'Recibí un archivo, pero no puedo procesarlo directamente. ¿Podés contarme por escrito en qué te ayudo?';
    // mediaId se guardaba acá antes — sin él, el archivo (ej: un PDF) quedaba
    // imposible de ver o descargar después desde el panel.
    const docLabel = msg.fileName ? `[Archivo: ${msg.fileName}]` : '[Archivo recibido]';
    await appendMessage(from, { role: 'user', content: text?.trim() ? `${docLabel} ${text.trim()}` : docLabel, mediaType: 'document', ...mediaFields, contactName, messageId, ...(replyTo && { replyTo }) });
    await appendMessage(from, { role: 'assistant', content: reply });
    if (channel === 'whatsapp') await sendWhatsAppMessage(from, reply);
    else if (channel === 'instagram') await sendInstagramMessage(from, reply);
    return;
  }

  // --- Image: download and pass to Claude ---
  let imageData = null;
  if (type === 'image') {
    if (mediaId) {
      imageData = await downloadMediaAsBase64(mediaId).catch(() => null);
    } else if (mediaUrl) {
      try {
        const axios = (await import('axios')).default;
        const { data: buffer } = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
        imageData = { base64: Buffer.from(buffer).toString('base64'), mimeType: 'image/jpeg' };
      } catch { /* continue without image */ }
    }
    const userContent = text?.trim() ? `[Imagen] ${text}` : '[Imagen recibida]';
    await appendMessage(from, { role: 'user', content: userContent, mediaType: 'image', ...mediaFields, contactName, messageId, ...(replyTo && { replyTo }) });
  } else if (!yaGuardado) {
    if (!text?.trim()) return;
    const isMediaWithCaption = type === 'video' || type === 'sticker';
    await appendMessage(from, {
      role: 'user',
      content: isMediaWithCaption ? `[Video] ${text}` : text,
      ...(isMediaWithCaption && { mediaType: type, ...mediaFields }),
      contactName, messageId, ...(replyTo && { replyTo }),
    });
  }

  // Detect urgency keywords and flag (as urgent flag, not status change)
  const isUrgent = text && URGENCY_KEYWORDS.some(re => re.test(text));
  if (isUrgent && !conversation.urgent) {
    setUrgentFlag(from, true).catch(() => {});
  }

  const orderContext = await resolveOrderContext(text ?? '', customer, conversation);
  const customerContext = buildCustomerContext(customer);

  if (orderContext.tnCustomer) {
    linkCustomerFromOrder(from, orderContext.tnCustomer).catch(err =>
      console.error('[bot] linkCustomerFromOrder error:', err.message)
    );
  }
  if (orderContext.orderRef && !orderContext.fromCache) {
    getDb().collection('bot-yoga_conversations').doc(from)
      .update({
        lastOrderRef: orderContext.orderRef,
        // Snapshot para los mensajes siguientes de la charla (ver cachedOrderContext).
        lastOrderInfo: orderContext.orderInfo ? JSON.stringify(orderContext.orderInfo) : null,
        lastOrderAt: new Date(),
      })
      .catch(() => {});
  }

  console.log(`[bot] Llamando a Claude para ${from}`);
  let botReply;
  try {
    botReply = await generateBotResponse(text ?? '', history, {
      knowledgeBase,
      orderInfo: orderContext.orderInfo,
      orderRef: orderContext.orderRef,
      orderFromCache: !!orderContext.fromCache,
      customerContext,
      availableLabels: availableLabels.map(l => l.name),
      customerTags,
      botConfig,
      imageData,
      areas,
      tools: [CLASES_TOOL, CART_TOOL],
      runTool: (name, input) => runBotTool(name, input, { contactId: from }),
    });
  } catch (err) {
    console.error(`[bot] Claude falló definitivamente para ${from} tras reintentos:`, err.message);
    const fallbackMsg = BOT_AUTONOMOUS
      ? 'Uy, se me complicó responderte recién 🙏 ¿Me escribís de nuevo en un ratito? Mientras tanto tenés fechas y entradas en www.yogaypatitas.com'
      : 'Estamos con un poquito de demora en este momento, ¡ya te contestamos! 🙏';
    await appendMessage(from, { role: 'assistant', content: fallbackMsg });
    await setUrgentFlag(from, true).catch(() => {});
    if (channel === 'whatsapp') await sendWhatsAppMessage(from, fallbackMsg).catch(() => {});
    else if (channel === 'instagram') await sendInstagramMessage(from, fallbackMsg).catch(() => {});
    return;
  }
  console.log(`[bot] Claude respondió (${botReply.length} chars) para ${from}`);

  const { reason: escalationReason, detail: escalationDetail, cleanText: textAfterReason } = parseReasonMarker(botReply);
  const { shouldEscalate: wantsEscalate, assignTo, cleanText: textAfterEscalation } = parseEscalationMarker(textAfterReason, areas);
  // Bot 100% autónomo: el marcador se limpia del texto pero nunca pasa a humano.
  const shouldEscalate = wantsEscalate && !BOT_AUTONOMOUS;
  if (wantsEscalate && BOT_AUTONOMOUS) console.log(`[bot] [ESCALAR] ignorado para ${from}: bot autónomo`);
  const { shouldClose: closeMarker, cleanText: textAfterClose } = parseCloseMarker(textAfterEscalation);
  const { labels: botLabels, newLabels: botNewLabels, cleanText: textAfterLabels } = parseLabelMarkers(textAfterClose);
  const { tags: botTags, newTags: botNewTags, cleanText: textAfterTags } = parseCustomerTagMarkers(textAfterLabels);
  const cleanText = toWhatsAppBold(textAfterTags);
  const shouldClose = closeMarker && !endsWithQuestion(cleanText);
  if (closeMarker && !shouldClose) console.log(`[bot] [CERRAR] ignorado para ${from}: la respuesta termina en pregunta`);

  await appendMessage(from, { role: 'assistant', content: cleanText });

  if (botNewLabels.length > 0) {
    await Promise.all(botNewLabels.map(l => createLabel(l, '#6b7280').then(() => addLabelToConversation(from, l))));
    console.log(`[bot] Nuevas labels creadas y aplicadas a ${from}:`, botNewLabels);
  }
  const allBotTags = [...botTags, ...botNewTags];
  if (allBotTags.length > 0) {
    const applied = await addTagsToCustomer(from, allBotTags).catch(err => {
      console.error(`[bot] Error agregando tags al contacto ${from}:`, err.message);
      return [];
    });
    if (applied.length) console.log(`[bot] Tags de contacto aplicados a ${from}:`, applied);
  }
  if (botLabels.length > 0) {
    await Promise.all(botLabels.map(l => addLabelToConversation(from, l)));
    console.log(`[bot] Labels aplicadas a ${from}:`, botLabels);
  }

  if (channel === 'whatsapp') {
    if (!cleanText.trim()) {
      console.warn(`[bot] cleanText vacío para ${from} — no se envía a WPP`);
    } else {
      try {
        console.log(`[bot] Enviando WPP a ${from}: ${cleanText.substring(0, 60)}`);
        await sendWhatsAppMessage(from, cleanText);
        console.log(`[bot] WPP enviado OK a ${from}`);
      } catch (sendErr) {
        console.error(`[bot] ERROR enviando WPP a ${from}:`, sendErr.response?.data ?? sendErr.message);
      }
    }
  } else if (channel === 'instagram') {
    if (cleanText.trim()) {
      try {
        await sendInstagramMessage(from, cleanText);
      } catch (sendErr) {
        console.error(`[bot] ERROR enviando IG a ${from}:`, sendErr.response?.data ?? sendErr.message);
      }
    }
  }

  if (shouldEscalate) {
    await dispatchConversation(from, {
      status: 'escalated',
      humanMode: true,
      assignedTo: assignTo ?? null,
      escalationReason: escalationReason ?? 'otro',
      escalationDetail,
    });
    console.log(`[bot] Escalando ${from} → área: ${assignTo ?? 'sin asignar'}`);

    const areaName = areas.find(a => a.id === assignTo)?.name ?? null;
    const escalationMsg = buildEscalationMessage(areaName, botConfig);
    try {
      await appendMessage(from, { role: 'assistant', content: escalationMsg });
      if (channel === 'whatsapp') await sendWhatsAppMessage(from, escalationMsg);
      else if (channel === 'instagram') await sendInstagramMessage(from, escalationMsg);
    } catch (err) {
      console.error('[bot] Error enviando mensaje de escalación:', err.message);
    }
  } else if (shouldClose) {
    await updateConversationStatus(from, 'resolved');
    console.log(`[bot] Conversación ${from} resuelta por el bot`);
  }
}

// Las clases salen del catálogo de TiendaNube (cada producto es una fecha y
// cada variante un horario, ver clases.js). El bot las consulta con esta tool
// en vez de inyectarlas siempre en el prompt: solo cuando hace falta.
export const CLASES_TOOL = {
  name: 'buscar_clases',
  description: 'Consulta EN VIVO en la tienda online las próximas clases (fecha, lugar, horarios y lugares libres por horario, precio y link para comprar) y los otros productos de la tienda (gift cards). Sin filtros trae las próximas clases desde hoy.',
  input_schema: {
    type: 'object',
    properties: {
      desde: { type: 'string', description: 'Fecha mínima YYYY-MM-DD (opcional)' },
      hasta: { type: 'string', description: 'Fecha máxima YYYY-MM-DD (opcional)' },
      lugar: { type: 'string', description: 'Barrio o sede, ej "Palermo" (opcional)' },
    },
  },
};

// Arma el carrito, le suma las UTM del bot (Analytics / TiendaNube) y lo
// registra para la estadística de carritos — si el registro falla, el link
// se manda igual.
async function buildAndRecordCart(productos, contactId) {
  const result = await createCartLink(productos, getProductById);
  if (result.error) return result;
  const link = withCartUtm(result.link);
  if (contactId) {
    await recordBotCart({ contactId, link, items: result.items, total: result.total })
      .catch(err => console.error('[bot] No se pudo registrar el carrito:', err.message));
  }
  return { link, detalle: result.detalle };
}

// El bot nunca escribe el link del carrito: pide variantes y cantidades y
// cart.js las valida contra TiendaNube y arma el cart-link.
export const CART_TOOL = {
  name: 'armar_carrito',
  description: 'Arma un link al carrito de la tienda online con los lugares ya cargados (cada variante es un horario de una clase; cantidad = cantidad de personas), para que el cliente solo complete sus datos y pague. Usá producto_id y variante_id exactamente como los devuelve buscar_clases. Si el horario no existe o no tiene lugares suficientes, no arma nada y te dice por qué.',
  input_schema: {
    type: 'object',
    properties: {
      productos: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          properties: {
            producto_id: { type: 'integer' },
            variante_id: { type: 'integer', description: 'El horario elegido' },
            cantidad: { type: 'integer', minimum: 1 },
          },
          required: ['producto_id', 'variante_id', 'cantidad'],
        },
      },
    },
    required: ['productos'],
  },
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function runBotTool(name, input, { contactId = null } = {}) {
  if (name === 'armar_carrito') return buildAndRecordCart(input?.productos, contactId);
  if (name !== 'buscar_clases') return { error: `Herramienta desconocida: ${name}` };
  const desde = DATE_RE.test(input?.desde ?? '') ? input.desde : undefined;
  const hasta = DATE_RE.test(input?.hasta ?? '') ? input.hasta : undefined;
  const { clases, otros } = buildClases(await getPublishedProducts());
  return { hoy: new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), resultado: formatClases(filterClases(clases, { desde, hasta, lugar: input?.lugar }), otros) };
}

/**
 * Resuelve si el mensaje hace referencia a un pedido y lo busca en Tienda
 * Nube. Versión simplificada de la de BOT-ALTORANCHO (ver [[project-bots]]):
 * Entreno no tiene Odoo ni locales físicos, así que todo pedido se busca
 * ÚNICA Y EXCLUSIVAMENTE en TiendaNube, por número o por email.
 */
async function resolveOrderContext(text, customer, conversation = {}) {
  const trimmed = text.trim();

  if (trimmed.includes('@')) {
    const tnOrders = await findOrdersByEmail(trimmed);
    if (tnOrders.length) {
      const summary = tnOrders.map(o => formatOrderStatus(o)).filter(Boolean);
      return { orderInfo: summary, tnCustomer: tnOrders[0]?.customer ?? null };
    }
    return { orderInfo: null, tnCustomer: null };
  }

  // Mensaje es directamente el número (con o sin "#"), ej: bot preguntó
  // "¿número de pedido?" y el cliente contesta solo "20610" o "#20610".
  const bareMatch = trimmed.match(ORDER_BARE_NUMBER);

  // Palabra clave de pedido en cualquier parte del mensaje + número en
  // cualquier parte del mensaje (no hace falta que estén pegados).
  const hasKeyword = ORDER_KEYWORD.test(trimmed);
  const tokenMatch = trimmed.match(ORDER_REF_TOKEN);

  const orderRef = bareMatch?.[1] ?? (hasKeyword && tokenMatch ? tokenMatch[1] : null);

  if (orderRef) {
    const result = await searchOrderByRef(orderRef, customer?.tnEmail);
    return { ...result, orderRef };
  }

  // Hay intención de consultar un pedido/compra pero sin número — priorizar
  // la última orden mencionada en esta conversación, luego la del perfil.
  const hasIntentWithoutNumber = hasKeyword || ORDER_INTENT_NO_NUMBER_PATTERNS.some(re => re.test(trimmed));
  if (hasIntentWithoutNumber) {
    const fallbackRef = conversation.lastOrderRef ?? String(customer?.tnOrders?.[0]?.number ?? '');
    if (fallbackRef) {
      console.log(`[bot] Sin número en mensaje, usando orden del contexto: #${fallbackRef}`);
      const result = await searchOrderByRef(fallbackRef, customer?.tnEmail);
      return { ...result, orderRef: fallbackRef };
    }
    return { orderInfo: null, tnCustomer: null };
  }

  // Seguimiento de la charla sobre un pedido ya consultado ("porque la otra
  // vez tardó una semana"): sin esto el prompt no trae el pedido, la regla de
  // "no inventes pedidos" hace que el bot se desdiga de lo que ya contestó y
  // termina derivando. Se reusa la última consulta guardada, sin volver a TN.
  const cached = cachedOrderContext(conversation);
  if (cached) return cached;

  return { orderInfo: null, tnCustomer: null };
}

const ORDER_CACHE_TTL_MS = 2 * 60 * 60 * 1000;

function cachedOrderContext(conversation = {}) {
  const { lastOrderRef, lastOrderInfo, lastOrderAt } = conversation;
  if (!lastOrderRef || !lastOrderInfo || !lastOrderAt) return null;
  const at = lastOrderAt?.toDate ? lastOrderAt.toDate() : new Date(lastOrderAt);
  if (!(Date.now() - at.getTime() < ORDER_CACHE_TTL_MS)) return null;
  try {
    return { orderInfo: JSON.parse(lastOrderInfo), orderRef: lastOrderRef, tnCustomer: null, fromCache: true };
  } catch {
    return null;
  }
}

async function searchOrderByRef(orderRef, email = null) {
  const tnOrder = await findOrder(orderRef);

  if (tnOrder) {
    console.log(`[bot] Pedido #${orderRef} encontrado en TiendaNube (TN id: ${tnOrder.id})`);
    return { orderInfo: formatOrderStatus(tnOrder), tnCustomer: tnOrder.customer ?? null };
  }

  // Último recurso: si ya sabemos el email del cliente en esta conversación,
  // reintentar por email — cubre pedidos 'open' que q= no indexa y que la
  // paginación por número puede fallar en encontrar bajo tráfico alto.
  if (email) {
    console.log(`[bot] Pedido #${orderRef} no encontrado, reintentando por email conocido (${email})`);
    const emailOrders = await findOrdersByEmail(email);
    const match = emailOrders.find(o => String(o.number) === orderRef);
    if (match) {
      console.log(`[bot] Pedido #${orderRef} encontrado vía email conocido`);
      return { orderInfo: formatOrderStatus(match), tnCustomer: match.customer ?? null };
    }
  }

  return { orderInfo: null, tnCustomer: null };
}

// WhatsApp manda el mediaId; Instagram, una URL directa. null si no se pudo
// transcribir o el audio vino vacío (el llamador cae al aviso de antes).
async function transcribeIncomingAudio({ mediaId, mediaUrl }) {
  try {
    let buffer, mimeType;
    if (mediaId) {
      ({ buffer, mimeType } = await downloadMetaMedia(mediaId));
    } else if (mediaUrl) {
      const axios = (await import('axios')).default;
      const res = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
      buffer = Buffer.from(res.data);
      mimeType = res.headers['content-type'] || 'audio/mp4';
    } else {
      return null;
    }
    const transcript = String(await transcribeAudio(buffer, mimeType) ?? '').trim();
    return transcript || null;
  } catch (err) {
    console.error('[bot] No se pudo transcribir el audio:', err.response?.data ?? err.message);
    return null;
  }
}
