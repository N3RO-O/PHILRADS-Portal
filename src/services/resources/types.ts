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

export interface ResourcesService {
  readonly source: DataSource;
  list(): Promise<Resource[]>;
  save(draft: ResourceDraft): Promise<Resource>;
  /** Removes it from Resources only; the file in Google Drive is not touched. */
  remove(id: string): Promise<void>;
}
