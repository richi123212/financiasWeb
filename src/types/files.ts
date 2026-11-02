export type FileKind = 'apk' | 'drive';
export type FileStatus = 'uploading' | 'ready' | 'deleting';
export type FileCategory = 'video' | 'audio' | 'pdf' | 'archive' | 'image' | 'document' | 'other';
export interface StoredFile {
  id: string; user_id: string; file_name: string; storage_path: string;
  file_size_bytes: number; mime_type: string; status: FileStatus; created_at: string;
}
export interface DriveFile extends StoredFile { category: FileCategory }
export interface ApkRelease extends StoredFile {
  app_name: string; app_slug: string; version: string; release_number: number;
  changelog: string; published_at: string | null;
}
