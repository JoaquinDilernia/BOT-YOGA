import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseProductName, buildClases, filterClases, formatClases, todayAR } from './clases.js';

const product = (id, name, variants, extra = {}) => ({
  id, name: { es: name }, published: true, created_at: '2026-10-01T12:00:00Z',
  canonical_url: `https://tienda.test/productos/${id}/`, variants, ...extra,
});
const variant = (id, time, stock, price = 25000) => ({ id, values: [{ es: time }], stock, stock_management: true, price: String(price) });

const NOW = new Date('2026-10-30T15:00:00Z');

test('parseProductName: fecha, título y lugar', () => {
  assert.deepEqual(
    parseProductName('Sábado 24 de Octubre • Palermo • Mario Bravo 1029', '2026-10-01'),
    { date: '2026-10-24', title: 'Sábado 24 de Octubre', place: 'Palermo • Mario Bravo 1029' },
  );
  assert.equal(parseProductName('Gift Card $30.000').date, null);
});

test('parseProductName: una fecha de enero creada en diciembre es del año siguiente', () => {
  assert.equal(parseProductName('Sábado 9 de Enero • Palermo', '2026-12-10').date, '2027-01-09');
});

test('todayAR usa la hora de Argentina', () => {
  assert.equal(todayAR(new Date('2026-10-31T02:00:00Z')), '2026-10-30');
});

test('buildClases: solo de hoy en adelante, ordenadas, gift cards aparte', () => {
  const { clases, otros } = buildClases([
    product(1, 'Sábado 7 de Noviembre • Palermo', [variant(11, '17:00', 10), variant(12, '10:00', 2)]),
    product(2, 'Sábado 24 de Octubre • Palermo', [variant(21, '10:00', 5)]),
    product(3, 'Viernes 30 de Octubre • Belgrano', [variant(31, '19:00', 0)]),
    product(4, 'Gift Card', [variant(41, 'Única', null, 30000)]),
    product(5, 'Domingo 8 de Noviembre • Palermo', [variant(51, '10:00', 3)], { published: false }),
  ], { now: NOW });
  assert.deepEqual(clases.map((c) => c.variantId), [31, 12, 11]);
  assert.equal(clases[0].spotsLabel, 'Completa');
  assert.equal(clases[1].spotsLabel, 'Quedan 2 lugares');
  assert.equal(clases[2].spotsLabel, 'Hay lugares');
  assert.deepEqual(otros.map((p) => p.id), [4]);
});

test('filterClases por rango y lugar sin tildes', () => {
  const { clases } = buildClases([
    product(1, 'Sábado 7 de Noviembre • Palermo', [variant(11, '10:00', 10)]),
    product(2, 'Domingo 15 de Noviembre • Núñez', [variant(21, '10:00', 10)]),
  ], { now: NOW });
  assert.deepEqual(filterClases(clases, { lugar: 'nunez' }).map((c) => c.variantId), [21]);
  assert.deepEqual(filterClases(clases, { hasta: '2026-11-10' }).map((c) => c.variantId), [11]);
});

test('formatClases agrupa por fecha y trae ids internos y link', () => {
  const { clases, otros } = buildClases([
    product(1, 'Sábado 7 de Noviembre • Palermo', [variant(11, '10:00', 2), variant(12, '17:00', 10)]),
    product(4, 'Gift Card', [variant(41, 'Única', null, 30000)]),
  ], { now: NOW });
  const text = formatClases(clases, otros);
  assert.match(text, /Sábado 7 de Noviembre — Palermo \(2026-11-07\) \[producto_id 1\]/);
  assert.match(text, /- 10:00: Quedan 2 lugares — \$\s?25\.000 \[variante_id 11\]/);
  assert.match(text, /Link: https:\/\/tienda\.test\/productos\/1\//);
  assert.match(text, /Gift Card — \$\s?30\.000 \[producto_id 4\] \[variante_id 41\]/);
  assert.match(formatClases([], []), /No hay clases publicadas/);
});
