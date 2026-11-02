import test from 'node:test';
import assert from 'node:assert/strict';
import { appSlug, fileMime, latestApks, previewType } from '../src/lib/fileUtils.ts';

test('el catalogo agrupa por autor y app y ordena por edicion, no por hora de carga', () => {
  const entries = [
    { id:'old', user_id:'a', app_slug:'game', release_number:1, status:'ready', created_at:'2026-12-01' },
    { id:'new', user_id:'a', app_slug:'game', release_number:2, status:'ready', created_at:'2026-11-01' },
    { id:'other', user_id:'b', app_slug:'game', release_number:1, status:'ready' },
    { id:'pending', user_id:'a', app_slug:'game', release_number:3, status:'uploading' },
    { id:'deleted', user_id:'a', app_slug:'game', release_number:4, status:'deleting' },
  ];
  const original = structuredClone(entries);
  const groups = latestApks(entries);
  assert.equal(groups.length,2); assert.deepEqual(groups[0].map(r => r.id),['new','old']);
  assert.deepEqual(entries,original);
});
test('normaliza nombres y MIME sin tratar HTML o SVG como vistas ejecutables', () => {
  assert.equal(appSlug(' Mi Aplicación #1 '),'mi-aplicacion-1');
  assert.equal(fileMime({name:'APP.APK',type:''}),'application/vnd.android.package-archive');
  assert.equal(previewType('index.html','text/html'),null);
  assert.equal(previewType('script.svg','image/svg+xml'),null);
  assert.equal(previewType('foto.png','image/png'),'image');
  assert.equal(previewType('respaldo.zip','application/zip'),null);
});
