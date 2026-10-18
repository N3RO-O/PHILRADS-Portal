# Google Drive integration plan

**Status:** boundary only. The upload form exists (`src/components/documents/DriveUploadPanel.tsx`) and the service interface is defined (`src/services/googleDrive.ts`), but `driveUploadService.configured` is `false`. The form keeps the selected files and says plainly that nothing was uploaded.

## What goes where

| Stored in | What |
| --- | --- |
| **Google Drive** | File content: photos, videos, PDFs, Word/Excel/PowerPoint files |
| **Supabase `documents` table** | Title, category, module, project/response link, MIME type, size, Drive file id, folder id, uploader, upload time |
| **Supabase `drive_destinations` table** | Which Drive folder each module, category and project uploads to |

Files are **not** made public. Access is through Drive sharing with authorised PHILRADS accounts (preferably a Shared Drive), plus the portal’s own `documents` permissions.

## Security rules

- The browser never receives Google client secrets, service-account keys or long-lived Drive tokens.
- No `VITE_` variable may contain a Google secret or the Supabase service-role key.
- Every upload is authorised on the server by checking the staff member’s Supabase session **and** the `documents.upload` permission.
- The `documents` row is written only after the server confirms the file exists in Drive, so a record never points at a missing file.

## Planned flow (Vercel server functions)

Vercel functions accept request bodies of at most about 4.5 MB, so large files (videos) must not pass through them. The plan uses Drive’s **resumable upload**:

1. **Browser → `POST /api/drive/upload-sessions`**, with `Authorization: Bearer <Supabase access token>` and JSON `{ title, category, module, projectId?, mimeType, sizeBytes }`.
2. **Function:**
   - verifies the token with Supabase (`auth.getUser(token)`);
   - checks `has_permission('documents.upload')` for that user;
   - validates the metadata (same rules as `uploadMetadataSchema` and `UPLOAD_RULES`);
   - looks up the folder in `drive_destinations`;
   - creates a Drive resumable upload session using server-held Google credentials, passing the browser’s `Origin` so the browser may upload to it;
   - returns `{ sessionId, uploadUrl }`, a one-time URL valid only for this file.
3. **Browser → `PUT uploadUrl`** with the file bytes, in chunks with progress (`onProgress`), and resumes on network drops.
4. **Browser → `POST /api/drive/upload-sessions/:id/complete`.**
5. **Function** confirms the file in Drive, inserts the `documents` row with the service-role key (server only), writes an `activity_logs` entry, and returns `{ documentId, driveFileId }`.

When this exists, replace the stub in `src/services/googleDrive.ts` with an implementation that calls these endpoints and set `configured: true`. The UI needs no other changes.

## Credentials (server-only Vercel environment variables)

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL (server copy) |
| `SUPABASE_SERVICE_ROLE_KEY` | Insert `documents` rows after verification. **Server only** |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Service account that owns or edits the Shared Drive folders |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Its private key. **Server only** |
| `GOOGLE_DRIVE_SHARED_DRIVE_ID` | The Shared Drive that holds portal folders (recommended) |

Alternative: Google OAuth with each staff member’s own account (files owned by them). This needs an OAuth consent screen and a server-side token exchange. A service account on a Shared Drive is simpler to govern; PHILRADS should choose.

## Decisions needed from PHILRADS

1. Shared Drive with a service account, or per-user OAuth?
2. Folder structure: per module, per project, per category? (Fill `drive_destinations`.)
3. File size limit (2 GB proposed) and accepted types.
4. Who may upload, and who may see uploaded files beyond the uploader and project members?
5. Retention: may files be deleted from the portal, and should that delete them in Drive?
