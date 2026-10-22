/**
 * DEVELOPMENT-ONLY SAMPLE DATA for Resources.
 * Google Drive entries use made-up file ids, so they won't open; they show how Drive
 * links look in the list. The web pages are real public humanitarian references.
 */
import { parseResourceLink } from '../lib/resourceLinks';
import type { Resource, ResourceCategory, ResourceFileType } from '../services/resources/types';

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

type Seed = [title: string, description: string, category: ResourceCategory, url: string, type: ResourceFileType | null, pinned: boolean, daysAgo: number];

const SEEDS: Seed[] = [
  ['Relief distribution acknowledgement form', 'Signed by each family receiving relief goods. Print double-sided.', 'Forms and templates', 'https://drive.google.com/file/d/1SAMPLEacknowledgementFormAbc/view?usp=sharing', 'PDF', true, 3],
  ['Rapid needs assessment template', 'First 72 hours after a disaster: households, shelter, water, health needs.', 'Forms and templates', 'https://docs.google.com/document/d/1SAMPLErapidNeedsAssessmentXyz/edit', 'Word', true, 12],
  ['Beneficiary master list template', 'One row per household; use for distributions and PDM sampling.', 'Forms and templates', 'https://docs.google.com/spreadsheets/d/1SAMPLEbeneficiaryMasterList12/edit', 'Excel', false, 20],
  ['Warehouse stock card', 'Bin card for manual counts during outages.', 'Forms and templates', 'https://drive.google.com/file/d/1SAMPLEwarehouseStockCardQrs/view', 'PDF', false, 41],
  ['Child safeguarding policy', 'Required reading for all staff and volunteers.', 'Policies and guidelines', 'https://drive.google.com/file/d/1SAMPLEchildSafeguardingPolicy/view', 'PDF', true, 60],
  ['Procurement and donations policy', 'Accepting in-kind donations, quotations and approvals.', 'Policies and guidelines', 'https://drive.google.com/file/d/1SAMPLEprocurementDonations01/view', 'PDF', false, 90],
  ['The Sphere Handbook', 'Humanitarian Charter and minimum standards in humanitarian response.', 'Policies and guidelines', 'https://spherestandards.org/handbook/', 'Web page', false, 120],
  ['Core Humanitarian Standard', 'Nine commitments on quality and accountability.', 'Policies and guidelines', 'https://www.corehumstandard.org/the-standard', 'Web page', false, 120],
  ['Volunteer orientation deck', 'Who we are, safety in the field, and how a distribution runs.', 'Training and manuals', 'https://docs.google.com/presentation/d/1SAMPLEvolunteerOrientation9/edit', 'PowerPoint', false, 15],
  ['PHILRADS IMS user manual', 'Receiving donations, releases and approvals in the inventory system.', 'Training and manuals', 'https://drive.google.com/file/d/1SAMPLEimsUserManualPdf00001/view', 'PDF', false, 8],
  ['Field training videos', 'Recorded sessions: first aid, distribution set-up, data collection.', 'Training and manuals', 'https://drive.google.com/drive/folders/1SAMPLEfieldTrainingVideos00', 'Folder', false, 30],
  ['Annual report 2025', 'Programs, beneficiaries reached and financial summary.', 'Reports and publications', 'https://drive.google.com/file/d/1SAMPLEannualReport2025Final/view', 'PDF', false, 200],
  ['Typhoon response situation reports', 'All sitreps for the current response, newest first.', 'Reports and publications', 'https://drive.google.com/drive/folders/1SAMPLEtyphoonSitreps000001', 'Folder', false, 2],
  ['PAGASA weather bulletins', 'Official tropical cyclone bulletins and warnings.', 'Reports and publications', 'https://www.pagasa.dost.gov.ph/', 'Web page', false, 45],
  ['PHILRADS logo pack', 'Emblem and wordmark in PNG and SVG, light and dark.', 'Brand and media', 'https://drive.google.com/drive/folders/1SAMPLElogoPackBrandAssets0', 'Folder', false, 70],
  ['Brand guidelines', 'Colours, typography and logo use.', 'Brand and media', 'https://drive.google.com/file/d/1SAMPLEbrandGuidelines2026x/view', 'PDF', false, 70],
];

export const createResourceSeed = (): Resource[] =>
  SEEDS.map(([title, description, category, url, fileType, pinned, days], i) => ({
    id: `res-${i + 1}`,
    title,
    description,
    category,
    url,
    kind: parseResourceLink(url)?.kind ?? 'web',
    fileType,
    pinned,
    addedByName: i % 3 === 0 ? 'Grace Villanueva (sample)' : i % 3 === 1 ? 'Maria Santos (sample)' : 'Jun Dela Cruz (sample)',
    createdAt: ago(days + 5),
    updatedAt: ago(days),
  }));
