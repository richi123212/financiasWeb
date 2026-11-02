import { useEffect, useRef, useState } from 'react';
import { FileUp, Pause, ShieldAlert, Trash2 } from 'lucide-react';
import { ModuleModal } from './ModuleUI';
import { completeFile, deleteFile, driveUrl, fileError, reserveFile, resumableUpload } from '../lib/filesData';
import { formatBytes, previewType } from '../lib/fileUtils';
import type { ApkRelease, DriveFile, FileKind, StoredFile } from '../types/files';
import './files.css';

export function FileUploadDialog({ kind, existing, onClose, onChange }: { kind: FileKind; existing?: StoredFile; onClose: () => void; onChange: () => void }) {
  const apk = existing as ApkRelease | undefined;
  const [file, setFile] = useState<File | null>(null);
  const [record, setRecord] = useState(existing);
  const [name, setName] = useState(apk?.app_name || '');
  const [version, setVersion] = useState(apk?.version || '');
  const [changelog, setChangelog] = useState(apk?.changelog || '');
  const [busy, setBusy] = useState(false);
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState('');
  const task = useRef<ReturnType<typeof resumableUpload> | null>(null);
  const locked = useRef(false);
  useEffect(() => () => { void task.current?.pause().catch(() => {}); }, []);
  const upload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file || locked.current) return;
    if (!file.size) { setError('El archivo está vacío.'); return; }
    if (kind === 'apk' && !file.name.toLowerCase().endsWith('.apk')) { setError('Selecciona un archivo .apk.'); return; }
    if (record && (record.file_name !== file.name || record.file_size_bytes !== file.size)) { setError('Para reanudar, selecciona el mismo archivo con el mismo nombre y tamaño.'); return; }
    locked.current = true; setBusy(true); setError('');
    try {
      const item = record || await reserveFile(kind, file, { appName: name, version, changelog });
      setRecord(item); onChange();
      if (record) {
        try { await completeFile(kind, item.id); onChange(); onClose(); return; }
        catch (err) { if (!/carga aun|no esta completa|tamano no coincide/i.test(fileError(err))) throw err; }
      }
      task.current = resumableUpload(kind, item, file, setPercent);
      await task.current.promise;
      task.current = null;
      await completeFile(kind, item.id);
      onChange(); onClose();
    } catch (err) { setError(fileError(err)); onChange(); }
    finally { task.current = null; locked.current = false; setBusy(false); }
  };
  return <ModuleModal title={kind === 'apk' ? 'Publicar una aplicación' : 'Subir a tu Drive'} subtitle={kind === 'apk' ? 'El APK estará disponible para las cuentas del portal. Se requiere sesión para descargarlo.' : 'Tus archivos son privados y solo se abren con enlaces temporales.'} onClose={onClose} busy={busy}>
    <form onSubmit={e => void upload(e)} className="module-form space-y-4">
      {kind === 'apk' && <><label className="module-label">Nombre de la aplicación<input required maxLength={100} className="module-field" aria-label="Nombre de la aplicación" value={name} disabled={busy || Boolean(record)} onChange={e => setName(e.target.value)} /></label><label className="module-label">Versión del APK (opcional)<input maxLength={60} className="module-field" aria-label="Versión del APK" placeholder="Ej. 1.0.0; en blanco: edición automática" value={version} disabled={busy || Boolean(record)} onChange={e => setVersion(e.target.value)} /></label><label className="module-label">Novedades<textarea maxLength={10000} rows={3} className="module-field" aria-label="Novedades" value={changelog} disabled={busy || Boolean(record)} onChange={e => setChangelog(e.target.value)} /></label></>}
      <label className="file-dropzone"><FileUp size={32} /><strong>{file ? file.name : record ? `Selecciona de nuevo ${record.file_name}` : 'Selecciona un archivo'}</strong><span>{file ? formatBytes(file.size) : 'Cargas por bloques de 6 MB, con reanudación'}</span><input aria-label="Archivo para subir" type="file" required accept={kind === 'apk' ? '.apk' : undefined} disabled={busy} onChange={e => setFile(e.target.files?.[0] || null)} /></label>
      <p className="text-xs text-slate-400">Se aplica el límite de archivo y espacio de tu proyecto Supabase. Si pausas o cierras la página, vuelve a elegir el mismo archivo para continuar. La edición automática ordena publicaciones; no modifica la versión interna del APK.</p>
      {busy && <div role="status" className="space-y-2"><div className="flex justify-between text-sm"><span>{percent === 100 ? 'Confirmando archivo…' : 'Subiendo…'}</span><strong>{percent}%</strong></div><progress aria-label="Progreso de subida" value={percent} max={100} className="file-progress" /></div>}
      {error && <div role="alert" className="module-alert">{error}</div>}
      <div className="module-form-footer">{busy ? <button type="button" className="module-secondary" onClick={() => void task.current?.pause().catch(err => setError(fileError(err)))}><Pause size={16} />Pausar carga</button> : <button type="button" className="module-secondary" onClick={onClose}>Cerrar</button>}<button className="module-primary" disabled={busy || !file} type="submit"><FileUp size={16} />{busy ? 'Subiendo…' : record ? 'Reanudar / confirmar' : kind === 'apk' ? 'Subir y publicar APK' : 'Subir archivo'}</button></div>
    </form>
  </ModuleModal>;
}

export function FileDeleteDialog({ kind, file, onClose, onChange }: { kind: FileKind; file: StoredFile; onClose: () => void; onChange: () => void }) {
  const [typed, setTyped] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  const remove = async () => {
    if (locked.current || typed !== file.file_name || !accepted || step !== 2) return;
    locked.current = true; setBusy(true); setError('');
    try { await deleteFile(kind, file.id); onChange(); onClose(); }
    catch (err) { setError(`${fileError(err)} La eliminación sigue pendiente; puedes reintentar.`); onChange(); }
    finally { locked.current = false; setBusy(false); }
  };
  return <ModuleModal title="Eliminar definitivamente" subtitle="Esta acción elimina el archivo y su registro. No hay papelera." onClose={onClose} busy={busy}>
    <div className="module-form space-y-4"><div className="file-danger-box"><ShieldAlert size={30} /><div><strong className="break-all">{file.file_name}</strong><p>{formatBytes(file.file_size_bytes)}{kind === 'apk' ? ' · Esta versión dejará de estar disponible para descargar.' : ' · Se eliminará de tu Drive privado.'}</p></div></div>
      {step === 1 ? <><label className="module-label">Escribe el nombre completo del archivo<input autoComplete="off" className="module-field" aria-label="Confirmar nombre del archivo" value={typed} onChange={e => setTyped(e.target.value)} /></label><label className="flex items-start gap-2 text-sm text-slate-300"><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} />Entiendo que se borrará permanentemente y que no podré recuperarlo desde el portal.</label><div className="module-form-footer"><button className="module-secondary" onClick={onClose}>Conservar archivo</button><button className="module-danger" disabled={typed !== file.file_name || !accepted} onClick={() => setStep(2)}>Continuar con la eliminación</button></div></> : <><p className="font-bold text-rose-200">¿Estás completamente seguro de eliminar este archivo?</p><p className="text-sm text-slate-400">Primero se elimina de Storage. Solo se confirma al retirar también los metadatos. Si la conexión falla, quedará pendiente para reintentar.</p>{error && <div role="alert" className="module-alert">{error}</div>}<div className="module-form-footer"><button className="module-secondary" disabled={busy} onClick={onClose}>No, conservar</button><button className="module-danger" disabled={busy} onClick={() => void remove()}><Trash2 size={16} />{busy ? 'Eliminando…' : 'Sí, eliminar definitivamente'}</button></div></>}
    </div>
  </ModuleModal>;
}

export function FilePreviewDialog({ file, onClose }: { file: DriveFile; onClose: () => void }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let cancelled = false; setUrl(''); setError('');
    void driveUrl(file).then(url => { if (!cancelled) setUrl(url); }).catch(err => { if (!cancelled) setError(fileError(err)); });
    return () => { cancelled = true; };
  }, [file, refresh]);
  const type = previewType(file.file_name, file.mime_type);
  return <ModuleModal title={file.file_name} subtitle="Vista privada · enlace temporal de una hora" onClose={onClose} wide><div className="module-form space-y-4">
    {error ? <div role="alert" className="module-alert">{error}</div> : !url ? <p role="status">Preparando vista previa…</p> : <div className="file-preview">{type === 'image' ? <img src={url} alt={file.file_name} /> : type === 'video' ? <video src={url} controls playsInline preload="metadata" onError={() => setError('No se pudo reproducir. Renueva el enlace o descarga el archivo para abrirlo en tu dispositivo.')} /> : type === 'audio' ? <audio src={url} controls preload="metadata" /> : type === 'pdf' ? <iframe sandbox="allow-same-origin" title={file.file_name} src={url} /> : <p>Este formato se puede descargar para abrirlo en tu dispositivo.</p>}</div>}
    <div className="module-form-footer"><button className="module-secondary" onClick={() => setRefresh(n => n + 1)}>Renovar enlace</button><a className="module-primary" href={url || undefined} target="_blank" rel="noopener noreferrer">Abrir en otra pestaña</a></div>
  </div></ModuleModal>;
}
