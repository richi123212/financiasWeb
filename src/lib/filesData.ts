import { Upload } from 'tus-js-client';
import { supabase, supabaseUrl } from './supabase';
import { appSlug, fileMime } from './fileUtils';
import type { ApkRelease, DriveFile, FileKind, StoredFile } from '../types/files';

export function fileError(error: unknown): string {
  const message = error instanceof Error ? error.message : String((error as { message?: string })?.message || error || 'Error desconocido');
  if (/schema cache|does not exist|Could not find|bucket not found/i.test(message)) return 'Falta configurar los módulos de archivos en Supabase. Ejecuta el SQL de APK Hub y Drive y vuelve a intentar.';
  if (/duplicate key|unique constraint/i.test(message)) return 'Esta versión ya existe para tu aplicación. Usa otra versión.';
  if (/Failed to fetch|NetworkError|fetch failed/i.test(message)) return 'Revisa tu conexión para consultar o modificar tus archivos.';
  if (/exceeded|too large|Payload too large|413|maximum.*size/i.test(message)) return 'El archivo supera el límite configurado en Supabase. La carga por bloques no evita el límite de tu plan.';
  return message;
}
export async function listReleases(userId?: string): Promise<ApkRelease[]> {
  let query = supabase.from('apk_releases').select('*').order('created_at', { ascending: false });
  query = userId ? query.eq('user_id', userId) : query.eq('status', 'ready');
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
export async function listDriveFiles(userId: string): Promise<DriveFile[]> {
  const { data, error } = await supabase.from('drive_files').select('*').eq('user_id',userId).order('created_at', { ascending:false });
  if (error) throw error;
  return data || [];
}
export async function reserveFile(kind: FileKind, file: File, details?: { appName: string; version: string; changelog: string }): Promise<StoredFile | ApkRelease> {
  const { data, error } = await supabase.rpc('reserve_file_upload', {
    p_kind: kind, p_file_name: file.name, p_size: file.size, p_mime: fileMime(file),
    p_app_name: details?.appName || '', p_app_slug: appSlug(details?.appName || ''),
    p_version: details?.version || '', p_changelog: details?.changelog || '',
  });
  if (error) throw error;
  return data;
}
export function resumableUpload(kind: FileKind, record: StoredFile, file: File, progress: (percent: number) => void) {
  let rejectTask: (reason: Error) => void = () => {};
  const origin = new URL(supabaseUrl);
  if (origin.hostname.endsWith('.supabase.co')) origin.hostname = origin.hostname.replace('.supabase.co','.storage.supabase.co');
  const task = new Upload(file, {
    endpoint: `${origin.origin}/storage/v1/upload/resumable`,
    retryDelays: [0,1000,3000,5000,10000], chunkSize: 6 * 1024 * 1024,
    removeFingerprintOnSuccess: true, uploadDataDuringCreation: true,
    metadata: { bucketName: kind === 'apk' ? 'apps-repository' : 'personal-drive', objectName: record.storage_path, contentType: record.mime_type, cacheControl:'3600' },
    fingerprint: async () => `${record.user_id}:${record.id}:${file.name}:${file.size}:${file.lastModified}`,
    onBeforeRequest: async request => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Inicia sesión de nuevo para continuar la carga.');
      request.setHeader('Authorization', `Bearer ${session.access_token}`);
    },
    onProgress: (sent, total) => progress(total ? Math.round(sent / total * 100) : 0),
  });
  const promise = new Promise<void>((resolve,reject) => {
    rejectTask = reject;
    task.options.onSuccess = () => resolve();
    task.options.onError = error => reject(error);
  });
  let paused = false;
  void task.findPreviousUploads().then(previous => {
    if (paused) return;
    if (previous[0]) task.resumeFromPreviousUpload(previous[0]);
    task.start();
  }).catch(error => rejectTask(error));
  return { promise, pause: async () => { paused = true; await task.abort(false); rejectTask(new Error('Carga pausada. Elige el mismo archivo para reanudarla.')); } };
}
export async function completeFile(kind: FileKind, id: string) {
  const { error } = await supabase.rpc('complete_file_upload', { p_kind:kind, p_id:id });
  if (error) throw error;
}
export async function deleteFile(kind: FileKind, id: string) {
  // Authorization and the path come from the database, never from a client-supplied path.
  const { data, error } = await supabase.rpc('begin_file_deletion', { p_kind:kind, p_id:id });
  if (error) throw error;
  const { error: storageError } = await supabase.storage.from(data.bucket).remove([data.storage_path]);
  if (storageError && Number(storageError.statusCode) !== 404) throw storageError;
  const { error: metadataError } = await supabase.rpc('finish_file_deletion', { p_kind:kind, p_id:id });
  if (metadataError) throw metadataError;
}
export async function downloadApk(release: ApkRelease) {
  const { data, error } = await supabase.storage.from('apps-repository').download(release.storage_path);
  if (error) throw error;
  const url = URL.createObjectURL(data);
  const link = document.createElement('a'); link.href = url; link.download = release.file_name;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export async function driveUrl(file: DriveFile, download = false) {
  const { data, error } = await supabase.storage.from('personal-drive').createSignedUrl(file.storage_path, 3600, download ? { download: file.file_name } : undefined);
  if (error) throw error;
  return data.signedUrl;
}
