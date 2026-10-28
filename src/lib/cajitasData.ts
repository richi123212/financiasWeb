import { supabase } from './supabase';
import type { CajitaApartado, CajitaMovimiento } from '../types';

// =============================================
// APARTADOS (Cajitas de Ahorro)
// =============================================

export async function getApartados(userId: string): Promise<CajitaApartado[]> {
  const { data, error } = await supabase
    .from('cajitas_apartados')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapApartado);
}

export async function addApartado(
  userId: string,
  apartado: {
    name: string;
    target_amount?: number;
    institution?: string;
    notes?: string;
    color_hex?: string;
  }
): Promise<CajitaApartado> {
  const { data, error } = await supabase
    .from('cajitas_apartados')
    .insert([{
      user_id: userId,
      name: apartado.name,
      target_amount: apartado.target_amount || 0,
      institution: apartado.institution || '',
      notes: apartado.notes || '',
      color_hex: apartado.color_hex || '#10B981',
    }])
    .select()
    .single();
  if (error) throw error;
  return mapApartado(data);
}

export async function updateApartado(
  id: string,
  updates: Partial<Pick<CajitaApartado, 'name' | 'target_amount' | 'institution' | 'notes' | 'color_hex'>>
): Promise<void> {
  const { error } = await supabase
    .from('cajitas_apartados')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteApartado(id: string): Promise<void> {
  const { error } = await supabase
    .from('cajitas_apartados')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

function mapApartado(row: any): CajitaApartado {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name || 'Cajita',
    target_amount: Number(row.target_amount || 0),
    current_balance: Number(row.current_balance || 0),
    institution: row.institution || '',
    notes: row.notes || '',
    color_hex: row.color_hex || '#10B981',
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// =============================================
// MOVIMIENTOS (Apartar / Liberar dinero)
// =============================================

export async function getMovimientos(userId: string): Promise<CajitaMovimiento[]> {
  const { data, error } = await supabase
    .from('cajitas_movimientos')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapMovimiento);
}

export async function registrarMovimiento(
  userId: string,
  mov: {
    apartado_id: string;
    tipo: 'apartar' | 'liberar';
    monto: number;
    nota?: string;
  }
): Promise<CajitaMovimiento> {
  void userId; // Identity is taken from auth.uid() by the database.
  const { data: movData, error } = await supabase.rpc('mover_reserva', {
    p_apartado_id: mov.apartado_id,
    p_tipo: mov.tipo,
    p_monto: mov.monto,
    p_nota: mov.nota || '',
  });
  if (error) throw error;

  return mapMovimiento(movData);
}

function mapMovimiento(row: any): CajitaMovimiento {
  return {
    id: row.id,
    user_id: row.user_id,
    apartado_id: row.apartado_id,
    tipo: row.tipo as 'apartar' | 'liberar',
    monto: Number(row.monto || 0),
    nota: row.nota || '',
    created_at: row.created_at,
  };
}

