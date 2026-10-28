import type { DataSource } from '../../types';
import type { LinkKind } from '../../lib/resourceLinks';

/** Shared files staff can open or download: forms, policies, manuals, reports, brand assets. */
export const RESOURCE_CATEGORIES = [
  'Forms and templates',
  'Policies and guidelines',
  'Training and manuals',
  'Reports and publications',
  'Brand and media',
  'Other',
] as const;
export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number];

/** What staff will get, shown as a label and icon. Optional: the link type is the fallback. */
export const RESOURCE_FILE_TYPES = ['PDF', 'Word', 'Excel', 'PowerPoint', 'Image', 'Video', 'Folder', 'Web page'] as const;
export type ResourceFileType = (typeof RESOURCE_FILE_TYPES)[number];

export interface Resource {
  id: string;
  title: string;
  description: string | null;
  category: ResourceCategory;
  url: string;
  kind: LinkKind;
  fileType: ResourceFileType | null;
  /** Pinned resources are shown first, for the things staff need most. */
  pinned: boolean;
  addedByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResourceDraft {
  id?: string;
  title: string;
  description: string;
  category: ResourceCategory;
  url: string;
  fileType: ResourceFileType | null;
  pinned: boolean;
}

export class ResourceRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResourceRuleError';
  }
}

/** A file or folder inside a Drive folder resource (read through the PHILRADS Drive connection). */
export interface FolderItem {
  id: string;
  name: string;
  mimeType: string;
  folder: boolean;
  sizeBytes: number | null;
  modifiedAt: string | null;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  /** Google Docs, Sheets and Slides download as ".docx", ".xlsx", ".pptx". */
  downloadAs: string | null;
  /** Short-lived links (2 hours); none for folders. */
  links: { thumb: string | null; view: string; download: string } | null;
}

export interface FolderListing {
  /** From the resource's folder down to the one shown. */
  path: { id: string; name: string }[];
  items: FolderItem[];
}

export interface ResourcesService {
  readonly source: DataSource;
  list(): Promise<Resource[]>;
  /** What's inside a Drive folder resource, or a folder within it. */
  folder(resourceId: string, folderId?: string): Promise<FolderListing>;
  save(draft: ResourceDraft): Promise<Resource>;
  /** Removes it from Resources only; the file in Google Drive is not touched. */
  remove(id: string): Promise<void>;
}
