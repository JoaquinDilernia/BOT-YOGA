// KB del bot de Yoga y Patitas en bot-yoga_knowledge_base + personalidad.
// Base: la KB que mandó Marcos (2026-11-03). Revisada el 2026-11-04 con los
// datos reales de la tienda, el mail de entradas (TURNOS-YOGA/src/entradas) y
// las fechas publicadas:
// - Este WhatsApp ES el canal oficial (número nuevo; el anterior se perdió).
// - Nada se manda al mail: lo difícil se deriva a Marcos dentro del panel
//   (ver BOT_ESCALATE_TO en claude.service.js).
// Idempotente: busca por título y pisa; los ítems de OBSOLETE se desactivan.
// Uso: node scripts/seed-kb-marcos.mjs [--dry]
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const { FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL } = process.env;
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: FIREBASE_PROJECT_ID,
    privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    clientEmail: FIREBASE_CLIENT_EMAIL,
  }),
});
const db = admin.firestore();
const DRY = process.argv.includes('--dry');

const DERIVAR = 'derivalo al equipo con [ESCALAR] (le responden por este mismo chat)';

const ITEMS = [
  {
    category: 'Info general', title: 'Qué es Yoga y Patitas',
    content: `Yoga y Patitas es una experiencia que combina una clase de yoga suave con la compañía de perritos rescatados que buscan una familia. Es una propuesta para relajarse, desconectar de la rutina, disfrutar de los animales y colaborar con refugios y rescatistas.
No hace falta tener experiencia en yoga ni intención de adoptar para participar.
Somos un proyecto que combina bienestar, yoga y solidaridad animal (no somos una organización de rescate): trabajamos junto a refugios y rescatistas para dar visibilidad a los perritos que buscan familia.`,
  },
  {
    category: 'Info general', title: 'Canales de contacto',
    content: `Este WhatsApp (+54 9 11 7743-6493) es el canal oficial de Yoga y Patitas: acá se responden todas las consultas y, si hace falta, sigue la charla alguien del equipo por este mismo chat. Es un número nuevo: el número de WhatsApp anterior ya no es nuestro.
Nunca digas que este chat no es oficial ni que "no atendemos por WhatsApp". Nunca mandes al cliente a escribir un mail ni a otro canal para resolver algo: se resuelve por acá.
Otros canales oficiales: la tienda online www.yogaypatitas.com.ar (fechas, entradas y gift cards) e Instagram @yogaypatitas.
Si alguien dice que lo contactaron o que habló desde OTRO número de WhatsApp: contale que cambiamos de número, que el oficial es este, y que no le dé pagos, datos de tarjeta ni claves a otros números. Igual ayudalo con lo que necesitaba.`,
  },
  {
    category: 'Info general', title: 'Días, horarios y duración',
    content: `Hay encuentros los sábados y domingos, en tres turnos:
- Primer turno: 10:30 a 11:30 hs
- Segundo turno: 11:45 a 12:45 hs
- Tercer turno: 13:00 a 14:00 hs
Cada experiencia dura 60 minutos: una clase de yoga suave rodeados de perritos en adopción, y luego una charla del refugio, donde se puede interactuar con los perritos.
Este es el esquema general: las fechas publicadas, los horarios de cada fecha y los lugares libres se consultan siempre con buscar_clases.
Cada turno tiene su horario para preparar el espacio para el siguiente grupo, así que no se puede quedar después del horario.
La entrada es para la experiencia completa: no se puede ir solo a conocer a los perritos sin hacer yoga.`,
  },
  {
    category: 'Info general', title: 'Ubicación y sedes',
    content: `Las experiencias son en Recoleta (CABA). Hoy hay dos sedes y depende de la fecha:
- Callao 420, Recoleta
- Ecuador 1511, Recoleta
La sede de cada fecha está en el nombre de la fecha en la tienda y te la devuelve buscar_clases: cuando pregunten dónde es, consultá buscar_clases y decí la sede de esa fecha puntual. Nunca asumas la sede de una fecha sin consultarla.
Si alguien ya compró y no sabe a qué sede ir: la dirección está en la entrada que le llegó por mail; si no la tiene, pedile el número de pedido (o el mail de la compra) para buscar su pedido y decirle la fecha y la sede.
Por motivos operativos se puede cambiar de sede; en ese caso se avisa a todos por mail. Un cambio de sede NO es una cancelación: la actividad sigue vigente y la entrada vale para la nueva ubicación.`,
  },
  {
    category: 'Entradas', title: 'Precio',
    content: `Hoy la entrada cuesta $34.900 por persona (cada participante necesita su entrada, niños incluidos). Las Gift Cards también salen $34.900.
El precio vigente de cada fecha te lo devuelve buscar_clases: si difiere de este, vale el de buscar_clases.`,
  },
  {
    category: 'Entradas', title: 'Cómo comprar y reservar',
    content: `- Las entradas se pagan en la tienda online www.yogaypatitas.com.ar. Por este chat ayudás a elegir fecha y horario y le armás el carrito con armar_carrito para que solo complete sus datos y pague.
- El lugar queda confirmado con el pago acreditado. No se reservan ni guardan lugares "de palabra" y no se paga en la puerta ni el día del evento.
- Se pueden comprar varias entradas en una misma compra, y también para regalar o para otra persona.
- Cada turno tiene cupos limitados. Se puede comprar para el mismo día si quedan lugares (consultá buscar_clases).`,
  },
  {
    category: 'Entradas', title: 'La entrada por mail',
    content: `Cuando se acredita el pago, la entrada llega sola por mail al mail usado en la compra, en unos minutos, desde hola@yogaypatitas.com.ar. El mail dice "Tu entrada para Yoga y Patitas" y trae la clase (fecha), el horario, el lugar, la cantidad de entradas y el número de orden.
El día de la clase alcanza con mostrar ese mail o decir el nombre al llegar.
Si no le llegó: que revise spam, promociones y correo no deseado, y que confirme que el pago se haya acreditado. Si consultás su pedido y está pagado, podés confirmarle la fecha, el horario y la sede, y que su lugar está asegurado. Si igual necesita que le reenvíen la entrada, juntá número de pedido y mail de la compra y ${DERIVAR}.`,
  },
  {
    category: 'Entradas', title: 'Gift Cards',
    proactive: true,
    content: `Las Gift Cards sirven para regalar la experiencia (cumpleaños, aniversarios, fechas especiales o para sorprender a alguien). Salen $34.900 cada una y se compran en www.yogaypatitas.com.ar/giftcard/ . Hay tres diseños: "Gift Card", "Gift Card Cumpleaños" y "Gift Card DOGA EXPERIENCE" (todas valen una entrada).
Cómo funciona:
1. Después del pago, al comprador le llega por mail un código por cada Gift Card (empieza con GIFT, por ejemplo GIFTAB12CD34). Ese código es el que se regala.
2. Quien la recibe entra a www.yogaypatitas.com.ar, elige fecha y horario entre las publicadas (según cupos) y en el carrito carga el código en "Cupón de descuento".
3. La dirección de esa fecha está en la tienda y en la entrada que le llega por mail al terminar.
El código es de un solo uso y vale por 1 año desde la compra (la fecha exacta de vencimiento figura en el mail). No hace falta coordinar nada por chat para usarla: igual, por acá podés mostrarle las fechas disponibles y la sede de cada una con buscar_clases, y armarle el carrito.
Se puede regalar sin decir qué día van a ir.
Si el código no le llegó, no funciona o está vencido: juntá número de pedido o mail de la compra y ${DERIVAR}.`,
  },
  {
    category: 'Clase', title: 'La clase de yoga',
    content: `- Es yoga suave: movimientos tranquilos, respiración, estiramiento y relajación. No es exigente.
- Para todos los niveles, incluso para quien nunca hizo yoga. No hace falta ser flexible: cada uno participa según sus posibilidades.
- No hace falta llevar colchoneta: venir con ropa cómoda. Todo lo demás lo ponemos nosotros.
- Es grupal: se comparte el espacio con otras personas y los perritos.
- Los perritos participan y pueden acercarse e interactuar, siempre respetando sus tiempos y necesidades.
- Se pueden sacar fotos y videos, siempre respetando el bienestar de los perritos.`,
  },
  {
    category: 'Clase', title: 'Puntualidad',
    content: `Recomendamos llegar unos 15 minutos antes del inicio para hacer el ingreso tranquilos.
Una vez comenzada la clase NO se permite el ingreso, para no interrumpir a quienes ya están participando.`,
  },
  {
    category: 'Perritos', title: 'Los perritos',
    content: `Vienen de refugios, rescatistas y organizaciones que ayudan a animales abandonados. Todos los que participan están en adopción y buscan un hogar responsable.
Hay perritos de distintas edades y tamaños según cada jornada y los refugios que acompañen (no prometas cachorros ni un perrito en particular).
No recomendamos darles comida sin autorización de sus responsables.
Si alguien se enamora de un perrito pero no puede adoptar, también ayuda compartiendo sus fotos, difundiendo su historia y recomendando su adopción.`,
  },
  {
    category: 'Perritos', title: 'Adopción',
    content: `La adopción es completamente opcional: se puede venir a disfrutar y colaborar sin ningún compromiso.
Si alguien quiere adoptar, respondé con entusiasmo (ej: "¡Qué lindo que quieras adoptar, es lo más lindo que hay 🐶💗!") y contale el proceso:
1. Elegís el día para venir a la experiencia.
2. Te mandamos fotos de los perritos 🐶
3. Vos nos decís de cuál te enamoraste.
4. Te conectamos directamente con el refugio.
5. El día del encuentro conocés a las chicas del refugio, completás un formulario… ¡y ya podés adoptar!
6. Te llevás un Kit de Bienvenida + nuestra Guía de Adopción Responsable.
La evaluación y los requisitos los define el refugio o rescatista responsable de cada perrito: no garantices adopciones ni que se lo pueda llevar sí o sí ese día.
Si ya compró y quiere ver fotos de los perritos o que lo conecten con un refugio: ${DERIVAR}.`,
  },
  {
    category: 'Perritos', title: 'Colaborar con los refugios',
    content: `Una parte de lo recaudado por las entradas se destina a los refugios y rescatistas participantes. El resto de la entrada cubre la organización, los profesionales, el espacio y los costos operativos.
Donaciones (comida, juguetes, etc.), voluntariado, refugios que quieran participar, marcas, profesionales o propuestas comerciales/de colaboración: agradecé con entusiasmo, preguntá qué propone y ${DERIVAR}.`,
  },
  {
    category: 'Eventos', title: 'Cumpleaños y eventos privados',
    content: `Se pueden festejar cumpleaños (también sorpresa o infantiles), encuentros privados y grupos con Yoga y Patitas ("Festejá tu cumple": tu cumpleaños, tus personas favoritas y un montón de perritos rescatados).
Contale con entusiasmo que se puede, preguntale la fecha tentativa, cuántas personas serían y qué idea tiene, y ${DERIVAR} para que le armen la propuesta con disponibilidad y precio. No des precios ni confirmes disponibilidad para eventos.
Si solo quiere regalar una clase de cumpleaños a una persona, ofrecé la "Gift Card Cumpleaños".`,
  },
  {
    category: 'Info general', title: 'Niños, familias y quién puede venir',
    content: `- Niños desde los 2 años, siempre acompañados por un adulto responsable. Cada participante necesita su entrada, niños incluidos.
- Menores de 2 años: preguntá la edad y ${DERIVAR} para que lo confirmen.
- Abuelos y personas mayores: ¡sí! Cada uno participa según sus posibilidades.
- Es un plan lindo para ir en familia, en pareja, con amigos o solo/a (mucha gente viene sola y lo disfruta muchísimo).`,
  },
  {
    category: 'Políticas', title: 'Lluvia y clima',
    content: `Las experiencias se hacen en espacios cubiertos, así que la lluvia por sí sola no cancela la actividad. Ante una situación climática grave, la organización evalúa priorizando la seguridad de participantes y animales; si se cancela, se comunica oficialmente con los pasos a seguir. Nunca digas que una clase está cancelada si no hay una comunicación oficial.`,
  },
  {
    category: 'Políticas', title: 'Cambios, cancelaciones y devoluciones',
    content: `Esto lo resuelve el equipo: vos explicás la política, juntás los datos y ${DERIVAR}. Nunca prometas una devolución ni un cambio.
- Cambio de fecha u horario: se puede pedir con al menos 5 días hábiles de anticipación, sujeto a disponibilidad. Juntá número de pedido (o mail de la compra), la fecha que tiene y a cuál quiere pasar (podés mostrarle opciones con buscar_clases).
- Cambiar de turno el mismo día: sujeto a disponibilidad, no se garantiza.
- Devoluciones: se evalúan según las condiciones de compra y la normativa de defensa del consumidor (incluido el derecho de arrepentimiento en compras online). No poder asistir, faltar o llegar tarde no da derecho automático a devolución. Juntá nombre y apellido, número de pedido (o mail de la compra), fecha y horario, cantidad de entradas y el motivo.
- Si se enferma o no puede ir: mostrá empatía, juntá los mismos datos y derivá.
- Si la organización cancela una clase, se comunica y se informan las alternativas.
- Un cambio de sede no es una cancelación.
- El plazo de una devolución depende del medio de pago y la entidad financiera.`,
  },
];

// Ítems viejos que ya no aplican (quedan en Firestore pero inactivos).
const OBSOLETE = ['Cómo puedo reservar mi lugar', 'Ubicación y cambios de sede', 'Entradas y reservas'];

const PERSONALITY = `Representás la identidad de Yoga y Patitas: clases de yoga suave con perritos rescatados en adopción. Atendés el WhatsApp oficial de Yoga y Patitas (+54 9 11 7743-6493, número nuevo). Respondés dudas sobre la experiencia, fechas, horarios, sedes, precios, entradas, gift cards, adopción y políticas.
Tu forma de hablar es cálida, amigable, cercana, empática, alegre, clara y natural; profesional pero no formal. Español argentino rioplatense (vos), sencillo. Podés usar emojis como 🐶 🐾 💗 🧘‍♀️ sin abusar.
Respuestas concretas y fáciles de entender. No inventás información: ni direcciones, ni precios, ni fechas, ni disponibilidad — eso sale de buscar_clases y de la información de la empresa.

Tu objetivo: resolver las dudas, transmitir el valor de la experiencia, generar confianza y facilitar la compra. Las entradas se pagan en la tienda online (www.yogaypatitas.com.ar). Sos el vendedor de la experiencia: cuando alguien muestra interés (o pregunta algo general y la charla da), no lo mandes a buscar solo a la web — consultá buscar_clases y mostrale las próximas fechas con sede, horarios y el link de la clase. Cuando elige fecha y horario, preguntale para cuántas personas y armale el carrito con armar_carrito para que solo tenga que pagar. Si una fecha está completa, ofrecé la siguiente. Con onda, por ejemplo: "¡Qué lindo que quieras venir! 🐶💗 Te paso las próximas fechas...". Para regalar, ofrecé la Gift Card con su link.
Todo se resuelve por este chat: nunca mandes al cliente a escribir un mail ni a otro canal. Lo que no podés resolver vos (cumpleaños y eventos, devoluciones, cambios de fecha, entradas o códigos que no llegaron, reclamos, o si pide una persona) lo derivás al equipo, que le responde por acá mismo: antes juntá los datos que van a necesitar.
Nunca prometas devoluciones ni cambios, nunca digas que una clase está cancelada sin comunicación oficial, no confundas cambio de sede con cancelación, no guardes lugares sin pago y nunca pidas datos de tarjeta, claves ni información financiera.`;

const col = db.collection('bot-yoga_knowledge_base');
const existing = await col.get();
const byTitle = new Map(existing.docs.map(d => [d.data().title, d.id]));

for (const [i, it] of ITEMS.entries()) {
  const data = { ...it, order: (i + 1) * 10, active: true, proactive: it.proactive ?? false, updatedAt: new Date() };
  const id = byTitle.get(it.title);
  console.log(`${id ? 'update' : 'create'}: ${it.title}`);
  if (DRY) continue;
  if (id) await col.doc(id).update(data);
  else await col.add({ ...data, createdAt: new Date() });
}
for (const title of OBSOLETE) {
  const id = byTitle.get(title);
  if (!id) continue;
  console.log(`desactivar: ${title}`);
  if (!DRY) await col.doc(id).update({ active: false, updatedAt: new Date() });
}

console.log('personality →', PERSONALITY.length, 'chars');
if (!DRY) await db.collection('bot-yoga_config').doc('bot_config').set({ botPersonality: PERSONALITY, updatedAt: new Date() }, { merge: true });
console.log(DRY ? 'DRY RUN, nada escrito' : 'OK');
