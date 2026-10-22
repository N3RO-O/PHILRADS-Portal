import { z } from 'zod';
import type { DataSource } from '../types';

/**
 * Browser-visible configuration. Everything here ships in the client bundle,
 * so it must only ever contain public values (Supabase URL + anon/publishable key).
 */
const envSchema = z.object({
  VITE_SUPABASE_URL: z.union([z.literal(''), z.string().url()]).optional(),
  VITE_SUPABASE_ANON_KEY: z.string().optional(),
  VITE_DATA_SOURCE: z.enum(['mock', 'supabase']).optional(),
  VITE_INVENTORY_SOURCE: z.enum(['portal', 'ims']).optional(),
  VITE_IMS_URL: z.union([z.literal(''), z.string().url()]).optional(),
});

const parsed = envSchema.safeParse(import.meta.env);
const values = parsed.success ? parsed.data : {};

export const envProblems: string[] = parsed.success
  ? []
  : parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);

// Guard against privileged keys being exposed through VITE_ variables.
const leakedKeys = Object.keys(import.meta.env).filter((key) => /SERVICE_ROLE|SECRET|PRIVATE_KEY/i.test(key));
if (leakedKeys.length > 0) {
  envProblems.push(`Remove privileged variables from the client build: ${leakedKeys.join(', ')}`);
  console.error('[config] Privileged keys must never use the VITE_ prefix:', leakedKeys);
}

export const env = {
  supabaseUrl: values.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: values.VITE_SUPABASE_ANON_KEY ?? '',
  requestedDataSource: values.VITE_DATA_SOURCE ?? 'mock',
  /** portal: stock is recorded in the portal. ims: the portal shows stock pushed by PHILRADS IMS (read-only). */
  inventorySource: values.VITE_INVENTORY_SOURCE ?? 'portal',
  /** PHILRADS IMS address, for "Open in IMS" links (no trailing slash). */
  imsUrl: (values.VITE_IMS_URL ?? '').replace(/\/+$/, ''),
} as const;

export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);

/** Live data is used only when explicitly requested AND Supabase is configured. */
export const dataSource: DataSource =
  env.requestedDataSource === 'supabase' && isSupabaseConfigured ? 'supabase' : 'mock';

if (env.requestedDataSource === 'supabase' && !isSupabaseConfigured) {
  envProblems.push('VITE_DATA_SOURCE is "supabase" but VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing. Showing sample data.');
}
