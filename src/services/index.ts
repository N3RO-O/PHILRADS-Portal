import { dataSource, env } from '../config/env';
import { withDeviceCopy } from '../lib/deviceCopy';
import { supabase } from '../lib/supabase';
import { createSupabaseAuditService, mockAuditService, type AuditService } from './audit/auditService';
import { mockDashboardService } from './dashboard/mockDashboardService';
import { createSupabaseDocumentationService, createUploadQueue, mockDocumentationService, type DocumentationService } from './documentation/documentationService';
import { createSupabaseDashboardService } from './dashboard/supabaseDashboardService';
import type { DashboardService } from './dashboard/types';
import { createImsInventoryService, createSampleImsService } from './inventory/imsInventoryService';
import { createInventoryStore } from './inventory/inventoryStore';
import { createSupabaseMapService, mockMapService } from './map/mapService';
import type { MapService } from './map/types';
import { createSupabaseOnboardingService, mockOnboardingService, type OnboardingService } from './onboarding/onboardingService';
import { createSupabaseResourcesService, mockResourcesService } from './resources/resourcesService';
import type { ResourcesService } from './resources/types';
import { createSupabaseStaffService, mockStaffService } from './staff/staffService';
import type { StaffService } from './staff/types';
import { createOfflineTasks, type OfflineTasksService } from './tasks/offlineTasks';
import { createSupabaseTasksService, mockTasksService } from './tasks/tasksService';

export type { DashboardService } from './dashboard/types';
export { driveUploadService, DriveNotConfiguredError } from './googleDrive';

/** The one place that decides whether the dashboard shows sample or live data. */
export const dashboardService: DashboardService = withDeviceCopy(
  dataSource === 'supabase' && supabase ? createSupabaseDashboardService(supabase) : mockDashboardService,
  'dashboard',
  // Read-only Home cards: offline they show the last copy saved on this device.
  ['getSummary', 'getMyTasks', 'getOngoingProjects', 'getRecentActivity', 'getStockLevels', 'getWeeklyResponse', 'getNotifications'],
);

/** Inventory data source, wrapped in the offline-first store (outbox + cached snapshot). */
const live = dataSource === 'supabase' && supabase ? supabase : null;
// Stock lives in PHILRADS IMS; the portal shows it (receiving and releasing happen in the IMS).
export const inventoryStore = createInventoryStore(live ? createImsInventoryService(live) : createSampleImsService(env.imsUrl));

/** Shared files and links (Resources module). */
export const resourcesService: ResourcesService = withDeviceCopy(live ? createSupabaseResourcesService(live) : mockResourcesService, 'resources', ['list']);

/** Portal accounts, roles and invitations (Staff page, administrators only). */
export const staffService: StaffService = live ? createSupabaseStaffService(live) : mockStaffService;

/** Tasks, XP, kudos and the team goal (Tasks module). Works offline: changes wait on the device and sync later. */
export const tasksService: OfflineTasksService = createOfflineTasks(live ? createSupabaseTasksService(live) : mockTasksService);

/** Live Map: places (offline: the last copy on this device) and today's team check-ins. */
export const mapService: MapService = withDeviceCopy(live ? createSupabaseMapService(live) : mockMapService, 'map', ['listPlaces']);

/** Documentation: field photos, videos and reports in the PHILRADS Google Drive folder. */
export const documentationService: DocumentationService = live ? createSupabaseDocumentationService(live) : mockDocumentationService;
/** Uploads in progress: they carry on while staff move around the portal. */
export const uploadQueue = createUploadQueue(documentationService);

/** The admin log (Logs page, administrators only). */
export const auditService: AuditService = live ? createSupabaseAuditService(live) : mockAuditService;

/** First-run progress (Get started), saved to the person's account and kept on the device. */
export const onboardingService: OnboardingService = live ? createSupabaseOnboardingService(live) : mockOnboardingService;
