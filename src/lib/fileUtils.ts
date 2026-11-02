import type { ApkRelease, FileCategory } from '../types/files';
export function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 3);
  return `${(bytes / 1024 ** unit).toLocaleString('es-MX', { maximumFractionDigits: 1 })} ${['B','KB','MB','GB'][unit]}`;
}
export function appSlug(name: string) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100);
}
export function fileMime(file: Pick<File, 'type' | 'name'>) {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'apk') return 'application/vnd.android.package-archive';
  const types: Record<string, string> = { pdf:'application/pdf', mp4:'video/mp4', webm:'video/webm', mov:'video/quicktime', mp3:'audio/mpeg', wav:'audio/wav', ogg:'audio/ogg', png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif', webp:'image/webp', zip:'application/zip', txt:'text/plain' };
  return file.type || types[ext || ''] || 'application/octet-stream';
}
export function latestApks(releases: ApkRelease[]) {
  const grouped = new Map<string, ApkRelease[]>();
  for (const release of releases.filter(r => r.status === 'ready')) {
    const key = `${release.user_id}:${release.app_slug}`;
    grouped.set(key, [...(grouped.get(key) || []), release]);
  }
  return [...grouped.values()].map(versions => versions.sort((a,b) => Number(b.release_number) - Number(a.release_number)));
}
export function previewType(name: string, mime: string): 'image' | 'video' | 'audio' | 'pdf' | null {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (mime.startsWith('image/') && ['png','jpg','jpeg','gif','webp','avif'].includes(ext)) return 'image';
  if (mime.startsWith('video/') && ['mp4','webm','mov'].includes(ext)) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf' && ext === 'pdf') return 'pdf';
  return null;
}
export const categoryLabels: Record<FileCategory, string> = { video:'Videos', audio:'Audio', pdf:'PDF', archive:'Comprimidos', image:'Imágenes', document:'Documentos', other:'Otros' };
