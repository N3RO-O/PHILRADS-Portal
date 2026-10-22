import { z } from 'zod';
import { MODULES } from '../config/modules';
import { DOCUMENT_CATEGORIES, type ModuleId } from '../types';

/**
 * GOOGLE DRIVE INTEGRATION BOUNDARY (stub)
 *
 * File content goes to designated Google Drive folders; the structured record
 * (title, category, module, project, Drive file id, uploader) goes to the
 * Supabase `documents` table.
 *
 * The browser must never hold Google client secrets, service-account keys or
 * long-lived Drive tokens. The planned flow (docs/google-drive.md):
 *   1. Browser -> POST /api/drive/upload-sessions (Vercel function) with the
 *      staff member's Supabase access token and the file metadata below.
 *   2. The function verifies the token, checks the `documents.upload`
 *      permission, resolves the destination folder from `drive_destinations`,
 *      and creates a Drive *resumable upload session* with server-held credentials.
 *   3. Browser uploads the bytes straight to that one-time session URL with
 *      progress (large videos never pass through the 4.5 MB function body limit).
 *   4. Browser -> POST /api/drive/upload-sessions/:id/complete; the function
 *      confirms the file in Drive and inserts the `documents` row.
 *
 * Until that function and the Google Cloud configuration exist, the service
 * below reports itself as not configured and never pretends an upload worked.
 */

export interface DriveDestination {
  module: ModuleId;
  category: string;
  projectId?: string;
}

/**
 * FOLDER RULE (PHILRADS, 2026-10-22): every upload goes to
 *
 *     <Shared Drive root> / <Module> / <Uploader's name> / <Category> / file
 *     e.g.  Documentation / Maria Santos / Photos / IMG_0042.jpg
 *
 * so anyone browsing Google Drive can see who uploaded what, sorted by category.
 * The server decides the uploader from the signed-in session (never from the browser)
 * and creates missing folders. It finds a person's folder by their staff id, stored on
 * the folder as a Drive appProperty, so a renamed account keeps the same folder and two
 * people with the same name never share one; the folder is renamed to match their name.
 */
export function drivePath(destination: Pick<DriveDestination, 'module' | 'category'>, uploaderName: string): string[] {
  const module = MODULES.find((m) => m.id === destination.module)?.label ?? destination.module;
  return [module, driveFolderName(uploaderName) || 'Unknown uploader', driveFolderName(destination.category) || 'Other'];
}

/** Drive allows almost any folder name; keep them tidy and free of path separators. */
export const driveFolderName = (name: string) => name.replace(/[\\/]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80);

export interface DriveUploadRequest {
  file: File;
  title: string;
  destination: DriveDestination;
}

export interface DriveUploadResult {
  documentId: string;
  driveFileId: string;
}

export interface DriveUploadOptions {
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

export interface DriveUploadService {
  readonly configured: boolean;
  upload(request: DriveUploadRequest, options?: DriveUploadOptions): Promise<DriveUploadResult>;
}

export class DriveNotConfiguredError extends Error {
  constructor() {
    super('Google Drive uploads are not connected yet. Nothing was uploaded.');
    this.name = 'DriveNotConfiguredError';
  }
}

/** Upload limits and accepted types. Values are proposals: confirm with PHILRADS. */
export const UPLOAD_RULES = {
  maxBytes: 2 * 1024 ** 3, // 2 GB (TBC), resumable uploads make large videos feasible
  acceptedMimePrefixes: ['image/', 'video/'],
  acceptedMimeTypes: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
  accept: 'image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.pptx',
} as const;

export const uploadMetadataSchema = z.object({
  title: z.string().trim().min(1, 'Give the file a title.').max(200),
  category: z.enum(DOCUMENT_CATEGORIES),
  projectId: z.string().uuid().optional(),
});

export function validateUploadFile(file: File): string | null {
  const typeOk =
    UPLOAD_RULES.acceptedMimePrefixes.some((p) => file.type.startsWith(p)) ||
    (UPLOAD_RULES.acceptedMimeTypes as readonly string[]).includes(file.type);
  if (!typeOk) return 'This file type is not accepted. Use photos, videos, PDF, Word, Excel or PowerPoint files.';
  if (file.size > UPLOAD_RULES.maxBytes) return 'This file is larger than the 2 GB limit.';
  if (file.size === 0) return 'This file is empty.';
  return null;
}

export const driveUploadService: DriveUploadService = {
  configured: false,
  async upload() {
    throw new DriveNotConfiguredError();
  },
};
