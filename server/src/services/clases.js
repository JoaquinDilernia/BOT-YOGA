// Clases de Yoga y Patitas a partir del catálogo de TiendaNube: cada producto
// es una fecha de clase ("Sábado 24 de Octubre • Palermo • Mario Bravo 1029")
// y cada variante un horario, con el stock como lugares libres. Mismo formato
// que lee el panel de turnos (TURNOS-YOGA/src/tiendanube.js — parseProductName
// es copia de esa función: si cambia el formato de los nombres, cambiar las dos).

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DAYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const nameOf = (p) => (typeof p.name === 'string' ? p.name : (p.name?.es ?? Object.values(p.name ?? {})[0] ?? ''));
const variantLabel = (v) => (v.values ?? []).map((x) => x?.es ?? Object.values(x ?? {})[0]).filter(Boolean).join(' · ');

// Pocos lugares: a partir de acá se le dice al cliente cuántos quedan
const FEW_SPOTS = 5;

export function parseProductName(name, refDate) {
  const [dayPart, ...rest] = name.split('•').map((s) => s.trim());
  const m = norm(dayPart).match(/(\d{1,2})\s+de\s+([a-z]+)/);
  const month = m ? MONTHS.indexOf(m[2]) : -1;
  if (!m || month < 0) return { date: null, title: name, place: '' };
  const day = Number(m[1]);
  const weekday = DAYS.findIndex((d) => norm(dayPart).startsWith(d));
  const ref = new Date(refDate || Date.now());
  // El nombre no trae año: probamos el año de referencia y el siguiente, priorizando el que coincide con el día de semana
  const candidates = [ref.getUTCFullYear(), ref.getUTCFullYear() + 1, ref.getUTCFullYear() - 1];
  let year = candidates.find((y) => weekday >= 0 && new Date(Date.UTC(y, month, day)).getUTCDay() === weekday);
  if (!year) year = month < ref.getUTCMonth() - 1 ? ref.getUTCFullYear() + 1 : ref.getUTCFullYear();
  const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { date, title: dayPart, place: rest.join(' • ') };
}

const startMinutes = (time = '') => {
  const m = time.match(/(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 9999;
};

// Fecha de hoy en Argentina (YYYY-MM-DD): una clase de hoy sigue apareciendo todo el día
export const todayAR = (now = new Date()) => new Date(now.getTime() - 3 * 3600e3).toISOString().slice(0, 10);

function spots(v) {
  if (v.stock_management === false || v.stock === null || v.stock === undefined) return { free: null, label: 'Hay lugares' };
  if (v.stock <= 0) return { free: 0, label: 'Completa' };
  if (v.stock <= FEW_SPOTS) return { free: v.stock, label: `Quedan ${v.stock} lugar${v.stock === 1 ? '' : 'es'}` };
  return { free: v.stock, label: 'Hay lugares' };
}

/**
 * Separa el catálogo en clases (productos con fecha, de hoy en adelante) y
 * otros productos (gift cards, etc.).
 * @param {Array} products - productos publicados de TiendaNube (con variants)
 * @param {{ now?: Date }} [opts]
 */
export function buildClases(products, { now = new Date() } = {}) {
  const today = todayAR(now);
  const clases = [];
  const otros = [];
  for (const p of products ?? []) {
    if (p.published === false) continue;
    const parsed = parseProductName(nameOf(p), p.created_at);
    if (!parsed.date) {
      otros.push(p);
      continue;
    }
    if (parsed.date < today) continue;
    for (const v of p.variants ?? []) {
      const s = spots(v);
      clases.push({
        date: parsed.date,
        title: parsed.title,
        place: parsed.place,
        time: variantLabel(v),
        free: s.free,
        spotsLabel: s.label,
        price: Number(v.promotional_price) > 0 && Number(v.promotional_price) < Number(v.price) ? Number(v.promotional_price) : Number(v.price) || null,
        productId: p.id,
        variantId: v.id,
        url: p.canonical_url || '',
      });
    }
  }
  clases.sort((a, b) => a.date.localeCompare(b.date) || startMinutes(a.time) - startMinutes(b.time) || a.place.localeCompare(b.place));
  return { clases, otros };
}

/** Filtra por rango de fechas (YYYY-MM-DD, inclusive) y por texto en el lugar/barrio. */
export function filterClases(clases, { desde, hasta, lugar } = {}) {
  const q = lugar ? norm(String(lugar)).trim() : '';
  return clases.filter((c) =>
    (!desde || c.date >= desde)
    && (!hasta || c.date <= hasta)
    && (!q || norm(`${c.place} ${c.title}`).includes(q)));
}

const money = (n) => (Number.isFinite(n) && n > 0
  ? n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0 })
  : null);

const CLASES_LIMIT = 25;

/** Texto para la tool: clases agrupadas por fecha + otros productos (gift cards). */
export function formatClases(clases, otros = [], { limit = CLASES_LIMIT } = {}) {
  const parts = [];
  if (!clases.length) {
    parts.push('No hay clases publicadas para esas fechas.');
  } else {
    const shown = clases.slice(0, limit);
    const byProduct = new Map();
    for (const c of shown) {
      if (!byProduct.has(c.productId)) byProduct.set(c.productId, []);
      byProduct.get(c.productId).push(c);
    }
    for (const list of byProduct.values()) {
      const c0 = list[0];
      const head = `${c0.title}${c0.place ? ` — ${c0.place}` : ''} (${c0.date}) [producto_id ${c0.productId}]${c0.url ? `\nLink: ${c0.url}` : ''}`;
      const lines = list.map((c) => `- ${c.time || 'Horario único'}: ${c.spotsLabel}${money(c.price) ? ` — ${money(c.price)}` : ''} [variante_id ${c.variantId}]`);
      parts.push(`${head}\n${lines.join('\n')}`);
    }
    if (clases.length > shown.length) parts.push(`(Hay ${clases.length - shown.length} horario(s) más adelante; si busca otra fecha, consultá con desde/hasta.)`);
  }
  const extras = otros
    .map((p) => {
      const v = p.variants?.[0];
      const price = v ? money(Number(v.price)) : null;
      return `- ${nameOf(p)}${price ? ` — ${price}` : ''} [producto_id ${p.id}]${v ? ` [variante_id ${v.id}]` : ''}${p.canonical_url ? `\n  Link: ${p.canonical_url}` : ''}`;
    });
  if (extras.length) parts.push(`Otros productos de la tienda (gift cards, etc.):\n${extras.join('\n')}`);
  return parts.join('\n\n');
}
