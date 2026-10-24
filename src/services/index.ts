import { dataSource, env } from '../config/env';
import { supabase } from '../lib/supabase';
import { mockDashboardService } from './dashboard/mockDashboardService';
import { createSupabaseDashboardService } from './dashboard/supabaseDashboardService';
import type { DashboardService } from './dashboard/types';
import { createImsInventoryService, createSampleImsService } from './inventory/imsInventoryService';
import { createInventoryStore } from './inventory/inventoryStore';
import { createSupabaseResourcesService, mockResourcesService } from './resources/resourcesService';
import type { ResourcesService } from './resources/types';

export type { DashboardService } from './dashboard/types';
export { driveUploadService, DriveNotConfiguredError } from './googleDrive';

/** The one place that decides whether the dashboard shows sample or live data. */
export const dashboardService: DashboardService =
  dataSource === 'supabase' && supabase ? createSupabaseDashboardService(supabase) : mockDashboardService;

/** Inventory data source, wrapped in the offline-first store (outbox + cached snapshot). */
const live = dataSource === 'supabase' && supabase ? supabase : null;
// Stock lives in PHILRADS IMS; the portal shows it (receiving and releasing happen in the IMS).
export const inventoryStore = createInventoryStore(live ? createImsInventoryService(live) : createSampleImsService(env.imsUrl));

/** Shared files and links (Resources module). */
export const resourcesService: ResourcesService = live ? createSupabaseResourcesService(live) : mockResourcesService;
