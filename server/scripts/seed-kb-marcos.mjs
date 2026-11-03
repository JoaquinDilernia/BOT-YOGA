// Carga la KB que mandó Marcos (2026-11-03) en bot-yoga_knowledge_base y
// actualiza la personalidad del bot. Idempotente: busca por título y pisa.
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

const ITEMS = [
  {
    category: 'Info general', title: 'Qué es Yoga y Patitas',
    content: `Yoga y Patitas es una experiencia que combina una clase de yoga suave con la compañía de perritos rescatados que buscan una familia. Es una propuesta para relajarse, desconectar de la rutina, disfrutar de los animales y colaborar con refugios y rescatistas.
No hace falta tener experiencia en yoga ni intención de adoptar para participar.
Somos un proyecto que combina bienestar, yoga y solidaridad animal (no somos una organización de rescate): trabajamos junto a refugios y rescatistas para dar visibilidad a los perritos que buscan familia.`,
  },
  {
    category: 'Info general', title: 'Días, horarios y duración',
    content: `Hay encuentros todos los sábados y domingos, en tres turnos:
- Primer turno: 10:30 a 11:30 hs
- Segundo turno: 11:45 a 12:45 hs
- Tercer turno: 13:00 a 14:00 hs
Cada experiencia dura 60 minutos: una clase de yoga suave rodeados de perritos en adopción, y luego una charla del refugio, donde se puede interactuar con los perritos.
Este es el esquema general: las fechas concretas publicadas y los lugares libres se consultan siempre con buscar_clases (o en la web).
Cada turno tiene su horario establecido para preparar el espacio para el siguiente grupo, así que no se puede quedar después del horario.
La entrada es para la experiencia completa: no se puede ir solo a conocer a los perritos sin hacer yoga.`,
  },
  {
    category: 'Info general', title: 'Ubicación y cambios de sede',
    content: `Las experiencias se hacen en espacios especialmente seleccionados y la ubicación puede variar según la fecha. La dirección de cada fecha se informa en la web (en la página de cada fecha) — conviene revisarla antes de comprar. Nunca inventes direcciones: usá lo que devuelve buscar_clases o mandá a la web.
Por motivos operativos podemos cambiar de sede; en ese caso se avisa a todos por mail. Un cambio de sede NO es una cancelación: la actividad sigue vigente y la entrada vale para la nueva ubicación (y por sí solo no da derecho a devolución). Recomendá revisar el mail antes de ir.`,
  },
  {
    category: 'Clase', title: 'La clase de yoga',
    content: `- Es yoga suave: movimientos tranquilos, respiración, estiramiento y relajación. No es exigente.
- Para todos los niveles, incluso para quien nunca hizo yoga. No hace falta ser flexible: cada uno participa según sus posibilidades.
- No hace falta llevar colchoneta: solo llegar 15 minutos antes y venir con ropa cómoda. Todo lo demás lo ponemos nosotros.
- Es grupal: se comparte el espacio con otras personas y los perritos.
- Los perritos participan y pueden acercarse e interactuar, siempre respetando sus tiempos y necesidades.
- Se pueden sacar fotos y videos, siempre respetando el bienestar de los perritos.`,
  },
  {
    category: 'Clase', title: 'Puntualidad',
    content: `Recomendamos llegar 15 minutos antes del inicio para hacer el ingreso tranquilos.
Una vez comenzada la clase NO se permite el ingreso, para no interrumpir a quienes ya están participando.
Cambiar de turno el mismo día está sujeto a disponibilidad y a las condiciones de modificación: no se garantiza.`,
  },
  {
    category: 'Perritos', title: 'Los perritos',
    content: `Vienen de refugios, rescatistas y organizaciones que ayudan a animales abandonados. Todos los que participan están en adopción y buscan un hogar responsable.
Hay perritos de distintas edades y tamaños según cada jornada y los refugios que acompañen (no prometas cachorros ni un perrito en particular).
No recomendamos darles comida sin autorización de sus responsables. Si alguien quiere llevar juguetes o donaciones, que lo consulte antes (ver "Colaborar con los refugios").
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
La evaluación y los requisitos los define el refugio o rescatista responsable de cada perrito: no garantices adopciones ni que se lo pueda llevar sí o sí ese día.`,
  },
  {
    category: 'Perritos', title: 'Colaborar con los refugios',
    content: `Una parte de lo recaudado por las entradas se destina a los refugios y rescatistas participantes. El resto de la entrada cubre la organización, los profesionales, el espacio y los costos operativos.
Donaciones adicionales, voluntariado, refugios que quieran participar, marcas, profesionales o propuestas comerciales/de colaboración: que escriban a hola@yogaypatitas.com.`,
  },
  {
    category: 'Entradas', title: 'Entradas y reservas',
    content: `- Todo se compra exclusivamente en la web: www.yogaypatitas.com (no se reserva por WhatsApp, Instagram ni en la puerta, y no se paga el día del evento). Instagram es para info y consultas.
- El lugar queda confirmado con el pago completo; ahí llega la confirmación/entrada por mail (que revise spam, promociones y correo no deseado).
- Si no le llegó: que verifique que el pago se haya hecho y revise todas las carpetas; si sigue sin aparecer, que escriba a hola@yogaypatitas.com con nombre y apellido, mail usado en la compra, fecha y horario reservado y comprobante de pago.
- Se pueden comprar varias entradas en una misma compra, y también para regalar o para otra persona.
- Cada turno tiene cupos limitados. Se puede comprar para el mismo día si quedan lugares.
- Cambio de fecha/horario: hay que pedirlo con al menos 5 días hábiles de anticipación, sujeto a disponibilidad y a las condiciones de compra (por mail a hola@yogaypatitas.com).`,
  },
  {
    category: 'Entradas', title: 'Gift Cards',
    content: `Tenemos Gift Cards de Yoga y Patitas para regalar la experiencia (cumpleaños, aniversarios, fechas especiales o para sorprender a alguien). Se compran en www.yogaypatitas.com.ar/giftcard/
Quien la recibe elige la fecha entre las disponibles publicadas en la web, según cupos, y al coordinar su asistencia presenta/informa los datos de su Gift Card siguiendo las instrucciones de canje. Se puede regalar sin decir qué día van a ir.
Hay Gift Cards especiales de Navidad, y NO tienen vencimiento.`,
    proactive: true,
  },
  {
    category: 'Eventos', title: 'Cumpleaños y eventos privados',
    content: `Se pueden festejar cumpleaños (también sorpresa o infantiles), encuentros privados y grupos con Yoga y Patitas.
Para cumpleaños, eventos privados, grupos o presupuestos especiales: contale con entusiasmo que se puede, y que escriba a hola@yogaypatitas.com contando la idea, la fecha tentativa y la cantidad de personas, así le pasan propuestas, disponibilidad y precios. No des precios ni confirmes disponibilidad para eventos.`,
  },
  {
    category: 'Info general', title: 'Niños, familias y quién puede venir',
    content: `- Niños desde los 2 años, siempre acompañados por un adulto responsable. Cada participante necesita su entrada, niños incluidos.
- Menores de 2 años: consultar antes con el equipo por mail (hola@yogaypatitas.com).
- Abuelos y personas mayores: ¡sí! Cada uno participa según sus posibilidades.
- Es un plan lindo para ir en familia, en pareja, con amigos o solo/a (mucha gente viene sola y lo disfruta muchísimo).`,
  },
  {
    category: 'Políticas', title: 'Lluvia y clima',
    content: `Las experiencias se hacen en espacios cubiertos, así que la lluvia por sí sola no cancela la actividad. Ante una situación climática grave, la organización evalúa priorizando la seguridad de participantes y animales; si se cancela, se comunica oficialmente con los pasos a seguir. Nunca digas que una clase está cancelada si no hay una comunicación oficial.`,
  },
  {
    category: 'Políticas', title: 'Cambios, cancelaciones y devoluciones',
    content: `- Las devoluciones se evalúan según las condiciones de compra y la normativa de defensa del consumidor (incluido el derecho de arrepentimiento en compras online). No prometas devoluciones.
- No poder asistir, faltar o llegar tarde no da derecho automático a devolución. Cambios de fecha: con al menos 5 días hábiles de anticipación, sujetos a disponibilidad.
- Si se enferma: que escriba por mail para consultar las condiciones.
- Si la organización cancela una clase, se comunica y se informan las alternativas y el procedimiento de devolución.
- Un cambio de sede no es una cancelación.
- Las gestiones de devolución se hacen SOLO por mail a hola@yogaypatitas.com (no por WhatsApp ni Instagram). El mail debe incluir: nombre y apellido del titular, DNI, número de orden, mail usado en la compra, fecha y horario de la experiencia, cantidad de entradas, importe pagado, medio de pago, comprobante y motivo.
- El plazo de la devolución depende del medio de pago y la entidad financiera.`,
  },
  {
    category: 'Info general', title: 'Canales de contacto',
    content: `- Web (entradas, fechas, ubicaciones, gift cards): www.yogaypatitas.com
- Instagram: @yogaypatitas (consultas generales)
- Mail (consultas administrativas, devoluciones, cambios, colaboraciones): hola@yogaypatitas.com
- Para cumpleaños y eventos privados también es el mail: hola@yogaypatitas.com`,
  },
];

const PERSONALITY = `Representás la identidad de Yoga y Patitas: clases de yoga suave con perritos rescatados en adopción. Respondés dudas sobre la experiencia, fechas, horarios, lugares, entradas, gift cards, adopción y políticas.
Tu forma de hablar es cálida, amigable, cercana, empática, alegre, clara y natural; profesional pero no formal. Español argentino rioplatense (vos), sencillo. Podés usar emojis como 🐶 🐾 💗 🧘‍♀️ sin abusar.
Respuestas concretas y fáciles de entender. No inventás información: ni direcciones, ni precios, ni fechas, ni disponibilidad — eso sale de buscar_clases o de la web.

Tu objetivo: resolver las dudas, transmitir el valor de la experiencia, generar confianza y facilitar la compra. Todas las reservas se concretan en la web (www.yogaypatitas.com). Sos el vendedor de la experiencia: cuando alguien muestra interés (o pregunta algo general y la charla da), no lo mandes a buscar solo a la web — consultá buscar_clases y mostrale las próximas fechas con lugar, horarios y el link de la clase. Cuando elige fecha y horario, preguntale para cuántas personas y armale el carrito con armar_carrito para que solo tenga que pagar. Si una fecha está completa, ofrecé la siguiente. Con onda, por ejemplo: "¡Qué lindo que quieras venir! 🐶💗 Te paso las próximas fechas...". Para regalar, ofrecé la Gift Card con su link.
Resolvé vos todo: en este chat no atiende ninguna persona.
- Cumpleaños, eventos privados, grupos o presupuestos especiales → contale con entusiasmo que se puede y pasale el mail hola@yogaypatitas.com para que le armen la propuesta.
- Devoluciones, cambios de fecha, no poder asistir, problemas con la compra y temas administrativos → explicale lo que dice la política y pasale el mail hola@yogaypatitas.com con los datos que tiene que mandar (por este chat no se gestionan).
- Adopciones → contá el proceso y aclarás que depende del refugio responsable; nunca garantices una adopción.
Nunca prometas devoluciones, nunca digas que una clase está cancelada sin comunicación oficial, no confundas cambio de sede con cancelación, no ofrezcas reservas manuales y nunca pidas datos de tarjeta, claves ni información financiera.`;

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

console.log('personality →', PERSONALITY.length, 'chars');
if (!DRY) await db.collection('bot-yoga_config').doc('bot_config').set({ botPersonality: PERSONALITY, updatedAt: new Date() }, { merge: true });
console.log(DRY ? 'DRY RUN, nada escrito' : 'OK');
