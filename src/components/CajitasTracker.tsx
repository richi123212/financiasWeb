import { useState } from 'react';
import type { CajitaApartado, UserProfile } from '../types';
import * as api from '../lib/cajitasData';
import { formatCurrency as money } from '../utils/financeCalculators';

const field = 'w-full rounded-xl bg-slate-900 border border-slate-700 p-3';
const button = 'rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 hover:bg-slate-700 disabled:opacity-50';
export function ReserveSummary({ total, protectedAmount }: { total: number; protectedAmount: number }) {
  return <section className="rounded-2xl border border-emerald-500/40 bg-[#10241E] p-5 space-y-3"><div className="grid gap-4 sm:grid-cols-3">{[['Saldo Total en Cuenta', total], ['Total Protegido/Ahorrado', protectedAmount], ['Disponible Real para Gastos', Number((total - protectedAmount).toFixed(2))]].map(([label, value]) => <div key={label}><p className="text-sm text-slate-300">{label}</p><p className={`text-2xl font-black ${Number(value) < 0 ? 'text-red-400' : 'text-emerald-300'}`}>{money(Number(value))}</p></div>)}</div><p className="text-xs text-slate-400">Saldo total declarado en Finanzas − reservas. El margen para compras descuenta además deudas y gastos fijos. Apartar y liberar reclasifica dinero; no modifica el saldo bancario.</p>{protectedAmount > total && <p role="alert" className="text-amber-300">Tus reservas superan el saldo declarado. Revisa el saldo total en Finanzas.</p>}</section>;
}
export function CajitasTracker({ user, demo, apartados, total, reload, saveDemo }: { user: UserProfile; demo: boolean; apartados: CajitaApartado[]; total: number; reload: () => Promise<void>; saveDemo: (next: CajitaApartado[]) => void }) {
  const [draft, setDraft] = useState<CajitaApartado | null>(null);
  const [movement, setMovement] = useState<{ apartado: CajitaApartado; tipo: 'apartar' | 'liberar' } | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<Awaited<ReturnType<typeof api.getMovimientos>>>([]);
  const [showHistory, setShowHistory] = useState(false);
  const protectedAmount = Number(apartados.reduce((sum, a) => sum + a.current_balance, 0).toFixed(2));
  async function run(action: () => Promise<void>) { setBusy(true); setError(''); try { await action(); } catch (e) { setError((e as Error).message || 'No se pudo guardar.'); } finally { setBusy(false); } }
  return <section className="space-y-5 text-slate-100"><div className="flex flex-wrap justify-between gap-3"><div><h1 className="text-3xl font-black">Reserva & Ahorros</h1><p className="text-slate-400">Protege el dinero comprometido antes de decidir una compra.</p></div><button className={button} onClick={() => setDraft({ id: '', user_id: user.id, name: '', target_amount: 0, current_balance: 0, institution: '', notes: '', color_hex: '#10b981' })}>+ Nuevo apartado</button></div>
    <ReserveSummary total={total} protectedAmount={protectedAmount} />
    {error && <p role="alert" className="rounded-xl bg-red-950 p-4">{error}</p>}
    {!apartados.length && <p className="p-8 text-slate-400">Crea tu primer apartado y registra el dinero que deseas proteger.</p>}
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{apartados.map(a => <article key={a.id} className="rounded-2xl border border-slate-700 bg-[#161F30] p-5 space-y-3" style={{ borderTopColor: a.color_hex }}><h2 className="text-xl font-bold break-words">{a.name}</h2><p className="text-slate-400">{a.institution || 'Sin institución'}</p><p className="text-3xl font-black text-emerald-300">{money(a.current_balance)}</p>{a.target_amount > 0 && <div><progress className="w-full" max={a.target_amount} value={a.current_balance} /><p className="text-sm text-slate-400">Meta: {money(a.target_amount)} · {Math.round(a.current_balance / a.target_amount * 100)}%</p></div>}<p className="whitespace-pre-wrap break-words text-sm">{a.notes}</p><p className="text-xs text-slate-500">{a.updated_at && new Date(a.updated_at).toLocaleString('es-MX')}</p><div className="flex flex-wrap gap-2">{(['apartar', 'liberar'] as const).map(tipo => <button key={tipo} className={button} disabled={busy} onClick={() => { setAmount(''); setNote(''); setMovement({ apartado: a, tipo }); }}>{tipo === 'apartar' ? 'Apartar dinero' : 'Liberar a gasto'}</button>)}<button className={button} disabled={busy} onClick={() => setDraft({ ...a })}>Editar</button><button className={button} disabled={busy} onClick={() => {
      if (a.current_balance > 0) { setError('Libera todo el saldo antes de eliminar el apartado.'); return; }
      if (confirm(`¿Eliminar el apartado “${a.name}”?`)) void run(async () => { if (demo) saveDemo(apartados.filter(x => x.id !== a.id)); else { await api.deleteApartado(a.id); await reload(); } });
    }}>Eliminar</button></div></article>)}</div>
    <button className={button} disabled={busy} onClick={() => void run(async () => { if (!demo) setHistory(await api.getMovimientos(user.id)); setShowHistory(true); })}>Ver movimientos</button>
    {showHistory && <div className="rounded-2xl bg-[#161F30] p-5 space-y-2"><h2 className="font-bold">Movimientos {demo && '(sesión demo)'}</h2>{!history.length && <p>Sin movimientos registrados.</p>}{history.map(m => <p className="text-sm" key={m.id}>{m.created_at && new Date(m.created_at).toLocaleString('es-MX')} · {apartados.find(a => a.id === m.apartado_id)?.name || 'Apartado eliminado'} · {m.tipo} · {money(m.monto)} · {m.nota}</p>)}</div>}
    {draft && <div className="fixed inset-0 z-50 bg-black/80 overflow-y-auto p-4 flex justify-center items-start"><form className="my-8 w-full max-w-lg rounded-2xl bg-[#161F30] p-6 space-y-4" onSubmit={e => { e.preventDefault(); void run(async () => {
      const values = { name: draft.name.trim(), institution: draft.institution.trim(), notes: draft.notes, target_amount: draft.target_amount, color_hex: draft.color_hex };
      if (!values.name || !Number.isFinite(values.target_amount) || values.target_amount < 0) throw new Error('Revisa el nombre y la meta.');
      if (demo) { const updated = { ...draft, ...values, id: draft.id || crypto.randomUUID(), updated_at: new Date().toISOString() }; saveDemo(draft.id ? apartados.map(a => a.id === draft.id ? updated : a) : [...apartados, updated]); }
      else { if (draft.id) await api.updateApartado(draft.id, values); else await api.addApartado(user.id, values); await reload(); }
      setDraft(null);
    }); }}><h2 className="text-xl font-bold">Apartado</h2><label className="block">Nombre<input autoFocus className={field} required maxLength={120} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label><label className="block">Institución<input className={field} maxLength={100} value={draft.institution} onChange={e => setDraft({ ...draft, institution: e.target.value })} /></label><label className="block">Meta opcional (0 = sin meta)<input className={field} type="number" min="0" step="0.01" value={draft.target_amount} onChange={e => setDraft({ ...draft, target_amount: Number(e.target.value) })} /></label><label className="block">Notas<textarea className={field} value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} /></label><label className="block">Color<input type="color" value={draft.color_hex} onChange={e => setDraft({ ...draft, color_hex: e.target.value })} /></label><p className="text-xs text-slate-400">El saldo se modifica mediante Apartar / Liberar para conservar su historial.</p>{error && <p role="alert">{error}</p>}<button className={button} disabled={busy}>Guardar</button> <button type="button" className={button} disabled={busy} onClick={() => setDraft(null)}>Cancelar</button></form></div>}
    {movement && <div className="fixed inset-0 z-50 bg-black/80 overflow-y-auto p-4 flex justify-center items-start"><form className="my-12 w-full max-w-lg rounded-2xl bg-[#161F30] p-6 space-y-4" onSubmit={e => { e.preventDefault(); void run(async () => {
      const monto = Number(amount);
      if (!Number.isFinite(monto) || monto <= 0 || Math.abs(monto * 100 - Math.round(monto * 100)) > 0.00001) throw new Error('Ingresa un monto positivo con hasta dos decimales.');
      const current = apartados.find(a => a.id === movement.apartado.id);
      if (!current) throw new Error('El apartado ya no existe.');
      if (movement.tipo === 'liberar' && monto > current.current_balance) throw new Error('No puedes liberar más que el saldo protegido.');
      if (movement.tipo === 'apartar' && monto > total - protectedAmount) throw new Error('El monto supera el disponible. Actualiza tu saldo total en Finanzas si es necesario.');
      if (demo) { saveDemo(apartados.map(a => a.id === current.id ? { ...a, current_balance: Number((a.current_balance + (movement.tipo === 'apartar' ? monto : -monto)).toFixed(2)), updated_at: new Date().toISOString() } : a)); setHistory(prev => [{ id: crypto.randomUUID(), user_id: user.id, apartado_id: current.id, tipo: movement.tipo, monto, nota: note, created_at: new Date().toISOString() }, ...prev]); }
      else { await api.registrarMovimiento(user.id, { apartado_id: current.id, tipo: movement.tipo, monto, nota: note }); await reload(); if (showHistory) setHistory(await api.getMovimientos(user.id)); }
      setMovement(null);
    }); }}><h2 className="text-xl font-bold">{movement.tipo === 'apartar' ? 'Apartar dinero' : 'Liberar dinero a gasto'} · {movement.apartado.name}</h2><label className="block">Monto MXN<input autoFocus className={field} required type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} /></label><label className="block">Nota<input className={field} value={note} onChange={e => setNote(e.target.value)} /></label>{error && <p role="alert">{error}</p>}<button className={button} disabled={busy}>Confirmar movimiento</button> <button type="button" className={button} disabled={busy} onClick={() => setMovement(null)}>Cancelar</button></form></div>}
  </section>;
}
