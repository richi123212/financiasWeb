import { useCallback, useEffect, useRef, useState } from 'react';
import { Cloud, Download, Eye, File, FileUp, LockKeyhole, RefreshCw, Trash2 } from 'lucide-react';
import type { UserProfile } from '../types';
import type { DriveFile, FileCategory } from '../types/files';
import { driveUrl, fileError, listDriveFiles } from '../lib/filesData';
import { categoryLabels, formatBytes, previewType } from '../lib/fileUtils';
import { EmptyState } from './ModuleUI';
import { FileDeleteDialog, FilePreviewDialog, FileUploadDialog } from './FileDialogs';

export function DriveTracker({ user }: { user: UserProfile }) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<FileCategory | 'all'>('all');
  const [upload, setUpload] = useState<DriveFile | true | null>(null);
  const [deleting, setDeleting] = useState<DriveFile | null>(null);
  const [preview, setPreview] = useState<DriveFile | null>(null);
  const [downloading, setDownloading] = useState('');
  const request = useRef(0);
  const reload = useCallback(async () => {
    const id = ++request.current;
    try { const data = await listDriveFiles(user.id); if (id === request.current) { setError(''); setFiles(data); } }
    catch (err) { if (id === request.current) setError(fileError(err)); }
    finally { if (id === request.current) setLoading(false); }
  }, [user.id]);
  const cancelRequest = useCallback(() => { request.current++; }, []);
  useEffect(() => { void reload(); return cancelRequest; }, [reload, cancelRequest]);
  const download = async (file: DriveFile) => {
    setDownloading(file.id); setError('');
    try {
      const url = await driveUrl(file, true);
      const link = document.createElement('a'); link.href = url; link.download = file.file_name;
      document.body.appendChild(link); link.click(); link.remove();
    } catch (err) { setError(fileError(err)); }
    finally { setDownloading(''); }
  };
  const visible = files.filter(f => (category === 'all' || f.category === category) && f.file_name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <div className="module-space space-y-6">
    <section className="module-hero"><div className="module-hero-top"><div className="module-title-row"><div className="module-hero-icon"><Cloud size={30} /></div><div><span className="module-eyebrow">TUS ARCHIVOS, CONTIGO</span><h1>Drive Personal</h1><p>Videos, documentos, imágenes y respaldos en tu espacio privado.</p></div></div><button className="module-primary" onClick={() => setUpload(true)}><FileUp size={18} />Subir archivo</button></div><div className="file-meta mt-5"><span className="file-badge flex items-center gap-2"><LockKeyhole size={13} />Privado por cuenta</span><span className="file-badge">Cargas reanudables</span><span className="file-badge">Enlaces temporales</span></div></section>
    <div className="file-stats"><div><strong>{files.filter(f => f.status === 'ready').length}</strong><span>Archivos disponibles</span></div><div><strong>{formatBytes(files.filter(f => f.status === 'ready').reduce((n,f) => n + Number(f.file_size_bytes),0))}</strong><span>En archivos completos</span></div><div><strong>{files.filter(f => f.status !== 'ready').length}</strong><span>Cargas o eliminaciones pendientes</span></div></div>
    {error && <div role="alert" className="module-alert">{error}<button className="ml-3 underline" onClick={() => void reload()}>Reintentar</button></div>}
    <div className="file-tools"><input className="module-field" type="search" aria-label="Buscar archivos" placeholder="Buscar en tu Drive…" value={query} onChange={e => setQuery(e.target.value)} /><select className="module-field" aria-label="Tipo de archivo" value={category} onChange={e => setCategory(e.target.value as FileCategory | 'all')}><option value="all">Todos los formatos</option>{Object.entries(categoryLabels).map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select><button className="module-secondary" aria-label="Actualizar archivos" onClick={() => void reload()}><RefreshCw size={17} /></button></div>
    {loading ? <p role="status" className="text-slate-400">Cargando tu Drive…</p> : visible.length === 0 ? <EmptyState icon={<Cloud size={40} />} title={files.length ? 'No hay coincidencias' : 'Tu espacio para guardar lo importante'} description={files.length ? 'Prueba otro nombre o tipo de archivo.' : 'Sube tu primer archivo. Solo tú podrás consultarlo con tu cuenta.'} action={<button className="module-primary" onClick={() => setUpload(true)}>Subir archivo</button>} /> : <div className="file-grid">{visible.map(file => <article className={`file-card ${file.status !== 'ready' ? 'file-pending' : ''}`} key={file.id}>
      <div className="flex items-start justify-between gap-3"><div className="file-card-icon"><File size={25} /></div><span className="file-badge">{categoryLabels[file.category]}</span></div><h3>{file.file_name}</h3><div className="file-meta"><span>{formatBytes(Number(file.file_size_bytes))}</span><span>{new Date(file.created_at).toLocaleDateString('es-MX')}</span></div>
      {file.status !== 'ready' && <p className="text-xs text-amber-200">{file.status === 'uploading' ? 'Carga pendiente. Selecciona el mismo archivo para reanudar o confirmar su subida.' : 'Eliminación pendiente. Reintenta para completar la limpieza.'}</p>}
      <div className="file-card-actions">{file.status === 'ready' ? <><button className="module-primary" disabled={downloading === file.id} onClick={() => void download(file)}><Download size={15} />{downloading === file.id ? 'Preparando…' : 'Descargar'}</button>{previewType(file.file_name,file.mime_type) && <button className="module-secondary" onClick={() => setPreview(file)}><Eye size={15} />Ver</button>}</> : file.status === 'uploading' ? <button className="module-secondary" onClick={() => setUpload(file)}><FileUp size={15} />Reanudar</button> : null}<button className="module-danger" aria-label={`Eliminar ${file.file_name}`} onClick={() => setDeleting(file)}><Trash2 size={15} />{file.status === 'deleting' ? 'Completar eliminación' : 'Eliminar'}</button></div>
    </article>)}</div>}
    {upload && <FileUploadDialog kind="drive" existing={upload === true ? undefined : upload} onClose={() => setUpload(null)} onChange={() => void reload()} />}
    {deleting && <FileDeleteDialog kind="drive" file={deleting} onClose={() => setDeleting(null)} onChange={() => void reload()} />}
    {preview && <FilePreviewDialog file={preview} onClose={() => setPreview(null)} />}
  </div>;
}
