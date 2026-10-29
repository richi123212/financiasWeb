import test from 'node:test';
import assert from 'node:assert/strict';
import { cargaReferenciaGym, crearPlanGym, recomendarModalidad } from '../src/lib/gymCoach.ts';

test('las modalidades ordenan cargas sin superar la referencia ni mutar registros', () => {
  assert.deepEqual(crearPlanGym('ascendente', 7, 'barras').map(s => s.peso), [4, 5, 7]);
  assert.deepEqual(crearPlanGym('inversa', 7, 'barras').map(s => s.peso), [7, 5, 4]);
  assert.deepEqual(crearPlanGym('constante', 7, 'barras').map(s => s.peso), [7, 7, 7]);
  assert.deepEqual(crearPlanGym('drop_set', 7, 'barras').map(s => s.peso), [7, 5, 3]);
  assert.deepEqual(crearPlanGym('ascendente', NaN, 'kg'), []);
});
test('dolor bloquea recomendación y técnica dudosa prioriza control', () => {
  assert.equal(recomendarModalidad('Press', 'kg', [], 'dolor').modalidad, null);
  assert.equal(recomendarModalidad('Press', 'kg', [], 'dudosa').modalidad, 'constante');
  assert.equal(recomendarModalidad('Press', 'peso_corporal', [], 'controlada').modalidad, 'constante');
});
test('solo usa historial del mismo ejercicio y unidad, sin modificarlo', () => {
  const historial = [1, 2].map(i => ({ fecha: `2026-10-0${i}`, ejercicios: [{ nombre: 'Préss', tipo_carga: 'kg', series: [{ peso: 7, reps: 10 }] }] }));
  const copia = structuredClone(historial);
  assert.equal(recomendarModalidad('press', 'kg', historial, 'controlada').modalidad, 'ascendente');
  assert.equal(recomendarModalidad('press', 'barras', historial, 'controlada').modalidad, 'constante');
  assert.deepEqual(historial, copia);
});

test('día ligero reduce series y carga sin forzar aumentos ni cargas negativas', () => {
  const ligero = crearPlanGym('constante', 50, 'kg', 'tecnica');
  assert.equal(ligero.length, 2);
  assert.deepEqual(ligero.map(s => s.peso), [40, 40]);
  assert.deepEqual(crearPlanGym('constante', 1, 'barras', 'tecnica').map(s => s.peso), [1, 1]);
  assert.deepEqual(crearPlanGym('constante', 0, 'peso_corporal', 'tecnica').map(s => s.peso), [0, 0]);
  assert.equal(recomendarModalidad('Press', 'kg', [], 'controlada', 'tecnica').modalidad, 'constante');
  assert.equal(recomendarModalidad('Press', 'kg', [], 'dolor', 'tecnica').modalidad, null);
});

test('jueves ligero no rebaja la referencia del próximo lunes y respeta unidades', () => {
  const historial = [
    { fecha: '2026-10-22', ejercicios: [{ nombre: 'Press', tipo_carga: 'kg', enfoque: 'tecnica', series: [{ peso: 40, reps: 8 }] }] },
    { fecha: '2026-10-19', ejercicios: [{ nombre: 'Press', tipo_carga: 'kg', series: [{ peso: 50, reps: 8 }, { peso: 100, reps: 1, tipo: 'calentamiento' }] }] },
  ];
  const copia = structuredClone(historial);
  assert.equal(cargaReferenciaGym('Press', 'kg', historial, 10), 50);
  assert.equal(cargaReferenciaGym('Press', 'barras', historial, 7), 7);
  assert.equal(cargaReferenciaGym('Otro', 'kg', historial, 10), 10);
  assert.deepEqual(historial, copia);
});
