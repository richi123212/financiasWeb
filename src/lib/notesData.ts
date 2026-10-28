import { supabase } from './supabase';
import type { Note, NoteFolder } from '../types';

// =============================================
// CARPETAS (FOLDERS)
// =============================================

export async function getFolders(userId: string): Promise<NoteFolder[]> {
  const { data, error } = await supabase
    .from('note_folders')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapFolder);
}

export async function addFolder(
  userId: string,
  folder: { name: string; color_hex?: string; icon?: string }
): Promise<NoteFolder> {
  const { data, error } = await supabase
    .from('note_folders')
    .insert([{
      user_id: userId,
      name: folder.name,
      color_hex: folder.color_hex || '#6366F1',
      icon: folder.icon || 'folder',
    }])
    .select()
    .single();
  if (error) throw error;
  return mapFolder(data);
}

export async function updateFolder(
  id: string,
  updates: Partial<Pick<NoteFolder, 'name' | 'color_hex' | 'icon'>>
): Promise<void> {
  const { error } = await supabase
    .from('note_folders')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteFolder(id: string): Promise<void> {
  // Notes in this folder will have folder_id set to null (ON DELETE SET NULL)
  const { error } = await supabase
    .from('note_folders')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

function mapFolder(row: any): NoteFolder {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name || 'Sin nombre',
    color_hex: row.color_hex || '#6366F1',
    icon: row.icon || 'folder',
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// =============================================
// NOTAS
// =============================================

export async function getNotes(userId: string): Promise<Note[]> {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', userId)
    .order('pinned', { ascending: false })
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapNote);
}

export async function addNote(
  userId: string,
  note: { title: string; content?: string; folder_id?: string | null; tags?: string[]; pinned?: boolean }
): Promise<Note> {
  const { data, error } = await supabase
    .from('notes')
    .insert([{
      user_id: userId,
      title: note.title,
      content: note.content || '',
      folder_id: note.folder_id || null,
      tags: note.tags || [],
      pinned: note.pinned || false,
    }])
    .select()
    .single();
  if (error) throw error;
  return mapNote(data);
}

export async function updateNote(
  id: string,
  updates: Partial<Pick<Note, 'title' | 'content' | 'folder_id' | 'tags' | 'pinned'>>
): Promise<void> {
  const { error } = await supabase
    .from('notes')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteNote(id: string): Promise<void> {
  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

function mapNote(row: any): Note {
  return {
    id: row.id,
    user_id: row.user_id,
    folder_id: row.folder_id || null,
    title: row.title || 'Sin título',
    content: row.content || '',
    tags: row.tags || [],
    pinned: Boolean(row.pinned),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

