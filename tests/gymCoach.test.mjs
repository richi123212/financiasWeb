import test from 'node:test';
import assert from 'node:assert/strict';
import { crearPlanGym, recomendarModalidad } from '../src/lib/gymCoach.ts';

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
