import { parseResourceLink } from './resourceLinks';
import { RESOURCE_CATEGORIES, type Resource, type ResourceDraft } from '../services/resources/types';

export type ResourceErrors = Partial<Record<keyof ResourceDraft, string>>;

/** Rules for adding or editing a resource. The database checks the same rules. */
export function validateResource(d: ResourceDraft, existing: Resource[]): ResourceErrors {
  const e: ResourceErrors = {};
  const title = d.title.trim();
  if (!title) e.title = 'Give the resource a title.';
  else if (title.length > 120) e.title = 'Keep the title under 120 characters.';
  if (d.description.trim().length > 500) e.description = 'Keep the description under 500 characters.';
  if (!RESOURCE_CATEGORIES.includes(d.category)) e.category = 'Choose a category.';

  const link = parseResourceLink(d.url);
  if (!d.url.trim()) e.url = 'Paste the Google Drive or web link.';
  else if (!link) e.url = 'Use a full https:// link, e.g. from Google Drive’s “Copy link”.';
  else if (link.kind === 'web' && /^(drive|docs)\.google\.com$/i.test(new URL(d.url.trim()).hostname))
    e.url = 'This Google link isn’t a file or folder link. Use Share → Copy link in Google Drive.';
  else if (existing.some((r) => r.id !== d.id && parseResourceLink(r.url)?.openUrl === link.openUrl)) e.url = 'This link is already in Resources.';
  return e;
}
