// KB del bot de Yoga y Patitas desde "TeDI_Yoga_y_Patitas_Carpetas.md" (2026-11-11):
// la versión que el cliente reescribió con IA, 16 carpetas. Cambios de fondo respecto
// de seed-kb-marcos.mjs: una sola sede (Ecuador 1511), promo 3x2 de noviembre, Gift
// Card navideña y derivación al WhatsApp del equipo (+54 9 11 3175-1110) en vez de
// [ESCALAR] para cumpleaños/eventos, quejas legales y casos extremos.
// Los [COMPLETAR] del archivo se llenaron con lo que ya estaba confirmado en la KB
// anterior y en las tarjetas que el cliente editó a mano el 11/11 (link de la gift
// navideña, 3x2 automático en el carrito, código GIFT en "Cupón de descuento", 1 año).
// Se suman 4 tarjetas viejas que el archivo no cubre (perritos, refugios, lluvia,
// puntualidad). Todo lo demás se DESACTIVA (no se borra): se puede volver atrás.
// Idempotente: busca por título y pisa. Uso: node scripts/seed-kb-carpetas.mjs [--dry]
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
db.settings({ preferRest: true });
const DRY = process.argv.includes('--dry');
const COLLECTION = 'bot-yoga_knowledge_base';

const EQUIPO = '+54 9 11 3175-1110';
const GIFT_NAVIDAD_URL = 'https://yogaypatitas.com.ar/productos/gift-card-copia-zzsnr/';

const ITEMS = [
  {
    category: 'Instrucciones', title: 'Instrucciones generales del bot',
    content: `Sos el asistente de Yoga y Patitas en WhatsApp.
- Resolvé vos cada consulta. Derivar a una persona es solo para cumpleaños/eventos, quejas legales o casos extremos (ver carpeta "Derivación al equipo").
- Fechas, horarios, sede y lugares libres: consultalos SIEMPRE con buscar_clases. Nunca los inventes.
- Si la persona quiere ir, ayudala a elegir fecha y armale el carrito con armar_carrito.
- No inventes datos. Si algo no está en tus carpetas, decí que no tenés ese dato y ofrecé lo que sí podés resolver.
- No prometas devoluciones, cambios, adopciones ni que un perrito en particular va a estar.
- Tono cálido, alegre y cercano, con voseo. Mensajes cortos. Emojis con moderación 🐶🐾💛🧘‍♀️`,
  },
  {
    category: 'Info general', title: 'Quiénes somos',
    content: `Yoga y Patitas es una experiencia que combina una clase de yoga suave con la compañía de perritos rescatados que buscan una familia. Es una propuesta para relajarse, desconectar de la rutina, disfrutar de los animales y colaborar con refugios y rescatistas.
No somos una organización de rescate: somos un proyecto de bienestar, yoga y solidaridad animal que trabaja junto a refugios y rescatistas para dar visibilidad a los perritos que buscan familia.
No hace falta tener experiencia en yoga ni intención de adoptar para participar.`,
  },
  {
    category: 'Info general', title: 'Canales oficiales y número anterior',
    content: `Canales oficiales:
- Este WhatsApp (+54 9 11 7743-6493): acá se responden todas las consultas.
- Tienda online: www.yogaypatitas.com.ar (fechas, entradas y gift cards).
- Instagram: @yogaypatitas
- Email: hola@yogaypatitas.com.ar (desde ahí llegan las entradas).

Si alguien dice que habló o coordinó algo con nosotros por otro WhatsApp que ya no anda, era nuestro número anterior. NUNCA digas que no era oficial.
1. Pedí disculpas por el cambio de número y contale que ahora es este.
2. Si ya eligió fecha, consultá buscar_clases y confirmale sede y horario.
3. Si tiene una Gift Card y no eligió fecha, explicale cómo usarla y ofrecé mostrarle fechas.

Seguridad: nunca pedimos pagos, datos de tarjeta ni claves por chat. Si alguien te cuenta que se los pidieron desde otro número, avisale que no los dé.`,
  },
  {
    category: 'Clase', title: 'Cómo es la experiencia',
    content: `- Dura 60 minutos: clase de yoga suave rodeados de perritos en adopción y, al final, una charla del refugio donde se puede interactuar con los perritos.
- Yoga suave: movimientos tranquilos, respiración, estiramiento y relajación. No es exigente.
- Para todos los niveles, incluso para quien nunca hizo yoga. No hace falta ser flexible: cada uno participa según sus posibilidades.
- Es grupal: se comparte el espacio con otras personas y los perritos.
- Los perritos se acercan e interactúan, siempre respetando sus tiempos y necesidades.
- La entrada es para la experiencia completa: no se puede ir solo a conocer a los perritos sin hacer yoga.
- Cada turno termina en horario para preparar el espacio del siguiente grupo: no se puede quedar después.`,
  },
  {
    category: 'Clase', title: 'Qué llevar y recomendaciones',
    content: `- Ropa cómoda. No hace falta llevar colchoneta: todo lo demás lo ponemos nosotros.
- Llegar 15 minutos antes. La clase empieza puntual.
- Se pueden sacar fotos y videos, respetando el bienestar de los perritos.
- No se puede llevar perro propio: la experiencia es con los perritos rescatados.
- Embarazo, lesiones o condiciones de salud: recomendamos consultar antes con un profesional.`,
  },
  {
    category: 'Info general', title: 'Días, horarios y sede',
    content: `Hay encuentros los sábados y domingos, en tres turnos:
- 1er turno: 10:30 a 11:30 h
- 2do turno: 11:45 a 12:45 h
- 3er turno: 13:00 a 14:00 h
Sede actual: Recoleta (Ecuador 1511). Confirmá siempre la sede y el horario de cada fecha con buscar_clases.
Cada turno tiene cupos limitados. Se puede comprar para el mismo día si quedan lugares.
Un cambio de sede no es una cancelación.`,
  },
  {
    category: 'Promos', title: 'Promo 3x2', proactive: true,
    content: `- Comprando 3 entradas, pagás 2.
- Válida para compras hechas hasta el 30/11/2026 inclusive.
- Las entradas se pueden usar en clases de noviembre o diciembre.
- No aplica a gift cards ni a cumpleaños o eventos privados.
- El descuento se aplica solo en el carrito al agregar las 3 entradas: no hace falta código. Con armar_carrito armá el carrito con 3 personas.
Si alguien viene de a 2, sugerile sumar a una tercera persona para aprovechar el 3x2.
Ejemplo: "¡Sí! Tenemos 3x2: comprando 3 entradas pagás 2 🎉 Es para compras hasta el 30/11 y las podés usar en clases de noviembre o diciembre. ¿Te muestro las fechas?"`,
  },
  {
    category: 'Entradas', title: 'Cómo comprar entradas',
    content: `- Las entradas se pagan en la tienda online www.yogaypatitas.com.ar
- Por este chat ayudás a elegir fecha y horario (buscar_clases) y armás el carrito (armar_carrito) para que solo complete sus datos y pague.
- El lugar queda confirmado con el pago acreditado.
- No se reservan lugares "de palabra", no se paga en la puerta ni el día del evento.
- Se pueden comprar varias entradas en una misma compra, también para regalar o para otra persona.
- El precio vigente es el que figura en la tienda. Hoy la entrada cuesta $34.900 por persona (cada participante necesita su entrada, niños incluidos); si buscar_clases muestra otro precio, vale ese.`,
  },
  {
    category: 'Entradas', title: 'Después de comprar: la entrada por mail',
    content: `Cuando se acredita el pago, la entrada llega sola por mail en unos minutos, desde hola@yogaypatitas.com.ar, al mail usado en la compra. El asunto es "Tu entrada para Yoga y Patitas" y trae fecha, horario, lugar, cantidad de entradas y número de orden.
El día de la clase alcanza con mostrar ese mail o decir el nombre al llegar.
Si no le llegó:
1. Que revise spam, promociones y correo no deseado.
2. Que confirme que el pago se haya acreditado.
3. Si consultás su pedido y está pagado, confirmale fecha, horario y sede: su lugar está asegurado y alcanza con decir su nombre al llegar.
4. Si igual quiere el reenvío del mail, que escriba a hola@yogaypatitas.com.ar con su número de pedido.`,
  },
  {
    category: 'Políticas', title: 'Cambios de fecha, devoluciones y cancelaciones',
    content: `Explicá la política en una o dos líneas. Nunca prometas un cambio ni una devolución.
- Cambio de fecha u horario: con al menos 5 días hábiles de anticipación, sujeto a disponibilidad. Podés mostrarle opciones con buscar_clases.
- Cambio de turno el mismo día: sujeto a disponibilidad, no se garantiza.
- Devoluciones: se evalúan según las condiciones de compra y la normativa de defensa del consumidor (incluido el derecho de arrepentimiento en compras online). No poder asistir, faltar o llegar tarde no da derecho automático a devolución.
- Si se enferma o no puede ir: mostrá empatía y explicale cómo pedir el cambio.
- Si la organización cancela una clase, se comunica y se informan las alternativas.
- El plazo de una devolución depende del medio de pago y la entidad financiera.
Cómo se pide: escribiendo a hola@yogaypatitas.com.ar con número de pedido, mail de la compra y motivo (o la fecha nueva).`,
  },
  {
    category: 'Gift Cards', title: 'Gift Card navideña', proactive: true,
    content: `- Precio: $34.900. Vale 1 entrada.
- Ideal para Navidad, Reyes, amigo invisible o regalo de equipo.
- Se compra en la tienda: ${GIFT_NAVIDAD_URL}
- Llega por mail al instante (lista para reenviar o imprimir) y quien la recibe elige fecha y horario, sujeto a disponibilidad.
- Vence al año de la compra (la fecha exacta figura en el mail).
- No aplica el 3x2. No se cambia por dinero.
- También hay otras gift cards (Gift Card, Gift Card Cumpleaños) en www.yogaypatitas.com.ar/giftcard/ — todas valen 1 entrada.
- Para regalar a varias personas se pueden comprar varias. Para empresas o equipos grandes, derivá al WhatsApp del equipo ${EQUIPO}.
Ejemplo: "¡Qué lindo regalo! 🎁 La Gift Card navideña sale $34.900: llega por mail y quien la recibe elige la fecha. La comprás acá 👉 ${GIFT_NAVIDAD_URL}"`,
  },
  {
    category: 'Gift Cards', title: 'Cómo usar una Gift Card',
    content: `1. Con la compra llega por mail un código por cada Gift Card (empieza con GIFT, por ejemplo GIFTAB12CD34). Ese es el código que se regala.
2. Quien la recibe entra a www.yogaypatitas.com.ar y elige fecha y horario entre los publicados (según cupos).
3. Agrega la entrada al carrito y, al pagar, carga el código en "Cupón de descuento".
4. Le llega la entrada por mail con fecha, horario y sede.
El código es de un solo uso y vence al año de la compra.
Ofrecé mostrarle fechas con buscar_clases y armarle el carrito.
Si el código no le llegó o no funciona: que revise spam y, si sigue sin andar, que escriba a hola@yogaypatitas.com.ar con el número de pedido o el mail de la compra.`,
  },
  {
    category: 'Perritos', title: 'Adopción',
    content: `La adopción es completamente opcional: se puede venir a disfrutar y colaborar sin ningún compromiso.
Si alguien quiere adoptar, respondé con entusiasmo ("¡Qué lindo que quieras adoptar, es lo más lindo que hay 🐶💗!") y contale el proceso:
1. Elegís el día para venir a la experiencia.
2. Te mandamos fotos de los perritos 🐶
3. Nos decís de cuál te enamoraste.
4. Te conectamos directamente con el refugio.
5. El día del encuentro conocés a las chicas del refugio, completás un formulario… ¡y ya podés adoptar!
6. Te llevás un Kit de Bienvenida + nuestra Guía de Adopción Responsable.
La evaluación y los requisitos los define el refugio o rescatista de cada perrito: no garantices adopciones ni que se lo pueda llevar ese día.`,
  },
  {
    category: 'Info general', title: 'Quiénes pueden participar',
    content: `- Chicos desde los 2 años, con un adulto responsable que también tenga su entrada y se quede en la clase todo el tiempo.
- Adultos mayores: sí, si están en condiciones para la actividad.
- Embarazo, lesiones o condiciones de salud: recomendamos consultar antes con un profesional.
- Solo ingresan personas con entrada.`,
  },
  {
    category: 'Eventos', title: 'Cumpleaños y eventos privados',
    content: `Se pueden festejar cumpleaños y hacer eventos privados (grupos, empresas, despedidas).
Para organizarlo, derivá al equipo: WhatsApp ${EQUIPO}.
Si solo quiere regalarle una clase a alguien por su cumple, ofrecé la Gift Card Cumpleaños (www.yogaypatitas.com.ar/giftcard/).
Ejemplo: "¡Nos encanta que quieras festejar con nosotros! 🎂🐶 Para organizar tu evento escribile a nuestro equipo al WhatsApp ${EQUIPO} y te cuentan todas las opciones."`,
  },
  {
    category: 'Derivación', title: 'Derivación al equipo',
    content: `Derivá al WhatsApp del equipo ${EQUIPO} SOLO en estos casos:
1. Cumpleaños o eventos privados (también empresas o equipos grandes que quieren gift cards).
2. Queja formal o tema legal (reclamo, defensa del consumidor, denuncia).
3. Caso extremo que no podés resolver con tus carpetas después de intentarlo (por ejemplo, pagó y el pedido no aparece).
Para todo lo demás, resolvé vos.
Frase: "Para esto te paso con nuestro equipo así lo ven personalmente 💛 Escribiles al WhatsApp ${EQUIPO} con tu número de pedido. ¡Gracias por tu paciencia!"`,
  },
  // Tarjetas de la KB anterior que el archivo no cubre (sin cambios de fondo).
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
    category: 'Perritos', title: 'Colaborar con los refugios',
    content: `Una parte de lo recaudado por las entradas se destina a los refugios y rescatistas participantes. El resto de la entrada cubre la organización, los profesionales, el espacio y los costos operativos.
Donaciones (comida, juguetes, etc.), voluntariado, refugios que quieran participar, marcas, profesionales o propuestas comerciales/de colaboración: agradecé con entusiasmo y pasale el WhatsApp del equipo ${EQUIPO}.`,
  },
  {
    category: 'Políticas', title: 'Lluvia y clima',
    content: `Las experiencias se hacen en espacios cubiertos, así que la lluvia por sí sola no cancela la actividad. Ante una situación climática grave, la organización evalúa priorizando la seguridad de participantes y animales; si se cancela, se comunica oficialmente con los pasos a seguir. Nunca digas que una clase está cancelada si no hay una comunicación oficial.`,
  },
].map((it, i) => ({ ...it, order: (i + 1) * 10, proactive: it.proactive ?? false, active: true }));

const snap = await db.collection(COLLECTION).get();
const existing = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
const wanted = new Set(ITEMS.map((i) => i.title));
const now = new Date();
const batch = db.batch();

for (const item of ITEMS) {
  const match = existing.find((e) => e.title === item.title);
  if (match) {
    console.log(`PISA      ${item.title}`);
    batch.update(db.collection(COLLECTION).doc(match.id), { ...item, updatedAt: now });
  } else {
    console.log(`CREA      ${item.title}`);
    batch.set(db.collection(COLLECTION).doc(), { ...item, createdAt: now, updatedAt: now });
  }
}
for (const e of existing) {
  if (!wanted.has(e.title) && e.active) {
    console.log(`DESACTIVA ${e.title}`);
    batch.update(db.collection(COLLECTION).doc(e.id), { active: false, updatedAt: now });
  }
}
if (DRY) console.log('\n--dry: no se escribió nada');
else { await batch.commit(); console.log(`\nListo: ${ITEMS.length} activas.`); }
process.exit(0);
