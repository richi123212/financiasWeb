import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateGymHistory, mergeGymRemote, queueGymSave, queueGymDelete } from '../src/lib/gymOffline.ts';
const record = id => ({ id, user_id: 'one', rutina_nombre: 'pecho', fecha: '2026-10-28', ejercicios: [] });

test('migración conserva originales y solo encola registros antiguos explícitamente locales', () => {
  const originals = [record('uuid-cloud'), record('local-1'), { ...record('other'), user_id: 'two' }, record('seed-1')];
  const backup = structuredClone(originals);
  const migrated = migrateGymHistory(originals, 'one', () => 'stable-id');
  assert.deepEqual(migrated.records.map(r => r.id), ['uuid-cloud', 'stable-id']);
  assert.deepEqual(migrated.pending.map(r => r.id), ['stable-id']);
  assert.deepEqual(originals, backup);
});
test('reintentos del mismo registro usan la misma operación y no crean duplicados', () => {
  let store = { records: [], pending: [] };
  store = queueGymSave(store, record('stable-id'));
  store = queueGymSave(store, record('stable-id'));
  assert.equal(store.records.length, 1); assert.equal(store.pending.length, 1);
  const merged = mergeGymRemote(store, [record('stable-id'), record('cloud')]);
  assert.equal(merged.records.length, 2); assert.equal(merged.pending.length, 1);
});
test('las eliminaciones pendientes ocultan la nube y no resucitan registros', () => {
  let store = queueGymSave({ records: [record('cached-deleted')], pending: [] }, record('lost-response'));
  store = queueGymDelete(store, 'lost-response');
  assert.equal(store.pending[0].kind, 'delete');
  const merged = mergeGymRemote(store, [record('lost-response'), record('existing')]);
  assert.deepEqual(merged.records.map(r => r.id), ['existing']);
  assert.equal(merged.pending.length, 1);
});
