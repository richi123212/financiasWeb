import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularMetricasGlobales, calcularInfoQuincena } from '../src/utils/financeCalculators.ts';

const debt = [{ id: 'card', saldo_actual: 1000, limite_credito: 10000 }];
const bills = [{ monto: 500, pagado_este_mes: false }, { monto: 800, pagado_este_mes: true }];
const metrics = reserve => calcularMetricasGlobales(debt, [], [], [], bills, 10000, reserve);

test('reserves reduce spending and purchase margins without changing bank or credit balances', () => {
  const result = metrics(4000);
  assert.equal(result.saldoEfectivoDebito, 10000);
  assert.equal(result.totalReservado, 4000);
  assert.equal(result.disponibleRealGastos, 6000);
  assert.equal(result.margenSeguroLibre, 5000);
  assert.equal(result.margenDespuesDeGastosFijos, 4500);
  assert.equal(result.lineaCreditoDisponible, metrics(0).lineaCreditoDisponible);
});
test('releasing reserves restores available money without recording fictitious income', () => {
  assert.equal(metrics(2500).disponibleRealGastos - metrics(4000).disponibleRealGastos, 1500);
  assert.equal(metrics(2500).saldoEfectivoDebito, metrics(4000).saldoEfectivoDebito);
});
test('a deficit remains visible instead of being clamped to zero', () => {
  const result = metrics(11000);
  assert.equal(result.disponibleRealGastos, -1000);
  assert.equal(result.margenDespuesDeGastosFijos, -2500);
  assert.equal(result.estadoSemaforo, 'peligro');
});
test('payday projection excludes protected money', () => {
  const m = metrics(4000);
  const projection = calcularInfoQuincena(new Date(2026, 9, 28), m.margenDespuesDeGastosFijos, 6750, m.deudaTotalConGastosFijos, m.disponibleRealGastos);
  assert.equal(projection.saldoTotalProyectadoConQuincena, 11250);
});
test('decimal reserves preserve currency precision and existing callers remain compatible', () => {
  const result = calcularMetricasGlobales([], [], [], [], [], 100.10, 25.05);
  assert.equal(result.disponibleRealGastos, 75.05);
  assert.equal(calcularMetricasGlobales([], [], [], [], [], 100).margenSeguroLibre, 100);
});
