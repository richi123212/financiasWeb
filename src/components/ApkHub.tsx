import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, FileUp, History, Package, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import type { UserProfile } from '../types';
import type { ApkRelease } from '../types/files';
import { downloadApk, fileError, listReleases } from '../lib/filesData';
import { formatBytes, latestApks } from '../lib/fileUtils';
import { EmptyState, ModuleModal } from './ModuleUI';
import { FileDeleteDialog, FileUploadDialog } from './FileDialogs';

export function ApkHub({ user }: { user: UserProfile }) {
  const [releases, setReleases] = useState<ApkRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [downloading, setDownloading] = useState('');
  const [upload, setUpload] = useState<ApkRelease | true | null>(null);
  const [deleting, setDeleting] = useState<ApkRelease | null>(null);
  const [history, setHistory] = useState<ApkRelease[] | null>(null);
  const request = useRef(0);
  const reload = useCallback(async () => {
    const id = ++request.current;
    try {
      const [catalog, own] = await Promise.all([listReleases(), user ? listReleases(user.id) : Promise.resolve([])]);
      if (id === request.current) { setError(''); setReleases([...new Map([...catalog,...own].map(r => [r.id,r])).values()]); }
    } catch (err) { if (id === request.current) setError(fileError(err)); }
    finally { if (id === request.current) setLoading(false); }
  }, [user]);
  const cancelRequest = useCallback(() => { request.current++; }, []);
  useEffect(() => { void reload(); return cancelRequest; }, [reload, cancelRequest]);
  const apps = latestApks(releases).filter(versions => versions.some(r => `${r.app_name} ${r.version} ${r.changelog}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())));
  const pending = releases.filter(r => r.user_id === user?.id && r.status !== 'ready');
  const download = async (release: ApkRelease) => {
    setError(''); setDownloading(release.id);
    try { await downloadApk(release); } catch (err) { setError(fileError(err)); }
    finally { setDownloading(''); }
  };
  const downloadButton = (release: ApkRelease) => <button className="file-download" disabled={Boolean(downloading)} onClick={() => void download(release)}><Download size={27} strokeWidth={2.5} />{downloading === release.id ? 'Descargando…' : 'Descargar APK'}</button>;
  const content = <div className="module-space space-y-6">
    <section className="module-hero"><div className="module-hero-top"><div className="module-title-row"><div className="module-hero-icon"><Package size={30} /></div><div><span className="module-eyebrow">APLICACIONES PARA LLEVAR</span><h1>APK Hub</h1><p>Descarga la última edición de cada app y consulta sus novedades.</p></div></div>{user && <button className="module-primary" onClick={() => setUpload(true)}><FileUp size={18} />Publicar APK</button>}</div><div className="file-meta mt-5"><span className="file-badge">Descargas con sesión</span><span className="file-badge">Historial de versiones</span><span className="file-badge flex gap-1 items-center"><ShieldCheck size={13} />Cada autor gestiona sus publicaciones</span></div></section>
    {error && <div role="alert" className="module-alert">{error}<button className="ml-3 underline" onClick={() => void reload()}>Reintentar</button></div>}
    <div className="file-tools"><input type="search" className="module-field" placeholder="Buscar apps o novedades…" aria-label="Buscar aplicaciones" value={query} onChange={e => setQuery(e.target.value)} /><button className="module-secondary" aria-label="Actualizar aplicaciones" onClick={() => void reload()}><RefreshCw size={17} /></button><span className="text-xs text-slate-400">{apps.length} aplicaciones</span></div>
    {pending.length > 0 && <section className="space-y-3"><h2 className="font-bold text-amber-200">Tus publicaciones pendientes</h2><div className="file-grid">{pending.map(file => <article key={file.id} className="file-card file-pending"><h3>{file.app_name}</h3><p className="text-xs text-slate-400 break-all">{file.file_name} · {formatBytes(Number(file.file_size_bytes))}</p><p className="text-sm text-amber-200">{file.status === 'uploading' ? 'Carga pendiente; aún no aparece en el catálogo.' : 'Eliminación pendiente de completar.'}</p><div className="file-card-actions">{file.status === 'uploading' && <button className="module-secondary" onClick={() => setUpload(file)}>Reanudar carga</button>}<button className="module-danger" onClick={() => setDeleting(file)}>{file.status === 'deleting' ? 'Completar eliminación' : 'Eliminar carga'}</button></div></article>)}</div></section>}
    {loading ? <p role="status">Cargando catálogo…</p> : apps.length === 0 ? <EmptyState icon={<Package size={40} />} title={query ? 'No hay coincidencias' : 'Las próximas apps estarán aquí'} description={query ? 'Prueba otro nombre o consulta el catálogo completo.' : 'Cada publicación incluirá novedades, versiones y su enlace de descarga.'} /> : <div className="file-grid">{apps.map(versions => {
      const latest = versions[0];
      return <article key={`${latest.user_id}:${latest.app_slug}`} className="file-card"><div className="flex items-start justify-between gap-2"><div className="file-card-icon"><Package size={27} /></div><span className="file-badge">Última edición · #{latest.release_number}</span></div><div><h3>{latest.app_name}</h3><p className="text-sm text-indigo-300 mt-1">{latest.version}</p></div><div className="file-meta"><span>{formatBytes(Number(latest.file_size_bytes))}</span><span>{new Date(latest.published_at || latest.created_at).toLocaleDateString('es-MX')}</span>{latest.user_id === user?.id && <span>Tu publicación</span>}</div><p className="text-sm text-slate-300 whitespace-pre-wrap max-h-44 overflow-y-auto">{latest.changelog || 'Esta edición no incluye notas adicionales.'}</p>{downloadButton(latest)}<div className="file-card-actions"><button className="module-secondary" onClick={() => setHistory(versions)}><History size={15} />{versions.length} versiones</button>{latest.user_id === user?.id && <button className="module-danger" aria-label={`Eliminar ${latest.file_name}`} onClick={() => setDeleting(latest)}><Trash2 size={15} />Eliminar versión</button>}</div></article>;
    })}</div>}
    {upload && user && <FileUploadDialog kind="apk" existing={upload === true ? undefined : upload} onClose={() => setUpload(null)} onChange={() => void reload()} />}
    {deleting && user && deleting.user_id === user.id && <FileDeleteDialog kind="apk" file={deleting} onClose={() => setDeleting(null)} onChange={() => void reload()} />}
    {history && <ModuleModal title={`Versiones de ${history[0].app_name}`} subtitle="La edición más reciente aparece primero." onClose={() => setHistory(null)}><div className="module-form space-y-4">{history.map(file => <article key={file.id} className="rounded-2xl border border-slate-700 bg-slate-900 p-4 space-y-3"><div className="flex justify-between gap-2"><strong>{file.version}</strong><span className="text-xs text-slate-400">#{file.release_number} · {formatBytes(Number(file.file_size_bytes))}</span></div><p className="text-sm text-slate-300 whitespace-pre-wrap">{file.changelog || 'Sin notas de versión.'}</p>{downloadButton(file)}{file.user_id === user?.id && <button className="module-danger" onClick={() => { setHistory(null); setDeleting(file); }}><Trash2 size={15} />Eliminar esta versión</button>}</article>)}</div></ModuleModal>}
  </div>;
  return content;
}
