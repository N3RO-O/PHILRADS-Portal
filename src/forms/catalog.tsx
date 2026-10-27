import type { ReactNode } from 'react';
import { ActivityReport, ACTIVITY_BENEFICIARY_ROWS } from './ActivityReport';
import { CanvassForm } from './CanvassForm';
import { CodeOfConduct } from './CodeOfConduct';
import { ConsentForm } from './ConsentForm';
import { DistributionList, DISTRIBUTION_ROWS } from './DistributionList';
import { FeedbackForm } from './FeedbackForm';
import { Masterlist, MASTERLIST_ROWS } from './Masterlist';
import { RapidNeedsAssessment } from './RapidNeedsAssessment';

export interface FormDef {
  id: string;
  title: string;
  summary: string;
  /** "A4, 3 pages" and the like. */
  paper: string;
  /** The print job's paper (CSS @page size), so it prints the right way round without changing printer settings. */
  pageSize: 'A4 portrait' | 'A4 landscape' | 'letter portrait';
  /** The template it reproduces. */
  source: string;
  /** Lists that can grow: how many rows the template has. */
  rows?: { initial: number; label: string };
  /** Filled with the signed-in person's name when empty. */
  preparedBy?: string;
  render: (rows: number) => ReactNode;
}

/** The PHILRADS forms, from the templates PHILRADS provided (2026-10-27). */
export const FORMS: FormDef[] = [
  {
    id: 'activity-report',
    pageSize: 'A4 portrait',
    title: 'Activity Report',
    summary: 'Overview, highlights, beneficiaries, photos and sign-off for an activity.',
    paper: 'A4 · 3 pages',
    source: 'ACTIVITY REPORT-Template.docx',
    rows: { initial: ACTIVITY_BENEFICIARY_ROWS, label: 'beneficiary rows' },
    preparedBy: 'preparedBy',
    render: (rows) => <ActivityReport rows={rows} />,
  },
  {
    id: 'rapid-needs-assessment',
    pageSize: 'A4 portrait',
    title: 'Rapid Needs Assessment',
    summary: 'Multi-sector assessment: shelter, food, water, health, protection and more.',
    paper: 'A4 · 4 pages',
    source: 'RNA- Rapid Needs Assessment.pdf',
    render: () => <RapidNeedsAssessment />,
  },
  {
    id: 'masterlist',
    pageSize: 'A4 landscape',
    title: 'Masterlist',
    summary: 'Beneficiaries of a response by age, sex, impairment and household (PSS, Food and NFIs).',
    paper: 'A4 landscape',
    source: 'MASTERLIST.xlsx',
    rows: { initial: MASTERLIST_ROWS, label: 'beneficiary rows' },
    render: (rows) => <Masterlist rows={rows} />,
  },
  {
    id: 'distribution-list',
    pageSize: 'A4 landscape',
    title: 'Distribution List',
    summary: 'Volunteer allowances (meal, transport) with amounts and signatures.',
    paper: 'A4 landscape',
    source: 'DISTRIBUTION List- Volunteer Allowance.pdf',
    rows: { initial: DISTRIBUTION_ROWS, label: 'rows' },
    render: (rows) => <DistributionList rows={rows} />,
  },
  {
    id: 'canvass',
    pageSize: 'A4 portrait',
    title: 'Canvass Form',
    summary: 'A supplier’s offer: items, prices and totals, worked out as you type.',
    paper: 'A4',
    source: 'Canvass Form.docx',
    preparedBy: 'preparedBy',
    render: () => <CanvassForm />,
  },
  {
    id: 'feedback',
    pageSize: 'letter portrait',
    title: 'Feedback & Complaint Form',
    summary: 'Community feedback on a humanitarian response (Filipino).',
    paper: 'US Letter · 2 pages',
    source: 'Feedback & Complaint Form.docx',
    render: () => <FeedbackForm />,
  },
  {
    id: 'consent',
    pageSize: 'letter portrait',
    title: 'Image/Story Consent Form',
    summary: 'Written consent to photograph, record or tell someone’s story (with AAR Japan).',
    paper: 'US Letter',
    source: 'Consent Form (with AAR Japan logo).docx',
    render: () => <ConsentForm />,
  },
  {
    id: 'code-of-conduct',
    pageSize: 'A4 portrait',
    title: 'Code of Conduct',
    summary: 'Safeguarding commitment in English and Filipino, signed by staff and volunteers.',
    paper: 'A4 · 2 pages',
    source: 'CODE OF CONDUCT.docx',
    render: () => <CodeOfConduct />,
  },
];
