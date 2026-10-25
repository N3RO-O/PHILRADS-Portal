/**
 * Understands the links staff paste into Resources: Google Drive files and folders,
 * Google Docs / Sheets / Slides, and ordinary web pages. Works out how to open and
 * download each one, and how to preview it inside the portal. Only https links are accepted (no javascript:, data: or http:).
 */
export type LinkKind = 'drive_file' | 'drive_folder' | 'google_doc' | 'google_sheet' | 'google_slides' | 'web';

export interface ParsedLink {
  kind: LinkKind;
  /** Google file or folder id, when the link is a Google one. */
  googleId: string | null;
  openUrl: string;
  /** Direct download, or null when the link can only be opened (folders, web pages). */
  downloadUrl: string | null;
  /**
   * Google's embeddable viewer for the file or folder, shown in the portal's preview.
   * Null for web pages: most sites refuse to be shown inside another site.
   */
  previewUrl: string | null;
}

const GOOGLE_ID = /^[A-Za-z0-9_-]{10,}$/;

export function parseResourceLink(raw: string): ParsedLink | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || !url.hostname.includes('.')) return null;
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split('/').filter(Boolean);
  const after = (segment: string) => {
    const i = parts.indexOf(segment);
    const id = i >= 0 ? parts[i + 1] : undefined;
    return id && GOOGLE_ID.test(id) ? id : null;
  };

  if (host === 'drive.google.com') {
    const folder = after('folders');
    if (folder)
      return {
        kind: 'drive_folder',
        googleId: folder,
        openUrl: `https://drive.google.com/drive/folders/${folder}`,
        downloadUrl: null,
        previewUrl: `https://drive.google.com/embeddedfolderview?id=${folder}#list`,
      };
    const file = after('d') ?? (GOOGLE_ID.test(url.searchParams.get('id') ?? '') ? url.searchParams.get('id') : null);
    if (file)
      return {
        kind: 'drive_file',
        googleId: file,
        openUrl: `https://drive.google.com/file/d/${file}/view`,
        downloadUrl: `https://drive.google.com/uc?export=download&id=${file}`,
        previewUrl: `https://drive.google.com/file/d/${file}/preview`,
      };
  }
  if (host === 'docs.google.com') {
    const id = after('d');
    const kinds = { document: 'google_doc', spreadsheets: 'google_sheet', presentation: 'google_slides' } as const;
    const kind = kinds[parts[0] as keyof typeof kinds];
    if (id && kind) {
      // Google files download as the matching Office format.
      const format = kind === 'google_doc' ? 'docx' : kind === 'google_sheet' ? 'xlsx' : 'pptx';
      return {
        kind,
        googleId: id,
        openUrl: `https://docs.google.com/${parts[0]}/d/${id}/edit`,
        downloadUrl: `https://docs.google.com/${parts[0]}/d/${id}/export?format=${format}`,
        previewUrl: `https://docs.google.com/${parts[0]}/d/${id}/preview`,
      };
    }
  }
  return { kind: 'web', googleId: null, openUrl: url.toString(), downloadUrl: null, previewUrl: null };
}

/**
 * Ask Google to use a specific signed-in account (`authuser`), so someone signed in to several
 * Google accounts sees the file as their PHILRADS account rather than whichever account is first.
 * Google ignores it when that account isn't signed in. Only for Google links; never in copied links.
 */
export function withGoogleAccount(url: string, email: string | null | undefined): string {
  if (!email) return url;
  try {
    const u = new URL(url);
    if (u.hostname !== 'drive.google.com' && u.hostname !== 'docs.google.com') return url;
    u.searchParams.set('authuser', email);
    return u.toString();
  } catch {
    return url;
  }
}

export const LINK_KIND_LABEL: Record<LinkKind, string> = {
  drive_file: 'Google Drive file',
  drive_folder: 'Google Drive folder',
  google_doc: 'Google Doc',
  google_sheet: 'Google Sheet',
  google_slides: 'Google Slides',
  web: 'Web page',
};
