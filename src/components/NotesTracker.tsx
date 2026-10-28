import { useState } from 'react';
import type { Note, NoteFolder, UserProfile } from '../types';
import * as api from '../lib/notesData';
import { useModuleData } from '../hooks/useModuleData';

const field = 'w-full rounded-xl bg-slate-900 border border-slate-700 p-3 text-white';
const button = 'rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 hover:bg-slate-700 disabled:opacity-50';
const empty = { folders: [] as NoteFolder[], notes: [] as Note[] };
export function NotesTracker({ user, demo }: { user: UserProfile; demo: boolean }) {
  const { data, loading, error, reload, saveDemo } = useModuleData(`notes-demo:${user.id}`, demo, empty, async () => {
    const [folders, notes] = await Promise.all([api.getFolders(user.id), api.getNotes(user.id)]);
    return { folders, notes };
  });
  const [folder, setFolder] = useState('all');
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('');
  const [draft, setDraft] = useState<Note | null>(null);
  const [folderDraft, setFolderDraft] = useState<NoteFolder | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const [preview, setPreview] = useState(false);
  async function run(action: () => Promise<void>) {
    setBusy(true); setFailure('');
    try { await action(); } catch (e) { setFailure((e as Error).message || 'No se pudo guardar.'); }
    finally { setBusy(false); }
  }
  function newNote() {
    setPreview(false);
    setDraft({ id: '', user_id: user.id, title: '', content: '', folder_id: folder === 'all' || folder === 'none' ? null : folder, tags: [], pinned: false });
  }
  const filtered = data.notes.filter(n => (folder === 'all' || (folder === 'none' ? !n.folder_id : n.folder_id === folder)) && (!tag || n.tags.includes(tag)) && `${n.title} ${n.content}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || (b.updated_at || '').localeCompare(a.updated_at || ''));
  return <section className="space-y-5 text-slate-100">
    <div className="flex flex-wrap justify-between gap-3"><div><h1 className="text-3xl font-black">Notas & Carpetas</h1><p className="text-slate-400">Ideas, pendientes y conocimiento en un lugar.</p></div><button className={button} onClick={newNote} disabled={loading || !!error}>+ Nueva nota</button></div>
    {(error || failure) && <div role="alert" className="rounded-xl bg-red-950 p-4">{error || failure} <button onClick={() => void reload()} className={button}>Reintentar</button></div>}
    {loading ? <p role="status">Cargando notas…</p> : <div className="grid gap-5 md:grid-cols-[240px_1fr]">
      <aside className="rounded-2xl border border-slate-800 bg-[#161F30] p-4 space-y-3">
        <label className="block">Carpeta<select className={field} value={folder} onChange={e => setFolder(e.target.value)}><option value="all">Todas las notas ({data.notes.length})</option><option value="none">Sin clasificar</option>{data.folders.map(f => <option key={f.id} value={f.id}>{f.icon} {f.name}</option>)}</select></label>
        <button className={button} onClick={() => setFolderDraft({ id: '', user_id: user.id, name: '', color_hex: '#6366f1', icon: '📁' })}>+ Carpeta</button>
        {data.folders.map(f => <div key={f.id} className="flex items-center gap-2"><button className="flex-1 text-left break-words" style={{ color: f.color_hex }} onClick={() => setFolder(f.id)}>{f.icon} {f.name}</button><button aria-label={`Editar carpeta ${f.name}`} onClick={() => setFolderDraft({ ...f })}>✎</button><button disabled={busy} aria-label={`Eliminar carpeta ${f.name}`} onClick={() => {
          if (confirm(`¿Eliminar “${f.name}”? Sus notas pasarán a Sin clasificar.`)) void run(async () => {
            if (demo) saveDemo({ folders: data.folders.filter(x => x.id !== f.id), notes: data.notes.map(n => n.folder_id === f.id ? { ...n, folder_id: null } : n) });
            else { await api.deleteFolder(f.id); await reload(); }
            if (folder === f.id) setFolder('none');
          });
        }}>×</button></div>)}
      </aside>
      <div className="space-y-4"><div className="flex flex-wrap gap-3"><input className={`${field} flex-1`} aria-label="Buscar notas" placeholder="Buscar por título o contenido…" value={query} onChange={e => setQuery(e.target.value)} /><select className={field + ' md:w-52'} aria-label="Filtrar por etiqueta" value={tag} onChange={e => setTag(e.target.value)}><option value="">Todas las etiquetas</option>{[...new Set(data.notes.flatMap(n => n.tags))].sort().map(t => <option key={t}>{t}</option>)}</select></div>
        {!filtered.length && <p className="p-8 text-slate-400">No hay notas que coincidan. Crea una nota o cambia los filtros.</p>}
        <div className="grid gap-4 lg:grid-cols-2">{filtered.map(n => <article key={n.id} className="rounded-2xl border border-slate-700 bg-[#161F30] p-5 space-y-3" style={{ borderTopColor: data.folders.find(f => f.id === n.folder_id)?.color_hex }}>
          <button className="block text-left w-full" onClick={() => { setPreview(false); setDraft({ ...n }); }}><h2 className="text-xl font-bold break-words">{n.pinned && '📌 '}{n.title}</h2><p className="text-slate-400 whitespace-pre-wrap break-words line-clamp-3">{n.content}</p></button><p className="text-sm text-indigo-300">{n.tags.map(t => `#${t}`).join(' ')}</p><p className="text-xs text-slate-500">{n.updated_at && new Date(n.updated_at).toLocaleString('es-MX')}</p>
          <div className="flex gap-2"><button className={button} disabled={busy} onClick={() => void run(async () => { if (demo) saveDemo({ ...data, notes: data.notes.map(x => x.id === n.id ? { ...x, pinned: !x.pinned } : x) }); else { await api.updateNote(n.id, { pinned: !n.pinned }); await reload(); } })}>{n.pinned ? 'Desfijar' : 'Fijar'}</button><button className={button} disabled={busy} onClick={() => { if (confirm('¿Eliminar esta nota permanentemente?')) void run(async () => { if (demo) saveDemo({ ...data, notes: data.notes.filter(x => x.id !== n.id) }); else { await api.deleteNote(n.id); await reload(); } }); }}>Eliminar</button></div>
        </article>)}</div>
      </div>
    </div>}
    {folderDraft && <div className="fixed inset-0 z-50 bg-black/80 overflow-y-auto p-4 flex items-start justify-center"><form className="my-10 w-full max-w-lg rounded-2xl bg-[#161F30] p-6 space-y-4" onSubmit={e => { e.preventDefault(); void run(async () => {
      const values = { name: folderDraft.name.trim(), color_hex: folderDraft.color_hex, icon: folderDraft.icon };
      if (!values.name) throw new Error('Escribe un nombre de carpeta.');
      if (demo) saveDemo({ ...data, folders: folderDraft.id ? data.folders.map(f => f.id === folderDraft.id ? { ...f, ...values } : f) : [...data.folders, { ...folderDraft, ...values, id: crypto.randomUUID() }] });
      else { if (folderDraft.id) await api.updateFolder(folderDraft.id, values); else await api.addFolder(user.id, values); await reload(); }
      setFolderDraft(null);
    }); }}><h2 className="text-xl font-bold">Carpeta</h2><label className="block">Nombre<input autoFocus required maxLength={100} className={field} value={folderDraft.name} onChange={e => setFolderDraft({ ...folderDraft, name: e.target.value })} /></label><label className="block">Ícono<input maxLength={16} className={field} value={folderDraft.icon} onChange={e => setFolderDraft({ ...folderDraft, icon: e.target.value })} /></label><label className="block">Color<input type="color" className="block" value={folderDraft.color_hex} onChange={e => setFolderDraft({ ...folderDraft, color_hex: e.target.value })} /></label>{failure && <p role="alert">{failure}</p>}<button className={button} disabled={busy}>Guardar</button> <button type="button" className={button} disabled={busy} onClick={() => setFolderDraft(null)}>Cancelar</button></form></div>}
    {draft && <div className="fixed inset-0 z-50 bg-black/80 overflow-y-auto p-4 flex items-start justify-center"><form className="my-6 w-full max-w-3xl rounded-2xl bg-[#161F30] p-6 space-y-4" onSubmit={e => { e.preventDefault(); void run(async () => {
      const values = { title: draft.title.trim(), content: draft.content, folder_id: draft.folder_id, tags: [...new Set(draft.tags.map(t => t.trim()).filter(Boolean))], pinned: draft.pinned };
      if (!values.title) throw new Error('Escribe un título.');
      if (demo) { const now = new Date().toISOString(); saveDemo({ ...data, notes: draft.id ? data.notes.map(n => n.id === draft.id ? { ...n, ...values, updated_at: now } : n) : [{ ...draft, ...values, id: crypto.randomUUID(), created_at: now, updated_at: now }, ...data.notes] }); }
      else { if (draft.id) await api.updateNote(draft.id, values); else await api.addNote(user.id, values); await reload(); }
      setDraft(null);
    }); }}><h2 className="text-xl font-bold">{draft.id ? 'Editar nota' : 'Nueva nota'}</h2><label className="block">Título<input autoFocus required maxLength={200} className={field} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></label><label className="block">Carpeta<select className={field} value={draft.folder_id || ''} onChange={e => setDraft({ ...draft, folder_id: e.target.value || null })}><option value="">Sin clasificar</option>{data.folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
      <button type="button" className={button} onClick={() => setPreview(!preview)}>{preview ? 'Editar contenido' : 'Vista previa'}</button><p className="text-xs text-slate-400">Markdown ligero: # encabezado, ## subtítulo, - lista. El texto se guarda sin perder su formato.</p>
      {preview ? <div className="min-h-60 break-words">{draft.content.split('\n').map((line, i) => line.startsWith('# ') ? <h2 className="text-2xl font-bold" key={i}>{line.slice(2)}</h2> : line.startsWith('## ') ? <h3 className="text-xl font-bold" key={i}>{line.slice(3)}</h3> : <p className="whitespace-pre-wrap min-h-6" key={i}>{line.startsWith('- ') ? `• ${line.slice(2)}` : line}</p>)}</div> : <label className="block">Contenido<textarea rows={12} className={field} value={draft.content} onChange={e => setDraft({ ...draft, content: e.target.value })} /></label>}
      <label className="block">Etiquetas separadas por comas<input className={field} value={draft.tags.join(',')} onChange={e => setDraft({ ...draft, tags: e.target.value.split(',') })} /></label><label className="block"><input type="checkbox" checked={draft.pinned} onChange={e => setDraft({ ...draft, pinned: e.target.checked })} /> Fijar al inicio</label>{failure && <p role="alert">{failure}</p>}<button className={button} disabled={busy}>Guardar nota</button> <button type="button" className={button} disabled={busy} onClick={() => setDraft(null)}>Cancelar</button>
    </form></div>}
  </section>;
}
