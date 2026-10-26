# Google Drive integration plan

**Status:** boundary only. The upload form exists (`src/components/documents/DriveUploadPanel.tsx`) and the service interface is defined (`src/services/googleDrive.ts`), but `driveUploadService.configured` is `false`. The form keeps the selected files and says plainly that nothing was uploaded.

## What goes where

| Stored in | What |
| --- | --- |
| **Google Drive** | File content: photos, videos, PDFs, Word/Excel/PowerPoint files |
| **Supabase `documents` table** | Title, category, module, project/response link, MIME type, size, Drive file id, folder id, uploader, upload time |
| **Supabase `drive_destinations` table** | The root Drive folder for each module (Documentation, Resources) |

## Folder structure (decided 2026-10-22)

Inside each module's folder, files are filed **by the uploader's name, then by category**, so anyone browsing Google Drive can see who uploaded what:

```
PHILRADS Shared Drive/
  Documentation/
    Maria Santos/
      Photos/            IMG_0042.jpg, IMG_0043.jpg
      Reports/           Sitrep 14.pdf
    Jun Dela Cruz/
      Distribution records/
  Resources/
    Grace Villanueva/
      Forms and templates/
```

- The upload function decides the uploader from the signed-in session, never from what the browser sends.
- A person's folder is found by their staff id, stored on the folder as a Drive `appProperty`, not by name, so renaming an account keeps the same folder (and renames it), and two staff with the same name never share a folder.
- Missing person and category folders are created on first upload.
- The path is saved in `documents.drive_path` (e.g. `Documentation/Maria Santos/Photos`), so the portal shows where each file lives and who uploaded it.
- The rule is in `drivePath()` in `src/services/googleDrive.ts`; the upload form shows *Saves to Documentation › your name › category* before uploading.

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
   - looks up the module's root folder in `drive_destinations`, then finds or creates `<uploader name>/<category>` inside it (see *Folder structure*);
   - creates a Drive resumable upload session using server-held Google credentials, passing the browser’s `Origin` so the browser may upload to it;
   - returns `{ sessionId, uploadUrl }`, a one-time URL valid only for this file.
3. **Browser → `PUT uploadUrl`** with the file bytes, in chunks with progress (`onProgress`), and resumes on network drops.
4. **Browser → `POST /api/drive/upload-sessions/:id/complete`.**
5. **Function** confirms the file in Drive, inserts the `documents` row (with `drive_path` and `uploaded_by`) using the service-role key (server only), writes an `activity_logs` entry, and returns `{ documentId, driveFileId }`.

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
2. ~~Folder structure~~ Decided: module › uploader's name › category. Still needed: the root folder id for each module in `drive_destinations`.
3. ~~File size limit~~ Decided 2026-10-26: no limit of the portal's own; the connected Google account's storage is the only limit. Accepted types: photos, videos, PDF, Word, Excel, PowerPoint.
4. Who may upload, and who may see uploaded files beyond the uploader and project members?
5. Retention: may files be deleted from the portal, and should that delete them in Drive?
