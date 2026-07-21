import React, { Suspense, lazy, useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Zap, Droplets, Wind, Cog, ShieldAlert, Monitor, Building2, Sparkles, Wrench, Forklift as Truck,
  Plus, LogOut, Camera, X, Clock, CheckCircle2, AlertTriangle,
  ListChecks, Settings, ChevronLeft, User, MapPin, Package, Search, Trash2, Send,
  ShieldCheck, Bell, Check, Moon, Sun, BarChart3, CalendarClock, PenLine, HardHat,
  DollarSign, RefreshCw, Power, Users, UserPlus, ClipboardCheck, ClipboardList,
  FileText, ExternalLink, Gauge, SlidersHorizontal, Copy, Hexagon, MessageSquare,
  FileSpreadsheet, Printer, Shirt, Footprints, Hand, Glasses, Headphones, Coins, PackageX, PackageCheck, Bug, Phone, KeyRound, Mail, Smartphone, Download, MonitorDown, MoreHorizontal, History} from "lucide-react";
import { AISettingsCard } from "./AISettingsCard.jsx";
import { InlineAITicketCreate } from "./InlineAITicketCreate.jsx";
import { UnitPicker } from "./UnitPicker.jsx";
import packageInfo from "../package.json";
import { XLSX } from "./xlsxWorkbookModel.js";
import { analyzeBackupPayload, BACKUP_APP_ID, BACKUP_COLLECTIONS, buildBackupPayload, shouldExportLegacyTicketPhoto } from "./backupModel.js";
import { productionAccessToken, store } from "./storageAdapter.js";
import { DEFAULT_MANAGER_PERMS, USER_PERMISSION_MODULES, canFull, canManage, canRequest, canView, cleanPerms, normalizePerms, permLevel, permRank } from "./permissionModel.js";
import { BI_PERIOD_OPTIONS, biDepartmentRiskRows, biPeriodRange, biScopeForSession, biTicketHeatmapRows, ticketMatchesBiHeatmapMetric } from "./biScopeModel.js";
import { biFocusDepartmentMatches, recurringFacilityZoneRows } from "./biTicketInsightModel.js";
import { normalizeNotificationPrefs } from "./notificationAccessModel.js";
import { buildPpeApprovedEvents, ppeRequestLineSummary, ppeRequestNeedsAction, ppeRequestStatusLabel } from "./ppeModel.js";
import { ppeOpenOrderQty, ppeSmartReorderLines, ppeSmartReorderLinesForItem } from "./ppeReorderModel.js";
import { isActivationLinkRole, isPasswordActivationRole, isPinActivationRole, isWorkerLoginRole, loginSetupPrompt, shouldKeepWorkerFormOpenForActivationLink, userHasLoginSecret, userNeedsInitialLoginSetup, workerLoginStateText } from "./workerAccessModel.js";
import { transportDuplicateReview } from "./ticketDuplicateModel.js";
import { facilityOwnerPatch, normalizeFacilitySupplierPatch } from "./facilityTicketRouteModel.js";
import { applyTicketStatusTiming } from "./ticketTransitionModel.js";
import { normalizedTicketLifecycleStages, ticketHasLifecycleStage, ticketLifecycleMetOperationalSla, ticketLifecycleMissedOperationalSla, ticketLifecycleOperationalElapsedMs, ticketLifecycleOperationalSlaRatio, ticketLifecycleSummary, ticketLifecycleWaitReasonStats } from "./ticketLifecycleExportModel.js";
import { findTaskImportMatch } from "./taskImportModel.js";
import { normalizeTaskActionRecord, taskActionSourceFields } from "./taskActionModel.js";
import { DEFAULT_NOTIFY_CONFIG } from "./notificationModel.js";
import { browserNotificationEvents, DEFAULT_LOCAL_NOTIFICATION_PREFS, initialBrowserNotificationState, mergeNotificationReadStates, nextBrowserNotificationEvent, notificationReadStateForEvents, notificationReadStorageKeys, parseBrowserNotificationState, parseLocalNotificationPrefs, unreadNotificationKeySet } from "./notificationPrefsModel.js";
import { resolveIdentifier } from "./loginIdentifierModel.js";
import { archiveAiConversation, callAiAssistApi, createAiConversation, createAiMemoryFact, deactivateAiMemoryFact, getAiConversation, getAiConversationAccess, listAiConversations, listAiMemoryFacts, updateAiMemoryFact } from "./aiAgentApiClient.js";
import { createAiAgentActionExecutor, createAiAgentTicketDraftEditor } from "./aiAgentActionAdapter.js";
import { buildAIContextSnapshot as buildAIContextSnapshotModel } from "./aiAssistSnapshotModel.js";
import { biHeatmapAiPrompt, cleaningDashboardAiPrompt, fleetAiPrompt, ticketAiPrompt } from "./aiAssistEntryPointModel.js";
import { AI_MODES, aiModeFromEnv, normalizeAiSettings } from "./aiProviderModel.js";
import { APP_MODES, appModeFromEnv, builtinLoginsForMode, seedPolicyForMode } from "./seedPolicyModel.js";
import { isPresenceOnline, presenceRecordForUser, shiftPresenceStatusText, todayPresenceKey, userPresenceStatusText } from "./userPresenceModel.js";
import { changeProductionPassword, completeProductionInitialPassword, createProductionAuthStore, loginWithProductionPassword, loginWithProductionPin, logoutProductionSession, productionLoginConfigFromEnv, productionLoginReady, restoreProductionSession, updateProductionNotificationReadState, updateProductionProfile, validateProductionInitialPassword } from "./productionLoginAdapter.js";
import { isOperationallyOverdue } from "./slaModel.js";
import { resolveTechnicianTolerances } from "./technicianToleranceModel.js";
import { findUserDuplicateGroups } from "./userDuplicateModel.js";
import { createTicketPhotoStorageFromEnv } from "./ticketPhotoStorage.js";
import { createCleaningPhotoStorageFromEnv } from "./cleaningPhotoStorage.js";
import { createPublicComplaintClient, fetchPublicZones, publicComplaintApiUrlFromEnv, publicZonesApiUrlFromEnv } from "./publicComplaintAdapter.js";
import { parseFleetLicenseWorkbook, planFleetLicenseCatalogAdditions } from "./fleetLicenseImportModel.js";
import { catalogAwareTypeMaps, fleetUnitsMissingFromVehicleCatalog, vehicleCatalogBase, vehicleTypeCompactSummary, vehicleTypeExistsInConfig, vehicleTypeInUseCodes } from "./fleetCatalogModel.js";
import { saveFleetImportAtomically } from "./fleetImportSaveModel.js";
import { applyFleetBulkDepartment, applyFleetBulkDocumentDate, bulkFleetDocumentLabels, selectedFleetUnits } from "./fleetBulkActionsModel.js";
import { buildMaintenanceScheduleFromRules, fleetRuleTargetMatchesUnit, maintenanceIntervalMonthsForTask, maintenanceRulesForUnit, maintenanceTitleForTask, nextMaintenanceDueFrom, normalizeFleetUnitRef, normalizeMaintenanceRules } from "./fleetMaintenancePolicyModel.js";
import { reportClientError } from "./clientErrorAdapter.js";
import { sendPhoneNotification } from "./pushNotificationAdapter.js";
import { createAppIssue } from "./appIssueModel.js";
import { appModeRequiresCleaningQr, cleaningQrAccess, cleaningQrMatchesZone, cleaningQrUrlFromWindow, extractCzoneFromRaw, findScannedCleaningZone, normalizeCleaningQrManualCode, scannedCleaningZoneIdFromWindow } from "./cleaningQrModel.js";
import { cleaningChecklistTranslationLanguages, draftCleaningChecklistTranslations, normalizeCleaningChecklistItem } from "./cleaningChecklistTranslationModel.js";
import { cleaningMissedRoundRecordsForStatuses, cleaningWindowBounds, cleaningWindowMinutes, isCleaningRoundActionableStatus, isCompletedCleaningRound } from "./cleaningRoundScheduleModel.js";
import { VERSION_MANIFEST_PATH, markStandaloneVersionRefreshed, normalizeVersionManifest, shouldAutoRefreshStandaloneVersion, shouldShowVersionUpdate } from "./appVersionModel.js";
import { softResetAppCache } from "./appCacheResetModel.js";
import { DEFAULT_LANGUAGE, languageCookieString, languageDirection, languageFromCookie, languageOptions, normalizeLanguageCode, preferredInitialLanguage } from "./languageModel.js";
import { uiText } from "./uiI18nModel.js";
import { isStandaloneDisplay, pwaInstallPromptMode } from "./pwaInstallModel.js";
import { cleaningZoneBlockerCount, cleaningZoneDeleteBlockers, cleaningZoneDeletePlan } from "./cleaningZoneBlockersModel.js";
import { appIssueScreenContext, captureAppIssueScreenshot } from "./appIssueScreenshot.js";
import { canPerformCleaning, canReceiveCleaningComplaints, hasCleaningAccess, isWorkerLike, normalizeCleaningAccess } from "./cleaningAccessModel.js";
import { defaultWorkerView } from "./workerProfileModel.js";
import { brandCompanyName, brandSiteSubtitle } from "./brandConfigModel.js";
import { parseStoredAppConfigValue } from "./appConfigRecordModel.js";
import { createApiTicketProvider } from "./apiTicketAdapter.js";
import { createApiFleetProvider } from "./apiFleetAdapter.js";
import { createApiPmProvider } from "./apiPmAdapter.js";
import { createApiCleaningZonesProvider } from "./apiCleaningZonesAdapter.js";
import { createApiCleaningRoundsProvider } from "./apiCleaningRoundsAdapter.js";
import { createApiCleaningComplaintsProvider, createApiWorkerAbsencesProvider } from "./apiCleaningRecordsAdapter.js";
import { createApiPpeProvider } from "./apiPpeAdapter.js";
import { createApiWorkProvider } from "./apiWorkAdapter.js";
import { createApiSettingsRecordsProvider } from "./apiSettingsRecordsAdapter.js";
import { createApiPresenceProvider } from "./apiPresenceAdapter.js";
import { createApiUserProvider } from "./apiUserAdapter.js";
import { storageApiBaseUrlFromEnv, storageProviderFromEnv, STORAGE_PROVIDERS } from "./storageProviderModel.js";
import { normalizedTicketAuthorityEnabled, ticketAuthorityFailureIssue, ticketsForAuthority } from "./ticketAuthorityModel.js";
import { normalizeTransportCreateResponsibility, ticketHolderLabel, transportTechnicianAssignee } from "./ticketResponsibilityModel.js";
import { supplierCandidatesForTicket, supplierHasFacilityCategory, supplierHasPpeScope, supplierHasTransportScope, supplierMeta as supMeta, supplierTypeFromMeta } from "./ticketSupplierFilterModel.js";
import { fleetAuthorityFailureIssue, fleetForAuthority, normalizedFleetAuthorityEnabled } from "./fleetAuthorityModel.js";
import { normalizedPmAuthorityEnabled, pmAuthorityFailureIssue, pmForAuthority } from "./pmAuthorityModel.js";
import { cleaningZonesAuthorityFailureIssue, cleaningZonesForAuthority, normalizedCleaningZonesAuthorityEnabled } from "./cleaningZonesAuthorityModel.js";
import { cleaningRoundsAuthorityFailureIssue, cleaningRoundsForAuthority, normalizedCleaningRoundsAuthorityEnabled } from "./cleaningRoundsAuthorityModel.js";
import { cleaningComplaintsAuthorityFailureIssue, cleaningComplaintsForAuthority, normalizedCleaningRecordsAuthorityEnabled, workerAbsencesAuthorityFailureIssue, workerAbsencesForAuthority } from "./cleaningRecordsAuthorityModel.js";
import { normalizedPpeAuthorityEnabled, ppeAuthorityFailureIssue, ppeForAuthority } from "./ppeAuthorityModel.js";
import { normalizedWorkAuthorityEnabled, workAuthorityFailureIssue, workForAuthority } from "./workAuthorityModel.js";
import { normalizedSettingsRecordsAuthorityEnabled, settingsRecordsAuthorityFailureIssue, settingsRecordsForAuthority } from "./settingsRecordsAuthorityModel.js";
import { normalizedPresenceAuthorityEnabled, presenceAuthorityFailureIssue, presenceForAuthority } from "./presenceAuthorityModel.js";
import { priorityToken, statusTokenTone, taskStatusToken, ticketStatusToken } from "./statusTokenModel.js";
import { STARTUP_KV_PREFIXES, startupKvPrefixesForAuthorities } from "./startupDataLoadModel.js";
import { DEFAULT_DATA_REFRESH_INTERVAL_MS, shouldRunDataRefresh } from "./dataRefreshScheduleModel.js";
import { ownsTicketRecord, pmFleet, pmVisibleForSession as pmVisible, techCanSeeFleet, ticketFleetDepartments, ticketUserDepartments, visibleFleetForSession, visibleTicketsForSession } from "./ticketVisibilityModel.js";
import { canConfirmTicketForSession, managerActionRequiredForTicket, managerScopedTicketNeedsFollowUp, requesterOwnsTicket } from "./ticketActionScopeModel.js";
import { ADMIN_TICKET_DURATION_FIELDS, applyAdminTicketManualEdit, datetimeValueToMs, statusMsToHours } from "./adminTicketManualEditModel.js";
import { normalizeScopedWorkerForActor, scopedUsersForActor, scopedWorkerDefaultsForActor, userDepartments, userShift } from "./userScopeModel.js";
import { downtimeLevelOf, downtimeLevelsWithSystemDefaults, isDowntimeOutOfService, missingTicketCreateFields } from "./ticketCreateContract.js";

const APP_VERSION = packageInfo.version || "0.0.0";
const AIPanel = lazy(() => import("./AIPanel.jsx").then((module) => ({ default: module.AIPanel })));
const AdminTicketsLazy = lazy(() => import("./AdminTickets.jsx").then((module) => ({ default: module.AdminTickets })));
const BIOverviewLazy = lazy(() => import("./BIOverview.jsx").then((module) => ({ default: module.BIOverview })));
const AuditLogLazy = lazy(() => import("./AuditLog.jsx").then((module) => ({ default: module.AuditLog })));
const AppIssuesSettingsPanel = lazy(() => import("./AppIssuesSettings.jsx").then((module) => ({ default: module.AppIssuesSettings })));
const NotificationPanelLazy = lazy(() => import("./NotificationPanel.jsx").then((module) => ({ default: module.NotificationPanel })));
const PpeDashboardLazy = lazy(() => import("./PpeDashboard.jsx").then((module) => ({ default: module.PpeDashboard })));
const PpeOrderFormLazy = lazy(() => import("./PpeOrders.jsx").then((module) => ({ default: module.PpeOrderForm })));
const PpeOrdersLazy = lazy(() => import("./PpeOrders.jsx").then((module) => ({ default: module.PpeOrders })));
const SuppliersPanelLazy = lazy(() => import("./SuppliersPanel.jsx").then((module) => ({ default: module.SuppliersPanel })));
const ManageHubLazy = lazy(() => import("./ManageHub.jsx").then((module) => ({ default: module.ManageHub })));
const SettingsPanelLazy = lazy(() => import("./SettingsPanel.jsx").then((module) => ({ default: module.SettingsPanel })));
const TicketDetailLazy = lazy(() => import("./TicketDetail.jsx").then((module) => ({ default: module.TicketDetail })));
const FleetAssetsModuleLazy = lazy(() => import("./FleetAssetsModule.jsx").then((module) => ({ default: module.FleetAssetsModule })));
const FleetAssetCardLazy = lazy(() => import("./FleetAssetsModule.jsx").then((module) => ({ default: module.FleetAssetCard })));
const FleetPMScheduleLazy = lazy(() => import("./FleetAssetsModule.jsx").then((module) => ({ default: module.FleetPMSchedule })));
const FleetPMEntryLazy = lazy(() => import("./FleetAssetsModule.jsx").then((module) => ({ default: module.FleetPMEntry })));
const APP_BUILD_COMMIT = typeof __CMMS_BUILD_COMMIT__ !== "undefined" ? __CMMS_BUILD_COMMIT__ : "local";
const APP_BUILD_TIME = typeof __CMMS_BUILD_TIME__ !== "undefined" ? __CMMS_BUILD_TIME__ : "";
const SAVE_FAILED_MESSAGE = "השמירה נכשלה. בדקו חיבור ונסו שוב.";

/* ============================================================
   אחזקה — CMMS · roles(admin/tech/user) · tickets · fleet · PM · cleaning · PPE · AI
   ============================================================ */

/* ---------- domain ---------- */
const ROLE_LABEL = { admin: "מנהל מערכת", executive: "הנהלה", tech: "טכנאי", user: "מנהל מחלקה", worker: "עובד", cleaner: "עובד ניקיון" };
const USER_FORM_ROLE_OPTIONS = ["worker", "tech", "user", "executive", "admin"].map((role) => [role, ROLE_LABEL[role]]);
const isActiveCleaningWorker = (user = {}) => user?.active !== false && hasCleaningAccess(user);
const localizedUiLabel = (language, key, fallback) => {
  const value = uiText(language || DEFAULT_LANGUAGE, key);
  return value && value !== key ? value : fallback;
};
const roleLabelFor = (role, language = DEFAULT_LANGUAGE) => localizedUiLabel(language, `role.${role}`, ROLE_LABEL[role] || role || "");
const APP_MODE = appModeFromEnv(import.meta.env);
const SEED_POLICY = seedPolicyForMode(APP_MODE);
const AI_MODE = aiModeFromEnv(import.meta.env, APP_MODE);
const BROWSER_AI_ENABLED = AI_MODE === AI_MODES.client;
const PRODUCTION_LOGIN_CONFIG = productionLoginConfigFromEnv(import.meta.env);
const PRODUCTION_AUTH_STORE = createProductionAuthStore();
const TICKET_PHOTOS = createTicketPhotoStorageFromEnv(import.meta.env, store, PRODUCTION_AUTH_STORE);
const CLEANING_PHOTOS = createCleaningPhotoStorageFromEnv(import.meta.env, PRODUCTION_AUTH_STORE);
const NORMALIZED_TICKET_PROVIDER = createApiTicketProvider({
  baseUrl: storageApiBaseUrlFromEnv(import.meta.env),
  getAccessToken: productionAccessToken
});
const NORMALIZED_TICKET_AUTHORITY = normalizedTicketAuthorityEnabled({
  appMode: APP_MODE,
  storageProvider: storageProviderFromEnv(import.meta.env),
  provider: NORMALIZED_TICKET_PROVIDER
});
const NORMALIZED_TICKET_SHADOW_WRITE = !NORMALIZED_TICKET_AUTHORITY
  && APP_MODE === APP_MODES.production
  && storageProviderFromEnv(import.meta.env) === STORAGE_PROVIDERS.api
  && !!NORMALIZED_TICKET_PROVIDER;
const NORMALIZED_FLEET_PROVIDER = createApiFleetProvider({
  baseUrl: storageApiBaseUrlFromEnv(import.meta.env),
  getAccessToken: productionAccessToken
});
const NORMALIZED_FLEET_AUTHORITY = normalizedFleetAuthorityEnabled({
  appMode: APP_MODE,
  storageProvider: storageProviderFromEnv(import.meta.env),
  provider: NORMALIZED_FLEET_PROVIDER
});
const NORMALIZED_FLEET_SHADOW_WRITE = !NORMALIZED_FLEET_AUTHORITY
  && APP_MODE === APP_MODES.production
  && storageProviderFromEnv(import.meta.env) === STORAGE_PROVIDERS.api
  && !!NORMALIZED_FLEET_PROVIDER;
const NORMALIZED_PM_PROVIDER = createApiPmProvider({
  baseUrl: storageApiBaseUrlFromEnv(import.meta.env),
  getAccessToken: productionAccessToken
});
const NORMALIZED_PM_AUTHORITY = normalizedPmAuthorityEnabled({
  appMode: APP_MODE,
  storageProvider: storageProviderFromEnv(import.meta.env),
  provider: NORMALIZED_PM_PROVIDER
});
const NORMALIZED_PM_SHADOW_WRITE = !NORMALIZED_PM_AUTHORITY
  && APP_MODE === APP_MODES.production
  && storageProviderFromEnv(import.meta.env) === STORAGE_PROVIDERS.api
  && !!NORMALIZED_PM_PROVIDER;
const NORMALIZED_CLEANING_ZONES_PROVIDER = createApiCleaningZonesProvider({
  baseUrl: storageApiBaseUrlFromEnv(import.meta.env),
  getAccessToken: productionAccessToken
});
const NORMALIZED_CLEANING_ZONES_AUTHORITY = normalizedCleaningZonesAuthorityEnabled({
  appMode: APP_MODE,
  storageProvider: storageProviderFromEnv(import.meta.env),
  provider: NORMALIZED_CLEANING_ZONES_PROVIDER
});
const NORMALIZED_CLEANING_ZONES_SHADOW_WRITE = !NORMALIZED_CLEANING_ZONES_AUTHORITY
  && APP_MODE === APP_MODES.production
  && storageProviderFromEnv(import.meta.env) === STORAGE_PROVIDERS.api
  && !!NORMALIZED_CLEANING_ZONES_PROVIDER;
const NORMALIZED_CLEANING_ROUNDS_PROVIDER = createApiCleaningRoundsProvider({
  baseUrl: storageApiBaseUrlFromEnv(import.meta.env),
  getAccessToken: productionAccessToken
});
const NORMALIZED_CLEANING_ROUNDS_AUTHORITY = normalizedCleaningRoundsAuthorityEnabled({
  appMode: APP_MODE,
  storageProvider: storageProviderFromEnv(import.meta.env),
  provider: NORMALIZED_CLEANING_ROUNDS_PROVIDER
});
const NORMALIZED_CLEANING_ROUNDS_SHADOW_WRITE = !NORMALIZED_CLEANING_ROUNDS_AUTHORITY
  && APP_MODE === APP_MODES.production
  && storageProviderFromEnv(import.meta.env) === STORAGE_PROVIDERS.api
  && !!NORMALIZED_CLEANING_ROUNDS_PROVIDER;
const NORMALIZED_CLEANING_COMPLAINTS_PROVIDER = createApiCleaningComplaintsProvider({
  baseUrl: storageApiBaseUrlFromEnv(import.meta.env),
  getAccessToken: productionAccessToken
});
const NORMALIZED_CLEANING_COMPLAINTS_AUTHORITY = normalizedCleaningRecordsAuthorityEnabled({
  appMode: APP_MODE,
  storageProvider: storageProviderFromEnv(import.meta.env),
  provider: NORMALIZED_CLEANING_COMPLAINTS_PROVIDER
});
const NORMALIZED_CLEANING_COMPLAINTS_SHADOW_WRITE = !NORMALIZED_CLEANING_COMPLAINTS_AUTHORITY
  && APP_MODE === APP_MODES.production
  && storageProviderFromEnv(import.meta.env) === STORAGE_PROVIDERS.api
  && !!NORMALIZED_CLEANING_COMPLAINTS_PROVIDER;
const NORMALIZED_WORKER_ABSENCES_PROVIDER = createApiWorkerAbsencesProvider({
  baseUrl: storageApiBaseUrlFromEnv(import.meta.env),
  getAccessToken: productionAccessToken
});
const NORMALIZED_WORKER_ABSENCES_AUTHORITY = normalizedCleaningRecordsAuthorityEnabled({
  appMode: APP_MODE,
  storageProvider: storageProviderFromEnv(import.meta.env),
  provider: NORMALIZED_WORKER_ABSENCES_PROVIDER
});
const NORMALIZED_WORKER_ABSENCES_SHADOW_WRITE = !NORMALIZED_WORKER_ABSENCES_AUTHORITY
  && APP_MODE === APP_MODES.production
  && storageProviderFromEnv(import.meta.env) === STORAGE_PROVIDERS.api
  && !!NORMALIZED_WORKER_ABSENCES_PROVIDER;
const NORMALIZED_PPE_PROVIDER = createApiPpeProvider({
  baseUrl: storageApiBaseUrlFromEnv(import.meta.env),
  getAccessToken: productionAccessToken
});
const NORMALIZED_PPE_AUTHORITY = normalizedPpeAuthorityEnabled({
  appMode: APP_MODE,
  storageProvider: storageProviderFromEnv(import.meta.env),
  provider: NORMALIZED_PPE_PROVIDER
});
const NORMALIZED_PPE_SHADOW_WRITE = !NORMALIZED_PPE_AUTHORITY
  && APP_MODE === APP_MODES.production
  && storageProviderFromEnv(import.meta.env) === STORAGE_PROVIDERS.api
  && !!NORMALIZED_PPE_PROVIDER;
const NORMALIZED_WORK_PROVIDER = createApiWorkProvider({
  baseUrl: storageApiBaseUrlFromEnv(import.meta.env),
  getAccessToken: productionAccessToken
});
const NORMALIZED_WORK_AUTHORITY = normalizedWorkAuthorityEnabled({
  appMode: APP_MODE,
  storageProvider: storageProviderFromEnv(import.meta.env),
  provider: NORMALIZED_WORK_PROVIDER
});
const NORMALIZED_WORK_SHADOW_WRITE = !NORMALIZED_WORK_AUTHORITY
  && APP_MODE === APP_MODES.production
  && storageProviderFromEnv(import.meta.env) === STORAGE_PROVIDERS.api
  && !!NORMALIZED_WORK_PROVIDER;
const NORMALIZED_SETTINGS_RECORDS_PROVIDER = createApiSettingsRecordsProvider({
  baseUrl: storageApiBaseUrlFromEnv(import.meta.env),
  getAccessToken: productionAccessToken
});
const NORMALIZED_SETTINGS_RECORDS_AUTHORITY = normalizedSettingsRecordsAuthorityEnabled({
  appMode: APP_MODE,
  storageProvider: storageProviderFromEnv(import.meta.env),
  provider: NORMALIZED_SETTINGS_RECORDS_PROVIDER
});
const NORMALIZED_SETTINGS_RECORDS_SHADOW_WRITE = !NORMALIZED_SETTINGS_RECORDS_AUTHORITY
  && APP_MODE === APP_MODES.production
  && storageProviderFromEnv(import.meta.env) === STORAGE_PROVIDERS.api
  && !!NORMALIZED_SETTINGS_RECORDS_PROVIDER;
const NORMALIZED_PRESENCE_PROVIDER = createApiPresenceProvider({
  baseUrl: storageApiBaseUrlFromEnv(import.meta.env),
  getAccessToken: productionAccessToken
});
const NORMALIZED_PRESENCE_AUTHORITY = normalizedPresenceAuthorityEnabled({
  appMode: APP_MODE,
  storageProvider: storageProviderFromEnv(import.meta.env),
  provider: NORMALIZED_PRESENCE_PROVIDER
});
const NORMALIZED_PRESENCE_SHADOW_WRITE = !NORMALIZED_PRESENCE_AUTHORITY
  && APP_MODE === APP_MODES.production
  && storageProviderFromEnv(import.meta.env) === STORAGE_PROVIDERS.api
  && !!NORMALIZED_PRESENCE_PROVIDER;
const USER_MANAGEMENT_PROVIDER = createApiUserProvider({
  baseUrl: storageApiBaseUrlFromEnv(import.meta.env),
  getAccessToken: productionAccessToken
});
const USER_MANAGEMENT_API_AUTHORITY = APP_MODE === APP_MODES.production
  && storageProviderFromEnv(import.meta.env) === STORAGE_PROVIDERS.api
  && !!USER_MANAGEMENT_PROVIDER;
const PUBLIC_COMPLAINTS = createPublicComplaintClient({ url: publicComplaintApiUrlFromEnv(import.meta.env) });
const PUBLIC_ZONES_URL = publicZonesApiUrlFromEnv(import.meta.env);

function LanguagePicker({ value, onChange, compact = false }) {
  const current = normalizeLanguageCode(value);
  return (
    <label className={`language-picker${compact ? " compact" : ""}`}>
      {!compact && <span>{uiText(current, "language.label")}</span>}
      <select value={current} onChange={(e) => onChange(normalizeLanguageCode(e.target.value))}>
        {languageOptions().map((language) => (
          <option key={language.code} value={language.code}>{language.nativeName}</option>
        ))}
      </select>
    </label>
  );
}

const imageFileToSquareDataUrl = (file, size = 512) => new Promise((resolve, reject) => {
  if (!file) return resolve("");
  if (!/^image\//.test(file.type || "")) return reject(new Error("not_image"));
  const reader = new FileReader();
  reader.onerror = () => reject(new Error("read_failed"));
  reader.onload = () => {
    const img = new Image();
    img.onerror = () => reject(new Error("image_decode_failed"));
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, size, size);
      const pad = Math.round(size * 0.14);
      const max = size - pad * 2;
      const scale = Math.min(max / img.width, max / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      resolve(canvas.toDataURL("image/png"));
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

const imageFileToDataUrl = (file, maxSide = 1100, quality = 0.7) => new Promise((resolve, reject) => {
  if (!file) return resolve("");
  if (!/^image\//.test(file.type || "")) return reject(new Error("not_image"));
  const reader = new FileReader();
  reader.onerror = () => reject(new Error("read_failed"));
  reader.onload = () => {
    const img = new Image();
    img.onerror = () => reject(new Error("image_decode_failed"));
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

const TRACKS = {
  facility: { id: "facility", label: "אחזקת מבנה ומתקנים", short: "מבנה", Icon: Building2, color: "#1F4E8C" },
  transport: { id: "transport", label: "כלי שינוע / מלגזות", short: "שינוע", Icon: Truck, color: "#1F4E8C" },
};

const CATEGORIES = [
  { id: "electric", label: "חשמל", Icon: Zap, color: "#F59E0B" },
  { id: "plumbing", label: "אינסטלציה", Icon: Droplets, color: "#3E6DB0" },
  { id: "hvac", label: "מיזוג אוויר", Icon: Wind, color: "#14B8A6" },
  { id: "mechanical", label: "ציוד מכני", Icon: Cog, color: "#3E6DB0" },
  { id: "safety", label: "בטיחות", Icon: ShieldAlert, color: "#EF4444" },
  { id: "it", label: "מערכות IT", Icon: Monitor, color: "#6F7680" },
  { id: "building", label: "בניין", Icon: Building2, color: "#64748B" },
  { id: "cleaning", label: "ניקיון", Icon: Sparkles, color: "#10B981" },
  { id: "other", label: "אחר", Icon: Wrench, color: "#94A3B8" },
];
const TRANSPORT_CAT = { id: "transport", label: "כלי שינוע", Icon: Truck, color: "#1F4E8C" };
const CAT_LEGACY = { forklift: "mechanical" };
const catOf = (t) => {
  if (t?.track === "transport") return TRANSPORT_CAT;
  const id = t?.category || t;
  return CATEGORIES.find((c) => c.id === id) || CATEGORIES.find((c) => c.id === CAT_LEGACY[id]) || CATEGORIES[8];
};

const PRIORITIES = [
  { id: "high", label: "גבוהה", hours: 4, ...priorityToken("high") },
  { id: "medium", label: "בינונית", hours: 24, ...priorityToken("medium") },
  { id: "low", label: "נמוכה", hours: 72, ...priorityToken("low") },
];
const PRIO_ALIAS = { urgent: "high" };
const prOf = (id) => PRIORITIES.find((p) => p.id === (PRIO_ALIAS[id] || id)) || PRIORITIES[1];
// ---- מטלות ניהול (Management tasks) ----
const TASK_STATUS = [
  { id: "todo", label: "לביצוע", ...taskStatusToken("todo") },
  { id: "in_progress", label: "בתהליך", ...taskStatusToken("in_progress") },
  { id: "waiting", label: "ממתין לגורם", ...taskStatusToken("waiting") },
  { id: "done", label: "הושלם", ...taskStatusToken("done") },
  { id: "cancelled", label: "בוטל", ...taskStatusToken("cancelled") },
];
const tstOf = (id) => { const base = TASK_STATUS.find((s) => s.id === id) || TASK_STATUS[0]; const o = TASK_STATUS_META[base.id]; return o ? { ...base, label: o.label || base.label, color: o.color || base.color, bg: o.bg || base.bg } : base; };
let TASK_STATUS_META = {};
const taskStatuses = () => TASK_STATUS.map((s) => tstOf(s.id));
const PRANK = { high: 0, medium: 1, low: 2 };
const TASK_MODES = [
  { id: "deadline", label: "עם תאריך יעד" },
  { id: "recurring", label: "חוזרת" },
  { id: "permanent", label: "קבועה — אחריות מתמשכת" },
  { id: "deferred", label: "דחויה / מתישהו" },
];
const taskModeLabel = (id) => (TASK_MODES.find((m) => m.id === id) || TASK_MODES[0]).label;
const taskOpen = (t) => t.status !== "done" && t.status !== "cancelled";
const taskOverdue = (t) => taskOpen(t) && (t.mode === "deadline" || t.mode === "recurring") && t.dueAt && t.dueAt < Date.now();
const uName = (id, users) => (users || []).find((u) => u.id === id)?.name || "—";
const taskVisible = (t, session, users) => { if (session.role === "admin") return true; const me = session.id; return t.ownerId === me || (t.responsibleIds || []).includes(me) || (t.participantIds || []).includes(me); };
// ---- פגישות (Meetings) ----
const MEETING_TYPES = [
  { id: "boss", label: "פ.ע עם מנהל שלי", color: "#1F4E8C" },
  { id: "peers", label: "פ.ע עם קולגה", color: "#0891B2" },
  { id: "leadership", label: "פגישה קבוצתית", color: "#1F4E8C" },
];
const MTG_FALLBACK = { id: "general", label: "פגישה", color: "#64748B" };
const mtgType = (id) => MEETING_TYPES.find((m) => m.id === id) || MTG_FALLBACK;
// Движок типов: тип встречи включает/выключает поля и дефолты (одна форма, не три)
const MEETING_TYPE_CFG = {
  boss: { importExcel: true, standingTopics: false, taskMulti: false, taskLocation: false, hint: "פגישת אחריות: עוברים על המשימות שלי. אפשר לייבא את ה-Excel של הממונה." },
  peers: { importExcel: false, standingTopics: true, taskMulti: false, taskLocation: false, hint: "1:1 עם עמית: נקודות קב\u05f4ע (תקין/בעיה) + משימות חדשות. אפשר לקשר משימות מהממונה." },
  leadership: { importExcel: true, standingTopics: true, taskMulti: true, taskLocation: true, hint: "פגישת הנהלה: משימות לכמה אנשים, קטגוריה ומיקום חופשי." },
};
const mtgCfg = (type) => MEETING_TYPE_CFG[type] || { importExcel: false, standingTopics: false, taskMulti: false, taskLocation: false, hint: "" };
const ORIGIN_LABEL = { manual: "ידני", excel: "מ-Excel", ai: "ניתוח AI", meeting: "מפגישה", boss_meeting: "מפגישת הממונה", boss_excel: "Excel של הממונה" };
const originLabel = (o) => ORIGIN_LABEL[o] || "ידני";
const TASK_SOURCE_MODULE_LABEL = { fleet: "כלי שינוע", cleaning: "ניקיון", tickets: "קריאה", ticket: "קריאה", meetings: "פגישה", meeting: "פגישה", ppe: "ביגוד עובדים", pm: "טיפול תקופתי" };
const taskSourceInfo = (task = {}) => {
  const ref = task.sourceRef && typeof task.sourceRef === "object" ? task.sourceRef : {};
  const moduleId = task.sourceModule || ref.module || "";
  const sourceId = task.sourceId || ref.id || task.sourceRecordId || ref.recordId || task.sourceFindingId || ref.findingId || task.sourceRunId || ref.runId || task.sourceProgramId || ref.programId || "";
  const label = task.sourceLabel || ref.label || TASK_SOURCE_MODULE_LABEL[moduleId] || "";
  if (!moduleId && !sourceId && !label) return null;
  const moduleLabel = TASK_SOURCE_MODULE_LABEL[moduleId] || moduleId || "מקור";
  const detail = label && label !== moduleLabel ? label : sourceId;
  return { moduleId, moduleLabel, sourceId, label: label || sourceId || "—", detail };
};
const RECUR_LABEL = { weekly: "שבועית", monthly: "חודשית", quarterly: "רבעונית" };
const RECUR_MS = { weekly: 7 * 86400000, monthly: 30 * 86400000, quarterly: 91 * 86400000 };
const meetingVisible = (m, session, tasks) => session.role === "admin" || m.ownerId === session.id || (m.participantIds || []).includes(session.id) || (tasks || []).some((t) => (t.meetingId === m.id || (t.linkedMeetingIds || []).includes(m.id)) && (t.ownerId === session.id || (t.responsibleIds || []).includes(session.id)));
const CAT_META = CATEGORIES.reduce((a, c) => ((a[c.id] = { Icon: c.Icon, color: c.color }), a), {});
const catMeta = (id) => CAT_META[id] || { Icon: Wrench, color: "#94A3B8" };
const DEFAULT_SLA = { high: 4, medium: 24, low: 72 };
const slaForTicket = (t, cfg, fleet) => {
  if (t.slaHoursOverride) return Number(t.slaHoursOverride);
  const prio = prOf(t.priority).id;
  if (t.track === "transport" || t.forkliftId) { const f = (fleet || []).find((x) => x.id === t.forkliftId); return cfg?.typeSla?.[unitTypeName(f, cfg)]?.[prio] ?? cfg?.typeSla?.[unitModelCode(f)]?.[prio] ?? DEFAULT_SLA[prio]; }
  return cfg?.catSla?.[t.category]?.[prio] ?? DEFAULT_SLA[prio];
};

const STATUSES = [
  { id: "pending_manager", label: "ממתינה לאישור מנהל", ...ticketStatusToken("pending_manager") },
  { id: "rework", label: "הוחזר לעובד", ...ticketStatusToken("rework") },
  { id: "new", label: "חדשה", ...ticketStatusToken("new") },
  { id: "in_progress", label: "בטיפול", ...ticketStatusToken("in_progress") },
  { id: "waiting", label: "בהמתנה", ...ticketStatusToken("waiting") },
  { id: "pending_user", label: "ממתינה לאישור הפותח", ...ticketStatusToken("pending_user") },
  { id: "pending_admin", label: "ממתינה לסגירה", ...ticketStatusToken("pending_admin") },
  { id: "done", label: "נסגרה", ...ticketStatusToken("done") },
  { id: "cancelled", label: "בוטלה", ...ticketStatusToken("cancelled") },
];
const stOf = (id) => STATUSES.find((s) => s.id === id) || STATUSES[0];
const trackOf = (t) => t.track || (t.forkliftId ? "transport" : "facility");
const REJECT_REASONS = [{ id: "duplicate", label: "כפילות" }, { id: "not_needed", label: "לא נדרש" }, { id: "insufficient", label: "חוסר מידע" }];
const rejectLabel = (id) => (REJECT_REASONS.find((r) => r.id === id)?.label) || id;
// Single source of truth for the ticket lifecycle. Each key lists the statuses it may move to.
const TRANSITIONS = {
  pending_manager: ["new", "rework", "cancelled"],
  rework: ["pending_manager", "cancelled"],
  new: ["in_progress", "waiting", "cancelled"],
  in_progress: ["waiting", "pending_user", "cancelled"],
  waiting: ["in_progress", "pending_user", "cancelled"],
  pending_user: ["pending_admin", "in_progress"],
  pending_admin: ["done", "in_progress"],
  done: [],
  cancelled: [],
};
const canTransition = (from, to) => from === to || (TRANSITIONS[from] || []).includes(to);

const DOWNTIME = [
  { id: "has_replacement", label: "יש תחליף", desc: "הכלי מושבת אך קיים תחליף זמין", color: "#16A34A", prio: "medium", oos: false },
  { id: "minor", label: "תקלה שאינה מוציאה מכלל שימוש", desc: "ניתן להמשיך לעבוד · בדיקה/תחזוקה", color: "#CA8A04", prio: "low", oos: false },
  { id: "critical", label: "תקלה קריטית — אין תחליף", desc: "הכלי מושבת ואין תחליף", color: "#DC2626", prio: "high", oos: true },
];
// Уровни тяжести настраиваются админом (config.downtimeLevels); fallback — DOWNTIME. Поиск всегда что-то возвращает (целостность: ссылка на удалённый уровень не уронит экран).
const dtLevels = (cfg) => downtimeLevelsWithSystemDefaults(cfg, DOWNTIME);
const dtOf = (id, cfg) => downtimeLevelOf(id, cfg, DOWNTIME);
const DT_PALETTE = ["#1F4E8C", "#3E6DB0", "#6F7680", "#A4A9B0", "#16A34A", "#CA8A04", "#EA580C", "#DC2626", "#B91C1C"];
const WEAR = [{ id: "natural", label: "בלאי טבעי" }, { id: "disproportionate", label: "נזק בלתי פרופורציונלי" }];

const FORKLIFT_TYPES = ["52-8FDF20", "8FBE15T", "GS4047", "LPE200", "LWE250", "LWI160", "MX-X", "OSE250", "RRE140B", "RRE200H", "RRE250E", "SPE160", "SWE160", "VCE150A"];
const DOC_DEFS = [
  { id: "insurance", label: "ביטוח" },
  { id: "tasrir", label: "תסקיר" },
  { id: "license", label: "רישיון רכב" },
  { id: "lease", label: "סיום ליזינג" },
];
const COMPACT_DOC_LABELS = {
  license: "ר. רכב",
  lease: "ס. ליסינג"
};
const compactDocLabel = (doc) => COMPACT_DOC_LABELS[doc?.id] || doc?.label || "";
// Профиль документов по типу: tasrir (мачта/подъём → תסקיר), license (רישיון רכב), insurance (ביטוח), lease (סיום ליזינג).
const TYPE_META_SEED = {
  "52-8FDF20": { insurance: true, tasrir: true, license: true, lease: true },
  "8FBE15T": { insurance: true, tasrir: true, license: true, lease: true },
  "GS4047": { insurance: false, tasrir: true, license: false, lease: false },
  "LPE200": { insurance: true, tasrir: false, license: false, lease: true },
  "LWE250": { insurance: true, tasrir: false, license: false, lease: true },
  "LWI160": { insurance: true, tasrir: false, license: false, lease: true },
  "MX-X": { insurance: true, tasrir: true, license: true, lease: true },
  "OSE250": { insurance: true, tasrir: false, license: false, lease: true },
  "RRE140B": { insurance: true, tasrir: true, license: true, lease: true },
  "RRE200H": { insurance: true, tasrir: true, license: true, lease: true },
  "RRE250E": { insurance: true, tasrir: true, license: true, lease: true },
  "SPE160": { insurance: true, tasrir: true, license: true, lease: true },
  "SWE160": { insurance: true, tasrir: true, license: false, lease: true },
  "VCE150A": { insurance: true, tasrir: true, license: true, lease: true },
};
const FLEET_SEED = [
  {id:"v-194099-99",code:"99",type:"52-8FDF20",supplier:"טויוטה",chassis:"508FDF25-816",license:"194099",leaseCost:0,notes:"מלגזת משקל נגדי (דיזל)",docs:{tasrir:{date:"2026-06-08",link:""},license:{date:"2027-05-20",link:""}}},
  {id:"v-None-722",code:"722",type:"52-8FDF20",supplier:"טויוטה",chassis:"6823722",license:"",leaseCost:0,notes:"",docs:{tasrir:{date:"2027-09-15",link:""}}},
  {id:"v-None-678120",code:"678120",type:"52-8FDF20",supplier:"טויוטה",chassis:"202",license:"",leaseCost:0,notes:"",docs:{tasrir:{date:"2027-09-15",link:""}}},
  {id:"v-GS4716D2507-GS-4716D2507",code:"GS-4716D2507",type:"GS4047",supplier:"במת הרמה",chassis:"",license:"GS-4716D2507",leaseCost:0,notes:"במת הרמה",docs:{tasrir:{date:"2026-06-08",link:""}}},
  {id:"v-6677941-6677941",code:"6677941",type:"LPE200",supplier:"טויוטה",chassis:"",license:"6677941",leaseCost:0,notes:"עגלת אדם רוכב",docs:{lease:{date:"2026-06-08",link:""}}},
  {id:"v-6828150-6828150",code:"6828150",type:"LPE200",supplier:"טויוטה",chassis:"",license:"6828150",leaseCost:1210,notes:"עגלת אדם רוכב",docs:{lease:{date:"2028-03-10",link:""}}},
  {id:"v-6831651-6831651",code:"6831651",type:"LPE200",supplier:"טויוטה",chassis:"",license:"6831651",leaseCost:1210,notes:"עגלת אדם רוכב",docs:{lease:{date:"2028-03-10",link:""}}},
  {id:"v-6831652-6831652",code:"6831652",type:"LPE200",supplier:"טויוטה",chassis:"",license:"6831652",leaseCost:1210,notes:"עגלת אדם רוכב",docs:{lease:{date:"2028-03-10",link:""}}},
  {id:"v-6831653-6831653",code:"6831653",type:"LPE200",supplier:"טויוטה",chassis:"",license:"6831653",leaseCost:1210,notes:"עגלת אדם רוכב",docs:{lease:{date:"2028-03-10",link:""}}},
  {id:"v-178051-51",code:"51",type:"RRE140B",supplier:"טויוטה",chassis:"6852072",license:"178051",leaseCost:3265,notes:"מלגזת היגש",docs:{tasrir:{date:"2026-06-08",link:""},license:{date:"2027-05-20",link:""},lease:{date:"2028-03-10",link:""}}},
  {id:"v-194335-335",code:"335",type:"RRE200H",supplier:"טויוטה",chassis:"6823359",license:"194335",leaseCost:2810,notes:"מלגזת היגש",docs:{tasrir:{date:"2026-06-08",link:""},license:{date:"2027-05-20",link:""},lease:{date:"2028-03-10",link:""}}},
  {id:"v-194336-336",code:"336",type:"RRE200H",supplier:"טויוטה",chassis:"6823360",license:"194336",leaseCost:2810,notes:"מלגזת היגש",docs:{tasrir:{date:"2027-09-15",link:""},license:{date:"2027-05-20",link:""},lease:{date:"2028-03-10",link:""}}},
  {id:"v-194337-337",code:"337",type:"RRE200H",supplier:"טויוטה",chassis:"6823687",license:"194337",leaseCost:2810,notes:"מלגזת היגש",docs:{tasrir:{date:"2027-09-15",link:""},license:{date:"2027-05-20",link:""},lease:{date:"2028-03-10",link:""}}},
  {id:"v-194338-338",code:"338",type:"RRE200H",supplier:"טויוטה",chassis:"6823688",license:"194338",leaseCost:2810,notes:"מלגזת היגש",docs:{tasrir:{date:"2027-09-15",link:""},license:{date:"2027-05-20",link:""},lease:{date:"2028-03-10",link:""}}},
  {id:"v-194339-339",code:"339",type:"RRE200H",supplier:"טויוטה",chassis:"6823689",license:"194339",leaseCost:2810,notes:"מלגזת היגש",docs:{tasrir:{date:"2027-09-15",link:""},license:{date:"2027-05-20",link:""},lease:{date:"2028-03-10",link:""}}},
  {id:"v-178040-40",code:"40",type:"8FBE15T",supplier:"טויוטה",chassis:"8FBE15T-2019",license:"178040",leaseCost:2075,notes:"מלגזת משקל נגדי",docs:{tasrir:{date:"2026-06-08",link:""},license:{date:"2027-05-20",link:""},lease:{date:"2028-03-10",link:""}}},
  {id:"v-178039-39",code:"39",type:"8FBE15T",supplier:"טויוטה",chassis:"8FBE15T-2020",license:"178039",leaseCost:2075,notes:"מלגזת משקל נגדי",docs:{tasrir:{date:"2027-09-15",link:""},license:{date:"2027-05-20",link:""},lease:{date:"2028-03-10",link:""}}},
  {id:"v-178041-41",code:"41",type:"8FBE15T",supplier:"טויוטה",chassis:"8FBE15T-2018",license:"178041",leaseCost:2075,notes:"מלגזת משקל נגדי",docs:{tasrir:{date:"2027-09-15",link:""},license:{date:"2027-05-20",link:""},lease:{date:"2028-03-10",link:""}}},
  {id:"v-213580-580",code:"580",type:"8FBE15T",supplier:"טויוטה",chassis:"8FBE15T-2159",license:"213580",leaseCost:2075,notes:"מלגזת משקל נגדי",docs:{tasrir:{date:"2027-09-15",link:""},license:{date:"2027-05-20",link:""},lease:{date:"2028-03-10",link:""}}},
  {id:"v-6387893-6387893",code:"6387893",type:"LWE250",supplier:"טויוטה",chassis:"",license:"6387893",leaseCost:0,notes:"עגלת נהג",docs:{}},
  {id:"v-178070-70",code:"70",type:"VCE150A",supplier:"טויוטה",chassis:"6829589",license:"178070",leaseCost:7010,notes:"מלגזת צריח",docs:{tasrir:{date:"2026-06-08",link:""},license:{date:"2027-05-20",link:""},lease:{date:"2028-03-10",link:""}}},
  {id:"v-6810635-6810635",code:"6810635",type:"LWI160",supplier:"טויוטה",chassis:"",license:"6810635",leaseCost:0,notes:"עגלת נהג",docs:{lease:{date:"2026-06-08",link:""}}},
  {id:"v-6766794-6766794",code:"6766794",type:"LWI160",supplier:"טויוטה",chassis:"",license:"6766794",leaseCost:0,notes:"עגלת נהג",docs:{lease:{date:"2028-03-10",link:""}}},
  {id:"v-6810634-6810634",code:"6810634",type:"LWI160",supplier:"טויוטה",chassis:"",license:"6810634",leaseCost:860,notes:"עגלת נהג",docs:{lease:{date:"2028-03-10",link:""}}},
  {id:"v-6810269-6810269",code:"6810269",type:"LWI160",supplier:"טויוטה",chassis:"",license:"6810269",leaseCost:860,notes:"עגלת נהג",docs:{lease:{date:"2028-03-10",link:""}}},
  {id:"v-6809857-6809857",code:"6809857",type:"LWI160",supplier:"טויוטה",chassis:"",license:"6809857",leaseCost:860,notes:"עגלת נהג",docs:{lease:{date:"2028-03-10",link:""}}},
  {id:"v-6823722-6823722",code:"6823722",type:"SWE160",supplier:"טויוטה",chassis:"",license:"6823722",leaseCost:1310,notes:"עגלת אדם הולך עם תורן",docs:{tasrir:{date:"2026-06-08",link:""},lease:{date:"2028-03-10",link:""}}},
  {id:"v-6781202-6781202",code:"6781202",type:"SWE160",supplier:"טויוטה",chassis:"",license:"6781202",leaseCost:0,notes:"עגלת אדם הולך עם תורן",docs:{tasrir:{date:"2027-09-15",link:""},lease:{date:"2028-03-10",link:""}}},
  {id:"v-None-52",code:"52",type:"SWE160",supplier:"טויוטה",chassis:"6954052",license:"",leaseCost:0,notes:"",docs:{tasrir:{date:"2027-09-15",link:""}}},
  {id:"v-None-654",code:"654",type:"SWE160",supplier:"טויוטה",chassis:"6951654",license:"",leaseCost:0,notes:"",docs:{tasrir:{date:"2027-09-15",link:""}}},
  {id:"v-6883810-6883810",code:"6883810",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6883810",leaseCost:1965,notes:"מלקטת (כפולה)",docs:{lease:{date:"2026-06-08",link:""}}},
  {id:"v-6883812-6883812",code:"6883812",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6883812",leaseCost:1705,notes:"מלקטת (כפולה)",docs:{lease:{date:"2028-03-10",link:""}}},
  {id:"v-6883811-6883811",code:"6883811",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6883811",leaseCost:1705,notes:"מלקטת (כפולה)",docs:{lease:{date:"2028-03-10",link:""}}},
  {id:"v-6882295-6882295",code:"6882295",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6882295",leaseCost:1705,notes:"מלקטת (כפולה)",docs:{lease:{date:"2028-03-10",link:""}}},
  {id:"v-6851069-6851069",code:"6851069",type:"OSE250",supplier:"טויוטה",chassis:"",license:"6851069",leaseCost:1705,notes:"מלקטת (סינגל)",docs:{lease:{date:"2028-03-10",link:""}}},
  {id:"v-120823-120823",code:"120823",type:"RRE250E",supplier:"טויוטה",chassis:"12345678",license:"120823",leaseCost:0,notes:"מלגזת היגש",docs:{tasrir:{date:"2026-06-08",link:""},license:{date:"2027-05-20",link:""},lease:{date:"2028-03-10",link:""}}},
  {id:"v-194347-347",code:"347",type:"SPE160",supplier:"טויוטה",chassis:"6823724",license:"194347",leaseCost:1550,notes:"עגלת אדם רוכב עם תורן",docs:{tasrir:{date:"2026-06-08",link:""},license:{date:"2027-05-20",link:""},lease:{date:"2028-03-10",link:""}}},
  {id:"v-194348-348",code:"348",type:"SPE160",supplier:"טויוטה",chassis:"6823688",license:"194348",leaseCost:1550,notes:"עגלת אדם רוכב עם תורן",docs:{tasrir:{date:"2027-09-15",link:""},license:{date:"2027-05-20",link:""},lease:{date:"2028-03-10",link:""}}},
  {id:"v-6951654-6951654",code:"6951654",type:"SPE160",supplier:"טויוטה",chassis:"",license:"6951654",leaseCost:0,notes:"עגלת אדם הולך עם תורן",docs:{tasrir:{date:"2027-09-15",link:""}}},
  {id:"v-194895-895",code:"895",type:"SPE160",supplier:"טויוטה",chassis:"6865293",license:"194895",leaseCost:1870,notes:"עגלת אדם רוכב עם תורן",docs:{tasrir:{date:"2027-09-15",link:""},license:{date:"2027-05-20",link:""},lease:{date:"2028-03-10",link:""}}},
  {id:"v-194896-896",code:"896",type:"SPE160",supplier:"טויוטה",chassis:"6865294",license:"194896",leaseCost:1870,notes:"עגלת אדם רוכב עם תורן",docs:{tasrir:{date:"2027-09-15",link:""},license:{date:"2027-05-20",link:""},lease:{date:"2028-03-10",link:""}}},
  {id:"v-111236-236",code:"236",type:"MX-X",supplier:"קידמה",chassis:"12345678",license:"111236",leaseCost:4317,notes:"מלגזת צריח",docs:{tasrir:{date:"2026-06-08",link:""},license:{date:"2027-05-20",link:""}}},
];

const FREQS = [
  { id: "daily", label: "יומי", days: 1 }, { id: "weekly", label: "שבועי", days: 7 },
  { id: "monthly", label: "חודשי", days: 30 }, { id: "quarterly", label: "רבעוני", days: 90 }, { id: "yearly", label: "שנתי", days: 365 },
];
const freqOf = (id) => FREQS.find((f) => f.id === id) || FREQS[2];
const pmFreqForType = (type, cfg) => (cfg?.typeMeta?.[type]?.pmFreq) || "monthly";
const pmFreqForUnit = (f, cfg) => (cfg?.typeMeta?.[unitTypeName(f, cfg)]?.pmFreq) || (cfg?.typeMeta?.[unitModelCode(f)]?.pmFreq) || "monthly";

const WIDGETS = [
  { id: "kpis", label: "מדדים ראשיים" }, { id: "docs", label: "מסמכים פגי-תוקף" },
  { id: "downtime", label: "השבתות קריטיות" }, { id: "sla", label: "חריגות SLA" },
  { id: "pm", label: "תחזוקה מונעת" }, { id: "presence", label: "נוכחות טכנאים" }, { id: "costs", label: "עלויות החודש" },
];
const DEFAULT_CONFIG = {
  companyName: "CMMS CDSL", siteName: "ניהול אחזקה, צי, ניקיון וביגוד",
  departments: ["נפחי", "גלרייה", "מחסן", "קבלה", "החזרות", "הפצה", "שיגור", "בקרי איכות", "אחזקה", "ניקיון"],
  zones: ["אזור קבלת סחורה", "אזור משלוחים", "מחסן ראשי", "אזור קירור", "רחבת מלגזות", "רציפי טעינה", "משרדים", "חניון", "כללי"],
  suppliers: ["טויוטה", "במת הרמה", "קידמה", "Still", "קבלן חשמל א.ב.", "שירות מזגנים בע״מ", "ספק חלקים", "פנימי"],
  categories: CATEGORIES.map((c) => ({ id: c.id, label: c.label })),
  catSla: CATEGORIES.reduce((a, c) => ((a[c.id] = { high: 4, medium: 24, low: 72 }), a), {}),
  forkliftTypes: [...FORKLIFT_TYPES],
  typeSla: FORKLIFT_TYPES.reduce((a, t) => ((a[t] = { high: 4, medium: 24, low: 72 }), a), {}),
  typeMeta: { ...TYPE_META_SEED },
  docWarn: { yellow: 30, orange: 14, red: 7 },
  escalateCriticalHours: 2,
  widgets: WIDGETS.reduce((a, w) => ((a[w.id] = true), a), {}),
  techWidgets: { tickets: true, pm: true, sla: true, presence: true },
  mgrWidgets: { tickets: true, pm: true, sla: true },
  notify: { ...DEFAULT_NOTIFY_CONFIG },
  defaultShiftStart: "07:30", defaultShiftEnd: "16:30", lateGraceMin: 10, earlyGraceMin: 10,
  vehicleTypes: [], modelSupplier: {}, modelType: {}, maintenanceRules: [], pmDailyCapacity: 4, cleaningReminderMins: 30, shifts: [], workShifts: [],
};

/* ---------- helpers ---------- */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
// Экранирование пользовательского текста перед вставкой в HTML-отчёты (защита от инъекции в окне отчёта)
const esc = (v) => String(v ?? "").split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;").split(String.fromCharCode(34)).join("&quot;").split(String.fromCharCode(39)).join("&#39;");
// Excel formula injection: ячейку, начинающуюся с = + - @ или управляющего символа, префиксуем апострофом, чтобы Excel не исполнил её как формулу.
const cellSafe = (v) => (typeof v === "string" && /^[=+\-@\t\r\n]/.test(v)) ? "'" + v : v;
const rowsSafe = (rows) => (Array.isArray(rows) ? rows : []).map((r) => (r && typeof r === "object" && !Array.isArray(r)) ? Object.fromEntries(Object.entries(r).map(([k, val]) => [k, cellSafe(val)])) : r);
const clampPmDailyCapacity = (value) => Math.max(1, Math.min(20, Number(value) || 4));
const clampCleaningReminderMins = (value) => Math.max(5, Math.min(120, Number(value) || 30));
const loadReadExcelFile = () => import("read-excel-file/browser").then((module) => module.default || module);
const loadPapa = () => import("papaparse").then((module) => module.default || module);
const loadQrCode = () => import("qrcode").then((module) => module.default || module);
const loadJsQr = () => import("jsqr").then((module) => module.default || module);
const notifyUser = (message) => {
  try {
    if (typeof window === "undefined" || !window.dispatchEvent) return;
    const event = typeof CustomEvent !== "undefined"
      ? new CustomEvent("cmms:notice", { detail: { message } })
      : Object.assign(new Event("cmms:notice"), { detail: { message } });
    window.dispatchEvent(event);
  } catch (e) {}
};
// Надёжная выгрузка: пробуем несколько методов, т.к. песочница артефакта часто блокирует download/popup
const downloadBlob = (blob, filename) => {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename;
    a.style.display = "none"; document.body.appendChild(a); a.click();
    setTimeout(() => { try { document.body.removeChild(a); } catch (e) {} URL.revokeObjectURL(url); }, 2000);
    return true;
  } catch (e) { return false; }
};
const downloadXlsx = (wb, filename) => {
  const fallback = () => {
    if (downloadWorkbookFallback(wb, filename)) return;
    notifyUser("הסביבה חוסמת הורדת קבצים. נסו בדפדפן/בגרסת הענן.");
  };
  try {
    import("./xlsxExportAdapter.js")
      .then(({ workbookToBlob }) => workbookToBlob(wb))
      .then((blob) => { if (!downloadBlob(blob, filename)) fallback(); })
      .catch(fallback);
    return true;
  } catch (e) { fallback(); return false; }
};
const downloadWorkbookFallback = (wb, filename) => {
  // CSV-скачивание
  try {
    const ws = wb.Sheets[wb.SheetNames[0]];
    const csv = "\uFEFF" + XLSX.utils.sheet_to_csv(ws);
    if (downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), filename.replace(/\.xlsx$/, ".csv"))) return true;
  } catch (e) {}
  // открыть в новом окне для ручного сохранения
  try {
    const ws = wb.Sheets[wb.SheetNames[0]];
    const html = XLSX.utils.sheet_to_html(ws);
    const w = window.open("", "_blank");
    if (w) { w.document.write(`<html dir="rtl"><head><meta charset="utf8"><title>${filename}</title></head><body>${html}</body></html>`); w.document.close(); return true; }
  } catch (e) {}
  return false;
};
// Открыть отчёт в новом окне (для печати/сохранения PDF вручную)
const openReport = (html) => {
  try { const w = window.open("", "_blank"); if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(() => { try { w.print(); } catch (e) {} }, 400); return true; } } catch (e) {}
  try {
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    document.body.appendChild(frame);
    const doc = frame.contentWindow.document; doc.open(); doc.write(html); doc.close();
    setTimeout(() => { try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch (e) {} setTimeout(() => { try { document.body.removeChild(frame); } catch (e) {} }, 1500); }, 500);
    return true;
  } catch (e) {}
  notifyUser("הסביבה חוסמת פתיחת חלון להדפסה. נסו בדפדפן/בגרסת הענן.");
  return false;
};
const tkLetter = (t) => ((t?.track === "transport") || (!t?.track && t?.forkliftId)) ? "T" : "F";
const fleetDepts = ticketFleetDepartments;
const fleetDeptOf = (t, fleet) => { const f = (fleet || []).find((x) => x.id === t.forkliftId); return fleetDepts(f).join(", "); };
const fleetInDept = (f, dept) => fleetDepts(f).includes(dept);
const userDepts = ticketUserDepartments;
const ticketNo = (t) => (t && t.num) ? `${tkLetter(t)}-${String(t.num).padStart(3, "0")}` : (t ? `${tkLetter(t)}-${String(t.id || "").slice(-4).toUpperCase()}` : "—");
const pad2 = (n) => String(n).padStart(2, "0");
const fmtDate = (ts) => { if (!ts) return "—"; const d = new Date(ts); return Number.isNaN(d.getTime()) ? "—" : `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${String(d.getFullYear()).slice(-2)}`; };
const fmtTime = (ts) => { const d = new Date(ts); return Number.isNaN(d.getTime()) ? "—" : `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
const fmtDateTimeShort = (ts) => ts ? `${fmtDate(ts)} ${fmtTime(ts)}` : "";
const inputDateTime = (ts) => {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};
const daypartGreeting = (now = new Date()) => {
  const h = now.getHours();
  if (h >= 5 && h < 12) return "בוקר טוב";
  if (h >= 12 && h < 17) return "צהריים טובים";
  if (h >= 17 && h < 22) return "ערב טוב";
  return "לילה טוב";
};
const dayCountLabel = (n) => Number(n) === 1 ? "יום אחד" : `${n} ימים`;
const countLabel = (n, one, many) => `${n} ${Number(n) === 1 ? one : many}`;
const fmtDur = (ms) => { const h = Math.round(ms / 3600000); if (h < 1) return "פחות משעה"; if (h < 48) return `${h} שע׳`; return dayCountLabel(Math.round(h / 24)); };
const timeAgo = (ts) => { const s = (Date.now() - ts) / 1000; if (s < 60) return "כעת"; const m = s / 60; if (m < 60) return `לפני ${Math.floor(m)} ד׳`; const h = m / 60; if (h < 24) return `לפני ${Math.floor(h)} שע׳`; const d = h / 24; if (d < 30) return `לפני ${dayCountLabel(Math.floor(d))}`; return fmtDate(ts); };
const isOverdue = (t) => isOperationallyOverdue(t);
// "Гидравлика" теперь означает «мачта/подъём → требует תסקיר» (флаг типа tasrir, легаси: hydraulics).
const typeMetaOf = (typeName, cfg) => (cfg?.typeMeta?.[typeName]) || {};
const typeHydraulics = (typeName, cfg) => { const m = typeMetaOf(typeName, cfg); return !!(m.tasrir ?? m.hydraulics); };
const resolveHydraulics = (f, cfg) => {
  const ov = (f && (f.tasrir === true || f.tasrir === false)) ? f.tasrir : (f && (f.hydraulics === true || f.hydraulics === false)) ? f.hydraulics : undefined;
  const typeName = unitTypeName(f, cfg);
  const modelName = unitModelCode(f);
  return ov !== undefined ? ov : (typeHydraulics(typeName, cfg) || (modelName !== typeName && typeHydraulics(modelName, cfg)));
};
// Управляет ли тип данным документом (תסקיר учитывает per-machine override).
const typeManagesDoc = (typeName, docId, cfg) => { if (docId === "tasrir") return typeHydraulics(typeName, cfg); return !!typeMetaOf(typeName, cfg)[docId]; };
// --- Тип/Модель: миграция (1 тип на каждую текущую модель) и flatten в плоские поля ---
const buildVehicleTypes = (cfg, fleet) => {
  const models = (cfg?.forkliftTypes && cfg.forkliftTypes.length) ? cfg.forkliftTypes : [...new Set((fleet || []).map((f) => unitModelCode(f)).filter(Boolean))];
  const byName = new Map(); // имя типа (из заметки, иначе код модели) -> агрегат
  models.forEach((m) => {
    const unit = (fleet || []).find((f) => unitModelCode(f) === m);
    const name = unit ? (unitTypeName(unit, cfg) || m) : (modelTypeName(m, cfg) || m);
    if (!byName.has(name)) byName.set(name, { name, models: [], meta: cfg?.typeMeta?.[m] || {}, sla: cfg?.typeSla?.[m] || {} });
    const e = byName.get(name); if (!e.models.includes(m)) e.models.push(m);
  });
  let i = 0;
  return [...byName.values()].map((e) => { const meta = e.meta, sla = e.sla; return { id: "vt" + (i++) + "_" + (e.name || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8), name: e.name, high: sla.high ?? 4, medium: sla.medium ?? 24, low: sla.low ?? 72, tasrir: !!(meta.tasrir ?? meta.hydraulics), license: !!meta.license, insurance: !!meta.insurance, lease: !!meta.lease, pmFreq: meta.pmFreq || "monthly", models: e.models }; });
};
const flattenVehicleTypes = (vts) => {
  const forkliftTypes = [], typeSla = {}, typeMeta = {}, modelSupplier = {}, modelType = {};
  (vts || []).forEach((vt) => {
    const ms = (vt.models || []).map((m) => (m || "").trim()).filter(Boolean);
    const list = ms.length ? ms : [(vt.name || "").trim()].filter(Boolean);
    const typeName = (vt.name || "").trim();
    if (typeName) {
      typeSla[typeName] = { high: Number(vt.high) || 4, medium: Number(vt.medium) || 24, low: Number(vt.low) || 72 };
      typeMeta[typeName] = { tasrir: !!vt.tasrir, license: !!vt.license, insurance: !!vt.insurance, lease: !!vt.lease, pmFreq: vt.pmFreq || "monthly" };
    }
    list.forEach((m) => {
      if (!forkliftTypes.includes(m)) forkliftTypes.push(m);
      typeSla[m] = { high: Number(vt.high) || 4, medium: Number(vt.medium) || 24, low: Number(vt.low) || 72 };
      typeMeta[m] = { tasrir: !!vt.tasrir, license: !!vt.license, insurance: !!vt.insurance, lease: !!vt.lease, pmFreq: vt.pmFreq || "monthly" };
      modelSupplier[m] = vt.supplier || ""; modelType[m] = (vt.name || "").trim();
    });
  });
  return { vehicleTypes: vts, vehicleTypesSaved: true, vtMigV: 2, forkliftTypes, typeSla, typeMeta, modelSupplier, modelType };
};
const mergeFleetCatalogAdditions = (config, fleet, additions) => {
  const list = vehicleCatalogBase({
    config,
    fleet,
    productionStartsEmpty: SEED_POLICY.productionStartsEmpty,
    buildVehicleTypes
  });
  (additions || []).forEach((add) => {
    let type = list.find((v) => (v.name || "").trim() === add.name);
    if (!type) {
      type = { id: "vt_import_" + Date.now().toString(36) + "_" + list.length, name: add.name, high: 4, medium: 24, low: 72, tasrir: false, license: false, insurance: false, lease: false, pmFreq: "monthly", models: [] };
      list.push(type);
    }
    (add.models || []).forEach((m) => { if (m && !type.models.includes(m)) type.models.push(m); });
    type.tasrir = type.tasrir || !!add.docs?.tasrir;
    type.license = type.license || !!add.docs?.license;
    type.lease = type.lease || !!add.docs?.lease;
  });
  return { ...config, ...flattenVehicleTypes(list) };
};
const modelTypeName = (model, cfg) => (cfg?.modelType?.[model]) || "";
const modelSupplierOf = (model, cfg) => (cfg?.modelSupplier?.[model]) || "";
// --- Единый фундамент идентификации юнита: внутр.№ · тип · модель ---
const vehicleTypeExists = vehicleTypeExistsInConfig;
const unitModelCode = (f) => (f && (f.model || f.type)) || "";                         // модель (код производителя), legacy: f.type
const unitTypeName = (f, cfg) => {
  if (!f) return "";
  const explicit = (f.vehicleKind || "").trim();
  if (explicit) return explicit;
  const legacyMapped = modelTypeName(f.type, cfg);
  if (legacyMapped) return legacyMapped;
  if (vehicleTypeExists(f.type, cfg)) return f.type || "";
  return (f.notes || f.type || "").trim();
}; // тип: новое vehicleKind/type, иначе legacy mapping/notes
const unitDesc = (f, cfg) => { const t = unitTypeName(f, cfg), m = unitModelCode(f); const parts = (t && t !== m) ? [t, m] : [m || t]; return parts.filter(Boolean).join(" · "); }; // "тип · модель" без дубля если тип==модель
const unitLabel = (f, cfg) => { if (!f) return ""; return [f.code, unitDesc(f, cfg)].filter(Boolean).join(" · "); }; // "№ · тип · модель"
const unitNote = (f, cfg) => { const n = (f && f.notes) || ""; return n && n !== unitTypeName(f, cfg) ? n : ""; }; // заметка без дублирования типа
// --- Классификация записей журнала (вывод типа действия по тексту) ---
const LOG_KINDS = [
  { id: "close", label: "סגירה", color: "#15803D", re: /נסגר|סגירה/ },
  { id: "reject", label: "דחייה", color: "#DC2626", re: /נדחה|נדחתה/ },
  { id: "cancel", label: "ביטול", color: "#64748B", re: /בוטל|ביטול/ },
  { id: "reopen", label: "החזרה לטיפול", color: "#B45309", re: /מחדש|הוחזר/ },
  { id: "approve", label: "אישור", color: "#16A34A", re: /אושר|אישר/ },
  { id: "forward", label: "העברה לטכנאי", color: "#1F4E8C", re: /הועבר לטכנאי|נפתחה והועברה|הועברה לטכנאים/ },
  { id: "accept", label: "קבלה לטיפול", color: "#0891B2", re: /קיבל|התקבל/ },
  { id: "treat", label: "טיפול", color: "#0D9488", re: /הטיפול הסתיים|טופל|תיקון|הועבר לאישור|הועבר לסגירת/ },
  { id: "waiting", label: "המתנה", color: "#CA8A04", re: /ממתי[נן]|המתנה/ },
  { id: "open", label: "פתיחה", color: "#1F4E8C", re: /נפתח|דיווח נשלח|נשלח לאישור/ },
  { id: "classify", label: "סיווג", color: "#3E6DB0", re: /סיווג/ },
  { id: "driver", label: "נהגים", color: "#0D9488", re: /(?!)/ },
  { id: "cleaning", label: "ניקיון", color: "#3E6DB0", re: /סבב ניקיון/ },
];
const logKind = (text) => { const s = text || ""; for (const k of LOG_KINDS) if (k.re.test(s)) return k.id; return "other"; };
const logKindOf = (l) => (l && l.kind) || logKind(l && l.text); // явный kind, иначе вывод по тексту
const logKindMeta = (id) => LOG_KINDS.find((k) => k.id === id) || { id: "other", label: "אחר", color: "#64748B" };
const machineDocs = (f, cfg) => DOC_DEFS.filter((d) => {
  const typeName = unitTypeName(f, cfg);
  const modelName = unitModelCode(f);
  return d.id === "tasrir" ? resolveHydraulics(f, cfg) : (typeManagesDoc(typeName, d.id, cfg) || (modelName !== typeName && typeManagesDoc(modelName, d.id, cfg)));
});
// --- Водители на транспорте (по 3 категории-смены) ---
const DRIVER_SHIFTS = [
  { id: "morning", label: "בוקר", color: "#F59E0B" },
  { id: "night", label: "לילה", color: "#1F4E8C" },
];
const workShiftsOf = (cfg) => (cfg && cfg.workShifts && cfg.workShifts.length) ? cfg.workShifts : DRIVER_SHIFTS;
const driverShiftMeta = (id) => DRIVER_SHIFTS.find((s) => s.id === id) || { id, label: id === "overlap" ? "חפיפה" : (id || "—"), color: "#0D9488" };
const unitDrivers = (f) => (f && f.drivers) || {};
const driverOf = (f, cat) => unitDrivers(f)[cat] || null;
const driverActive = (d) => !!(d && (!d.status || d.status === "active"));
const driverPending = (d) => !!(d && (d.status === "pending_add" || d.status === "pending_move"));
const driverOwned = (d, session) => !!(d && session && (session.role === "admin" || d.addedByUid === session.id));
const canFleetDocs = (session) => canView(session, "fleetDocs");
const canFleetTickets = (session) => canView(session, "fleetTickets");
const canManageWorkerAccess = (session) => canManage(session, "workerAccess");
const canViewUsers = (session) => canView(session, "users");
const canManageUsers = (session) => canManage(session, "users");
const canRequestPpe = (session) => canRequest(session, "ppe");
const canManagePpe = (session) => canManage(session, "ppe");
const canViewSuppliers = (session) => canView(session, "suppliers");
const canManageSuppliers = (session) => canManage(session, "suppliers");
const canManageSettings = (session) => canManage(session, "settings");
const canFullSettings = (session) => canFull(session, "settings");
const canViewAudit = (session) => canView(session, "audit");
const fleetForSession = (session, fleet) => { if (!session || session.role === "admin") return fleet || []; const md = userDepts(session); if (!md.length) return fleet || []; return (fleet || []).filter((f) => fleetDepts(f).some((d) => md.includes(d))); };
const pushDriverEvent = (cfg, evt) => ({ ...cfg, driverEvents: [{ id: uid(), at: Date.now(), ...evt }, ...((cfg.driverEvents || []).slice(0, 299))] });
const pendingDriverReqs = (fleet) => { const out = []; (fleet || []).forEach((f) => DRIVER_SHIFTS.forEach((s) => { const d = driverOf(f, s.id); if (driverPending(d)) out.push({ unit: f, cat: s.id, driver: d }); })); return out.sort((a, b) => (b.driver.reqAt || 0) - (a.driver.reqAt || 0)); };
// личность работника = рабочий номер (имена могут совпадать — тёзки)
const sameWorker = (a, b) => !!(a && b && a.workNo && b.workNo && String(a.workNo).trim() === String(b.workNo).trim());
const driverAssignments = (fleet) => { const out = []; (fleet || []).forEach((f) => DRIVER_SHIFTS.forEach((s) => { const d = driverOf(f, s.id); if (driverActive(d) || driverPending(d)) out.push({ unit: f, shift: s.id, driver: d }); })); return out; };
const driverDupes = (fleet, d, exclUnitId, exclShift) => driverAssignments(fleet).filter((x) => !(x.unit.id === exclUnitId && x.shift === exclShift) && sameWorker(x.driver, d));
const dupWorkers = (scoped) => { const map = {}; driverAssignments(scoped).forEach((a) => { const k = (a.driver.workNo || "").trim(); if (!k) return; (map[k] = map[k] || []).push(a); }); return Object.values(map).filter((g) => g.length > 1); };
// кросс-смена: cross-водитель занимает машину в чужую смену → сменщик вытеснен; ищем свободную машину
const crossConflicts = (scoped) => scoped.filter((f) => { const m = driverOf(f, "morning"), n = driverOf(f, "night"); return (driverActive(m) && m.cross && driverActive(n)) || (driverActive(n) && n.cross && driverActive(m)); });
const crossSuggestions = (scoped) => {
  const out = [];
  const freeNight = scoped.filter((f) => !driverActive(driverOf(f, "night")) && !driverPending(driverOf(f, "night")) && !(driverActive(driverOf(f, "morning")) && driverOf(f, "morning").cross));
  const freeMorning = scoped.filter((f) => !driverActive(driverOf(f, "morning")) && !driverPending(driverOf(f, "morning")) && !(driverActive(driverOf(f, "night")) && driverOf(f, "night").cross));
  scoped.forEach((f) => {
    const m = driverOf(f, "morning"), n = driverOf(f, "night");
    if (driverActive(m) && m.cross && driverActive(n)) { const tgt = freeNight.find((u) => u.id !== f.id); if (tgt) out.push({ driver: n, shift: "night", fromCode: f.code, toCode: tgt.code, reason: `${m.name} (בוקר) חוצה לערב ותופס את ${f.code}` }); }
    if (driverActive(n) && n.cross && driverActive(m)) { const tgt = freeMorning.find((u) => u.id !== f.id); if (tgt) out.push({ driver: m, shift: "morning", fromCode: f.code, toCode: tgt.code, reason: `${n.name} (לילה) חוצה לבוקר ותופס את ${f.code}` }); }
  });
  return out;
};
const problemUnits = (fleet, tickets, config) => (fleet || []).map((f) => { const h = assetHealth(f, tickets, config); const rel = (tickets || []).filter((t) => t.forkliftId === f.id && Date.now() - t.createdAt <= 90 * 86400000); const byCat = {}; rel.forEach((t) => { const c = t.categoryLabel || "אחר"; byCat[c] = (byCat[c] || 0) + 1; }); const reasons = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 3); return { f, h, reasons }; }).filter((x) => x.h.count90 >= 3 || x.h.score < 60).sort((a, b) => b.h.count90 - a.h.count90 || a.h.score - b.h.score);
const driverEvtText = (ev) => { const cat = driverShiftMeta(ev.category).label; const who = (ev.driverName || "") + (ev.workNo ? ` (#${ev.workNo})` : ""); switch (ev.type) {
  case "add_req": return `בקשת הוספת נהג: ${who} · ${ev.unitCode} · ${cat}${ev.needsChip ? " · צריך צ׳יפ" : ""}`;
  case "add": return `נהג נוסף: ${who} · ${ev.unitCode} · ${cat}`;
  case "move_req": return `בקשת העברת נהג: ${who} · ${ev.unitCode} → ${ev.toUnitCode} (${driverShiftMeta(ev.toCategory).label})`;
  case "approved": return ev.sub === "move" ? `אושרה העברת ${who}: ${ev.unitCode} → ${ev.toUnitCode}` : `אושרה הוספת ${who} · ${ev.unitCode}`;
  case "rejected": return ev.sub === "move" ? `נדחתה העברת ${who} · ${ev.unitCode}` : `נדחתה הוספת ${who} · ${ev.unitCode}`;
  case "deleted": return `נהג הוסר: ${who} · ${ev.unitCode} · ${cat}`;
  case "edited": return `עודכנו פרטי נהג: ${who} · ${ev.unitCode} · ${cat}`;
  case "access": return `עודכנה גישת ${who} · ${ev.unitCode} → ${ev.sub || "0"} כלים`;
  default: return `${ev.type} · ${who}`;
} };

// ---- Демо-данные для тестирования (все помечены demo:true; чистятся отдельной кнопкой) ----
function buildDemoData(config) {
  const DAY = 86400000, now = Date.now();
  const iso = (o) => new Date(now + o * DAY).toISOString().slice(0, 10);
  const ts = (o) => now + o * DAY;
  const D = (o) => ({ date: iso(o), link: "" });
  const sup = (config.suppliers && config.suppliers[0]) || "", sup2 = (config.suppliers && config.suppliers[1]) || sup;
  const dep = (i) => (config.departments && config.departments.length ? config.departments[i % config.departments.length] : "כללי");
  const cats = config.categories || CATEGORIES;
  const catId = (i) => cats[i % cats.length].id, catLbl = (id) => (cats.find((c) => c.id === id)?.label || "");
  const zns = config.zones || [], zone = (i) => zns.length ? zns[i % zns.length] : "כללי";
  const fleet = [
    { id: "demo-f1", code: "מלגזה 12", type: "RRE200H", chassis: "CH-1012", license: "8821-72", docs: { insurance: D(-5), tasrir: D(160), license: D(9), lease: D(240) } },
    { id: "demo-f2", code: "מלגזה 7", type: "SPE160", chassis: "CH-0707", license: "", docs: { insurance: D(120), tasrir: D(-3), license: D(150), lease: D(220) } },
    { id: "demo-f3", code: "מלגזה 21", type: "LPE200", chassis: "CH-2121", license: "", docs: { insurance: D(180), lease: D(200) } },
    { id: "demo-f4", code: "מלגזה 3", type: "52-8FDF20", chassis: "CH-0003", license: "5540-31", docs: { insurance: D(300), tasrir: D(280), license: D(290), lease: D(310) } },
    { id: "demo-f5", code: "במה מתרוממת 1", type: "GS4047", chassis: "CH-B001", license: "", docs: { tasrir: D(140) } },
    { id: "demo-f6", code: "מלגזה 18", type: "OSE250", chassis: "CH-1818", license: "", docs: { insurance: D(150), lease: D(95) } },
    { id: "demo-f7", code: "מלגזה 30", type: "MX-X", chassis: "CH-3030", license: "7790-55", docs: { insurance: D(170), tasrir: D(190), license: D(125), lease: D(240) } },
  ].map((f, i) => ({ supplier: i % 2 ? sup2 : sup, depts: [dep(i)], dept: dep(i), notes: "", model: f.type, ...f, demo: true, createdAt: now }));
  const by = (name, role, d) => ({ name, role, dept: d });
  const mk = (o) => ({ hasPhoto: false, closure: null, wearType: null, downtimeEnd: null, assignee: "", zone: "", asset: "", forkliftId: null, downtimeType: null, downtimeStart: null, categoryLabel: "", updatedAt: o.createdAt, ...o, demo: true });
  const tickets = [
    mk({ id: "demo-t1", num: 901, track: "transport", subject: "דליפת שמן הידראולי", category: "transport", priority: "high", asset: "מלגזה 12", forkliftId: "demo-f1", downtimeType: "critical", downtimeStart: ts(-0.1), description: "שלולית שמן מתחת לתורן, הכלי מושבת.", status: "new", routedTech: true, createdBy: by("ודים", "admin", "הנהלה"), createdAt: ts(-0.1), dueAt: ts(0.05), log: [{ at: ts(-0.1), by: "ודים", byRole: "admin", text: "הקריאה נפתחה והועברה לטכנאים" }] }),
    mk({ id: "demo-t2", num: 902, track: "transport", subject: "רעש חריג בהיגוי", category: "transport", priority: "medium", asset: "מלגזה 7", forkliftId: "demo-f2", downtimeType: "minor", downtimeStart: ts(-2), description: "רעש מתכתי בעת פנייה.", status: "in_progress", routedTech: true, createdBy: by("מנהל מחלקה", "user", "מחסן"), createdAt: ts(-2), dueAt: ts(-0.5), log: [{ at: ts(-2), by: "מנהל מחלקה", byRole: "user", text: "הקריאה נפתחה" }] }),
    mk({ id: "demo-t3", num: 903, track: "facility", subject: "נורת לד שרופה במסדרון", category: catId(0), categoryLabel: catLbl(catId(0)), priority: "low", zone: zone(6), description: "להחליף נורה.", status: "waiting", waitingReason: "parts", createdBy: by("מנהל מחלקה", "user", "מחסן"), createdAt: ts(-3), dueAt: ts(2), log: [{ at: ts(-3), by: "מנהל מחלקה", byRole: "user", text: "הקריאה נפתחה" }, { at: ts(-2), by: "טכנאי", byRole: "tech", text: "ממתין · ממתין לחלקים" }] }),
    mk({ id: "demo-t4", num: 904, track: "transport", subject: "בלמים חלשים", category: "transport", priority: "high", asset: "מלגזה 18", forkliftId: "demo-f6", downtimeType: "has_replacement", downtimeStart: ts(-1), description: "מרחק בלימה ארוך מהרגיל.", status: "pending_admin", routedTech: true, createdBy: by("טכנאי", "tech", ""), createdAt: ts(-1), dueAt: ts(0.3), log: [{ at: ts(-1), by: "ודים", byRole: "admin", text: "נפתחה" }, { at: ts(-0.2), by: "טכנאי", byRole: "tech", text: "טופל — ממתין לאישור" }] }),
    mk({ id: "demo-t5", num: 905, track: "facility", subject: "דלת חשמלית לא נסגרת", category: catId(3), categoryLabel: catLbl(catId(3)), priority: "medium", zone: zone(1), description: "הדלת נתקעת באמצע.", status: "pending_user", createdBy: by("מנהל מחלקה", "user", "שילוח"), createdAt: ts(-4), dueAt: ts(-1), log: [{ at: ts(-4), by: "מנהל מחלקה", byRole: "user", text: "נפתחה" }] }),
    mk({ id: "demo-t6", num: 906, track: "facility", subject: "ברז דולף במטבחון", category: catId(1), categoryLabel: catLbl(catId(1)), priority: "low", zone: zone(6), description: "טפטוף מתמשך.", status: "done", createdBy: by("מנהל מחלקה", "user", "שילוח"), createdAt: ts(-8), dueAt: ts(-5), closure: { costAmount: 120, costSupplier: sup, costNote: "הוחלף אטם.", signedBy: "ודים", signedAt: ts(-6), recordedAt: ts(-6) }, log: [{ at: ts(-8), by: "מנהל מחלקה", byRole: "user", text: "הקריאה נפתחה" }, { at: ts(-6.5), by: "טכנאי", byRole: "tech", text: "הטיפול הסתיים — הועבר לאישור הפותח" }, { at: ts(-6.2), by: "מנהל מחלקה", byRole: "user", text: "הפותח אישר שהתקלה טופלה" }, { at: ts(-6), by: "ודים", byRole: "admin", text: "נסגרה ואושרה ע״י ודים · עלות ₪120" }] }),
    mk({ id: "demo-t7", num: 907, track: "transport", subject: "תקלה שדווחה בטעות", category: "transport", priority: "low", asset: "מלגזה 30", forkliftId: "demo-f7", downtimeType: "minor", downtimeStart: ts(-5), description: "בוטל ע״י המדווח.", status: "cancelled", createdBy: by("מנהל מחלקה", "user", "שילוח"), createdAt: ts(-5), dueAt: ts(-4), log: [{ at: ts(-5), by: "מנהל מחלקה", byRole: "user", text: "נפתחה" }] }),
    mk({ id: "demo-t8", num: 908, track: "transport", subject: "נזק לתורן עקב העמסה שגויה", category: "transport", priority: "medium", asset: "מלגזה 3", forkliftId: "demo-f4", downtimeType: "minor", downtimeStart: ts(-6), downtimeEnd: ts(-2), wearType: "disproportionate", statusMs: { "open": 86400000, "waiting:parts": 216000000, "pending_admin": 43200000 }, damageClass: "רשלנות", driverInvolved: "באבكر", description: "עיוות קל במסילת התורן בעקבות העמסה לא תקינה.", status: "done", routedTech: true, assignee: "טכנאי", createdBy: by("מנהל מחלקה", "user", "תפעול"), createdAt: ts(-6), dueAt: ts(-5), closure: { costAmount: 50, costSupplier: sup, costNote: "יישור והחלפת גלגלת.", signedBy: "ודים", signedAt: ts(-2), recordedAt: ts(-2) }, log: [
      { at: ts(-6), by: "מנהל מחלקה", byRole: "user", text: "הקריאה נפתחה והועברה לטכנאים" },
      { at: ts(-5.8), by: "טכנאי", byRole: "tech", text: "התקבלה לטיפול" },
      { at: ts(-5.5), by: "טכנאי", byRole: "tech", text: "סיווג: נזק בלתי פרופורציונלי" },
      { at: ts(-4), by: "טכנאי", byRole: "tech", text: "הטיפול הסתיים — הועבר לאישור הפותח" },
      { at: ts(-3), by: "מנהל מחלקה", byRole: "user", text: "הפותח אישר שהתקלה טופלה" },
      { at: ts(-2), by: "ודים", byRole: "admin", text: "נסגרה ואושרה ע״י ודים · עלות ₪50" },
    ] }),
    mk({ id: "demo-t9", num: 909, track: "transport", subject: "החלפת גלגל קדמי", category: "transport", priority: "medium", asset: "מלגזה 7", forkliftId: "demo-f2", downtimeType: "minor", downtimeStart: ts(-0.4), description: "נדרש גלגל חלופי.", status: "waiting", waitingReason: "no_equipment", waitBall: "manager", assignee: "טכנאי", equipWaitSince: ts(-0.2), routedTech: true, createdBy: by("מנהל מחלקה", "user", "מחסן"), createdAt: ts(-0.4), dueAt: ts(1), log: [{ at: ts(-0.4), by: "מנהל מחלקה", byRole: "user", text: "נפתחה" }, { at: ts(-0.2), by: "טכנאי", byRole: "tech", text: "הטכנאי דיווח: הכלי לא התקבל — ממתין לקבלת הכלי מהמנהל" }] }),
    mk({ id: "demo-t10", num: 910, track: "facility", subject: "החלפת מזגן במשרד", category: catId(2), categoryLabel: catLbl(catId(2)), priority: "medium", zone: zone(2), description: "המזגן אינו מקרר — נדרש אישור תקציב.", status: "waiting", waitingReason: "budget_approval", waitBall: "admin", assignee: "טכנאי", pauseSince: ts(-1), pauseAccumMs: 0, createdBy: by("מנהל מחלקה", "user", "שילוח"), createdAt: ts(-3), dueAt: ts(-0.5), log: [{ at: ts(-3), by: "מנהל מחלקה", byRole: "user", text: "נפתחה" }, { at: ts(-1), by: "טכנאי", byRole: "tech", text: "ממתין · ממתינה לאישור תקציב" }] }),
    mk({ id: "demo-t11", num: 911, track: "facility", subject: "ידית דלת התרופפה שוב", category: catId(0), categoryLabel: catLbl(catId(0)), priority: "low", zone: zone(3), description: "תיקון קודם לא החזיק.", status: "rework", assignee: "טכנאי", createdBy: by("מנהל מחלקה", "user", "שילוח"), createdAt: ts(-2), dueAt: ts(1), log: [{ at: ts(-2), by: "מנהל מחלקה", byRole: "user", text: "נפתחה" }, { at: ts(-0.5), by: "מנהל מחלקה", byRole: "user", text: "הוחזר לתיקון חוזר" }] }),
    mk({ id: "demo-t12", num: 912, track: "transport", subject: "בעיה חוזרת בבלמים", category: "transport", priority: "high", asset: "מלגזה 7", forkliftId: "demo-f2", downtimeType: "has_replacement", downtimeStart: ts(-1), description: "הבלמים שוב חלשים אחרי טיפול קודם.", status: "in_progress", returned: true, assignee: "טכנאי", routedTech: true, createdBy: by("ודים", "admin", "הנהלה"), createdAt: ts(-1), dueAt: ts(0.5), log: [{ at: ts(-1), by: "ודים", byRole: "admin", text: "נפתחה" }, { at: ts(-0.4), by: "מנהל מחלקה", byRole: "user", text: "הוחזר לטכנאי — לא טופל כראוי" }] }),
    mk({ id: "demo-t14", num: 914, track: "transport", subject: "החלפת צמיג קדמי", category: "transport", priority: "medium", asset: "מלגזה 7", forkliftId: "demo-f2", downtimeType: "minor", downtimeStart: ts(-20), downtimeEnd: ts(-19), statusMs: { "open": 43200000, "waiting:parts": 43200000 }, damageClass: "נזק טבעי", driverInvolved: "פאדי", description: "צמיג שחוק.", status: "done", routedTech: true, assignee: "טכנאי", createdBy: by("מנהל מחלקה", "user", "מחסן"), createdAt: ts(-20), dueAt: ts(-19), closure: { costAmount: 380, costSupplier: sup, costNote: "הוחלף צמיג קדמי.", signedBy: "ודים", signedAt: ts(-19), recordedAt: ts(-19) }, log: [{ at: ts(-20), by: "מנהל מחלקה", byRole: "user", text: "נפתחה" }, { at: ts(-19), by: "ודים", byRole: "admin", text: "נסגרה · עלות ₪380" }] }),
    mk({ id: "demo-t15", num: 915, track: "transport", subject: "תקלה חשמלית — נבדק והוחזר לשירות", category: "transport", priority: "high", asset: "מלגזה 3", forkliftId: "demo-f4", downtimeType: "critical", downtimeStart: ts(-0.6), backInServiceAt: ts(-0.15), description: "תקלה חשמלית; הכלי הושבת ואז הוחזר לשירות ידנית — הטיפול נמשך.", status: "in_progress", assignee: "טכנאי", routedTech: true, createdBy: by("טכנאי", "tech", ""), createdAt: ts(-0.6), dueAt: ts(0.4), log: [{ at: ts(-0.6), by: "טכנאי", byRole: "tech", text: "נפתחה · הכלי הושבת" }, { at: ts(-0.15), by: "ודים", byRole: "admin", text: "הכלי הוחזר לשירות (ידנית) — הטיפול בקריאה נמשך", kind: "other" }] }),
    mk({ id: "demo-t16", num: 916, track: "transport", subject: "תקלה בהגה כוח", category: "transport", priority: "high", asset: "מלגזה 21", forkliftId: "demo-f3", downtimeType: "minor", downtimeStart: ts(-0.3), description: "הגה כבד מהרגיל. הקריאה שובצה לטכנאי שעזב — איש אינו רואה אותה.", status: "in_progress", assignee: "מקסים (עזב)", routedTech: true, createdBy: by("מנהל מחלקה", "user", "מחסן"), createdAt: ts(-0.3), dueAt: ts(0.6), log: [{ at: ts(-0.3), by: "מנהל מחלקה", byRole: "user", text: "נפתחה ושובצה לטכנאי" }] }),
  ];
  // ТО для годовой матрицы: история по месяцам текущего года + план вперёд. atM — абсолютный месяц года; ts — смещение от сегодня для будущих/просроченных.
  const Y = new Date(now).getFullYear(), curM = new Date(now).getMonth();
  const atM = (m, day) => new Date(Y, m, day == null ? 12 : day).getTime();
  const hDone = (m, day, paid) => ({ type: "done", at: atM(m, day), by: "טכנאי חוץ", hadPaid: !!paid, paidNote: paid ? "עבודות המשך בתשלום" : "" });
  const hMiss = (m, day) => ({ type: "missed", at: atM(m, day), by: "מערכת", paidNote: "" });
  const past = (arr) => arr.filter((h) => new Date(h.at).getMonth() < curM); // не оставлять «историю» в будущем
  const pm = [
    { id: "demo-p1", forkliftId: "demo-f1", frequency: "monthly", title: "טיפול חודשי", active: true, demo: true, nextDue: ts(7), history: past([hDone(0), hDone(1), hDone(2), hMiss(3), hDone(4)]) },
    { id: "demo-p2", forkliftId: "demo-f2", frequency: "monthly", title: "טיפול חודשי", active: true, demo: true, nextDue: ts(-6), history: past([hDone(0), hDone(1), hMiss(2), hDone(3), hDone(4)]) },
    { id: "demo-p3", forkliftId: "demo-f3", frequency: "quarterly", title: "טיפול רבעוני", active: true, demo: true, nextDue: ts(30), history: past([hDone(0, 15), hMiss(3, 15)]) },
    { id: "demo-p4", forkliftId: "demo-f4", frequency: "quarterly", title: "טיפול רבעוני", active: true, demo: true, nextDue: ts(70), history: past([hDone(1, 20), hDone(4, 20)]) },
    { id: "demo-p5", forkliftId: "demo-f5", frequency: "monthly", title: "טיפול חודשי", active: true, demo: true, nextDue: ts(14), history: past([hDone(0), hMiss(1), hMiss(2), hDone(3, 12, true), hDone(4)]) },
    { id: "demo-p6", forkliftId: "demo-f6", frequency: "monthly", title: "טיפול חודשי", active: true, demo: true, nextDue: ts(11), history: past([hDone(0), hDone(1), hDone(2), hDone(3), hDone(4)]) },
    { id: "demo-p7", forkliftId: "demo-f7", frequency: "yearly", title: "טיפול שנתי", active: true, demo: true, nextDue: ts(95), history: [] },
  ];
  // Расширенный парк транспорта — детерминированная генерация, чтобы список «כלי שינוע» и матрица были полными.
  const TYPES = ["RRE200H", "SPE160", "LPE200", "OSE250", "RX60-25", "ESR1000", "52-8FDF20"];
  let seed = 20260611;
  const rnd = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
  const ri = (n) => Math.floor(rnd() * n);
  const genFleet = [], genPm = [];
  for (let i = 0; i < 30; i++) {
    const id = "demo-f" + (8 + i), num = 40 + i, type = TYPES[i % TYPES.length];
    genFleet.push({ id, code: "מלגזה " + num, type, model: type, chassis: "CH-" + (1000 + num), license: rnd() > 0.45 ? (1000 + ri(8000)) + "-" + (10 + ri(80)) : "", supplier: i % 2 ? sup2 : sup, depts: [dep(i)], dept: dep(i), notes: "", docs: { insurance: D(60 + ri(280)), tasrir: D(60 + ri(280)), license: D(60 + ri(280)), lease: D(60 + ri(300)) }, demo: true, createdAt: now });
    const freq = i % 6 === 5 ? "yearly" : i % 3 === 2 ? "quarterly" : "monthly";
    const hist = [];
    if (freq === "monthly") { for (let m = 0; m < curM; m++) { const r = rnd(); if (r < 0.12) hist.push(hMiss(m, 8 + ri(14))); else if (r < 0.93) hist.push(hDone(m, 8 + ri(14), rnd() < 0.15)); } }
    else if (freq === "quarterly") { [0, 3].forEach((m) => { if (m < curM) hist.push(rnd() < 0.18 ? hMiss(m, 15) : hDone(m, 15)); }); }
    const nd = rnd() < 0.12 ? ts(-(2 + ri(8))) : ts(3 + ri(60));
    genPm.push({ id: "demo-p" + (8 + i), forkliftId: id, frequency: freq, title: freq === "yearly" ? "טיפול שנתי" : freq === "quarterly" ? "טיפול רבעוני" : "טיפול חודשי", active: true, demo: true, nextDue: nd, history: hist });
  }
  // --- Демо: типы (модель→имя типа), водители по сменам, заявки на одобрение, события журнала ---
  const DEMO_TYPE_OF = { RRE200H: "מלגזת היגש", RRE250E: "מלגזת היגש", RRE140B: "מלגזת היגש", ESR1000: "מלגזת היגש", SPE160: "עגלת אדם רוכב עם תורן", LPE200: "עגלת אדם רוכב עם תורן", SWE160: "עגלת אדם רוכב עם תורן", OSE250: "מלגזת ליקוט גבוה", "RX60-25": "מלגזה משקל נגדי", "52-8FDF20": "מלגזה משקל נגדי", "8FBE15T": "מלגזה משקל נגדי", "MX-X": "במת צריח", GS4047: "במה מתרוממת" };
  const tmap = {}; Object.entries(DEMO_TYPE_OF).forEach(([model, tn]) => { (tmap[tn] = tmap[tn] || { id: "dt" + Object.keys(tmap).length, name: tn, models: [], supplier: "" }).models.push(model); });
  const demoVehicleTypes = Object.values(tmap);
  const allFleet = fleet.concat(genFleet);
  const byId = {}; allFleet.forEach((f) => (byId[f.id] = f));
  const drv = (name, workNo, ex = {}) => ({ name, workNo, cross: false, access: [], addedByUid: "builtin_mgr", addedByName: "מנהל מחלקה", addedByDept: "שילוח", at: ts(-12), status: "active", ...ex });
  if (byId["demo-f1"]) byId["demo-f1"].drivers = { morning: drv("דני כהן", "2201"), night: drv("עומר לוי", "2202", { cross: true }) };
  if (byId["demo-f2"]) byId["demo-f2"].drivers = { morning: drv("יוסי אברהם", "2203", { access: [{ unitId: "demo-f3", unitCode: "מלגזה 21", dept: byId["demo-f3"] ? (byId["demo-f3"].depts || [])[0] || "" : "" }] }) };
  if (byId["demo-f6"]) byId["demo-f6"].drivers = { morning: drv("רון מזרחי", "2204", { status: "pending_add", needsChip: true, reqAt: ts(-0.2) }) };
  if (byId["demo-f7"]) byId["demo-f7"].drivers = { night: drv("שגיא דהן", "2206", { status: "pending_move", moveTo: { unitId: "demo-f4", unitCode: "מלגזה 3", category: "night" }, reqAt: ts(-0.3) }) };
  if (byId["demo-f4"]) byId["demo-f4"].drivers = { morning: drv("ניר פלד", "2207") };
  const driverEvents = [
    { id: "de1", at: ts(-0.2), type: "add_req", unitCode: "מלגזה 18", category: "morning", driverName: "רון מזרחי", workNo: "2204", needsChip: true, byUid: "builtin_mgr", byName: "מנהל מחלקה", byDept: "שילוח" },
    { id: "de2", at: ts(-1), type: "approved", sub: "add", unitCode: "מלגזה 12", category: "morning", driverName: "דני כהן", byName: "ודים", reqByUid: "builtin_mgr", reqByName: "מנהל מחלקה" },
    { id: "de3", at: ts(-2), type: "add", status: "active", unitCode: "מלגזה 7", category: "morning", driverName: "יוסי אברהם", byName: "מנהל מחלקה", byDept: "מחסן" },
    { id: "de4", at: ts(-0.3), type: "move_req", unitCode: "מלגזה 30", toUnitCode: "מלגזה 3", category: "night", driverName: "שגיא דהן", byUid: "builtin_mgr", byName: "מנהל מחלקה", byDept: "שילוח" },
    { id: "de5", at: ts(-3), type: "rejected", sub: "move", unitCode: "מלגזה 21", toUnitCode: "מלגזה 7", driverName: "אורי", byName: "ודים", reqByUid: "builtin_mgr", reqByName: "מנהל מחלקה" },
    { id: "de6", at: ts(-0.5), type: "access", unitCode: "מלגזה 7", category: "morning", driverName: "יוסי אברהם", workNo: "2203", byName: "מנהל מחלקה", sub: "1" },
  ];
  // --- Демо: уборка (зоны/обходы/жалобы) + смены (присутствие) + плановые отсутствия ---
  const todayAt = (h, m = 0) => { const d = new Date(now); d.setHours(h, m, 0, 0); return d.getTime(); };
  const _MD = config.departments || [];
  const _fn = ["דוד", "יוסי", "משה", "אבי", "עמית", "רן", "ניר", "גיל", "עידו", "תום", "ליאור", "שי", "נדב", "אורי", "יואב", "אסף", "רועי", "דניאל", "איתי", "עומר"];
  const demoMgrs = _MD.map((d, i) => ({ id: `demo-u-mgr-${i}`, name: `מנהל ${d}`, role: "user", email: `mgr${i}@example.local`, password: "1234", pin: "", dept: d, depts: [d], mgrZones: [], shift: "morning", demo: true }));
  if (_MD[0]) demoMgrs.push({ id: "demo-u-mgr-x", name: `מנהל ${_MD[0]} (משנה)`, role: "user", email: "mgrx@example.local", password: "1234", pin: "", dept: _MD[0], depts: [_MD[0]], mgrZones: [], shift: "night", demo: true });
  const demoWorkers = _MD.flatMap((d, i) => [
    { id: `demo-u-w-${i}-a`, name: `${_fn[(i * 2) % _fn.length]} (${d})`, role: "worker", workerNo: String(3000 + i * 2), pin: "1234", email: "", password: "", dept: d, shift: "morning", employmentType: i % 3 === 0 ? "contractor" : "direct", contractorName: i % 3 === 0 ? "כ״א חיצוני בע״מ" : "", demo: true },
    { id: `demo-u-w-${i}-b`, name: `${_fn[(i * 2 + 1) % _fn.length]} (${d})`, role: "worker", workerNo: String(3001 + i * 2), pin: "1234", email: "", password: "", dept: d, shift: "night", employmentType: "direct", contractorName: "", demo: true },
  ]);
  const dusers = [
    { id: "demo-u-mgr1", name: "אורן (מנהל ניקיון)", role: "user", email: "oren@example.local", password: "1234", pin: "", dept: "ניקיון", depts: ["ניקיון"], mgrZones: ["demo-z1", "demo-z2", "demo-z3"], demo: true },
    { id: "demo-u-cl1", name: "רונן", role: "worker", workerNo: "2001", pin: "1234", email: "", password: "", dept: "ניקיון", depts: ["ניקיון"], demo: true },
    { id: "demo-u-cl2", name: "מאיה", role: "worker", workerNo: "2002", pin: "1234", email: "", password: "", dept: "ניקיון", depts: ["ניקיון"], demo: true },
    { id: "demo-u-cl3", name: "דמיטרי", role: "worker", workerNo: "2003", pin: "1234", email: "", password: "", dept: "ניקיון", depts: ["ניקיון"], demo: true },
    { id: "demo-u-tech1", name: "איגור", role: "tech", pin: "1234", email: "", password: "", supplier: "מוסך מרכזי", shiftStart: "07:30", shiftEnd: "16:30", techScope: "both", dept: "", demo: true },
    { id: "demo-u-tech2", name: "סרגיי", role: "tech", pin: "1234", email: "", password: "", supplier: "מוסך מרכזי", shiftStart: "08:00", shiftEnd: "16:30", techScope: "transport", dept: "", demo: true },
    { id: "demo-u-tech3", name: "ולנטין", role: "tech", pin: "1234", email: "", password: "", supplier: "", shiftStart: "07:30", shiftEnd: "16:30", techScope: "facility", dept: "", demo: true },
    ...demoMgrs, ...demoWorkers,
  ];
  const z1ck = [{ id: "z1c1", label: "ניקוי משטחים" }, { id: "z1c2", label: "החלפת מגבות נייר" }, { id: "z1c3", label: "ריקון פח" }, { id: "z1c4", label: "שטיפת רצפה" }];
  const z2ck = [{ id: "z2c1", label: "ניקוי אסלות" }, { id: "z2c2", label: "מילוי סבון" }, { id: "z2c3", label: "ניגוב מראות" }, { id: "z2c4", label: "ריקון פחים" }];
  const z3ck = [{ id: "z3c1", label: "טאטוא מעברים" }, { id: "z3c2", label: "ניקוי משטחי עבודה" }];
  const dzones = [
    { id: "demo-z1", code: "Z-KIT2", name: "מטבחון קומה 2", building: "בניין A", floor: "קומה 2", checklist: z1ck, windows: [{ id: "z1w1", time: "08:00", tol: 15, items: null }, { id: "z1w2", time: "13:00", tol: 15, items: null }], activeDays: WORK_WEEK.slice(), cleanerId: "demo-u-cl1", cleanerName: "רונן", active: true, demo: true, createdAt: now },
    { id: "demo-z2", code: "Z-WC1", name: "שירותים ראשי", building: "בניין A", floor: "קומה 1", checklist: z2ck, windows: [{ id: "z2w1", time: "07:30", tol: 20, items: null }, { id: "z2w2", time: "11:30", tol: 20, items: null }, { id: "z2w3", time: "15:30", tol: 20, items: null }], activeDays: [0, 1, 2, 3, 4, 5, 6], cleanerId: "demo-u-cl2", cleanerName: "מאיה", active: true, demo: true, createdAt: now },
    { id: "demo-z3", code: "Z-WH-N", name: "מחסן צפון", building: "בניין B", floor: "", checklist: z3ck, windows: [{ id: "z3w1", time: "09:00", tol: 30, items: null }], activeDays: WORK_WEEK.slice(), cleanerId: "demo-u-cl3", cleanerName: "דמיטרי", active: true, demo: true, createdAt: now },
  ];
  const drounds = [
    { id: "demo-r1", zoneId: "demo-z1", zoneName: "מטבחון קומה 2", zoneLoc: "בניין A · קומה 2", winId: "z1w1", winTime: "08:00", at: todayAt(8, 5), byUid: "demo-u-cl1", byName: "רונן", byRole: "cleaner", isCover: false, coverFor: "", items: { z1c1: true, z1c2: true, z1c3: true, z1c4: true }, doneCount: 4, total: 4, issues: [], demo: true },
    { id: "demo-r2", zoneId: "demo-z2", zoneName: "שירותים ראשי", zoneLoc: "בניין A · קומה 1", winId: "z2w1", winTime: "07:30", at: todayAt(7, 40), byUid: "demo-u-cl2", byName: "מאיה", byRole: "cleaner", isCover: false, coverFor: "", items: { z2c1: true, z2c2: true, z2c3: true, z2c4: true }, doneCount: 4, total: 4, issues: [{ itemId: "z2c2", label: "מילוי סבון", reason: "מתקן הסבון שבור — דולף", photo: null, kind: "broken" }, { itemId: "z2c4", label: "ריקון פחים", reason: "חסרים שקיות אשפה", photo: null, kind: "dirty" }], demo: true },
  ];
  const dcomplaints = [
    { id: "demo-c1", at: todayAt(9, 10), zoneId: "demo-z1", zoneName: "מטבחון קומה 2", zoneLoc: "בניין A · קומה 2", kind: "dirty", text: "כתם קפה גדול על השיש לא נוקה", photo: null, status: "open", ownerRole: "cleaner", verified: true, ticketId: null, reportedById: "demo-u-mgr1", reportedByName: "אורן", reportedByRole: "user", demo: true },
    { id: "demo-c2", at: todayAt(7, 40), zoneId: "demo-z2", zoneName: "שירותים ראשי", zoneLoc: "בניין A · קומה 1", kind: "broken", text: "מתקן הסבון שבור — דולף", photo: null, status: "pending", ownerRole: "admin", verified: false, ticketId: null, fromRoundId: "demo-r2", reportedById: "demo-u-cl2", reportedByName: "מאיה", reportedByRole: "cleaner", demo: true },
    { id: "demo-c3", at: todayAt(7, 41), zoneId: "demo-z2", zoneName: "שירותים ראשי", zoneLoc: "בניין A · קומה 1", kind: "round", text: "חסרים שקיות אשפה", photo: null, status: "open", ownerRole: "admin", verified: false, ticketId: null, fromRoundId: "demo-r2", reportedById: "demo-u-cl2", reportedByName: "מאיה", reportedByRole: "cleaner", demo: true },
    { id: "demo-c4", at: ts(-0.2), zoneId: "demo-z1", zoneName: "מטבחון קומה 2", zoneLoc: "בניין A · קומה 2", kind: "dirty", text: "דיווח אנונימי: רצפה רטובה ומסוכנת ליד הכניסה", photo: null, status: "pending", ownerRole: "cleaner", verified: false, ticketId: null, reportedById: "", reportedByName: "דיווח אנונימי", reportedByRole: "anonymous", demo: true },
    { id: "demo-c5", at: ts(-2), zoneId: "demo-z1", zoneName: "מטבחון קומה 2", zoneLoc: "בניין A · קומה 2", kind: "dirty", text: "פח עולה על גדותיו", photo: null, status: "resolved", ownerRole: "cleaner", verified: true, ticketId: null, resolvedAt: ts(-1.8), resolvedBy: "רונן", reportedById: "demo-u-mgr1", reportedByName: "אורן", reportedByRole: "user", demo: true },
  ];
  const dabs = [
    { id: "demo-a1", userId: "demo-u-cl3", name: "דמיטרי", from: iso(0), to: iso(1), at: ts(-1), demo: true },
    { id: "demo-a2", userId: "demo-u-cl2", name: "מאיה", from: iso(5), to: iso(7), at: ts(-0.5), demo: true },
  ];
  const dpresence = [
    { id: "demo-u-tech1", name: "איגור", onShift: true, since: todayAt(7, 22), endedAt: null, lastSeen: now, day: iso(0), demo: true },
    { id: "demo-u-tech2", name: "סרגיי", onShift: true, since: todayAt(8, 45), endedAt: null, lastSeen: now, day: iso(0), demo: true },
    { id: "demo-u-tech3", name: "ולנטין", onShift: false, since: todayAt(7, 25), endedAt: todayAt(13, 0), lastSeen: todayAt(13, 0), day: iso(0), demo: true },
  ];
  return { fleet: allFleet, tickets, pm: pm.concat(genPm), driverEvents, vehicleTypes: demoVehicleTypes, modelType: DEMO_TYPE_OF, users: dusers, zones: dzones, rounds: drounds, complaints: dcomplaints, absences: dabs, presence: dpresence };
}
const isOpen = (t) => t.status !== "done" && t.status !== "cancelled";
// כלי מושבת = קריאת שינוע פתוחה (לא ממתינה לאישור מנהל/הוחזרה לעובד) ברמת חומרה «מוציאה מכלל שימוש», שלא הוחזרה לשירות ידנית. נגזר מהקריאות — אין דגל נפרד שעלול להתנתק מהמציאות.
const ticketBlocks = (t, cfg) => t.track === "transport" && isOpen(t) && t.status !== "pending_manager" && t.status !== "rework" && !t.backInServiceAt && isDowntimeOutOfService(dtOf(t.downtimeType, cfg));
const unitBlock = (f, tickets, cfg) => { if (!f) return null; const bs = (tickets || []).filter((t) => t.forkliftId === f.id && ticketBlocks(t, cfg)).sort((a, b) => b.createdAt - a.createdAt); if (!bs.length) return null; return { ticket: bs[0], level: dtOf(bs[0].downtimeType, cfg), count: bs.length }; };
// השבתה ידנית = פתיחת קריאת שינוע ברמה חוסמת. החזרה לשירות = סימון backInServiceAt על כל הקריאות החוסמות (הטיפול בקריאה עצמה נמשך).
const buildBlockTicket = (f, cfg, by, reason) => { const now = Date.now(); const lvl = dtLevels(cfg).find((d) => d.oos) || DOWNTIME[2]; const rsn = (reason || "").trim(); return { id: uid(), track: "transport", subject: `השבתת כלי · ${f.code}`, category: "transport", priority: lvl.prio || "high", zone: "רחבת מלגזות", asset: f.code, forkliftId: f.id, downtimeType: lvl.id, wearType: null, description: rsn || "הכלי הושבת ידנית — אין להשתמש בו עד לתיקון.", status: "new", assignee: "", routedTech: true, supplier: f.supplier || "", downtimeStart: now, downtimeEnd: null, createdBy: { name: by.name, role: by.role }, createdAt: now, updatedAt: now, dueAt: now + slaForTicket({ track: "transport", forkliftId: f.id, priority: lvl.prio || "high" }, cfg, [f]) * 3600000, hasPhoto: false, closure: null, log: [{ at: now, by: by.name, byRole: by.role, text: `הכלי הושבת ידנית${f.supplier ? " · ספק: " + f.supplier : ""}${rsn ? " · סיבה: " + rsn : ""}`, kind: "open" }] }; };
const clearBlockPatches = (f, tickets, cfg, by) => { const now = Date.now(); return (tickets || []).filter((t) => t.forkliftId === f.id && ticketBlocks(t, cfg)).map((t) => ({ ...t, backInServiceAt: now, updatedAt: now, log: [...(t.log || []), { at: now, by: by.name, byRole: by.role, text: "הכלי הוחזר לשירות (ידנית) — הטיפול בקריאה נמשך", kind: "other" }] })); };
// Жёсткая модель: чей сейчас «мяч» (кто должен действовать). Единый источник правды для всех экранов.
const ballIn = (t) => {
  const track = t.track || (t.forkliftId ? "transport" : "facility");
  const exec = t.mgrExec ? "manager" : "tech"; // кто исполнитель: менеджер (по зданию) или техник
  switch (t.status) {
    case "new": case "in_progress": case "waiting":
      // Во время ожидания мяч определяется причиной (waitBall, записан при установке причины). Старые заявки: no_equipment→менеджер.
      if (t.status === "waiting") { const wb = t.waitBall || (t.waitingReason === "no_equipment" ? "manager" : "executor"); if (wb === "manager") return "manager"; if (wb === "admin") return "admin"; }
      // facility-заявка на админском маршруте остаётся у админа, даже если выбран поставщик.
      // НО возвращённая заявка (t.returned) уже была у исполнителя — её НЕ диспетчеризуем заново через админа.
      if (track === "facility" && !t.routedTech && !t.mgrExec && !t.returned) return "admin";
      return exec;
    case "pending_user": return "manager";
    case "pending_admin": return "admin";
    case "pending_manager": return "manager"; // דיווח עובד — ממתין לאישור מנהל המחלקה
    case "rework": return "none";              // הוחזר לעובד — מחוץ למשפך עד שליחה חוזרת
    default: return "none"; // done / cancelled
  }
};
// «у кого мяч» — кто сейчас держит заявку, для отображения на карточке
const ballHolder = (t, fleet = []) => {
  const who = ballIn(t);
  if (who === "admin") return { key: "admin", label: "מנהל המערכת", Icon: ShieldCheck, color: "#1F4E8C" };
  if (who === "manager") return { key: "manager", label: ticketHolderLabel(t, "manager"), Icon: User, color: "#0D9488" };
  if (who === "tech") return { key: "tech", label: ticketHolderLabel(t, "tech", { fleet }), Icon: Wrench, color: "#D97706" };
  return null; // none — סגורה/בוטלה/הוחזרה לעובד
};
// Есть ли активный техник, который МОЖЕТ принять заявку (по типу/поставщику/категории). Пусто → заявка «без принимающего».
const eligibleTechs = (t, users, fleet) => {
  const track = t.track || (t.forkliftId ? "transport" : "facility");
  return (users || []).filter((u) => {
    if (u.role !== "tech" || u.active === false) return false;
    const scope = u.techScope || "transport";
    if (t.supplier && u.supplier && t.supplier !== u.supplier) return false;
    if (t.supplier && !u.supplier) return false;
    if (track === "transport") { if (scope === "facility") return false; if (u.supplier && t.forkliftId && !t.supplier) { const f = (fleet || []).find((x) => x.id === t.forkliftId); if (f && f.supplier && f.supplier !== u.supplier) return false; } return true; }
    if (scope === "transport") return false;
    const cats = u.techCats || []; if (cats.length && t.category && !cats.includes(t.category)) return false; return true;
  });
};
// «Между стульев»: заявка открыта, мяч у бригады техников, но принять некому (нет техника, либо назначенный исчез/неактивен).
const needsHandler = (t, users, fleet) => {
  if (!isOpen(t) || ballIn(t) !== "tech") return false;
  const assignee = transportTechnicianAssignee(t, fleet);
  if (assignee) return !(users || []).some((u) => u.role === "tech" && u.active !== false && u.name === assignee);
  return eligibleTechs(t, users, fleet).length === 0;
};
// Причины ожидания — ДЕФОЛТНЫЙ список (сид). Админ редактирует в настройках (config.waitReasons).
// ball: у кого мяч во время ожидания (executor|manager|admin). pauseSla: останавливает ли часы SLA (учёт — Phase 2). setters: кто может ставить (tech|manager|both).
const WAIT_REASONS = [
  { id: "no_equipment", label: "לא התקבל הכלי", ball: "manager", pauseSla: true, setters: "tech" },
  { id: "parts", label: "ממתינה לחלקים", ball: "executor", pauseSla: true, setters: "both" },
  { id: "supplier", label: "ממתינה לספק", ball: "executor", pauseSla: true, setters: "both" },
  { id: "access", label: "ממתינה לגישה", ball: "executor", pauseSla: true, setters: "both" },
  { id: "manager_decision", label: "ממתינה להחלטת מנהל", ball: "manager", pauseSla: false, setters: "both" },
  { id: "requester_confirmation", label: "ממתינה לאישור הפותח", ball: "manager", pauseSla: false, setters: "manager" },
  { id: "scheduled_date", label: "מתוזמנת לתאריך", ball: "executor", pauseSla: true, setters: "manager" },
  { id: "safety_hold", label: "עצירת בטיחות", ball: "manager", pauseSla: true, setters: "manager" },
  { id: "budget_approval", label: "ממתינה לאישור תקציב", ball: "admin", pauseSla: true, setters: "manager" },
  { id: "external_contractor", label: "ממתינה לקבלן חוץ", ball: "executor", pauseSla: true, setters: "manager" },
  { id: "other", label: "אחר", ball: "executor", pauseSla: false, setters: "both" },
];
const wReasons = (cfg) => (cfg && Array.isArray(cfg.waitReasons) && cfg.waitReasons.length) ? cfg.waitReasons : WAIT_REASONS;
const wReasonOf = (cfg, id) => wReasons(cfg).find((r) => r.id === id) || WAIT_REASONS.find((r) => r.id === id) || null;
const waitReasonLabel = (id, cfg) => (wReasonOf(cfg, id)?.label || "ממתינה");
const ticketWaitReasonLabel = (t, cfg) => (t?.status === "waiting" && t.waitingReason) ? waitReasonLabel(t.waitingReason, cfg) : "";
const reasonBall = (cfg, id) => (wReasonOf(cfg, id)?.ball || "executor");
const waitReasonLifecycleMeta = (cfg, id) => {
  const reason = wReasonOf(cfg, id);
  return reason ? { ball: reason.ball || "executor", pauseSla: !!reason.pauseSla } : {};
};
const lifecycleSlaOptions = (cfg, now = Date.now()) => ({
  now,
  isOpen,
  waitReasonMeta: (id) => waitReasonLifecycleMeta(cfg, id)
});
const ticketMissedSla = (ticket, cfg, now = Date.now()) => ticketLifecycleMissedOperationalSla(ticket, lifecycleSlaOptions(cfg, now));
const ticketOperationalElapsed = (ticket, cfg, now = Date.now()) => ticketLifecycleOperationalElapsedMs(ticket, now, lifecycleSlaOptions(cfg, now));
const ticketOperationalRemaining = (ticket, cfg, now = Date.now()) => {
  const sla = ticket?.dueAt != null && ticket?.createdAt != null ? Math.max(0, ticket.dueAt - ticket.createdAt) : null;
  return sla == null ? null : sla - ticketOperationalElapsed(ticket, cfg, now);
};
const lifecycleOwnerLabel = (owner) => ({ executor: "טכנאי/מבצע", manager: "מנהל", admin: "מנהל מערכת", requester: "פותח", none: "ללא" }[owner] || owner || "—");
// Причины, которые роль может ВЫСТАВЛЯТЬ (один список, фильтр по setters). no_equipment ставится отдельной кнопкой техника.
const reasonsForRole = (cfg, role) => wReasons(cfg).filter((r) => r.id !== "no_equipment" && (r.setters === "both" || (role === "tech" ? r.setters === "tech" : r.setters === "manager"))).map((r) => (r.id === "manager_decision" && r.label === "ממתינה להחלטת מנהל") ? { ...r, label: "צריך עזרה / החלטה" } : r);
const reasonPauses = (cfg, id) => !!(wReasonOf(cfg, id)?.pauseSla);
// Бухгалтерия паузы SLA: при входе в «ожидание» с причиной, останавливающей SLA — копим время; при выходе — финализируем. now позволяет «бэкдейт» (точка разворота).
const pausePatch = (prev, patch, cfg, now = Date.now()) => {
  const ns = ("status" in patch) ? patch.status : prev.status;
  const nr = ("waitingReason" in patch) ? patch.waitingReason : prev.waitingReason;
  const wasP = prev.status === "waiting" && reasonPauses(cfg, prev.waitingReason);
  const willP = ns === "waiting" && reasonPauses(cfg, nr);
  let acc = prev.pauseAccumMs || 0, since = prev.pauseSince || null;
  if (wasP && since && !willP) { acc += Math.max(0, now - since); since = null; }
  else if (!wasP && willP) since = now;
  else if (wasP && willP && !since) since = now;
  return { pauseAccumMs: acc, pauseSince: since };
};

// ---- Risk Score ----
function computeRisk(ticket, fleet, config) {
  let score = 0, reasons = [];
  const pr = prOf(ticket.priority);
  if (pr.id === "high") { score += 3; reasons.push("עדיפות גבוהה"); }
  else if (pr.id === "medium") score += 1;
  if (ticket.downtimeType === "critical") { score += 4; reasons.push("השבתה קריטית"); }
  else if (ticket.downtimeType === "has_replacement") { score += 1; }
  if (ticketMissedSla(ticket, config)) { score += 3; reasons.push("חריגת SLA"); }
  else if (ticket.dueAt && (ticket.dueAt - Date.now()) < 4 * 3600000 && isOpen(ticket)) { score += 2; reasons.push("SLA קרוב"); }
  if (!ticket.assignee && isOpen(ticket)) { score += 2; reasons.push("אין אחראי"); }
  if (ticket.status === "waiting") { score += 2; if (ticket.waitingReason) reasons.push(waitReasonLabel(ticket.waitingReason)); }
  if (ticket.returned) { score += 1; reasons.push("הוחזרה לטיפול"); }
  const f = ticket.forkliftId ? fleet.find((x) => x.id === ticket.forkliftId) : null;
  if (f) { const ds = docStatus(f, config); if (ds.d != null && ds.d < 0) { score += 2; reasons.push("מסמך פג-תוקף"); } }
  const level = score >= 8 ? "red" : score >= 5 ? "orange" : score >= 3 ? "yellow" : "green";
  const colors = { green: "#16A34A", yellow: "#CA8A04", orange: "#EA580C", red: "#DC2626" };
  const labels = { green: "סיכון נמוך", yellow: "סיכון בינוני", orange: "סיכון גבוה", red: "סיכון קריטי" };
  return { score, level, color: colors[level], label: labels[level], reasons };
}
// ---- Asset Health (профиль актива) ----
function assetHealth(f, tickets, config) {
  const now = Date.now(), D = 86400000;
  const rel = tickets.filter((t) => t.forkliftId === f.id);
  const last90 = rel.filter((t) => now - t.createdAt <= 90 * D);
  const done = rel.filter((t) => t.status === "done" && t.closure);
  const mttr = done.length ? done.reduce((a, t) => a + ((t.closure.signedAt || t.updatedAt) - t.createdAt), 0) / done.length : 0;
  const cost90 = rel.filter((t) => t.closure && now - (t.closure.signedAt || 0) <= 90 * D).reduce((a, t) => a + (t.closure.costAmount || 0), 0);
  const ds = docStatus(f, config);
  const docExpired = ds.d != null && ds.d < 0;
  const openCrit = rel.some((t) => isOpen(t) && t.downtimeType === "critical");
  let score = 100;
  score -= last90.length * 8;
  score -= docExpired ? 20 : 0;
  score -= openCrit ? 25 : 0;
  score -= mttr > 48 * 3600000 ? 10 : 0;
  score = Math.max(0, Math.min(100, score));
  const level = score >= 75 ? "good" : score >= 50 ? "watch" : score >= 30 ? "risk" : "critical";
  const colors = { good: "#16A34A", watch: "#CA8A04", risk: "#EA580C", critical: "#DC2626" };
  const labels = { good: "תקין", watch: "במעקב", risk: "בסיכון", critical: "קריטי" };
  let rec;
  if (level === "good") rec = "המשך תחזוקה שגרתית.";
  else if (level === "watch") rec = "מומלץ מעקב ובדיקה מונעת.";
  else if (level === "risk") rec = last90.length >= 3 ? "ריבוי תקלות — מומלץ טיפול שורש ושיחה עם הספק." : "מומלץ בדיקה יסודית ותחזוקה מונעת.";
  else rec = "שקול הוצאה משירות / החלפה והסלמה לספק.";
  if (docExpired) rec = "יש לחדש מסמך שפג תוקף. " + rec;
  return { score, level, color: colors[level], label: labels[level], rec, count90: last90.length, mttr, cost90 };
}

const isCriticalEscalated = (t, cfg) => t.track === "transport" && t.downtimeType === "critical" && !transportTechnicianAssignee(t) && isOpen(t) && (Date.now() - t.createdAt) > (cfg?.escalateCriticalHours ?? 2) * 3600000;
const HE_STOP = new Set("של את עם על אם כי או גם לא יש אין זה זו הוא היא הם הן אני אתה אנחנו עד אל כל כך מה מי כמו בין אחר אחרי לפני תחת ליד מן אבל אז רק עוד כבר היה היתה להיות יותר פחות מאוד".split(/\s+/));
const normToken = (w) => (w || "").replace(/[^\u0590-\u05FFa-zA-Z0-9]/g, "");
const keywordsOf = (text) => Array.from(new Set((text || "").split(/\s+/).map(normToken).filter((w) => w.length >= 3 && !HE_STOP.has(w)).map((w) => w.toLowerCase())));
const PRIO_RANK = { high: 0, medium: 1, low: 2 };
const ticketSortKey = (t, cfg) => { const overdue = cfg ? ticketMissedSla(t, cfg) : isOverdue(t); return [overdue ? -1 : 0, PRIO_RANK[prOf(t.priority).id] ?? 1, t.dueAt || Infinity]; };
const sortByImportance = (arr, cfg) => [...arr].sort((a, b) => { const ka = ticketSortKey(a, cfg), kb = ticketSortKey(b, cfg); for (let i = 0; i < ka.length; i++) { if (ka[i] !== kb[i]) return ka[i] - kb[i]; } return b.createdAt - a.createdAt; });
function similarTickets(target, all, opts = {}) {
  const days = opts.days ?? null, now = Date.now();
  const pool = all.filter((t) => t.id !== target.id && (days == null || (now - t.createdAt) <= days * 86400000));
  const ks = new Set(keywordsOf(`${target.subject || ""} ${target.description || ""}`));
  const sameMachine = !!(target.track === "transport" || target.forkliftId);
  return pool.map((t) => {
    const tk = keywordsOf(`${t.subject || ""} ${t.description || ""}`);
    const overlap = tk.filter((w) => ks.has(w)).length;
    let score = overlap * 3;                                   // ключевые слова — главный сигнал
    if (sameMachine && t.forkliftId && t.forkliftId === target.forkliftId) score += 2; // тот же погрузчик — доп. сигнал
    if (!sameMachine && t.category && t.category === target.category) score += 1;
    if (t.zone && t.zone === target.zone) score += 1;
    return { t, score, overlap };
  }).filter((x) => x.score >= 3 || x.overlap >= 1).sort((a, b) => b.score - a.score || b.t.createdAt - a.t.createdAt);
}
const countBy = (list, f) => { const c = {}; list.forEach((x) => { const k = f(x); if (k != null && k !== "") c[k] = (c[k] || 0) + 1; }); return c; };
const ils = (n) => "₪" + (n || 0).toLocaleString("he-IL");
const dateToTs = (s) => s ? new Date(s + "T00:00:00").getTime() : null;
const tsToDate = (ts) => ts ? new Date(ts).toISOString().slice(0, 10) : "";
const isoDateToDisplay = (value) => {
  if (!value) return "";
  const [y, m, d] = String(value).slice(0, 10).split("-");
  return y && m && d ? `${d}.${m}.${String(y).slice(-2)}` : "";
};
const displayDateToIso = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = raw.match(/^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2}|\d{4}))?$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = match[3] ? Number(match[3].length === 2 ? "20" + match[3] : match[3]) : new Date().getFullYear();
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
};
const normalizeTimeText = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = raw.replace(/\s+/g, "").match(/^(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = match[2] == null ? 0 : Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${pad2(hour)}:${pad2(minute)}`;
};
function DateInput({ value, onChange, disabled = false, className = "", ...props }) {
  const [text, setText] = useState(isoDateToDisplay(value));
  useEffect(() => { setText(isoDateToDisplay(value)); }, [value]);
  const commit = (raw) => {
    const parsed = displayDateToIso(raw);
    if (parsed !== null) {
      setText(isoDateToDisplay(parsed));
      onChange?.(parsed);
    } else {
      setText(isoDateToDisplay(value));
    }
  };
  return <input {...props} className={className} dir="ltr" inputMode="numeric" disabled={disabled} value={text} placeholder={props.placeholder || "dd.mm.yy"} onChange={(e) => setText(e.target.value.replace(/[^\d./-]/g, ""))} onBlur={(e) => commit(e.target.value)} />;
}
function TimeInput({ value, onChange, className = "", ...props }) {
  const [text, setText] = useState(value || "");
  useEffect(() => { setText(value || ""); }, [value]);
  const commit = (raw) => {
    const parsed = normalizeTimeText(raw);
    if (parsed !== null) {
      setText(parsed);
      onChange?.(parsed);
    } else {
      setText(value || "");
    }
  };
  return <input {...props} className={className} dir="ltr" inputMode="numeric" value={text} placeholder={props.placeholder || "HH:mm"} onChange={(e) => { const next = e.target.value.replace(/[^\d:]/g, "").slice(0, 5); setText(next); const parsed = normalizeTimeText(next); if (parsed !== null && next.includes(":")) onChange?.(parsed); }} onBlur={(e) => commit(e.target.value)} />;
}
const daysLeft = (ts) => Math.ceil((ts - Date.now()) / 86400000);
const isWorkday = (d) => { const w = new Date(d).getDay(); return w !== 5 && w !== 6; }; // 5=Fri 6=Sat off
const toWorkday = (ts) => { let d = new Date(ts); while (!isWorkday(d)) d.setDate(d.getDate() + 1); return d.getTime(); };
const nextWorkdayFrom = (ts) => { let d = new Date(ts); d.setDate(d.getDate() + 1); return toWorkday(d.getTime()); };
const startOfDay = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
const todayKey = () => new Date().toISOString().slice(0, 10);
const presenceOf = (presence, userId) => presenceRecordForUser(presence, userId, { todayKey: todayKey() });
// График смены техника: старт+конец (одно расписание на все дни). Источник — личные поля, затем дефолт.
const techSched = (u, cfg) => ({ start: u?.shiftStart || cfg?.defaultShiftStart || "07:30", end: u?.shiftEnd || cfg?.defaultShiftEnd || "16:30" });
const todayAtHM = (hm) => { const [hh, mm] = String(hm || "00:00").split(":").map(Number); const d = new Date(); d.setHours(hh || 0, mm || 0, 0, 0); return d.getTime(); };
// Простой смены: опоздание к старту (вход позже старт+допуск) и ранний уход (выход раньше конец−допуск). Только рабочие дни.
const isShiftWorkday = () => WORK_WEEK.includes(new Date().getDay());
// Плановое отсутствие: есть ли у пользователя отгул, покрывающий день dk (ISO YYYY-MM-DD).
const isAbsentOn = (userId, absences, dk) => { const d = dk || todayKey(); return (absences || []).some((a) => a.userId === userId && a.from && a.from <= d && (a.to || a.from) >= d); };
const shiftIdle = (rec, u, cfg) => {
  const sc = techSched(u, cfg), tol = resolveTechnicianTolerances(u, { lateTolerance: cfg?.lateGraceMin ?? 10, earlyTolerance: cfg?.earlyGraceMin ?? 10 });
  const lg = tol.lateTolerance * 60000, eg = tol.earlyTolerance * 60000;
  const sTs = todayAtHM(sc.start), eTs = todayAtHM(sc.end);
  const since = (rec && rec.day === todayKey()) ? rec.since : null;
  const endedAt = (rec && rec.day === todayKey()) ? rec.endedAt : null;
  const lateMin = since ? Math.max(0, Math.round((since - (sTs + lg)) / 60000)) : 0;
  const earlyMin = endedAt ? Math.max(0, Math.round(((eTs - eg) - endedAt) / 60000)) : 0;
  return { lateMin, earlyMin, sTs, eTs, lateThresh: sTs + lg };
};
const HE_DOW = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
const HE_MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
const pmColor = (d) => (d <= 0 ? "#DC2626" : d <= 3 ? "#EA580C" : d <= 7 ? "#CA8A04" : "#16A34A");
const downtimeMs = (t) => { const start = t.downtimeStart || t.createdAt; const end = t.status === "done" ? (t.downtimeEnd || t.updatedAt) : Date.now(); return Math.max(0, end - start); };

function docStatus(fleet, cfg) {
  const w = cfg?.docWarn || DEFAULT_CONFIG.docWarn;
  let min = Infinity, which = "", missing = "";
  const docs = machineDocs(fleet, cfg);
  docs.forEach((d) => {
    const ts = dateToTs(fleet.docs?.[d.id]?.date);
    if (ts == null) { if (!missing) missing = d.label; return; }
    if (daysLeft(ts) < min) { min = daysLeft(ts); which = d.label; }
  });
  if (missing) return { d: -1, color: "#DC2626", label: "חסר תוקף", which: missing, missing: true };
  if (min === Infinity) return { d: null, color: "var(--muted)", label: "—", which: "" };
  let color = "#16A34A", label = `תקין · ${min} י׳`;
  if (min < 0) { color = "#DC2626"; label = `פג תוקף`; }
  else if (min <= w.red) { color = "#DC2626"; label = `${min} ימים`; }
  else if (min <= w.orange) { color = "#EA580C"; label = `${min} ימים`; }
  else if (min <= w.yellow) { color = "#CA8A04"; label = `${min} ימים`; }
  return { d: min, color, label, which };
}
function docNotificationAt(fleet, cfg, status = {}) {
  const docs = machineDocs(fleet, cfg);
  const matchedDoc = docs.find((doc) => doc.label === status.which) || null;
  const matchedTs = matchedDoc ? dateToTs(fleet?.docs?.[matchedDoc.id]?.date) : null;
  if (matchedTs != null) return matchedTs;
  const stableFallback = Number(fleet?.updatedAt || fleet?.createdAt || fleet?.importedAt || 0);
  return Number.isFinite(stableFallback) && stableFallback > 0 ? stableFallback : 0;
}
const aggregateNotificationAt = (items = [], candidates = ["updatedAt", "createdAt", "at"]) => (
  Math.max(0, ...(items || []).map((item) => (
    Math.max(0, ...candidates.map((field) => Number(item?.[field] || 0)).filter(Number.isFinite))
  )))
);
function docWarnColor(days, cfg) {
  const w = cfg?.docWarn || DEFAULT_CONFIG.docWarn;
  if (days == null) return "var(--muted)";
  if (days < 0) return "#DC2626";
  if (days <= w.red) return "#DC2626";
  if (days <= w.orange) return "#EA580C";
  if (days <= w.yellow) return "#CA8A04";
  return "#16A34A";
}
const docDaysLabel = (days) => days == null ? "—" : days < 0 ? "פג תוקף" : `${days} י׳`;

// Владелец заявки = тот, кто её открыл. Сверяем по id (имя ненадёжно при совпадениях).
// На будущее: сюда же добавится логика «подчинённых менеджера», когда понадобится.
const ownsTicket = ownsTicketRecord;
const ownsPendingUserTicket = requesterOwnsTicket;
// Заявка-обращение от работника (нижний канал). reportedBy остаётся на всю жизнь заявки — для «моих обращений» работника и для статистики.
const isWorkerReport = (t) => !!t.reportedBy;
const ticketRequiresManagerAction = (session, ticket) => managerActionRequiredForTicket(session, ticket, {
  open: isOpen(ticket),
  ball: ballIn(ticket),
  workerReport: isWorkerReport(ticket)
});
const ticketNeedsManagerScopeFollowUp = (session, ticket) => managerScopedTicketNeedsFollowUp(session, ticket, {
  open: isOpen(ticket),
  ball: ballIn(ticket),
  workerReport: isWorkerReport(ticket)
});

const visibleTickets = visibleTicketsForSession;

function entryFor(session, text, kind) { return { at: Date.now(), by: session.name, byRole: session.role, text, ...(kind ? { kind } : {}) }; }

/* ---------- AI ---------- */
async function callClaude(messages, system, maxTokens = 1024) {
  if (!BROWSER_AI_ENABLED) throw new Error("ai-disabled");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: maxTokens, system, messages }),
  });
  if (!res.ok) throw new Error("api-" + res.status);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "api-error");
  const txt = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  if (!txt) throw new Error("empty");
  return txt;
}
function localSuggest(text) {
  const s = (text || "").toLowerCase();
  const map = [
    ["electric", ["חשמל", "תאורה", "שקע", "חשמלי", "מתח", "נורה", "לוח"]],
    ["plumbing", ["מים", "נזילה", "ביוב", "אינסטלציה", "ברז", "דליפה", "שירותים", "אסלה"]],
    ["hvac", ["מיזוג", "מזגן", "קירור", "חימום", "אוורור", "טמפרטורה"]],
    ["mechanical", ["מנוע", "מכני", "משאבה", "רצועה", "מסוע", "גלגל"]],
    ["safety", ["בטיחות", "כיבוי", "אש", "מטף", "גלאי", "חירום"]],
    ["it", ["מחשב", "רשת", "אינטרנט", "מדפסת", "שרת", "מסך", "סיסמה"]],
    ["building", ["דלת", "קיר", "גג", "חלון", "רצפה", "תקרה", "מבנה", "סדק"]],
    ["cleaning", ["ניקיון", "לכלוך", "פסולת", "זבל", "ניקוי"]],
  ];
  let category = "other";
  for (const [id, kw] of map) if (kw.some((k) => s.includes(k))) { category = id; break; }
  let priority = "medium";
  if (["דחוף", "מיידי", "מסוכן", "חירום", "סכנה", "שריפה", "הצפה"].some((k) => s.includes(k))) priority = "high";
  else if (["לא עובד", "מושבת", "תקול", "חוסם", "עצר", "נפל"].some((k) => s.includes(k))) priority = "high";
  return { category, priority };
}
function buildAIContext(session, tickets, pm, fleet, cfg) {
  const open = tickets.filter(isOpen);
  const L = [`תפקיד: ${ROLE_LABEL[session.role]}`];
  L.push(`קריאות בתחום ראייתך: סה"כ ${tickets.length}, פתוחות ${open.length}, חריגת SLA ${tickets.filter(isOverdue).length}.`);
  open.slice(0, 16).forEach((t) => L.push(`#${ticketNo(t)}|${TRACKS[t.track]?.short}|${catOf(t).label}|${prOf(t.priority).label}|${stOf(t.status).label}${ticketWaitReasonLabel(t, cfg) ? " · " + ticketWaitReasonLabel(t, cfg) : ""}|${t.assignee || "ללא"}|${t.subject}`));
  if (session.role === "admin") {
    const exp = (fleet || []).map((f) => ({ f, s: docStatus(f, cfg) })).filter((x) => x.s.d != null && x.s.d <= 30);
    if (exp.length) { L.push("מסמכי כלי שינוע פגי-תוקף קרוב:"); exp.slice(0, 10).forEach((x) => L.push(`- ${unitLabel(x.f, cfg)}: ${x.s.label}`)); }
    const due = (pm || []).filter((p) => p.active && daysLeft(p.nextDue) <= 7);
    if (due.length) { L.push("טיפולים תקופתיים קרובים:"); due.forEach((p) => { const f = pmFleet(p, fleet); L.push(`- ${f ? f.code : "כלי"} בעוד ${daysLeft(p.nextDue)} ימים`); }); }
    const cost = tickets.reduce((a, t) => a + (t.closure?.costAmount || 0), 0);
    L.push(`עלות מצטברת: ${ils(cost)}.`);
  }
  return L.join("\n");
}

function buildAIContextSnapshot(session, tickets, pm, fleet, cfg, tasks = [], meetings = [], users = [], ppeItems = [], ppeReqs = [], zones = []) {
  const now = Date.now();
  return buildAIContextSnapshotModel({
    session,
    tickets,
    pm,
    fleet,
    users,
    tasks,
    meetings,
    ppeItems,
    ppeReqs,
    zones,
    config: cfg,
    now,
    isOpenTicket: isOpen,
    isOverdueTicket: (ticket) => ticketMissedSla(ticket, cfg),
    requiresManagerAction: ticketRequiresManagerAction,
    ticketNumber: ticketNo,
    statusLabel: (status) => stOf(status).label,
    priorityLabel: (priority) => prOf(priority).label,
    trackOf,
    waitReasonLabel: (ticket) => ticketWaitReasonLabel(ticket, cfg),
    formatDateTime: (timestamp) => `${fmtDate(timestamp)} ${fmtTime(timestamp)}`,
    daysLeft: (timestamp) => daysLeft(timestamp),
    pmFleet: (task, fleetList) => pmFleet(task, fleetList || []),
    docStatus: (unit) => docStatus(unit, cfg)
  });
}

function aiAssistantEnabled(cfg) {
  return BROWSER_AI_ENABLED || normalizeAiSettings(cfg?.ai).mode === AI_MODES.server;
}

async function callAIAssistant({ text, messages, conversationId, system, context, workflow, includeProviderPlan = false, idempotencyKey, signal = null, timeoutMs }) {
  if (BROWSER_AI_ENABLED) return callClaude(messages, system, 900);
  return callAiAssistApi({
    text,
    messages,
    conversationId,
    context,
    workflow,
    includeProviderPlan,
    idempotencyKey,
    getAccessToken: productionAccessToken,
    signal,
    timeoutMs
  });
}

async function loadAIConversations() {
  return listAiConversations({ getAccessToken: productionAccessToken });
}

async function loadAIConversationAccess() {
  return getAiConversationAccess({ getAccessToken: productionAccessToken });
}

async function startAIConversation({ title } = {}) {
  return createAiConversation({ title, getAccessToken: productionAccessToken });
}

async function openAIConversation(id) {
  return getAiConversation({ id, getAccessToken: productionAccessToken });
}

async function archiveAIConversation(id) {
  return archiveAiConversation({ id, getAccessToken: productionAccessToken });
}

async function loadAIMemoryFacts() {
  return listAiMemoryFacts({ getAccessToken: productionAccessToken });
}

async function saveAIMemoryFact(fact) {
  return createAiMemoryFact({ fact, getAccessToken: productionAccessToken });
}

async function reviseAIMemoryFact(id, fact) {
  return updateAiMemoryFact({ id, fact, getAccessToken: productionAccessToken });
}

async function forgetAIMemoryFact(id) {
  return deactivateAiMemoryFact({ id, getAccessToken: productionAccessToken });
}

/* ---------- notifications ---------- */
const DEFAULT_NOTIF_PREFS = DEFAULT_LOCAL_NOTIFICATION_PREFS;
function computeEvents(session, tickets, pm, fleet, cfg, presence, zones = [], rounds = [], complaints = [], users = [], absences = [], tasks = [], meetings = [], ppeReqs = [], ppeItems = [], ppeOrders = []) {
  const ev = []; const vis = visibleTickets(session, tickets, fleet);
  (tasks || []).forEach((t) => { if (!taskOpen(t)) return; if (!(t.ownerId === session.id || (t.responsibleIds || []).includes(session.id))) return; if (taskOverdue(t)) ev.push({ key: "task-ovd-" + t.id, at: t.dueAt, kind: "task", go: "tasks", title: `מטלה באיחור · ${t.title}`, body: tstOf(t.status).label }); else if ((t.mode === "deadline" || t.mode === "recurring") && t.dueAt && t.dueAt - Date.now() < 2 * 86400000) ev.push({ key: "task-due-" + t.id, at: t.dueAt, kind: "task", go: "tasks", title: `מטלה לקראת יעד · ${t.title}`, body: fmtDate(t.dueAt) }); else if (t.nextActionAt && t.nextActionAt - Date.now() < 86400000) ev.push({ key: "task-na-" + t.id, at: t.nextActionAt, kind: "task", go: "tasks", title: `מעקב מטלה · ${t.title}`, body: "הגיע תאריך מעקב" }); });
  (meetings || []).forEach((m) => { if (m.status !== "planned") return; if (!(m.ownerId === session.id || (m.participantIds || []).includes(session.id))) return; const dt = m.at - Date.now(); if (dt > -3600000 && dt < 24 * 3600000) ev.push({ key: "mtg-" + m.id, at: m.at, kind: "task", go: "tasks", title: `פגישה קרובה · ${m.title}`, body: `${fmtDate(m.at)} ${fmtTime(m.at)}` }); });
  const shiftEvents = (go) => {
    const techs = (users || []).filter((u) => u.role === "tech" && u.active !== false);
    const workday = isShiftWorkday();
    techs.forEach((u) => {
      const r = (presence || []).find((x) => x.id === u.id && x.day === todayKey());
      const { lateMin, earlyMin, lateThresh } = shiftIdle(r, u, cfg);
      if (r && r.since) {
        ev.push({ key: "sh-on-" + u.id + r.since, at: r.since, kind: "confirm", go, title: "טכנאי התחיל משמרת", body: `${u.name}${lateMin > 0 ? " · באיחור " + lateMin + " ד׳" : " · בזמן"}` });
        if (lateMin > 0) ev.push({ key: "sh-late-" + u.id + todayKey(), at: r.since, kind: "escalate", go, title: "טכנאי איחר לתחילת משמרת", body: `${u.name} · איחור ${lateMin} ד׳` });
      } else if (workday && Date.now() > lateThresh) {
        const mins = Math.round((Date.now() - lateThresh) / 60000);
        ev.push({ key: "sh-noshow-" + u.id + todayKey(), at: lateThresh, kind: "escalate", go, title: "טכנאי טרם התחיל משמרת", body: `${u.name} · איחור ${mins} ד׳ (טרם נכנס למערכת)` });
      }
      if (r && r.endedAt) {
        ev.push({ key: "sh-off-" + u.id + r.endedAt, at: r.endedAt, kind: "back", go, title: "טכנאי סיים משמרת", body: `${u.name}${earlyMin > 0 ? " · מוקדם ב-" + earlyMin + " ד׳" : ""}` });
        if (earlyMin > 0) ev.push({ key: "sh-early-" + u.id + r.endedAt, at: r.endedAt, kind: "escalate", go, title: "טכנאי סיים משמרת מוקדם", body: `${u.name} · מוקדם ב-${earlyMin} ד׳` });
      }
    });
  };
  if (canPerformCleaning(session) && !["admin", "user", "tech"].includes(session.role)) {
    const nowTs = Date.now();
    (zones || []).filter((z) => z.active !== false && isZoneCleaner(z, session.id)).forEach((z) => zoneTodayStatuses(z, rounds, nowTs, cfg).forEach(({ win, status, slotStart }) => {
      if ((status === "due" || status === "overdue") && !isAbsentOn(session.id, absences)) ev.push({ key: `cls-${z.id}-${win.id}-${todayKey()}`, at: windowAbs(win, nowTs) - (+win.tol || 0) * 60000, kind: "cleaning", go: "cleaning", title: status === "overdue" ? "סבב ניקיון באיחור" : "סבב ניקיון לביצוע כעת", body: `${z.name}${zoneLoc(z) ? " · " + zoneLoc(z) : ""} · חלון ${win.time}` });
      if (status === "upcoming" && !isAbsentOn(session.id, absences)) ev.push({ key: `upcoming-${z.id}-${win.id}-${todayKey()}`, at: slotStart - clampCleaningReminderMins(cfg?.cleaningReminderMins ?? 30) * 60000, kind: "cleaning", go: "cleaning", title: "סבב מתחיל בקרוב", body: `${z.name} · בעוד ${Math.max(1, Math.round((slotStart - nowTs) / 60000))} דקות` });
    }));
    (complaints || []).filter((c) => c.status === "open" && c.ownerRole !== "admin" && c.reportedById !== session.id && canReceiveCleaningComplaints(session) && (zones || []).some((z) => z.id === c.zoneId && isZoneCleaner(z, session.id))).forEach((c) => ev.push({ key: "cmp-" + c.id, at: c.at, kind: "cleaning", go: "cleaning", title: c.kind === "broken" ? "דווחה תקלה באזור שלך" : "דווח לכלוך באזור שלך", body: `${c.zoneName}${c.zoneLoc ? " · " + c.zoneLoc : ""}${c.text ? " · " + c.text : ""}` }));
    return ev.sort((a, b) => b.at - a.at);
  }
  if (session.role === "admin") {
    tickets.forEach((t) => {
      ev.push({ key: t.id + "-c", at: t.createdAt, ticketId: t.id, kind: "new", title: `קריאה חדשה · ${TRACKS[t.track]?.short}`, body: t.subject });
      if (t.status === "pending_admin") ev.push({ key: t.id + "-pa", at: t.updatedAt, ticketId: t.id, kind: "ready", title: "ממתינה לסגירה סופית", body: t.subject });
      if (t.status === "waiting" && t.waitingReason === "no_equipment") ev.push({ key: t.id + "-noeq", at: t.updatedAt, ticketId: t.id, kind: "escalate", title: `הכלי לא הועבר לטכנאי · #${ticketNo(t)}`, body: `${t.asset || ""} · ${t.subject} — נדרשת העברת הכלי, נצבר זמן השבתה` });
      if (ticketMissedSla(t, cfg)) ev.push({ key: t.id + "-sla", at: t.dueAt, ticketId: t.id, kind: "sla", title: `חריגת SLA · #${ticketNo(t)}`, body: t.subject });
      if (isCriticalEscalated(t, cfg)) ev.push({ key: t.id + "-esc", at: t.createdAt + (cfg?.escalateCriticalHours ?? 2) * 3600000, ticketId: t.id, kind: "escalate", title: `השבתה קריטית ללא טכנאי · #${ticketNo(t)}`, body: `${t.asset || ""} · ${t.subject} — אף טכנאי לא קיבל את הקריאה מעל ${cfg?.escalateCriticalHours ?? 2} שע׳` });
    });
    (fleet || []).forEach((f) => { const s = docStatus(f, cfg); if (s.d != null && s.d <= (cfg?.docWarn?.yellow || 30)) ev.push({ key: "doc-" + f.id, at: docNotificationAt(f, cfg, s), kind: "doc", go: "fleet", fleetId: f.id, title: `מסמך פג-תוקף · ${f.code}`, body: `${unitTypeName(f, cfg)} · ${s.label}` }); });
    (fleet || []).forEach((f) => { const b = unitBlock(f, tickets, cfg); if (b) ev.push({ key: "blk-" + f.id + b.ticket.id, at: b.ticket.createdAt, ticketId: b.ticket.id, kind: "escalate", go: "fleet", fleetId: f.id, title: `כלי מושבת · ${f.code}`, body: `${unitTypeName(f, cfg)} · ${b.level.label} — אין להשתמש בכלי` }); });
    tickets.filter((t) => needsHandler(t, users, fleet)).forEach((t) => ev.push({ key: "orphan-" + t.id, at: t.createdAt, ticketId: t.id, kind: "escalate", go: "tickets", title: `קריאה ללא מטפל · #${ticketNo(t)}`, body: `${t.subject} — ${t.assignee ? "המטפל אינו פעיל עוד" : "אין טכנאי פעיל לקבל"}. נדרש שיבוץ.` }));
    (pm || []).filter((x) => x.active !== false && daysLeft(x.nextDue) <= 3).forEach((x) => { const f = pmFleet(x, fleet); const d = daysLeft(x.nextDue); ev.push({ key: "pm-" + x.id, at: x.nextDue, kind: "pm", go: "pm", title: "טיפול תקופתי קרוב", body: `${f ? unitLabel(f, cfg) : "כלי"} · ${d < 0 ? "באיחור" : d === 0 ? "היום" : "בעוד " + d + " ימים"}` }); });
    pendingDriverReqs(fleet).forEach(({ unit, cat, driver }) => ev.push({ key: "drvreq-" + unit.id + cat, at: driver.reqAt || Date.now(), kind: "driver", go: "fleet", fleetId: unit.id, title: driver.status === "pending_add" ? "בקשת הוספת נהג — ממתין לאישורך" : "בקשת העברת נהג — ממתין לאישורך", body: `${driver.name} · ${unit.code} (${driverShiftMeta(cat).label})${driver.status === "pending_move" && driver.moveTo ? ` → ${driver.moveTo.unitCode}` : ""}${driver.needsChip ? " · צריך להנפיק צ׳יפ" : ""} · מ-${driver.addedByName || "מנהל"}` }));
    { const pend = (ppeReqs || []).filter(ppeRequestNeedsAction);
      if (pend.length) ev.push({ key: "ppe-pending-admin", at: Math.max(...pend.map((r) => r.at || r.updatedAt || 0)), kind: "ppe", go: "ppe", ppeSub: "dash", title: "בקשות ביגוד ממתינות", body: `${countLabel(pend.length, "בקשה", "בקשות")} לאישור או חתימת עובד` }); }
    { const low = (ppeItems || []).filter((it) => it.active !== false && ppeLow(it));
      if (low.length) ev.push({ key: "ppe-low-admin", at: aggregateNotificationAt(low), kind: "ppe", go: "ppe", ppeSub: "dash", title: "חוסרי ביגוד לפי מידה", body: `${countLabel(low.length, "פריט", "פריטים")} מתחת למינימום` }); }
    { const openOrders = (ppeOrders || []).filter((o) => o.status === "sent");
      if (openOrders.length) ev.push({ key: "ppe-orders-admin", at: Math.max(...openOrders.map((o) => o.sentAt || o.createdAt || 0)), kind: "ppe", go: "ppe", ppeSub: "log", title: "הזמנות ביגוד ממתינות לקליטה", body: `${countLabel(openOrders.length, "הזמנת רכש פתוחה", "הזמנות רכש פתוחות")}` }); }
    ev.push(...buildPpeApprovedEvents(ppeReqs));
    shiftEvents("team");
    { const nowTs = Date.now(); (zones || []).filter((z) => z.active !== false).forEach((z) => { const assigned = zoneCleanerIds(z); const absent = assigned.length > 0 && assigned.every((id) => isAbsentOn(id, absences)); zoneTodayStatuses(z, rounds, nowTs, cfg).forEach(({ win, status }) => { if (status === "missed") ev.push({ key: `clmiss-${z.id}-${win.id}-${todayKey()}`, at: windowAbs(win, nowTs) + (+win.tol || 0) * 60000, kind: "cleaning", go: "cleaning", title: absent ? "סבב ניקיון — נדרש כיסוי (העובד בחופשה)" : "סבב ניקיון פוספס", body: `${z.name}${zoneLoc(z) ? " · " + zoneLoc(z) : ""} · חלון ${win.time}${zoneCleanerLabel(z, users) !== "ללא אחראי" ? " · " + zoneCleanerLabel(z, users) : ""}` }); }); }); }
    (complaints || []).filter((c) => c.status === "pending").forEach((c) => ev.push({ key: "cmpp-" + c.id, at: c.at, kind: "cleaning", go: "cleaning", title: "דיווח ממתין לאישורך", body: `${c.zoneName}${c.zoneLoc ? " · " + c.zoneLoc : ""} · ${c.reportedByRole === "anonymous" ? "אנונימי" : c.reportedByName}` }));
    (complaints || []).filter((c) => c.status === "open").forEach((c) => ev.push({ key: "cmp-" + c.id, at: c.escalatedTo === "admin" ? (c.escalatedAt || c.at) : c.at, kind: "cleaning", go: "cleaning", title: c.escalatedTo === "admin" ? "דיווח הועבר אליך לטיפול" : (c.kind === "broken" ? "דיווח תקלה באזור ניקיון" : "דיווח לכלוך באזור ניקיון"), body: `${c.zoneName}${c.zoneLoc ? " · " + c.zoneLoc : ""} · ${c.escalatedTo === "admin" ? "מ-" + (c.escalatedBy || "עובד ניקיון") : "מ-" + c.reportedByName}` }));
  } else if (session.role === "tech") {
    vis.forEach((t) => {
      if (t.status === "new") ev.push({ key: t.id + "-n", at: t.createdAt, ticketId: t.id, kind: "new", title: "קריאת שינוע חדשה", body: t.subject });
      (t.log || []).forEach((l, i) => { if (l.byRole === "user" && /הערות|הוחזר/.test(l.text)) ev.push({ key: `${t.id}-${i}`, at: l.at, ticketId: t.id, kind: "back", title: "הוחזר מהמשתמש", body: `${t.subject} — ${l.text}` }); });
    });
    (pm || []).filter((x) => x.active !== false && daysLeft(x.nextDue) <= 3).forEach((x) => { const f = pmFleet(x, fleet); const d = daysLeft(x.nextDue); ev.push({ key: "pm-" + x.id, at: x.nextDue, kind: "pm", go: "pm", title: "טיפול תקופתי לביצוע", body: `${f ? unitLabel(f, cfg) : "כלי"} · ${d < 0 ? "באיחור" : d === 0 ? "היום" : "בעוד " + d + " ימים"}` }); });
    (fleet || []).filter((f) => techCanSeeFleet(session, f)).forEach((f) => { const b = unitBlock(f, tickets, cfg); if (b) ev.push({ key: "blk-" + f.id + b.ticket.id, at: b.ticket.createdAt, ticketId: b.ticket.id, kind: "escalate", title: `כלי מושבת · ${f.code}`, body: `${unitTypeName(f, cfg)} · ${b.level.label}` }); });
  } else {
    vis.forEach((t) => {
      if (t.status === "pending_user" && canConfirmTicketForSession(session, t)) ev.push({ key: t.id + "-pu", at: t.updatedAt, ticketId: t.id, kind: "confirm", title: "ממתינה לאישורך", body: t.subject });
      if (t.status === "waiting" && t.waitingReason === "no_equipment") ev.push({ key: t.id + "-noeq", at: t.updatedAt, ticketId: t.id, kind: "escalate", title: `הכלי לא הועבר לטכנאי · #${ticketNo(t)}`, body: `${t.asset || ""} · ${t.subject} — יש להעביר את הכלי לטכנאי` });
      (t.log || []).forEach((l, i) => { if (l.byRole !== "user") ev.push({ key: `${t.id}-${i}`, at: l.at, ticketId: t.id, kind: "upd", title: `עדכון · #${ticketNo(t)}`, body: `${t.subject} — ${l.text}` }); });
    });
    (pm || []).filter((x) => x.active !== false && daysLeft(x.nextDue) <= 3).forEach((x) => { const f = pmFleet(x, fleet); if (!f || !fleetDepts(f).some((d) => userDepts(session).includes(d))) return; const d = daysLeft(x.nextDue); ev.push({ key: "pm-" + x.id, at: x.nextDue, kind: "pm", go: "dept", fleetId: f.id, title: "כלי מחלקתך לטיפול", body: `${unitLabel(f, cfg)} · ${d < 0 ? "באיחור — יש להוציא" : d === 0 ? "היום" : "בעוד " + d + " ימים"}` }); });
    if (session.role === "user") fleetForSession(session, fleet).forEach((f) => { const b = unitBlock(f, tickets, cfg); if (b) ev.push({ key: "blk-" + f.id + b.ticket.id, at: b.ticket.createdAt, ticketId: b.ticket.id, kind: "escalate", go: "dept", title: `כלי מושבת · ${f.code}`, body: `${unitTypeName(f, cfg)} · ${b.level.label} — אין להשתמש בכלי` }); });
    if (session.role === "user") (cfg.driverEvents || []).filter((e) => (e.type === "approved" || e.type === "rejected") && e.reqByUid === session.id).slice(0, 20).forEach((e) => ev.push({ key: "drvout-" + e.id, at: e.at, kind: "driver", go: "dept", fleetId: e.unitId || null, title: e.type === "approved" ? "בקשת הנהג שלך אושרה" : "בקשת הנהג שלך נדחתה", body: `${e.sub === "move" ? "העברת" : "הוספת"} ${e.driverName} · ${e.unitCode}${e.toUnitCode ? ` → ${e.toUnitCode}` : ""}` }));
    if (session.role === "user") { const mz = session.mgrZones || []; (complaints || []).filter((c) => c.status === "open" && mz.includes(c.zoneId)).forEach((c) => ev.push({ key: "cmp-" + c.id, at: c.at, kind: "cleaning", go: "cleaning", title: c.kind === "broken" ? "תקלה באזור של מחלקתך" : "לכלוך באזור של מחלקתך", body: `${c.zoneName}${c.zoneLoc ? " · " + c.zoneLoc : ""}` }));
      (rounds || []).filter((r) => r.zoneId && Date.now() - r.at < 2 * 60 * 60 * 1000 && r.byUid !== session.id).forEach((r) => { const zone = (zones || []).find((z) => z.id === r.zoneId); if (!zone || !mz.includes(zone.id)) return; ev.push({ key: "zone-cleaned-" + r.id, at: r.at, kind: "cleaning", go: "cleaning", title: "האזור שלך נוקה", body: `${zone.name} · ${r.byName || "עובד ניקיון"}` }); }); }
    shiftEvents("dept");
  }
  return ev.sort((a, b) => b.at - a.at);
}
function useNotifications(session, tickets, pm, fleet, cfg, presence, zones = [], rounds = [], complaints = [], users = [], absences = [], tasks = [], meetings = [], ppeReqs = [], ppeItems = [], ppeOrders = []) {
  const userNotifKey = session.id || session.role + ":" + session.name;
  const { primary: skey, legacy: legacySkey } = notificationReadStorageKeys(session);
  const pkey = `notifprefs:${userNotifKey}`;
  const bkey = `browsernotif:${userNotifKey}`;
  const serverReadStateKey = JSON.stringify(session?.notificationPrefs?.readState || null);
  const [readState, setReadState] = useState(null), [toast, setToast] = useState(null);
  const [prefs, setPrefsState] = useState(DEFAULT_NOTIF_PREFS);
  const browserNotificationRef = useRef({ maxAt: 0, notifiedKeys: [], lastNotifiedAt: 0 }), initRef = useRef(false), browserStateLoadedRef = useRef(false);
  useEffect(() => {
    initRef.current = false;
    browserNotificationRef.current = { maxAt: 0, notifiedKeys: [], lastNotifiedAt: 0 };
    browserStateLoadedRef.current = false;
  }, [bkey]);
  useEffect(() => {
    let cancelled = false;
    browserStateLoadedRef.current = false;
    store.get(bkey, false).then((v) => {
      if (cancelled) return;
      browserNotificationRef.current = parseBrowserNotificationState(v);
      browserStateLoadedRef.current = true;
    }).catch(() => {
      if (!cancelled) browserStateLoadedRef.current = true;
    });
    return () => { cancelled = true; };
  }, [bkey]);
  useEffect(() => {
    let cancelled = false;
    setReadState(null);
    Promise.all([store.get(skey, false), legacySkey ? store.get(legacySkey, false) : Promise.resolve(null)]).then(([current, legacy]) => {
      const serverReadState = session?.notificationPrefs?.readState || null;
      const next = mergeNotificationReadStates(serverReadState, current, legacy);
      if (!cancelled) setReadState(next);
      if (!cancelled && legacy) {
        const currentNext = mergeNotificationReadStates(current);
        const currentKeys = new Set(currentNext.seenKeys || []);
        const hasNewLegacyKey = (next.seenKeys || []).some((key) => !currentKeys.has(key));
        if ((next.seenAt || 0) !== (currentNext.seenAt || 0) || hasNewLegacyKey) {
          store.set(skey, JSON.stringify(next), false);
        }
      }
    });
    return () => { cancelled = true; };
  }, [skey, legacySkey, serverReadStateKey]);
  useEffect(() => {
    let cancelled = false;
    setPrefsState(parseLocalNotificationPrefs(null, DEFAULT_NOTIF_PREFS));
    store.get(pkey, false).then((v) => {
      if (!cancelled) setPrefsState(parseLocalNotificationPrefs(v, DEFAULT_NOTIF_PREFS));
    });
    return () => { cancelled = true; };
  }, [pkey]);
  const setPrefs = (patch) => setPrefsState((p) => { const np = { ...p, ...patch }; store.set(pkey, JSON.stringify(np), false); return np; });
  const rawEvents = useMemo(() => computeEvents(session, tickets, pm, fleet, cfg, presence, zones, rounds, complaints, users, absences, tasks, meetings, ppeReqs, ppeItems, ppeOrders).filter((e) => (cfg.notify || {})[e.kind] !== false), [session, tickets, pm, fleet, cfg, presence, zones, rounds, complaints, users, absences, tasks, meetings, ppeReqs, ppeItems, ppeOrders]);
  const visible = useMemo(() => rawEvents.filter((e) => !prefs.hidden[e.kind]), [rawEvents, prefs.hidden]);
  const browserVisible = useMemo(() => browserNotificationEvents(visible), [visible]);
  const events = useMemo(() => [...visible].sort((a, b) => prefs.sort === "oldest" ? a.at - b.at : b.at - a.at), [visible, prefs.sort]);
  const unreadKeys = useMemo(() => readState == null ? new Set() : unreadNotificationKeySet(visible, readState), [visible, readState]);
  const unreadEvents = useMemo(() => events.filter((event) => unreadKeys.has(event.key)), [events, unreadKeys]);
  const unread = unreadKeys.size;
  useEffect(() => {
    if (!browserStateLoadedRef.current) return;
    if (!browserVisible.length) return;
    if (!initRef.current) {
      initRef.current = true;
      const stored = parseBrowserNotificationState(browserNotificationRef.current);
      const baseline = initialBrowserNotificationState(browserVisible);
      browserNotificationRef.current = {
        maxAt: Math.max(stored.maxAt || 0, baseline.maxAt || 0),
        notifiedKeys: [...new Set([...(stored.notifiedKeys || []), ...(baseline.notifiedKeys || [])])],
        lastNotifiedAt: stored.lastNotifiedAt || 0
      };
      store.set(bkey, JSON.stringify(browserNotificationRef.current), false);
      return;
    }
    const nextBrowserNotification = nextBrowserNotificationEvent(browserVisible, browserNotificationRef.current);
    browserNotificationRef.current = {
      maxAt: nextBrowserNotification.maxAt,
      notifiedKeys: nextBrowserNotification.notifiedKeys,
      lastNotifiedAt: nextBrowserNotification.lastNotifiedAt || 0
    };
    store.set(bkey, JSON.stringify(browserNotificationRef.current), false);
    const top = nextBrowserNotification.event;
    if (top) {
      setToast(top);
      try { if ("Notification" in window && Notification.permission === "granted") new Notification(top.title, { body: top.body }); } catch (e) {}
      setTimeout(() => setToast(null), 5200);
    }
  }, [browserVisible]);
  const markRead = async (items = visible) => {
    const next = mergeNotificationReadStates(readState, notificationReadStateForEvents(items));
    setReadState(next);
    const localSave = store.set(skey, JSON.stringify(next), false);
    if (session?.productionSession) {
      void (async () => {
        try {
          const accessToken = await productionAccessToken();
          await updateProductionNotificationReadState({ accessToken, notificationReadState: next, config: PRODUCTION_LOGIN_CONFIG });
        } catch (_) {}
      })();
    }
    await localSave;
  };
  return { events, unread, unreadKeys, unreadEvents, markRead, toast, dismissToast: () => setToast(null), prefs, setPrefs, presentKinds: [...new Set(rawEvents.map((e) => e.kind))] };
}

/* ============================================================ ROOT */
export default function App() {
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState(null);
  const [versionUpdate, setVersionUpdate] = useState(null);
  const [dismissedVersionCommit, setDismissedVersionCommit] = useState("");
  const [session, setSession] = useState(null);
  const sessionRef = useRef(null);
  const readyRef = useRef(false);
  const dataRefreshInFlightRef = useRef(false);
  const dataRefreshLastStartedAtRef = useRef(0);
  const quietSharedFailureKeysRef = useRef(new Set());
  const automaticAppIssueKeysRef = useRef(new Map());
  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => { readyRef.current = ready; }, [ready]);
  useEffect(() => {
    store._onFail = (details = {}) => {
      const errorId = `client-${Date.now().toString(36)}`;
      const current = sessionRef.current || {};
      reportClientError({
        kind: "storage_save_failed",
        message: "Shared storage operation failed",
        operation: details.operation || "",
        key: details.key || "",
        shared: details.shared === true,
        metadata: {
          error: details.error || "",
          actorId: current.id || "",
          actorRole: current.role || "",
          errorId
        }
      });
    };
    return () => { store._onFail = null; };
  }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 5000); return () => clearTimeout(t); }, [toast]);
  useEffect(() => {
    const onNotice = (event) => {
      const message = event?.detail?.message;
      if (message) setToast(message);
    };
    window.addEventListener("cmms:notice", onNotice);
    return () => window.removeEventListener("cmms:notice", onNotice);
  }, []);
  useEffect(() => {
    let cancelled = false;
    const checkVersion = async () => {
      try {
        const response = await fetch(`${VERSION_MANIFEST_PATH}?t=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) return;
        const latest = normalizeVersionManifest(await response.json());
        if (cancelled) return;
        if (shouldShowVersionUpdate({ currentCommit: APP_BUILD_COMMIT, latestCommit: latest.commit, dismissedCommit: dismissedVersionCommit })) {
          if (shouldAutoRefreshStandaloneVersion({
            currentCommit: APP_BUILD_COMMIT,
            latestCommit: latest.commit,
            isStandalone: isStandaloneDisplay({ matchMedia: window.matchMedia?.bind(window), navigator: window.navigator }),
            storage: window.sessionStorage
          })) {
            markStandaloneVersionRefreshed({ latestCommit: latest.commit, storage: window.sessionStorage });
            await refreshAppCache();
            return;
          }
          setVersionUpdate(latest);
        } else if (latest.commit === APP_BUILD_COMMIT) {
          setVersionUpdate(null);
        }
      } catch {}
    };
    const onVisible = () => { if (!document.hidden) checkVersion(); };
    checkVersion();
    const id = setInterval(checkVersion, 60000);
    window.addEventListener("focus", checkVersion);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener("focus", checkVersion);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [dismissedVersionCommit]);
  const refreshAppCache = async () => {
    try {
      await softResetAppCache();
    } catch {}
    window.location.reload();
  };
  const [rolePreviewRole, setRolePreviewRole] = useState(null);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  TASK_STATUS_META = config.taskStatusMeta || {};
  const [users, setUsers] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [pm, setPm] = useState([]);
  const [fleet, setFleet] = useState([]);
  const [presence, setPresence] = useState([]);
  const presenceRef = useRef([]);
  const [zones, setZones] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [locations, setLocations] = useState([]);
  const [ppe, setPpe] = useState([]);
  const [ppeItems, setPpeItems] = useState([]);
  const [ppeNorms, setPpeNorms] = useState([]);
  const [ppeReqs, setPpeReqs] = useState([]);
  const [ppeOrders, setPpeOrders] = useState([]);
  const [appIssues, setAppIssues] = useState([]);
  const [issueReportOpen, setIssueReportOpen] = useState(false);
  const [issueReportDraft, setIssueReportDraft] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [theme, setTheme] = useState("light");
  const [language, setLanguageState] = useState(() => preferredInitialLanguage({ cookie: typeof document !== "undefined" ? document.cookie : "", navigator: typeof navigator !== "undefined" ? navigator : undefined }));
  const snapRef = useRef({});
  useEffect(() => { presenceRef.current = presence; }, [presence]);
  const persistLanguagePreference = (nextLanguage) => {
    const normalized = normalizeLanguageCode(nextLanguage);
    if (typeof document !== "undefined") document.cookie = languageCookieString(normalized);
    store.set("language:v1", normalized, false);
    return normalized;
  };
  const setLanguage = (nextLanguage) => {
    const normalized = persistLanguagePreference(nextLanguage);
    setLanguageState(normalized);
  };
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = languageDirection(language);
  }, [language]);
  const applySavedConfig = (savedConfig) => {
    if (!savedConfig) return;
    try {
      const sv = parseStoredAppConfigValue(savedConfig);
      const D = DEFAULT_CONFIG;
      const typeMaps = catalogAwareTypeMaps(sv, D);
      setConfig({
        ...D,
        ...sv,
        widgets: { ...D.widgets, ...(sv.widgets || {}) },
        techWidgets: { ...D.techWidgets, ...(sv.techWidgets || {}) },
        mgrWidgets: { ...D.mgrWidgets, ...(sv.mgrWidgets || {}) },
        notify: { ...D.notify, ...(sv.notify || {}) },
        docWarn: { ...D.docWarn, ...(sv.docWarn || {}) },
        catSla: { ...D.catSla, ...(sv.catSla || {}) },
        ...typeMaps
      });
    } catch {}
  };

  useEffect(() => { (async () => {
    try {
    const th = await store.get("theme:v1", false); if (th) setTheme(th);
    const savedLanguage = await store.get("language:v1", false);
    const cookieLanguage = typeof document !== "undefined" ? languageFromCookie(document.cookie) : "";
    if (cookieLanguage) {
      store.set("language:v1", cookieLanguage, false);
    } else if (savedLanguage) {
      const normalizedLanguage = normalizeLanguageCode(savedLanguage);
      setLanguageState(normalizedLanguage);
      if (typeof document !== "undefined") document.cookie = languageCookieString(normalizedLanguage);
    } else if (typeof document !== "undefined") {
      document.cookie = languageCookieString(language);
      store.set("language:v1", language, false);
    }
    if (SEED_POLICY.requiresServerBootstrapAdmin) {
      fetchPublicZones({ url: PUBLIC_ZONES_URL })
        .then((publicZones) => { if (publicZones.length > 0) setZones(publicZones); })
        .catch(() => {});
      const restored = await restoreProductionSession({ config: PRODUCTION_LOGIN_CONFIG, authStore: PRODUCTION_AUTH_STORE });
      if (restored?.session) {
	        setSession(restored.session);
	        applySavedConfig(await store.get("config:v1", true));
	        setUsers(await loadUsers());
	        await reloadAll();
	      }
      return;
    }
    applySavedConfig(await store.get("config:v1", true));
    let us = await loadColl("user:");
    { // migrate legacy users that predate email/password login
      let migrated = false;
      for (const u of us) {
        if (u.role !== "tech" && u.role !== "worker" && !u.email) { u.email = u.role === "admin" ? "owner@example.local" : `user${String(u.id).slice(-4)}@example.local`; u.password = u.password || u.pin || "demo1234"; await store.set(`user:${u.id}`, JSON.stringify(u), true); migrated = true; }
        if (u.role === "tech" && !u.pin) { u.pin = "0000"; await store.set(`user:${u.id}`, JSON.stringify(u), true); migrated = true; }
        if (u.role === "worker" && !u.workerNo) { u.workerNo = (u.email === "worker@example.local") ? "1042" : String(u.id).slice(-4); u.pin = u.pin || u.password || "1234"; u.email = ""; u.password = ""; await store.set(`user:${u.id}`, JSON.stringify(u), true); migrated = true; }
      }
      if (migrated) us = await loadColl("user:");
    }
    if (SEED_POLICY.allowBuiltinDemoUsers) { // гарантируем наличие дефолтных учёток в demo/test בלבד
      const defaults = [
        { name: "ודים", role: "admin", email: "owner@example.local", password: "demo1234", pin: "", dept: "הנהלה" },
        { name: "מנהל מחלקה", role: "user", email: "manager@example.local", password: "demo1234", pin: "", dept: (DEFAULT_CONFIG.departments[0] || "שילוח") },
        { name: "טכנאי", role: "tech", email: "", password: "", pin: "1234", supplier: "", shiftEnd: "16:30", dept: "" },
        { name: "עובד מחסן", role: "worker", workerNo: "1042", pin: "1234", email: "", password: "", dept: (DEFAULT_CONFIG.departments[0] || "שילוח") },
        { name: "עובד ניקיון", role: "worker", workerNo: "1050", pin: "1234", email: "", password: "", dept: "ניקיון", depts: ["ניקיון"] },
      ];
      let added = false;
      for (const d of defaults) {
        const exists = d.role === "tech" ? us.some((u) => u.role === "tech" && (u.pin || "") === "1234") : d.role === "worker" ? us.some((u) => String(u.workerNo || "") === String(d.workerNo || "")) : us.some((u) => (u.email || "").toLowerCase() === d.email.toLowerCase());
        if (!exists) { const u = { id: uid(), active: true, createdAt: Date.now(), ...d }; await store.set(`user:${u.id}`, JSON.stringify(u), true); us.push(u); added = true; }
      }
      if (added) us = await loadColl("user:");
    }
    setUsers(us);
    // הצי אינו נטען אוטומטית: מצב ברירת המחדל ריק. הצי האמיתי (FLEET_SEED) נטען יחד עם «טען נתוני דמו».
    const s = await store.get("session:v1", false); if (s) try { const ss = JSON.parse(s); if (us.find((u) => u.id === ss.id && u.active)) setSession(ss); } catch {}
    await reloadAll();
    } catch (e) { console.error("init error", e); }
    finally { setReady(true); }
  })(); }, []);
  useEffect(() => {
    if (!session) return;
    const refresh = ({ force = false } = {}) => {
      const now = Date.now();
      if (!shouldRunDataRefresh({
        now,
        lastStartedAt: dataRefreshLastStartedAtRef.current,
        inFlight: dataRefreshInFlightRef.current,
        hidden: document.hidden,
        force
      })) return;
      dataRefreshInFlightRef.current = true;
      dataRefreshLastStartedAtRef.current = now;
      reloadAll()
        .catch(() => {})
        .finally(() => { dataRefreshInFlightRef.current = false; });
    };
    const onVisible = () => { if (!document.hidden) refresh({ force: true }); };
    const id = setInterval(refresh, DEFAULT_DATA_REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [session]);

  async function loadColl(prefix) {
    const records = typeof store.listValues === "function" ? await store.listValues(prefix, true) : null;
    if (Array.isArray(records)) {
      return parseCollRecords(records);
    }
    const keys = await store.list(prefix, true);
    const arr = await Promise.all(keys.map(async (k) => {
      const raw = await store.get(k, true);
      try { return JSON.parse(raw); } catch { return null; }
    }));
    return arr.filter(Boolean);
  }
	  const parseCollRecords = (records) => (records || []).map((record) => {
	    try { return JSON.parse(record.value); } catch { return null; }
	  }).filter(Boolean);
	  async function loadUsers() {
	    if (USER_MANAGEMENT_API_AUTHORITY) {
	      const response = await USER_MANAGEMENT_PROVIDER.list();
	      return Array.isArray(response?.users) ? response.users : [];
	    }
	    return loadColl("user:");
	  }
	  async function loadCollections(prefixes) {
    if (!prefixes.length) return [];
    if (typeof store.listManyValues === "function") {
      try {
        const grouped = await store.listManyValues(prefixes, true);
        if (grouped && prefixes.every((prefix) => Array.isArray(grouped[prefix]))) {
          return prefixes.map((prefix) => parseCollRecords(grouped[prefix]));
        }
      } catch {}
    }
    return Promise.all(prefixes.map((prefix) => loadColl(prefix)));
  }
  const recordAutomaticAppIssue = async ({ kind = "storage_save_failed", action = "", key = "", message = "" } = {}) => {
    const current = sessionRef.current || {};
    if (!current.id) return;
    const issueKey = `${kind}:${action}:${key || "unknown"}`;
    const now = Date.now();
    const last = automaticAppIssueKeysRef.current.get(issueKey) || 0;
    if (now - last < 5 * 60 * 1000) return;
    automaticAppIssueKeysRef.current.set(issueKey, now);
    const screenshotContext = appIssueScreenContext();
    const description = [
      "תקלה אוטומטית בשמירת נתונים.",
      action ? `פעולה: ${action}` : "",
      key ? `רשומה: ${key}` : "",
      message ? `פרטים: ${message}` : "",
    ].filter(Boolean).join("\n");
    let issue;
    try {
      issue = {
        ...createAppIssue({
          description,
          screenshotContext,
          session: current,
          location: screenshotContext.location || "",
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        }),
        source: "automatic_storage_failure",
        kind,
        storageAction: action,
        storageKey: key,
      };
    } catch {
      return;
    }
    let ok = false;
    if (NORMALIZED_SETTINGS_RECORDS_AUTHORITY) {
      try {
        if (typeof NORMALIZED_SETTINGS_RECORDS_PROVIDER.appIssues?.upsert === "function") {
          await NORMALIZED_SETTINGS_RECORDS_PROVIDER.appIssues.upsert(issue);
          ok = true;
        }
      } catch {}
    } else {
      ok = await store.set(`appIssue:${issue.id}`, JSON.stringify(issue), true);
    }
    if (ok) setAppIssues((items) => [issue, ...items.filter((item) => item.id !== issue.id)].sort((a, b) => b.at - a.at));
  };
  const persistShared = async (key, value, options = {}) => {
    const toastOnFail = options.toastOnFail !== false;
    if (!toastOnFail) quietSharedFailureKeysRef.current.add(key);
    const ok = await store.set(key, value, true).finally(() => {
      if (!toastOnFail) quietSharedFailureKeysRef.current.delete(key);
    });
    if (!ok && toastOnFail) {
      setToast("השמירה לא הושלמה — בדקו חיבור ונסו שוב");
      void recordAutomaticAppIssue({ kind: "storage_save_failed", action: "set", key, message: "Shared record save failed" });
    }
    return ok;
  };
  const persistSharedMany = async (records, options = {}) => {
    const toastOnFail = options.toastOnFail !== false;
    const keys = (records || []).map((record) => record.key).filter(Boolean);
    const failKey = keys.slice(0, 5).join(",");
    if (!toastOnFail) {
      keys.forEach((key) => quietSharedFailureKeysRef.current.add(key));
      if (failKey) quietSharedFailureKeysRef.current.add(failKey);
    }
    const ok = await store.setMany(records, true, { atomic: !!options.atomic, timeoutMs: options.timeoutMs }).finally(() => {
      if (!toastOnFail) {
        keys.forEach((key) => quietSharedFailureKeysRef.current.delete(key));
        if (failKey) quietSharedFailureKeysRef.current.delete(failKey);
      }
    });
    if (!ok && toastOnFail) {
      setToast("השמירה לא הושלמה — בדקו חיבור ונסו שוב");
      void recordAutomaticAppIssue({ kind: "storage_save_failed", action: "setMany", key: failKey || `${keys.length} records`, message: "Shared batch save failed" });
    }
    return ok;
  };
  const deleteShared = async (key, options = {}) => {
    const toastOnFail = options.toastOnFail !== false;
    const ok = await store.del(key, true);
    if (!ok && toastOnFail) {
      setToast("המחיקה לא הושלמה — בדקו חיבור ונסו שוב");
      void recordAutomaticAppIssue({ kind: "storage_delete_failed", action: "delete", key, message: "Shared record delete failed" });
    }
    return ok;
  };
  async function reloadAll() {
    const startupPrefixes = startupKvPrefixesForAuthorities({
      tickets: NORMALIZED_TICKET_AUTHORITY,
      pm: NORMALIZED_PM_AUTHORITY,
      fleet: NORMALIZED_FLEET_AUTHORITY,
      presence: NORMALIZED_PRESENCE_AUTHORITY,
      users: USER_MANAGEMENT_API_AUTHORITY,
      cleaningZones: NORMALIZED_CLEANING_ZONES_AUTHORITY,
      cleaningRounds: NORMALIZED_CLEANING_ROUNDS_AUTHORITY,
      cleaningComplaints: NORMALIZED_CLEANING_COMPLAINTS_AUTHORITY,
      workerAbsences: NORMALIZED_WORKER_ABSENCES_AUTHORITY,
      settingsRecords: NORMALIZED_SETTINGS_RECORDS_AUTHORITY,
      work: NORMALIZED_WORK_AUTHORITY,
      ppe: NORMALIZED_PPE_AUTHORITY
    });
    const loadedStartupCollections = await loadCollections(startupPrefixes);
    const kvCollections = Object.fromEntries(startupPrefixes.map((prefix, index) => [prefix, loadedStartupCollections[index] || []]));
    const kvRows = (prefix) => kvCollections[prefix] || [];
    const fallbackRows = async (prefix) => {
      if (Object.prototype.hasOwnProperty.call(kvCollections, prefix)) return kvRows(prefix);
      const rows = await loadColl(prefix);
      kvCollections[prefix] = rows;
      return rows;
    };
    const fallbackMany = async (prefixes) => Promise.all(prefixes.map((prefix) => fallbackRows(prefix)));
	    let ticketRows = kvRows(STARTUP_KV_PREFIXES.tickets);
	    let pmRows = kvRows(STARTUP_KV_PREFIXES.pm);
	    let fleetRows = kvRows(STARTUP_KV_PREFIXES.fleet);
	    let zoneRows = kvRows(STARTUP_KV_PREFIXES.cleaningZones);
	    let roundRows = kvRows(STARTUP_KV_PREFIXES.cleaningRounds);
	    let complaintRows = kvRows(STARTUP_KV_PREFIXES.cleaningComplaints);
	    let absenceRows = kvRows(STARTUP_KV_PREFIXES.workerAbsences);
	    let userRows = kvRows(STARTUP_KV_PREFIXES.users);
	    let ppeRows = kvRows(STARTUP_KV_PREFIXES.ppeMovements);
	    let ppeItemRows = kvRows(STARTUP_KV_PREFIXES.ppeItems);
	    let ppeNormRows = kvRows(STARTUP_KV_PREFIXES.ppeNorms);
	    let ppeRequestRows = kvRows(STARTUP_KV_PREFIXES.ppeRequests);
	    let ppeOrderRows = kvRows(STARTUP_KV_PREFIXES.ppeOrders);
	    let taskRows = kvRows(STARTUP_KV_PREFIXES.workTasks);
	    let meetingRows = kvRows(STARTUP_KV_PREFIXES.workMeetings);
	    let locationRows = kvRows(STARTUP_KV_PREFIXES.locations);
	    let appIssueRows = kvRows(STARTUP_KV_PREFIXES.appIssues);
	    let presenceRows = kvRows(STARTUP_KV_PREFIXES.presence);
    const normalizedLoads = [];
    if (NORMALIZED_TICKET_AUTHORITY) {
      normalizedLoads.push((async () => {
      try {
        const normalized = await ticketsForAuthority({
          kvTickets: [],
          provider: NORMALIZED_TICKET_PROVIDER,
          normalizedAuthority: true
        });
        ticketRows = normalized.tickets;
      } catch (error) {
        ticketRows = await fallbackRows(STARTUP_KV_PREFIXES.tickets);
        void recordAutomaticAppIssue(ticketAuthorityFailureIssue({
          action: "load",
          message: error?.message || "Normalized ticket API load failed"
        }));
      }
      })());
    }
    if (NORMALIZED_FLEET_AUTHORITY) {
      normalizedLoads.push((async () => {
      try {
        const normalizedFleet = await fleetForAuthority({
          kvFleet: [],
          provider: NORMALIZED_FLEET_PROVIDER,
          normalizedAuthority: true
        });
        fleetRows = normalizedFleet.fleet;
      } catch (error) {
        fleetRows = await fallbackRows(STARTUP_KV_PREFIXES.fleet);
        void recordAutomaticAppIssue(fleetAuthorityFailureIssue({
          action: "load",
          message: error?.message || "Normalized fleet API load failed"
        }));
      }
      })());
    }
	    if (NORMALIZED_PM_AUTHORITY) {
	      normalizedLoads.push((async () => {
	      try {
	        const normalizedPm = await pmForAuthority({
          kvPm: [],
          provider: NORMALIZED_PM_PROVIDER,
          normalizedAuthority: true
        });
        pmRows = normalizedPm.pm;
      } catch (error) {
        pmRows = await fallbackRows(STARTUP_KV_PREFIXES.pm);
        void recordAutomaticAppIssue(pmAuthorityFailureIssue({
          action: "load",
          message: error?.message || "Normalized PM API load failed"
	        }));
	      }
	      })());
	    }
	    if (NORMALIZED_CLEANING_ZONES_AUTHORITY) {
	      normalizedLoads.push((async () => {
	      try {
	        const normalizedCleaningZones = await cleaningZonesForAuthority({
          kvZones: [],
          provider: NORMALIZED_CLEANING_ZONES_PROVIDER,
          normalizedAuthority: true
        });
        zoneRows = normalizedCleaningZones.zones;
      } catch (error) {
        zoneRows = await fallbackRows(STARTUP_KV_PREFIXES.cleaningZones);
        void recordAutomaticAppIssue(cleaningZonesAuthorityFailureIssue({
          action: "load",
          message: error?.message || "Normalized cleaning zones API load failed"
        }));
	      }
	      })());
	    }
	    if (NORMALIZED_CLEANING_ROUNDS_AUTHORITY) {
	      normalizedLoads.push((async () => {
	      try {
	        const normalizedCleaningRounds = await cleaningRoundsForAuthority({
          kvRounds: [],
          provider: NORMALIZED_CLEANING_ROUNDS_PROVIDER,
          normalizedAuthority: true
        });
        roundRows = normalizedCleaningRounds.rounds;
      } catch (error) {
        roundRows = await fallbackRows(STARTUP_KV_PREFIXES.cleaningRounds);
        void recordAutomaticAppIssue(cleaningRoundsAuthorityFailureIssue({
          action: "load",
          message: error?.message || "Normalized cleaning rounds API load failed"
        }));
	      }
	      })());
	    }
	    if (NORMALIZED_CLEANING_COMPLAINTS_AUTHORITY) {
	      normalizedLoads.push((async () => {
	      try {
	        const normalizedCleaningComplaints = await cleaningComplaintsForAuthority({
          kvComplaints: [],
          provider: NORMALIZED_CLEANING_COMPLAINTS_PROVIDER,
          normalizedAuthority: true
        });
        complaintRows = normalizedCleaningComplaints.complaints;
      } catch (error) {
        complaintRows = await fallbackRows(STARTUP_KV_PREFIXES.cleaningComplaints);
        void recordAutomaticAppIssue(cleaningComplaintsAuthorityFailureIssue({
          action: "load",
          message: error?.message || "Normalized cleaning complaints API load failed"
        }));
	      }
	      })());
	    }
	    if (NORMALIZED_WORKER_ABSENCES_AUTHORITY) {
	      normalizedLoads.push((async () => {
	      try {
	        const normalizedWorkerAbsences = await workerAbsencesForAuthority({
          kvAbsences: [],
          provider: NORMALIZED_WORKER_ABSENCES_PROVIDER,
          normalizedAuthority: true
        });
        absenceRows = normalizedWorkerAbsences.absences;
      } catch (error) {
        absenceRows = await fallbackRows(STARTUP_KV_PREFIXES.workerAbsences);
        void recordAutomaticAppIssue(workerAbsencesAuthorityFailureIssue({
          action: "load",
          message: error?.message || "Normalized worker absences API load failed"
        }));
	      }
	      })());
	    }
	    if (USER_MANAGEMENT_API_AUTHORITY) {
	      normalizedLoads.push((async () => {
	      try {
	        userRows = await loadUsers();
	      } catch (error) {
	        userRows = await fallbackRows(STARTUP_KV_PREFIXES.users);
	        void recordAutomaticAppIssue({ kind: "users_api_load_failed", action: "load", key: "user:*", message: error?.message || "User-management API load failed" });
	      }
	      })());
	    }
	    if (NORMALIZED_PPE_AUTHORITY) {
	      normalizedLoads.push((async () => {
	      try {
	        const normalizedPpe = await ppeForAuthority({
          kvMovements: [],
          kvItems: [],
          kvNorms: [],
          kvRequests: [],
          kvOrders: [],
          provider: NORMALIZED_PPE_PROVIDER,
          normalizedAuthority: true
        });
        ppeRows = normalizedPpe.movements;
        ppeItemRows = normalizedPpe.items;
        ppeNormRows = normalizedPpe.norms;
        ppeRequestRows = normalizedPpe.requests;
        ppeOrderRows = normalizedPpe.orders;
      } catch (error) {
        [ppeRows, ppeItemRows, ppeNormRows, ppeRequestRows, ppeOrderRows] = await fallbackMany([
          STARTUP_KV_PREFIXES.ppeMovements,
          STARTUP_KV_PREFIXES.ppeItems,
          STARTUP_KV_PREFIXES.ppeNorms,
          STARTUP_KV_PREFIXES.ppeRequests,
          STARTUP_KV_PREFIXES.ppeOrders
        ]);
	        void recordAutomaticAppIssue(ppeAuthorityFailureIssue({
          action: "load",
          resource: "records",
          message: error?.message || "Normalized PPE API load failed"
        }));
	      }
	      })());
	    }
	    if (NORMALIZED_WORK_AUTHORITY) {
	      normalizedLoads.push((async () => {
	      try {
	        const normalizedWork = await workForAuthority({
          kvTasks: [],
          kvMeetings: [],
          provider: NORMALIZED_WORK_PROVIDER,
          normalizedAuthority: true
        });
        taskRows = normalizedWork.tasks;
        meetingRows = normalizedWork.meetings;
      } catch (error) {
        [taskRows, meetingRows] = await fallbackMany([
          STARTUP_KV_PREFIXES.workTasks,
          STARTUP_KV_PREFIXES.workMeetings
        ]);
        void recordAutomaticAppIssue(workAuthorityFailureIssue({
          action: "load",
          resource: "records",
          message: error?.message || "Normalized work API load failed"
        }));
	      }
	      })());
	    }
	    if (NORMALIZED_SETTINGS_RECORDS_AUTHORITY) {
	      normalizedLoads.push((async () => {
        const canLoadAppIssues = canManageSettings(sessionRef.current || {});
	      try {
	        const normalizedSettingsRecords = await settingsRecordsForAuthority({
          kvLocations: [],
          kvAppIssues: [],
          provider: canLoadAppIssues ? NORMALIZED_SETTINGS_RECORDS_PROVIDER : {
            ...NORMALIZED_SETTINGS_RECORDS_PROVIDER,
            appIssues: { list: async () => ({ ok: true, appIssues: [] }) }
          },
          normalizedAuthority: true
        });
        locationRows = normalizedSettingsRecords.locations;
        appIssueRows = canLoadAppIssues ? normalizedSettingsRecords.appIssues : [];
      } catch (error) {
        if (canLoadAppIssues) {
          [locationRows, appIssueRows] = await fallbackMany([
            STARTUP_KV_PREFIXES.locations,
            STARTUP_KV_PREFIXES.appIssues
          ]);
        } else {
          locationRows = await fallbackRows(STARTUP_KV_PREFIXES.locations);
          appIssueRows = [];
        }
        void recordAutomaticAppIssue(settingsRecordsAuthorityFailureIssue({
          action: "load",
          resource: "records",
          message: error?.message || "Normalized settings records API load failed"
        }));
	      }
	      })());
	    }
	    if (NORMALIZED_PRESENCE_AUTHORITY) {
	      normalizedLoads.push((async () => {
	      try {
	        const normalizedPresence = await presenceForAuthority({
          kvPresence: [],
          provider: NORMALIZED_PRESENCE_PROVIDER,
          normalizedAuthority: true
        });
        presenceRows = normalizedPresence.presence;
      } catch (error) {
        presenceRows = await fallbackRows(STARTUP_KV_PREFIXES.presence);
        void recordAutomaticAppIssue(presenceAuthorityFailureIssue({
          action: "load",
          message: error?.message || "Normalized presence API load failed"
        }));
	      }
	      })());
	    }
    await Promise.all(normalizedLoads);
    const apply = (key, arr, setter, sortFn) => {
      const data = sortFn ? [...arr].sort(sortFn) : arr;
      const sig = JSON.stringify(data);
      if (snapRef.current[key] !== sig) { snapRef.current[key] = sig; setter(data); }
    };
    apply("ticket", ticketRows, setTickets, (a, b) => b.createdAt - a.createdAt);
    apply("pm", pmRows, setPm, (a, b) => a.nextDue - b.nextDue);
    apply("fleet", fleetRows, setFleet, (a, b) => (a.code > b.code ? 1 : -1));
    apply("czone", zoneRows, setZones, zoneSort);
    apply("cround", roundRows, setRounds, (a, b) => b.at - a.at);
    apply("ccomplaint", complaintRows, setComplaints, (a, b) => b.at - a.at);
    apply("location", locationRows, setLocations, (a, b) => (a.name || "").localeCompare(b.name || "", "he"));
    apply("mtask", taskRows, setTasks, (a, b) => b.createdAt - a.createdAt);
    apply("mmeet", meetingRows, setMeetings, (a, b) => b.at - a.at);
    apply("ppe", ppeRows, setPpe, (a, b) => b.at - a.at);
    apply("ppeitem", ppeItemRows, setPpeItems, (a, b) => (a.name > b.name ? 1 : -1));
    apply("ppenorm", ppeNormRows, setPpeNorms, null);
    apply("ppereq", ppeRequestRows, setPpeReqs, (a, b) => b.at - a.at);
    apply("ppeorder", ppeOrderRows, setPpeOrders, (a, b) => b.createdAt - a.createdAt);
    apply("appIssue", appIssueRows, setAppIssues, (a, b) => (b.at || 0) - (a.at || 0));
    apply("cabsence", absenceRows, setAbsences, (a, b) => (a.from > b.from ? 1 : -1));
    // presence: мержим хранилище с текущим стейтом по свежести lastSeen — чтобы поллинг не затирал только что записанный статус при медленном/частичном хранилище
    setPresence((cur) => {
      const map = {};
      [...(cur || []), ...presenceRows].forEach((r) => { if (!r || !r.id) return; const ex = map[r.id]; if (!ex || (r.lastSeen || 0) >= (ex.lastSeen || 0)) map[r.id] = r; });
      const merged = Object.values(map);
      const sig = JSON.stringify(merged);
      if (snapRef.current.presence !== sig) { snapRef.current.presence = sig; return merged; }
      return cur;
    });
	    apply("user", userRows, setUsers, null);
	  }
  const pushTargetIds = (ids) => {
    const unique = [...new Set((ids || []).filter(Boolean).map(String))];
    const withoutActor = unique.filter((id) => id !== session?.id);
    return withoutActor.length ? withoutActor : unique;
  };
  const activeUserList = () => (users || []).filter((u) => u.active !== false && u.status !== "archived");
  const notifyPhone = (event) => {
    const targetUserIds = pushTargetIds(event.targetUserIds);
    if (!targetUserIds.length) return;
    sendPhoneNotification({ event: { ...event, targetUserIds } }).catch(() => {});
  };
  const ticketPhoneTargets = (ticket) => {
    const ids = [];
    const add = (id) => { if (id) ids.push(id); };
    activeUserList().forEach((u) => {
      if (u.role === "admin") add(u.id);
      else if (u.role === "tech" && transportTechnicianAssignee(ticket, fleet) && u.name === transportTechnicianAssignee(ticket, fleet)) add(u.id);
      else if (u.role === "tech" && !transportTechnicianAssignee(ticket, fleet) && u.supplier && ticket.supplier === u.supplier) add(u.id);
      else if (u.role === "user" && ticket.status === "pending_user" && canConfirmTicketForSession(u, ticket)) add(u.id);
      else if (u.role === "user" && ticket.status !== "pending_user" && visibleTickets(u, [ticket], fleet).length) add(u.id);
    });
    add(ticket.createdBy?.id);
    add(ticket.reportedBy?.id);
    return ids;
  };
  const notifyTicketPhone = (ticket, prevTicket) => {
    const targets = ticketPhoneTargets(ticket);
    if (!targets.length) return;
    const changedStatus = prevTicket && prevTicket.status !== ticket.status;
    const kind = !prevTicket ? "new" : ticket.status === "pending_admin" ? "ready" : ticket.status === "pending_user" ? "confirm" : "upd";
    const statusPart = changedStatus ? ` · ${stOf(ticket.status).label}` : "";
    notifyPhone({
      targetUserIds: targets,
      kind,
      title: !prevTicket ? `קריאה חדשה · #${ticketNo(ticket)}` : `עדכון קריאה · #${ticketNo(ticket)}`,
      body: `${ticket.subject || "קריאה"}${statusPart}`,
      url: "/",
      dedupeKey: `ticket-${ticket.id}-${ticket.updatedAt || ticket.createdAt || Date.now()}`
    });
  };
  const complaintPhoneTargets = (complaint) => {
    const ids = [];
    const add = (id) => { if (id) ids.push(id); };
    const zone = (zones || []).find((z) => z.id === complaint.zoneId);
    activeUserList().forEach((u) => {
      if (u.role === "admin") add(u.id);
      else if (canReceiveCleaningComplaints(u) && isZoneCleaner(zone, u.id)) add(u.id);
      else if (u.role === "user" && (u.mgrZones || []).includes(complaint.zoneId)) add(u.id);
    });
    return ids;
  };
  const notifyComplaintPhone = (complaint) => {
    const targets = complaintPhoneTargets(complaint);
    if (!targets.length) return;
    notifyPhone({
      targetUserIds: targets,
      kind: "cleaning",
      title: complaint.status === "pending" ? "דיווח ניקיון ממתין לאישור" : "דיווח ניקיון חדש",
      body: `${complaint.zoneName || "אזור ניקיון"}${complaint.text ? " · " + complaint.text : ""}`,
      url: "/",
      dedupeKey: `cleaning-${complaint.id}-${complaint.at || Date.now()}`
    });
  };
  const shadowWriteNormalizedTicket = async (ticket) => {
    if (!NORMALIZED_TICKET_SHADOW_WRITE) return;
    try {
      await NORMALIZED_TICKET_PROVIDER.upsert(ticket);
    } catch (error) {
      void recordAutomaticAppIssue({
        kind: "ticket_normalized_shadow_write_failed",
        action: "upsert",
        key: `ticket:${ticket?.id || "unknown"}`,
        message: error?.message || "Normalized ticket API write failed"
      });
    }
  };
  const shadowDeleteNormalizedTicket = async (id) => {
    if (!NORMALIZED_TICKET_SHADOW_WRITE) return;
    try {
      await NORMALIZED_TICKET_PROVIDER.delete(id);
    } catch (error) {
      void recordAutomaticAppIssue({
        kind: "ticket_normalized_shadow_delete_failed",
        action: "delete",
        key: `ticket:${id || "unknown"}`,
        message: error?.message || "Normalized ticket API delete failed"
      });
    }
  };
  const mirrorTicketToKv = async (ticket) => {
    const ok = await persistShared(`ticket:${ticket.id}`, JSON.stringify(ticket), { toastOnFail: false });
    if (!ok) void recordAutomaticAppIssue({
      kind: "ticket_kv_mirror_save_failed",
      action: "mirror-save",
      key: `ticket:${ticket?.id || "unknown"}`,
      message: "Compatibility KV ticket mirror save failed"
    });
  };
  const mirrorDeleteTicketFromKv = async (id) => {
    const ok = await deleteShared(`ticket:${id}`, { toastOnFail: false });
    if (!ok) void recordAutomaticAppIssue({
      kind: "ticket_kv_mirror_delete_failed",
      action: "mirror-delete",
      key: `ticket:${id || "unknown"}`,
      message: "Compatibility KV ticket mirror delete failed"
    });
  };
  const shadowWriteNormalizedPm = async (p) => {
    if (!NORMALIZED_PM_SHADOW_WRITE) return;
    try {
      await NORMALIZED_PM_PROVIDER.upsert(p);
    } catch (error) {
      void recordAutomaticAppIssue({
        kind: "pm_normalized_shadow_write_failed",
        action: "upsert",
        key: `pm:${p?.id || "unknown"}`,
        message: error?.message || "Normalized PM API write failed"
      });
    }
  };
  const shadowDeleteNormalizedPm = async (id) => {
    if (!NORMALIZED_PM_SHADOW_WRITE) return;
    try {
      await NORMALIZED_PM_PROVIDER.delete(id);
    } catch (error) {
      void recordAutomaticAppIssue({
        kind: "pm_normalized_shadow_delete_failed",
        action: "delete",
        key: `pm:${id || "unknown"}`,
        message: error?.message || "Normalized PM API delete failed"
      });
    }
  };
  const mirrorPmToKv = async (p) => {
    const ok = await persistShared(`pm:${p.id}`, JSON.stringify(p), { toastOnFail: false });
    if (!ok) void recordAutomaticAppIssue({
      kind: "pm_kv_mirror_save_failed",
      action: "mirror-save",
      key: `pm:${p?.id || "unknown"}`,
      message: "Compatibility KV PM mirror save failed"
    });
  };
  const mirrorPmManyToKv = async (tasks = []) => {
    const rows = (tasks || []).filter((p) => p?.id);
    if (!rows.length) return;
    const ok = await persistSharedMany(rows.map((p) => ({ key: `pm:${p.id}`, value: JSON.stringify(p) })), {
      toastOnFail: false,
      atomic: true,
      timeoutMs: 60000
    });
    if (!ok) void recordAutomaticAppIssue({
      kind: "pm_kv_mirror_save_failed",
      action: "mirror-save-many",
      key: `pm:${rows.length} records`,
      message: "Compatibility KV PM batch mirror save failed"
    });
  };
  const mirrorDeletePmFromKv = async (id) => {
    const ok = await deleteShared(`pm:${id}`, { toastOnFail: false });
    if (!ok) void recordAutomaticAppIssue({
      kind: "pm_kv_mirror_delete_failed",
      action: "mirror-delete",
      key: `pm:${id || "unknown"}`,
      message: "Compatibility KV PM mirror delete failed"
    });
  };
  const saveNormalizedPmTasks = async (tasks = [], action = "save") => {
    try {
      for (const task of tasks) await NORMALIZED_PM_PROVIDER.upsert(task);
      return true;
    } catch (error) {
      setToast(SAVE_FAILED_MESSAGE);
      void recordAutomaticAppIssue(pmAuthorityFailureIssue({
        action,
        message: error?.message || "Normalized PM API save failed"
      }));
      return false;
    }
  };
  const shadowWriteNormalizedFleet = async (f) => {
    if (!NORMALIZED_FLEET_SHADOW_WRITE) return;
    try {
      await NORMALIZED_FLEET_PROVIDER.upsert(f);
    } catch (error) {
      void recordAutomaticAppIssue({
        kind: "fleet_normalized_shadow_write_failed",
        action: "upsert",
        key: `fleet:${f?.id || "unknown"}`,
        message: error?.message || "Normalized fleet API write failed"
      });
    }
  };
  const shadowDeleteNormalizedFleet = async (id) => {
    if (!NORMALIZED_FLEET_SHADOW_WRITE) return;
    try {
      await NORMALIZED_FLEET_PROVIDER.delete(id);
    } catch (error) {
      void recordAutomaticAppIssue({
        kind: "fleet_normalized_shadow_delete_failed",
        action: "delete",
        key: `fleet:${id || "unknown"}`,
        message: error?.message || "Normalized fleet API delete failed"
      });
    }
  };
  const mirrorFleetToKv = async (f) => {
    const ok = await persistShared(`fleet:${f.id}`, JSON.stringify(f), { toastOnFail: false });
    if (!ok) void recordAutomaticAppIssue({
      kind: "fleet_kv_mirror_save_failed",
      action: "mirror-save",
      key: `fleet:${f?.id || "unknown"}`,
      message: "Compatibility KV fleet mirror save failed"
    });
  };
  const mirrorFleetManyToKv = async (units = []) => {
    const rows = (units || []).filter((f) => f?.id);
    if (!rows.length) return;
    const ok = await persistSharedMany(rows.map((f) => ({ key: `fleet:${f.id}`, value: JSON.stringify(f) })), {
      toastOnFail: false,
      atomic: true,
      timeoutMs: 60000
    });
    if (!ok) void recordAutomaticAppIssue({
      kind: "fleet_kv_mirror_save_failed",
      action: "mirror-save-many",
      key: `fleet:${rows.length} records`,
      message: "Compatibility KV fleet batch mirror save failed"
    });
  };
  const mirrorDeleteFleetFromKv = async (id) => {
    const ok = await deleteShared(`fleet:${id}`, { toastOnFail: false });
    if (!ok) void recordAutomaticAppIssue({
      kind: "fleet_kv_mirror_delete_failed",
      action: "mirror-delete",
      key: `fleet:${id || "unknown"}`,
      message: "Compatibility KV fleet mirror delete failed"
    });
  };
  const saveNormalizedFleetUnits = async (units = [], action = "save") => {
    try {
      for (const unit of units) await NORMALIZED_FLEET_PROVIDER.upsert(unit);
      return true;
    } catch (error) {
      setToast(SAVE_FAILED_MESSAGE);
      void recordAutomaticAppIssue(fleetAuthorityFailureIssue({
        action,
        message: error?.message || "Normalized fleet API save failed"
      }));
      return false;
    }
  };
  const shadowWriteNormalizedCleaningZone = async (z) => {
    if (!NORMALIZED_CLEANING_ZONES_SHADOW_WRITE) return;
    try {
      await NORMALIZED_CLEANING_ZONES_PROVIDER.upsert(z);
    } catch (error) {
      void recordAutomaticAppIssue({
        kind: "cleaning_zone_normalized_shadow_write_failed",
        action: "upsert",
        key: `czone:${z?.id || "unknown"}`,
        message: error?.message || "Normalized cleaning zones API write failed"
      });
    }
  };
  const shadowDeleteNormalizedCleaningZone = async (id) => {
    if (!NORMALIZED_CLEANING_ZONES_SHADOW_WRITE) return;
    try {
      await NORMALIZED_CLEANING_ZONES_PROVIDER.delete(id);
    } catch (error) {
      void recordAutomaticAppIssue({
        kind: "cleaning_zone_normalized_shadow_delete_failed",
        action: "delete",
        key: `czone:${id || "unknown"}`,
        message: error?.message || "Normalized cleaning zones API delete failed"
      });
    }
  };
  const mirrorCleaningZoneToKv = async (z) => {
    const ok = await persistShared(`czone:${z.id}`, JSON.stringify(z), { toastOnFail: false });
    if (!ok) void recordAutomaticAppIssue({
      kind: "cleaning_zone_kv_mirror_save_failed",
      action: "mirror-save",
      key: `czone:${z?.id || "unknown"}`,
      message: "Compatibility KV cleaning zone mirror save failed"
    });
  };
  const mirrorDeleteCleaningZoneFromKv = async (id) => {
    const ok = await deleteShared(`czone:${id}`, { toastOnFail: false });
    if (!ok) void recordAutomaticAppIssue({
      kind: "cleaning_zone_kv_mirror_delete_failed",
      action: "mirror-delete",
      key: `czone:${id || "unknown"}`,
      message: "Compatibility KV cleaning zone mirror delete failed"
    });
  };
  const shadowWriteNormalizedCleaningRound = async (round) => {
    if (!NORMALIZED_CLEANING_ROUNDS_SHADOW_WRITE) return;
    try {
      await NORMALIZED_CLEANING_ROUNDS_PROVIDER.upsert(round);
    } catch (error) {
      void recordAutomaticAppIssue({
        kind: "cleaning_round_normalized_shadow_write_failed",
        action: "upsert",
        key: `cround:${round?.id || "unknown"}`,
        message: error?.message || "Normalized cleaning rounds API write failed"
      });
    }
  };
  const mirrorCleaningRoundToKv = async (round) => {
    const ok = await persistShared(`cround:${round.id}`, JSON.stringify(round), { toastOnFail: false });
    if (!ok) void recordAutomaticAppIssue({
      kind: "cleaning_round_kv_mirror_save_failed",
      action: "mirror-save",
      key: `cround:${round?.id || "unknown"}`,
      message: "Compatibility KV cleaning round mirror save failed"
    });
  };
  const shadowWriteNormalizedCleaningComplaint = async (complaint) => {
    if (!NORMALIZED_CLEANING_COMPLAINTS_SHADOW_WRITE) return;
    try {
      await NORMALIZED_CLEANING_COMPLAINTS_PROVIDER.upsert(complaint);
    } catch (error) {
      void recordAutomaticAppIssue({
        kind: "cleaning_complaint_normalized_shadow_write_failed",
        action: "upsert",
        key: `ccomplaint:${complaint?.id || "unknown"}`,
        message: error?.message || "Normalized cleaning complaints API write failed"
      });
    }
  };
  const shadowDeleteNormalizedCleaningComplaint = async (id) => {
    if (!NORMALIZED_CLEANING_COMPLAINTS_SHADOW_WRITE) return;
    try {
      await NORMALIZED_CLEANING_COMPLAINTS_PROVIDER.delete(id);
    } catch (error) {
      void recordAutomaticAppIssue({
        kind: "cleaning_complaint_normalized_shadow_delete_failed",
        action: "delete",
        key: `ccomplaint:${id || "unknown"}`,
        message: error?.message || "Normalized cleaning complaints API delete failed"
      });
    }
  };
  const mirrorCleaningComplaintToKv = async (complaint) => {
    const ok = await persistShared(`ccomplaint:${complaint.id}`, JSON.stringify(complaint), { toastOnFail: false });
    if (!ok) void recordAutomaticAppIssue({
      kind: "cleaning_complaint_kv_mirror_save_failed",
      action: "mirror-save",
      key: `ccomplaint:${complaint?.id || "unknown"}`,
      message: "Compatibility KV cleaning complaint mirror save failed"
    });
  };
  const mirrorDeleteCleaningComplaintFromKv = async (id) => {
    const ok = await deleteShared(`ccomplaint:${id}`, { toastOnFail: false });
    if (!ok) void recordAutomaticAppIssue({
      kind: "cleaning_complaint_kv_mirror_delete_failed",
      action: "mirror-delete",
      key: `ccomplaint:${id || "unknown"}`,
      message: "Compatibility KV cleaning complaint mirror delete failed"
    });
  };
  const shadowWriteNormalizedWorkerAbsence = async (absence) => {
    if (!NORMALIZED_WORKER_ABSENCES_SHADOW_WRITE) return;
    try {
      await NORMALIZED_WORKER_ABSENCES_PROVIDER.upsert(absence);
    } catch (error) {
      void recordAutomaticAppIssue({
        kind: "worker_absence_normalized_shadow_write_failed",
        action: "upsert",
        key: `cabsence:${absence?.id || "unknown"}`,
        message: error?.message || "Normalized worker absences API write failed"
      });
    }
  };
  const shadowDeleteNormalizedWorkerAbsence = async (id) => {
    if (!NORMALIZED_WORKER_ABSENCES_SHADOW_WRITE) return;
    try {
      await NORMALIZED_WORKER_ABSENCES_PROVIDER.delete(id);
    } catch (error) {
      void recordAutomaticAppIssue({
        kind: "worker_absence_normalized_shadow_delete_failed",
        action: "delete",
        key: `cabsence:${id || "unknown"}`,
        message: error?.message || "Normalized worker absences API delete failed"
      });
    }
  };
  const mirrorWorkerAbsenceToKv = async (absence) => {
    const ok = await persistShared(`cabsence:${absence.id}`, JSON.stringify(absence), { toastOnFail: false });
    if (!ok) void recordAutomaticAppIssue({
      kind: "worker_absence_kv_mirror_save_failed",
      action: "mirror-save",
      key: `cabsence:${absence?.id || "unknown"}`,
      message: "Compatibility KV worker absence mirror save failed"
    });
  };
  const mirrorDeleteWorkerAbsenceFromKv = async (id) => {
    const ok = await deleteShared(`cabsence:${id}`, { toastOnFail: false });
    if (!ok) void recordAutomaticAppIssue({
      kind: "worker_absence_kv_mirror_delete_failed",
      action: "mirror-delete",
      key: `cabsence:${id || "unknown"}`,
      message: "Compatibility KV worker absence mirror delete failed"
    });
  };
  const ppeResourceProvider = (resource) => NORMALIZED_PPE_PROVIDER?.[resource] || null;
  const ppeKvPrefix = (resource) => ({
    movements: "ppe:",
    items: "ppeitem:",
    norms: "ppenorm:",
    requests: "ppereq:",
    orders: "ppeorder:"
  })[resource] || "ppe:";
  const shadowWriteNormalizedPpe = async (resource, record) => {
    if (!NORMALIZED_PPE_SHADOW_WRITE) return;
    try {
      await ppeResourceProvider(resource)?.upsert?.(record);
    } catch (error) {
      void recordAutomaticAppIssue({
        kind: `ppe_${resource}_normalized_shadow_write_failed`,
        action: "upsert",
        key: `${ppeKvPrefix(resource)}${record?.id || "unknown"}`,
        message: error?.message || "Normalized PPE API write failed"
      });
    }
  };
  const shadowDeleteNormalizedPpe = async (resource, id) => {
    if (!NORMALIZED_PPE_SHADOW_WRITE) return;
    try {
      await ppeResourceProvider(resource)?.delete?.(id);
    } catch (error) {
      void recordAutomaticAppIssue({
        kind: `ppe_${resource}_normalized_shadow_delete_failed`,
        action: "delete",
        key: `${ppeKvPrefix(resource)}${id || "unknown"}`,
        message: error?.message || "Normalized PPE API delete failed"
      });
    }
  };
  const mirrorPpeToKv = async (resource, record) => {
    const key = `${ppeKvPrefix(resource)}${record.id}`;
    const ok = await persistShared(key, JSON.stringify(record), { toastOnFail: false });
    if (!ok) void recordAutomaticAppIssue({
      kind: `ppe_${resource}_kv_mirror_save_failed`,
      action: "mirror-save",
      key,
      message: "Compatibility KV PPE mirror save failed"
    });
  };
  const mirrorDeletePpeFromKv = async (resource, id) => {
    const key = `${ppeKvPrefix(resource)}${id}`;
    const ok = await deleteShared(key, { toastOnFail: false });
    if (!ok) void recordAutomaticAppIssue({
      kind: `ppe_${resource}_kv_mirror_delete_failed`,
      action: "mirror-delete",
      key,
      message: "Compatibility KV PPE mirror delete failed"
    });
  };
  const savePpeResource = async (resource, record, { setState, sortFn } = {}) => {
    const key = `${ppeKvPrefix(resource)}${record.id}`;
    if (NORMALIZED_PPE_AUTHORITY) {
      try {
        await ppeResourceProvider(resource)?.upsert?.(record);
      } catch (error) {
        setToast(SAVE_FAILED_MESSAGE);
        void recordAutomaticAppIssue(ppeAuthorityFailureIssue({
          action: "save",
          resource,
          id: record.id,
          message: error?.message || "Normalized PPE API save failed"
        }));
        return false;
      }
    } else {
      if (!await persistShared(key, JSON.stringify(record))) return false;
      void shadowWriteNormalizedPpe(resource, record);
    }
    setState((s) => {
      const rows = [record, ...s.filter((item) => item.id !== record.id)];
      return sortFn ? rows.sort(sortFn) : rows;
    });
    return true;
  };
  const deletePpeResource = async (resource, id, setState) => {
    const key = `${ppeKvPrefix(resource)}${id}`;
    if (NORMALIZED_PPE_AUTHORITY) {
      try {
        await ppeResourceProvider(resource)?.delete?.(id);
      } catch (error) {
        setToast("המחיקה לא הושלמה — בדקו חיבור ונסו שוב");
        void recordAutomaticAppIssue(ppeAuthorityFailureIssue({
          action: "delete",
          resource,
          id,
          message: error?.message || "Normalized PPE API delete failed"
        }));
        return false;
      }
    } else {
      if (!await deleteShared(key)) return false;
      void shadowDeleteNormalizedPpe(resource, id);
    }
    setState((s) => s.filter((item) => item.id !== id));
    return true;
  };
  const workResourceProvider = (resource) => NORMALIZED_WORK_PROVIDER?.[resource] || null;
  const workKvPrefix = (resource) => ({ tasks: "mtask:", meetings: "mmeet:" })[resource] || "mtask:";
  const shadowWriteNormalizedWork = async (resource, record) => {
    if (!NORMALIZED_WORK_SHADOW_WRITE) return;
    try {
      await workResourceProvider(resource)?.upsert?.(record);
    } catch (error) {
      void recordAutomaticAppIssue({
        kind: `work_${resource}_normalized_shadow_write_failed`,
        action: "upsert",
        key: `${workKvPrefix(resource)}${record?.id || "unknown"}`,
        message: error?.message || "Normalized work API write failed"
      });
    }
  };
  const shadowDeleteNormalizedWork = async (resource, id) => {
    if (!NORMALIZED_WORK_SHADOW_WRITE) return;
    try {
      await workResourceProvider(resource)?.delete?.(id);
    } catch (error) {
      void recordAutomaticAppIssue({
        kind: `work_${resource}_normalized_shadow_delete_failed`,
        action: "delete",
        key: `${workKvPrefix(resource)}${id || "unknown"}`,
        message: error?.message || "Normalized work API delete failed"
      });
    }
  };
  const saveWorkResource = async (resource, record, { setState, sortFn } = {}) => {
    const key = `${workKvPrefix(resource)}${record.id}`;
    if (NORMALIZED_WORK_AUTHORITY) {
      try {
        await workResourceProvider(resource)?.upsert?.(record);
      } catch (error) {
        setToast(SAVE_FAILED_MESSAGE);
        void recordAutomaticAppIssue(workAuthorityFailureIssue({
          action: "save",
          resource,
          id: record.id,
          message: error?.message || "Normalized work API save failed"
        }));
        return false;
      }
    } else {
      if (!await persistShared(key, JSON.stringify(record))) return false;
      void shadowWriteNormalizedWork(resource, record);
    }
    setState((s) => {
      const rows = [record, ...s.filter((item) => item.id !== record.id)];
      return sortFn ? rows.sort(sortFn) : rows;
    });
    return true;
  };
  const deleteWorkResource = async (resource, id, setState) => {
    const key = `${workKvPrefix(resource)}${id}`;
    if (NORMALIZED_WORK_AUTHORITY) {
      try {
        await workResourceProvider(resource)?.delete?.(id);
      } catch (error) {
        setToast("המחיקה לא הושלמה — בדקו חיבור ונסו שוב");
        void recordAutomaticAppIssue(workAuthorityFailureIssue({
          action: "delete",
          resource,
          id,
          message: error?.message || "Normalized work API delete failed"
        }));
        return false;
      }
    } else {
      if (!await deleteShared(key)) return false;
      void shadowDeleteNormalizedWork(resource, id);
    }
    setState((s) => s.filter((item) => item.id !== id));
    return true;
  };
  const saveTicket = async (t) => {
    let rec = t;
    const _prev = tickets.find((x) => x.id === rec.id), _now = Date.now();
    rec = normalizeTransportCreateResponsibility(rec, _prev);
    rec = applyTicketStatusTiming(rec, _prev, _now);
    if (!rec.num && !NORMALIZED_TICKET_AUTHORITY) { const letter = tkLetter(rec); const sameType = tickets.filter((x) => tkLetter(x) === letter && x.num); const max = sameType.reduce((m, x) => Math.max(m, x.num), 0); rec = { ...rec, num: max + 1 }; }
    if (NORMALIZED_TICKET_AUTHORITY) {
      try {
        const result = await (_prev ? NORMALIZED_TICKET_PROVIDER.update || NORMALIZED_TICKET_PROVIDER.upsert : NORMALIZED_TICKET_PROVIDER.create || NORMALIZED_TICKET_PROVIDER.upsert)(rec);
        if (result?.ticket && typeof result.ticket === "object") rec = result.ticket;
      } catch (error) {
        setToast(SAVE_FAILED_MESSAGE);
        void recordAutomaticAppIssue(ticketAuthorityFailureIssue({
          action: "save",
          id: rec.id,
          message: error?.message || "Normalized ticket API save failed"
        }));
        return false;
      }
    } else {
      if (!await persistShared(`ticket:${rec.id}`, JSON.stringify(rec))) return false;
      void shadowWriteNormalizedTicket(rec);
    }
    setTickets((p) => [rec, ...p.filter((x) => x.id !== rec.id)].sort((a, b) => b.createdAt - a.createdAt));
    notifyTicketPhone(rec, _prev);
    return true;
  };
  const savePm = async (p) => {
    if (NORMALIZED_PM_AUTHORITY) {
      try {
        await NORMALIZED_PM_PROVIDER.upsert(p);
      } catch (error) {
        setToast(SAVE_FAILED_MESSAGE);
        void recordAutomaticAppIssue(pmAuthorityFailureIssue({
          action: "save",
          id: p.id,
          message: error?.message || "Normalized PM API save failed"
        }));
        return false;
      }
    } else {
      if (!await persistShared(`pm:${p.id}`, JSON.stringify(p))) return false;
      void shadowWriteNormalizedPm(p);
    }
    setPm((s) => [...s.filter((x) => x.id !== p.id), p].sort((a, b) => a.nextDue - b.nextDue));
    return true;
  };
  const savePmMany = async (items, options = {}) => {
    const tasks = (items || []).filter((p) => p?.id);
    if (!tasks.length) return true;
    if (NORMALIZED_PM_AUTHORITY) {
      if (!await saveNormalizedPmTasks(tasks, "save-many")) return false;
    } else {
      const ok = await persistSharedMany(tasks.map((p) => ({ key: `pm:${p.id}`, value: JSON.stringify(p) })), { ...options, atomic: true, timeoutMs: 60000 });
      if (!ok) return false;
      tasks.forEach((task) => void shadowWriteNormalizedPm(task));
    }
    setPm((s) => {
      const ids = new Set(tasks.map((p) => p.id));
      return [...s.filter((x) => !ids.has(x.id)), ...tasks].sort((a, b) => a.nextDue - b.nextDue);
    });
    return true;
  };
  const delPm = async (id) => {
    if (NORMALIZED_PM_AUTHORITY) {
      try {
        await NORMALIZED_PM_PROVIDER.delete(id);
      } catch (error) {
        setToast("המחיקה לא הושלמה — בדקו חיבור ונסו שוב");
        void recordAutomaticAppIssue(pmAuthorityFailureIssue({
          action: "delete",
          id,
          message: error?.message || "Normalized PM API delete failed"
        }));
        return false;
      }
    } else {
      if (!await deleteShared(`pm:${id}`)) return false;
      void shadowDeleteNormalizedPm(id);
    }
    setPm((s) => s.filter((x) => x.id !== id));
    return true;
  };
  const delPmMany = async (ids = []) => {
    const cleanIds = [...new Set((ids || []).filter(Boolean))];
    if (!cleanIds.length) return true;
    for (const id of cleanIds) {
      if (!await delPm(id)) return false;
    }
    return true;
  };
  const delTicket = async (id) => {
    if (NORMALIZED_TICKET_AUTHORITY) {
      try {
        await NORMALIZED_TICKET_PROVIDER.delete(id);
      } catch (error) {
        setToast("המחיקה לא הושלמה — בדקו חיבור ונסו שוב");
        void recordAutomaticAppIssue(ticketAuthorityFailureIssue({
          action: "delete",
          id,
          message: error?.message || "Normalized ticket API delete failed"
        }));
        return false;
      }
    } else {
      if (!await deleteShared(`ticket:${id}`)) return false;
      void shadowDeleteNormalizedTicket(id);
    }
    try { await TICKET_PHOTOS.remove(tickets.find((x) => x.id === id) || id); } catch {}
    setTickets((s) => s.filter((x) => x.id !== id));
    return true;
  };
  const saveFleet = async (f, options = {}) => {
    if (NORMALIZED_FLEET_AUTHORITY) {
      try {
        await NORMALIZED_FLEET_PROVIDER.upsert(f);
      } catch (error) {
        setToast(SAVE_FAILED_MESSAGE);
        void recordAutomaticAppIssue(fleetAuthorityFailureIssue({
          action: "save",
          id: f.id,
          message: error?.message || "Normalized fleet API save failed"
        }));
        return false;
      }
    } else {
      if (!await persistShared(`fleet:${f.id}`, JSON.stringify(f), options)) return false;
      void shadowWriteNormalizedFleet(f);
    }
    setFleet((s) => [...s.filter((x) => x.id !== f.id), f].sort((a, b) => (a.code > b.code ? 1 : -1)));
    return true;
  };
  const saveFleetMany = async (items, options = {}) => {
    const units = (items || []).filter((f) => f?.id);
    if (!units.length) return true;
    if (NORMALIZED_FLEET_AUTHORITY) {
      if (!await saveNormalizedFleetUnits(units, "save-many")) return false;
    } else {
      const ok = await persistSharedMany(units.map((f) => ({ key: `fleet:${f.id}`, value: JSON.stringify(f) })), options);
      if (!ok) return false;
      units.forEach((unit) => void shadowWriteNormalizedFleet(unit));
    }
    setFleet((s) => {
      const ids = new Set(units.map((f) => f.id));
      return [...s.filter((x) => !ids.has(x.id)), ...units].sort((a, b) => (a.code > b.code ? 1 : -1));
    });
    return true;
  };
  const saveFleetImportBatch = async (items, catalogAdditions = [], options = {}) => {
    const units = (items || []).filter((f) => f?.id);
    if (!units.length) return true;
    const mergedConfig = catalogAdditions?.length ? mergeFleetCatalogAdditions(config, fleet, catalogAdditions) : config;
    if (NORMALIZED_FLEET_AUTHORITY) {
      if (catalogAdditions?.length && !await persistShared("config:v1", JSON.stringify(mergedConfig), options)) return false;
      if (!await saveNormalizedFleetUnits(units, "import")) return false;
      setFleet((s) => {
        const ids = new Set(units.map((f) => f.id));
        return [...s.filter((x) => !ids.has(x.id)), ...units].sort((a, b) => (a.code > b.code ? 1 : -1));
      });
      if (catalogAdditions?.length) setConfig(mergedConfig);
      return true;
    }
    const records = units.map((f) => ({ key: `fleet:${f.id}`, value: JSON.stringify(f) }));
    if (catalogAdditions?.length) records.push({ key: "config:v1", value: JSON.stringify(mergedConfig) });
    const ok = await persistSharedMany(records, { ...options, atomic: true, timeoutMs: 60000 });
    if (!ok) return false;
    units.forEach((unit) => void shadowWriteNormalizedFleet(unit));
    setFleet((s) => {
      const ids = new Set(units.map((f) => f.id));
      return [...s.filter((x) => !ids.has(x.id)), ...units].sort((a, b) => (a.code > b.code ? 1 : -1));
    });
    if (catalogAdditions?.length) setConfig(mergedConfig);
    return true;
  };
  const saveZone = async (z) => {
    if (NORMALIZED_CLEANING_ZONES_AUTHORITY) {
      try {
        await NORMALIZED_CLEANING_ZONES_PROVIDER.upsert(z);
      } catch (error) {
        setToast(SAVE_FAILED_MESSAGE);
        void recordAutomaticAppIssue(cleaningZonesAuthorityFailureIssue({
          action: "save",
          id: z.id,
          message: error?.message || "Normalized cleaning zones API save failed"
        }));
        return false;
      }
    } else {
      if (!await persistShared(`czone:${z.id}`, JSON.stringify(z))) return false;
      void shadowWriteNormalizedCleaningZone(z);
    }
    setZones((s) => [...s.filter((x) => x.id !== z.id), z].sort(zoneSort));
    return true;
  };
  const delZone = async (id) => {
    const plan = cleaningZoneDeletePlan(id, { rounds, complaints, users });
    if (!plan.zoneId) return false;
    const linked = cleaningZoneDeleteBlockers(plan.zoneId, { rounds, complaints, users });
    for (const manager of plan.updatedManagers) {
      if (!await saveUser(manager)) return false;
    }
    if (NORMALIZED_CLEANING_ZONES_AUTHORITY) {
      try {
        await NORMALIZED_CLEANING_ZONES_PROVIDER.delete(plan.zoneId);
      } catch (error) {
        setToast(SAVE_FAILED_MESSAGE);
        void recordAutomaticAppIssue(cleaningZonesAuthorityFailureIssue({
          action: "delete",
          id: plan.zoneId,
          message: error?.message || "Normalized cleaning zones API delete failed"
        }));
        return false;
      }
    } else {
      void shadowDeleteNormalizedCleaningZone(plan.zoneId);
    }
    for (const key of plan.deleteKeys) {
      if (NORMALIZED_CLEANING_ZONES_AUTHORITY && key === `czone:${plan.zoneId}`) continue;
      if (!await deleteShared(key)) return false;
    }
    for (const record of [...(linked.rounds || []), ...(linked.complaints || [])]) {
      await CLEANING_PHOTOS.removeRecord(record);
    }
    const zoneId = String(plan.zoneId).trim();
    const belongsToZone = (record) => String(record?.zoneId || "").trim() === zoneId;
    setZones((s) => s.filter((x) => x.id !== plan.zoneId));
    setRounds((s) => s.filter((x) => !belongsToZone(x)));
    setComplaints((s) => s.filter((x) => !belongsToZone(x)));
    return true;
  };
  const saveRound = async (r) => {
    const rec = await CLEANING_PHOTOS.saveRound(r);
    if (NORMALIZED_CLEANING_ROUNDS_AUTHORITY) {
      try {
        await NORMALIZED_CLEANING_ROUNDS_PROVIDER.upsert(rec);
      } catch (error) {
        setToast(SAVE_FAILED_MESSAGE);
        void recordAutomaticAppIssue(cleaningRoundsAuthorityFailureIssue({
          action: "save",
          id: rec.id,
          message: error?.message || "Normalized cleaning rounds API save failed"
        }));
        return false;
      }
    } else {
      if (!await persistShared(`cround:${rec.id}`, JSON.stringify(rec))) return false;
      void shadowWriteNormalizedCleaningRound(rec);
    }
    setRounds((s) => [...s.filter((x) => x.id !== rec.id), rec].sort((a, b) => b.at - a.at));
    return true;
  };
  const saveAbsence = async (a) => {
    if (NORMALIZED_WORKER_ABSENCES_AUTHORITY) {
      try {
        await NORMALIZED_WORKER_ABSENCES_PROVIDER.upsert(a);
      } catch (error) {
        setToast(SAVE_FAILED_MESSAGE);
        void recordAutomaticAppIssue(workerAbsencesAuthorityFailureIssue({
          action: "save",
          id: a.id,
          message: error?.message || "Normalized worker absences API save failed"
        }));
        return false;
      }
    } else {
      if (!await persistShared(`cabsence:${a.id}`, JSON.stringify(a))) return false;
      void shadowWriteNormalizedWorkerAbsence(a);
    }
    setAbsences((s) => [...s.filter((x) => x.id !== a.id), a].sort((x, y) => (x.from > y.from ? 1 : -1)));
    return true;
  };
  const delAbsence = async (id) => {
    if (NORMALIZED_WORKER_ABSENCES_AUTHORITY) {
      try {
        await NORMALIZED_WORKER_ABSENCES_PROVIDER.delete(id);
      } catch (error) {
        setToast("המחיקה לא הושלמה — בדקו חיבור ונסו שוב");
        void recordAutomaticAppIssue(workerAbsencesAuthorityFailureIssue({
          action: "delete",
          id,
          message: error?.message || "Normalized worker absences API delete failed"
        }));
        return false;
      }
    } else {
      if (!await deleteShared(`cabsence:${id}`)) return false;
      void shadowDeleteNormalizedWorkerAbsence(id);
    }
    setAbsences((s) => s.filter((x) => x.id !== id));
    return true;
  };
  const spawnFacilityFromComplaint = async (c) => {
    const tid = uid(), now = Date.now(); const cat = (config.categories || [])[0];
    const complaintPhoto = c.photo || await CLEANING_PHOTOS.load(c);
    const t = { id: tid, track: "facility", subject: (c.text || "").trim() || ("תקלה · " + c.zoneName), category: cat?.id || "", categoryLabel: cat?.label || "", priority: "medium", zone: c.zoneLoc || c.zoneName, asset: c.zoneName || "", forkliftId: null, downtimeType: null, wearType: null, downtimeStart: null, downtimeEnd: null, description: `נפתח מדיווח על תקלה באזור ניקיון «${c.zoneName}»${c.zoneLoc ? " · " + c.zoneLoc : ""}.${c.text ? "\n" + c.text.trim() : ""}`, status: "new", assignee: "", routedTech: false, createdBy: { id: c.reportedById, name: c.reportedByName, role: c.reportedByRole === "anonymous" ? "user" : (c.reportedByRole || "user"), dept: "" }, createdAt: now, updatedAt: now, dueAt: now + 48 * 3600000, hasPhoto: !!complaintPhoto, closure: null, log: [{ at: now, by: c.reportedByName, byRole: c.reportedByRole || "user", text: "נפתח מדיווח על תקלה באזור ניקיון" }] };
    const rec = complaintPhoto ? { ...t, ...(await TICKET_PHOTOS.save(tid, "before", complaintPhoto)) } : t;
    const ok = await saveTicket(rec);
    return ok ? tid : null;
  };
  const persistComplaint = async (comp) => {
    if (NORMALIZED_CLEANING_COMPLAINTS_AUTHORITY) {
      try {
        await NORMALIZED_CLEANING_COMPLAINTS_PROVIDER.upsert(comp);
      } catch (error) {
        setToast(SAVE_FAILED_MESSAGE);
        void recordAutomaticAppIssue(cleaningComplaintsAuthorityFailureIssue({
          action: "save",
          id: comp.id,
          message: error?.message || "Normalized cleaning complaints API save failed"
        }));
        return false;
      }
    } else {
      if (!await persistShared(`ccomplaint:${comp.id}`, JSON.stringify(comp))) return false;
      void shadowWriteNormalizedCleaningComplaint(comp);
    }
    setComplaints((s) => [...s.filter((x) => x.id !== comp.id), comp].sort((a, b) => b.at - a.at));
    return true;
  };
  const fileComplaint = async (c) => {
    const trusted = c.reportedByRole === "admin" || c.reportedByRole === "user";
    const ownerRole = c.reportedByRole === "cleaner" ? "admin" : "cleaner"; // מי אחראי לסגור: דיווח מעובד ניקיון ⇒ אצל המנהל/מערכת, לא חוזר אליו
    const status = trusted ? "open" : "pending";
    const base = { ...c, id: c.id || uid(), at: c.at || Date.now() };
    let ticketId = null;
    if (base.kind === "broken" && status === "open") ticketId = await spawnFacilityFromComplaint(base);
    const stored = await CLEANING_PHOTOS.saveComplaint(base);
    const rec = { ...stored, status, ownerRole, verified: trusted, ticketId, demo: false };
    const ok = await persistComplaint(rec);
    if (ok) notifyComplaintPhone(rec);
    return ok;
  };
  const submitAnonymousComplaint = async (c) => {
    if (APP_MODE === APP_MODES.production) {
      return PUBLIC_COMPLAINTS.submit(c);
    }
    return fileComplaint(c);
  };
  const approveComplaint = async (c) => {
    let ticketId = c.ticketId || null;
    if (c.kind === "broken" && !ticketId) ticketId = await spawnFacilityFromComplaint(c);
    return persistComplaint({ ...c, status: "open", verified: true, ticketId, approvedBy: effSession.name, approvedAt: Date.now() });
  };
  const rejectComplaint = async (c) => persistComplaint({ ...c, status: "rejected", resolvedAt: Date.now(), resolvedBy: effSession.name });
  const escalateComplaint = async (c) => persistComplaint({ ...c, status: "open", escalatedTo: "admin", escalatedAt: Date.now(), escalatedBy: effSession.name });
  const resolveComplaint = async (c) => persistComplaint({ ...c, status: "resolved", resolvedAt: Date.now(), resolvedBy: effSession.name });
  const progressComplaint = async (c) => persistComplaint({ ...c, status: "open", progress: "in_progress", progressNote: (c.progressNote || "").trim(), progressBy: effSession.name, progressAt: Date.now() });
  const delComplaint = async (id) => {
    if (NORMALIZED_CLEANING_COMPLAINTS_AUTHORITY) {
      try {
        await NORMALIZED_CLEANING_COMPLAINTS_PROVIDER.delete(id);
      } catch (error) {
        setToast("המחיקה לא הושלמה — בדקו חיבור ונסו שוב");
        void recordAutomaticAppIssue(cleaningComplaintsAuthorityFailureIssue({
          action: "delete",
          id,
          message: error?.message || "Normalized cleaning complaints API delete failed"
        }));
        return false;
      }
    } else {
      if (!await deleteShared(`ccomplaint:${id}`)) return false;
      void shadowDeleteNormalizedCleaningComplaint(id);
    }
    setComplaints((s) => s.filter((x) => x.id !== id));
    return true;
  };
  const delFleet = async (id, options = {}) => {
    if (NORMALIZED_FLEET_AUTHORITY) {
      try {
        await NORMALIZED_FLEET_PROVIDER.delete(id);
      } catch (error) {
        setToast("המחיקה לא הושלמה — בדקו חיבור ונסו שוב");
        void recordAutomaticAppIssue(fleetAuthorityFailureIssue({
          action: "delete",
          id,
          message: error?.message || "Normalized fleet API delete failed"
        }));
        return false;
      }
    } else {
      if (!await deleteShared(`fleet:${id}`, options)) return false;
      void shadowDeleteNormalizedFleet(id);
    }
    setFleet((s) => s.filter((x) => x.id !== id));
    return true;
  };
  const syncAdminProfileUser = async (u) => {
    if (!u?.authUserId) return;
    const accessToken = PRODUCTION_AUTH_STORE.get()?.accessToken || "";
    const patch = {
      name: u.name || "",
      role: u.role || "user",
      active: u.active !== false,
      email: u.email || "",
      phone: u.phone || "",
      department: u.dept || "",
      departments: Array.isArray(u.depts) ? u.depts : (u.dept ? [u.dept] : []),
      permissions: u.perms || u.permissions || {},
      manager_zones: Array.isArray(u.mgrZones) ? u.mgrZones : [],
      tech_scope: u.techScope || "",
      supplier: u.supplier || ""
    };
    const response = await fetch("/api/session/admin-profile", {
      method: "PATCH",
      credentials: "include",
      headers: {
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
        "content-type": "application/json"
      },
      body: JSON.stringify({ authUserId: u.authUserId, patch })
    });
	    if (!response.ok) {
	      const data = await response.json().catch(() => ({}));
	      throw new Error(data?.error || `admin_profile_sync_${response.status}`);
	    }
	  };
	  const saveUser = async (u) => {
	    const requestedId = u.id;
	    if (!USER_MANAGEMENT_API_AUTHORITY) {
	      try {
	        await syncAdminProfileUser(u);
	      } catch (error) {
	        console.warn("admin profile sync failed", error);
	        return false;
	      }
	    }
	    if (USER_MANAGEMENT_API_AUTHORITY) {
	      try {
	        const result = await USER_MANAGEMENT_PROVIDER.upsert(u);
	        u = result?.user || u;
	      } catch (error) {
	        setToast("השמירה לא הושלמה — בדקו חיבור ונסו שוב");
	        void recordAutomaticAppIssue({ kind: "users_api_save_failed", action: "upsert", key: `user:${u.id}`, message: error?.message || "User-management API save failed" });
	        return false;
	      }
	    } else if (!await persistShared(`user:${u.id}`, JSON.stringify(u))) return false;
	    setUsers((s) => [...s.filter((x) => x.id !== requestedId && x.id !== u.id), u]);
	    return u;
	  };
	  const delUser = async (id) => {
	    if (USER_MANAGEMENT_API_AUTHORITY) {
	      try {
	        await USER_MANAGEMENT_PROVIDER.delete(id);
	      } catch (error) {
	        setToast("המחיקה לא הושלמה — בדקו חיבור ונסו שוב");
	        void recordAutomaticAppIssue({ kind: "users_api_delete_failed", action: "delete", key: `user:${id}`, message: error?.message || "User-management API delete failed" });
	        return false;
	      }
	    } else if (!await deleteShared(`user:${id}`)) return false;
	    setUsers((s) => s.filter((x) => x.id !== id));
	    return true;
	  };
  const saveConfig = async (n, options = {}) => { if (!await persistShared("config:v1", JSON.stringify(n), options)) return false; setConfig(n); return true; };
  const saveTask = async (t) => {
    const task = normalizeTaskActionRecord(t);
    return saveWorkResource("tasks", task, { setState: setTasks, sortFn: (a, b) => b.createdAt - a.createdAt });
  };
  const delTask = async (id) => deleteWorkResource("tasks", id, setTasks);
  const saveMeeting = async (m) => saveWorkResource("meetings", m, { setState: setMeetings, sortFn: (a, b) => b.at - a.at });
  const delMeeting = async (id) => deleteWorkResource("meetings", id, setMeetings);
  const savePpeItem = async (x) => savePpeResource("items", x, { setState: setPpeItems, sortFn: (a, b) => (a.name > b.name ? 1 : -1) });
  const delPpeItem = async (id) => deletePpeResource("items", id, setPpeItems);
  const savePpe = async (x) => savePpeResource("movements", x, { setState: setPpe, sortFn: (a, b) => b.at - a.at });
  const delPpe = async (id) => deletePpeResource("movements", id, setPpe);
  const saveNorm = async (x) => savePpeResource("norms", x, { setState: setPpeNorms });
  const delNorm = async (id) => deletePpeResource("norms", id, setPpeNorms);
  const savePpeReq = async (x) => savePpeResource("requests", x, { setState: setPpeReqs, sortFn: (a, b) => b.at - a.at });
  const delPpeReq = async (id) => deletePpeResource("requests", id, setPpeReqs);
  const savePpeOrder = async (x) => savePpeResource("orders", x, { setState: setPpeOrders, sortFn: (a, b) => b.createdAt - a.createdAt });
  const delPpeOrder = async (id) => deletePpeResource("orders", id, setPpeOrders);
  const shadowWriteNormalizedAppIssue = async (issue) => {
    if (!NORMALIZED_SETTINGS_RECORDS_SHADOW_WRITE) return;
    try {
      await NORMALIZED_SETTINGS_RECORDS_PROVIDER.appIssues?.upsert?.(issue);
    } catch (error) {
      void recordAutomaticAppIssue(settingsRecordsAuthorityFailureIssue({
        action: "shadow-save",
        resource: "appIssues",
        id: issue.id,
        message: error?.message || "Normalized app issue API shadow save failed"
      }));
    }
  };
  const saveAppIssue = async (x) => {
    if (NORMALIZED_SETTINGS_RECORDS_AUTHORITY) {
      try {
        await NORMALIZED_SETTINGS_RECORDS_PROVIDER.appIssues?.upsert?.(x);
      } catch (error) {
        setToast(SAVE_FAILED_MESSAGE);
        void recordAutomaticAppIssue(settingsRecordsAuthorityFailureIssue({
          action: "save",
          resource: "appIssues",
          id: x.id,
          message: error?.message || "Normalized app issue API save failed"
        }));
        return false;
      }
    } else {
      if (!await persistShared(`appIssue:${x.id}`, JSON.stringify(x))) return false;
      void shadowWriteNormalizedAppIssue(x);
    }
    setAppIssues((s) => [x, ...s.filter((y) => y.id !== x.id)].sort((a, b) => (b.at || 0) - (a.at || 0)));
    return true;
  };
  const shadowWriteNormalizedPresence = async (record) => {
    if (!NORMALIZED_PRESENCE_SHADOW_WRITE) return;
    try {
      await NORMALIZED_PRESENCE_PROVIDER.upsert(record);
    } catch (error) {
      void recordAutomaticAppIssue(presenceAuthorityFailureIssue({
        action: "shadow_save",
        id: record.id,
        message: error?.message || "Normalized presence API shadow save failed"
      }));
    }
  };
  const mirrorPresenceToKv = async (record) => {
    if (!record?.id) return false;
    return persistShared(`presence:${record.id}`, JSON.stringify(record), { toastOnFail: false });
  };
  const loadPresenceRecord = async (id) => {
    if (!id) return null;
    if (NORMALIZED_PRESENCE_AUTHORITY) {
      try {
        const response = await NORMALIZED_PRESENCE_PROVIDER.get(id);
        return response?.presence || null;
      } catch (error) {
        if (error?.message !== "presence_not_found") {
          void recordAutomaticAppIssue(presenceAuthorityFailureIssue({
            action: "get",
            id,
            message: error?.message || "Normalized presence API get failed"
          }));
        }
      }
    }
    try {
      const raw = await store.get(`presence:${id}`, true);
      if (!raw) return null;
      return JSON.parse(typeof raw === "string" ? raw : raw.value);
    } catch {
      return null;
    }
  };
  const savePresenceRecord = async (record) => {
    if (!record?.id) return false;
    if (NORMALIZED_PRESENCE_AUTHORITY) {
      try {
        await NORMALIZED_PRESENCE_PROVIDER.upsert(record);
      } catch (error) {
        setToast(SAVE_FAILED_MESSAGE);
        void recordAutomaticAppIssue(presenceAuthorityFailureIssue({
          action: "save",
          id: record.id,
          message: error?.message || "Normalized presence API save failed"
        }));
        return false;
      }
      return true;
    }
    const ok = await persistShared(`presence:${record.id}`, JSON.stringify(record));
    if (ok) void shadowWriteNormalizedPresence(record);
    return ok;
  };
  // авто-миграция Тип/Модель: группировка по типу; версия 2 пересобирает старый 1:1
  useEffect(() => {
    if (ready && fleet.length && config.vtMigV !== 2) {
      const vts = buildVehicleTypes(config, fleet);
      if (vts.length) saveConfig({ ...config, ...flattenVehicleTypes(vts), vtMigV: 2 }, { toastOnFail: false });
    }
  }, [ready, fleet, config]);
  const setShift = async (on) => { if (!session) return false; const prev = presence.find((x) => x.id === session.id); const rec = { id: session.id, name: session.name, onShift: on, since: on ? Date.now() : (prev?.since || null), endedAt: on ? null : Date.now(), lastSeen: Date.now(), day: todayKey() }; if (!await savePresenceRecord(rec)) return false; setPresence((s) => [...s.filter((x) => x.id !== session.id), rec]); return true; };
  const touchPresence = async () => {
    if (!session?.id) return;
    const cur = presenceRef.current.find((x) => x.id === session.id);
    const rec = {
      ...(cur || {}),
      id: session.id,
      name: session.name,
      onShift: session.role === "tech" ? !!cur?.onShift : false,
      since: cur?.since || null,
      endedAt: cur?.endedAt || null,
      lastSeen: Date.now(),
      day: cur?.day || todayPresenceKey()
    };
    if (await savePresenceRecord(rec)) setPresence((s) => [...s.filter((x) => x.id !== session.id), rec]);
  };
  useEffect(() => { if (!session?.id) return; touchPresence(); const id = setInterval(touchPresence, 60000); return () => clearInterval(id); }, [session?.id, session?.name, session?.role]);
  const login = async (s, options = {}) => {
    setSession(s);
    if (s?.productionSession) {
      await store.del("session:v1", false);
      if (options.productionAuth) PRODUCTION_AUTH_STORE.set(options.productionAuth, { remember: options.remember === true });
      applySavedConfig(await store.get("config:v1", true));
      await reloadAll();
      return;
    }
    await store.set("session:v1", JSON.stringify(s), false);
  };
  const logout = async () => { setRolePreviewRole(null); setSession(null); await logoutProductionSession({ config: PRODUCTION_LOGIN_CONFIG }); PRODUCTION_AUTH_STORE.clear(); await store.del("session:v1", false); };
  const saveMyProfile = async ({ email, phone, newPassword } = {}) => {
    const realSession = session;
    if (!realSession) return { ok: false, error: "session_missing" };
    if (newPassword && newPassword.length < 6) return { ok: false, error: "password_min_6" };
    try {
      if (realSession.productionSession) {
        const auth = PRODUCTION_AUTH_STORE.get();
        const accessToken = auth?.accessToken || "";
        if (!accessToken && !auth?.cookieSession) return { ok: false, error: "access_token_required" };
        let nextSession = realSession;
        const normalizedEmail = String(email || "").trim().toLowerCase();
        const normalizedPhone = String(phone || "").trim();
        if (normalizedEmail !== String(realSession.email || "").trim().toLowerCase() || normalizedPhone !== String(realSession.phone || "").trim()) {
          const result = await updateProductionProfile({ accessToken, email: normalizedEmail, phone: normalizedPhone, config: PRODUCTION_LOGIN_CONFIG });
          nextSession = { ...nextSession, ...result.session };
        }
        if (newPassword) {
          const result = await changeProductionPassword({ accessToken, newPassword, config: PRODUCTION_LOGIN_CONFIG });
          nextSession = { ...nextSession, ...result.session };
        }
        setSession(nextSession);
        return { ok: true };
      }
      const target = users.find((u) => u.id === realSession.id) || realSession;
      const nextUser = { ...target, email: String(email || "").trim().toLowerCase(), phone: String(phone || "").trim() };
      if (newPassword) nextUser.password = newPassword;
      if (!await saveUser(nextUser)) return { ok: false, error: "save_failed" };
      const nextSession = { ...realSession, email: nextUser.email || "", phone: nextUser.phone || "" };
      setSession(nextSession);
      await store.set("session:v1", JSON.stringify(nextSession), false);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error?.message || "profile_save_failed" };
    }
  };
  const toggleTheme = async () => { const n = theme === "light" ? "dark" : "light"; setTheme(n); await store.set("theme:v1", n, false); };

  const techNames = users.filter((u) => u.role === "tech" && u.active !== false).map((u) => u.name);
  const isRealAdmin = session?.role === "admin";
  const impersonating = isRealAdmin && rolePreviewRole && rolePreviewRole !== "admin";
  const firstTech = (users || []).find((u) => u.role === "tech" && u.active !== false);
  const firstMgr = (users || []).find((u) => u.role === "user" && u.active !== false);
  const firstWorker = (users || []).find((u) => u.role === "worker" && u.active !== false);
  const firstExecutive = (users || []).find((u) => u.role === "executive" && u.active !== false);
  const effSession = !impersonating ? session
    : rolePreviewRole === "executive" ? (firstExecutive ? { ...firstExecutive, role: "executive", dept: firstExecutive.dept || "הנהלה", depts: userDepts(firstExecutive) } : { ...session, role: "executive", dept: "הנהלה", depts: [] })
    : rolePreviewRole === "tech" ? (firstTech ? { id: firstTech.id, name: firstTech.name, role: "tech", dept: firstTech.dept || "", supplier: firstTech.supplier || "", shiftStart: firstTech.shiftStart || "", shiftEnd: firstTech.shiftEnd || "16:30", shiftId: "", techScope: firstTech.techScope || "transport", techCats: firstTech.techCats || [] } : { ...session, role: "tech", supplier: "", shiftStart: session.shiftStart || "", shiftEnd: session.shiftEnd || "16:30", shiftId: "", techScope: "transport", techCats: [] })
    : rolePreviewRole === "worker" ? (firstWorker ? { id: firstWorker.id, name: firstWorker.name, role: "worker", dept: firstWorker.dept || "", email: firstWorker.email || "" } : { ...session, role: "worker", dept: session.dept || config.departments[0] || "" })
    : (firstMgr ? { id: firstMgr.id, name: firstMgr.name, role: "user", dept: firstMgr.dept || config.departments[0] || "", depts: userDepts(firstMgr).length ? userDepts(firstMgr) : [config.departments[0] || ""], email: firstMgr.email || "", mgrZones: firstMgr.mgrZones || [], shift: firstMgr.shift || "", perms: normalizePerms(firstMgr) } : { ...session, role: "user", dept: session.dept || config.departments[0] || "", mgrZones: session.mgrZones || [] });
  const effLogout = impersonating ? (async () => setRolePreviewRole(null)) : logout;
  // В режиме просмотра роли пишем присутствие под выбранным техником — чтобы статус был сквозным (видно и админу, и менеджеру).
  const effSetShift = !impersonating ? setShift : (async (on) => {
    const id = effSession.id; if (!id) return;
    const prev = presence.find((x) => x.id === id);
    const rec = { id, name: effSession.name, onShift: on, since: on ? Date.now() : (prev?.since || null), endedAt: on ? null : Date.now(), lastSeen: Date.now(), day: todayKey() };
    if (!await savePresenceRecord(rec)) return false;
    setPresence((s) => [...s.filter((x) => x.id !== id), rec]);
    return true;
  });
  const loadDemo = async () => {
    if (!SEED_POLICY.allowDemoData) return false;
    const cfg0 = { ...config, departments: DEFAULT_CONFIG.departments };
    const { fleet: df, tickets: dt, pm: dp, driverEvents, vehicleTypes, modelType, users: du, zones: dz, rounds: dr, complaints: dc, absences: da, presence: dpr } = buildDemoData(cfg0);
    const adminU = users.find((u) => u.role === "admin"), mgrs = users.filter((u) => u.role === "user");
    const aId = adminU?.id || "demo-admin", mId = mgrs[0]?.id || aId, m2 = mgrs[1]?.id || mId;
    const DAY = 86400000, now = Date.now(), mklog = (txt, by, off = 0) => ({ at: now - off * DAY, by, byRole: "admin", text: txt, kind: "open" });
    const demoTasks = [
      { id: "mt-1", title: "להכין הצעת תקציב אחזקה ל-Q3", desc: "לפי דרישת המנכ״ל בישיבת ההנהלה — פירוט עלויות צפויות לכלי שינוע ולמבנה.", responsibleIds: [aId], participantIds: [], ownerId: aId, priority: "high", status: "in_progress", mode: "deadline", dueAt: now + 4 * DAY, recur: null, nextActionAt: now + 2 * DAY, category: "תקציב", waitingFor: "", isPrivate: false, meetingId: "mm-0", linkedMeetingIds: ["mm-2"], origin: "boss_meeting", createdBy: { name: adminU?.name || "ודים", role: "admin" }, createdAt: now - 3 * DAY, updatedAt: now - 1 * DAY, demo: true, log: [mklog("המטלה נוצרה (מישיבה עם המנכ״ל)", adminU?.name || "ודים", 3)] },
      { id: "mt-2", title: "לחתום חוזה מול ספק מלגזות חדש", desc: "מעבר לספק חלופי לחלקים.", responsibleIds: [mId], participantIds: [], ownerId: aId, priority: "high", status: "waiting", mode: "deadline", dueAt: now - 1 * DAY, recur: null, nextActionAt: now, category: "ספקים", waitingFor: "ממתין להצעת מחיר סופית מהספק", isPrivate: false, meetingId: "mm-1", createdBy: { name: adminU?.name || "ודים", role: "admin" }, createdAt: now - 8 * DAY, updatedAt: now - 2 * DAY, demo: true, log: [mklog("שובץ למנהל המחלקה", adminU?.name || "ודים", 8)] },
      { id: "mt-3", title: "סבב בטיחות שבועי במחסן", desc: "בדיקת מטפים, יציאות חירום, סימון נתיבי מלגזות.", responsibleIds: [mId], participantIds: [], ownerId: aId, priority: "medium", status: "todo", mode: "recurring", dueAt: now + 2 * DAY, recur: "weekly", nextActionAt: null, category: "בטיחות", waitingFor: "", isPrivate: false, createdBy: { name: adminU?.name || "ודים", role: "admin" }, createdAt: now - 10 * DAY, updatedAt: now - 6 * DAY, demo: true, log: [mklog("מטלה חוזרת שבועית", adminU?.name || "ודים", 10)] },
      { id: "mt-4", title: "מעקב מול הנהלה — דוח אחזקה חודשי", desc: "אחריות מתמשכת: סיכום חודשי למנכ״ל.", responsibleIds: [aId], participantIds: [], ownerId: aId, priority: "medium", status: "todo", mode: "permanent", dueAt: null, recur: null, nextActionAt: null, category: "ניהול", waitingFor: "", isPrivate: false, createdBy: { name: adminU?.name || "ודים", role: "admin" }, createdAt: now - 20 * DAY, updatedAt: now - 20 * DAY, demo: true, log: [mklog("אחריות קבועה", adminU?.name || "ודים", 20)] },
      { id: "mt-5", title: "לתאם הדרכת נהגים חדשים", desc: "", responsibleIds: [m2], participantIds: [], ownerId: aId, priority: "low", status: "done", mode: "deadline", dueAt: now - 5 * DAY, recur: null, nextActionAt: null, category: "כ״א", waitingFor: "", isPrivate: false, createdBy: { name: adminU?.name || "ודים", role: "admin" }, createdAt: now - 12 * DAY, updatedAt: now - 5 * DAY, demo: true, log: [mklog("נוצרה", adminU?.name || "ודים", 12), { at: now - 5 * DAY, by: uName(m2, users), byRole: "user", text: "סטטוס שונה ל«הושלם»", kind: "other" }] },
    ];
    const demoMeetings = [
      { id: "mm-0", title: "פגישה עם המנכ״ל", type: "boss", purpose: "מעבר על המשימות והדיווח מול המנכ״ל", at: now - 3 * DAY + 10 * 3600000, participantIds: [aId], agenda: "תקציב Q3, מצב צי המלגזות, כוח אדם.", decisions: "", recur: null, status: "done", ownerId: aId, createdBy: { name: adminU?.name || "ודים", role: "admin" }, createdAt: now - 5 * DAY, updatedAt: now - 3 * DAY, demo: true, log: [{ at: now - 3 * DAY, by: adminU?.name || "ודים", byRole: "admin", text: "📌 הוחלט: להגיש הצעת תקציב Q3 עד סוף השבוע", kind: "other" }] },
      { id: "mm-1", title: "ישיבת הנהלה שבועית", type: "leadership", purpose: "סטטוס שבועי וחריגות", standingTopics: [{ id: "tp-sla", text: "חריגות SLA פתוחות" }, { id: "tp-safety", text: "אירועי בטיחות" }], topicMarks: {}, at: now + 1 * DAY + 9 * 3600000, participantIds: [aId, mId].filter(Boolean), agenda: "סטטוס קריאות פתוחות, חריגות SLA, ספקים.", decisions: "", recur: "weekly", status: "planned", ownerId: aId, createdBy: { name: adminU?.name || "ודים", role: "admin" }, createdAt: now - 7 * DAY, updatedAt: now - 7 * DAY, demo: true, log: [{ at: now - 7 * DAY, by: adminU?.name || "ודים", byRole: "admin", text: "פגישה שבועית קבועה", kind: "open" }] },
      { id: "mm-2", title: "סנכרון מול ספקי שירות", type: "peers", purpose: "תיאום מול עמית", standingTopics: [{ id: "tp-resp", text: "זמני תגובה של ספקים" }, { id: "tp-contract", text: "חידוש חוזים" }], topicMarks: { "tp-resp": "issue" }, at: now + 5 * DAY + 11 * 3600000, participantIds: [aId, m2].filter(Boolean), agenda: "חוזי שירות, זמני תגובה.", decisions: "", recur: "monthly", status: "planned", ownerId: aId, createdBy: { name: adminU?.name || "ודים", role: "admin" }, createdAt: now - 2 * DAY, updatedAt: now - 2 * DAY, demo: true, log: [{ at: now - 2 * DAY, by: adminU?.name || "ודים", byRole: "admin", text: "נקבעה", kind: "open" }] },
    ];
    const demoPpeItems = [
      { id: "ppe-gloves", name: "כפפות עבודה", category: "gloves", sizes: ["אחיד"], stockBySize: { "אחיד": 40 }, unitCost: 12, minStock: 20, clawbackEligible: false, active: true, demo: true, createdAt: now },
      { id: "ppe-helmet", name: "קסדת מגן", category: "head", sizes: ["אחיד"], stockBySize: { "אחיד": 18 }, unitCost: 45, minStock: 8, clawbackEligible: true, active: true, demo: true, createdAt: now },
      { id: "ppe-shoes", name: "נעלי בטיחות", category: "shoes", sizes: ["40", "41", "42", "43", "44", "45", "46"], stockBySize: { "40": 3, "41": 5, "42": 6, "43": 4, "44": 5, "45": 2, "46": 1 }, minBySize: { "40": 2, "41": 3, "42": 3, "43": 3, "44": 3, "45": 2, "46": 2 }, unitCost: 240, minStock: 12, clawbackEligible: true, active: true, demo: true, createdAt: now },
      { id: "ppe-shoes-up", name: "נעלי בטיחות משודרגות", category: "shoes", sizes: ["40", "41", "42", "43", "44", "45", "46"], stockBySize: { "40": 1, "41": 2, "42": 2, "43": 2, "44": 1, "45": 1, "46": 0 }, minBySize: { "40": 1, "41": 1, "42": 1, "43": 1, "44": 1, "45": 1, "46": 1 }, unitCost: 380, minStock: 6, clawbackEligible: true, active: true, demo: true, createdAt: now },
      { id: "ppe-vest", name: "אפוד זוהר", category: "hivis", sizes: ["אחיד"], stockBySize: { "אחיד": 30 }, unitCost: 25, minStock: 12, clawbackEligible: true, active: true, demo: true, createdAt: now },
      { id: "ppe-ear", name: "אוזניות מגן", category: "ear", sizes: ["אחיד"], stockBySize: { "אחיד": 9 }, unitCost: 35, minStock: 10, clawbackEligible: false, active: true, demo: true, createdAt: now },
      { id: "ppe-shirt-s", name: "חולצת קיץ", category: "clothing", sizes: ["S", "M", "L", "XL", "XXL"], stockBySize: { S: 4, M: 8, L: 8, XL: 5, XXL: 2 }, minBySize: { S: 3, M: 4, L: 4, XL: 3, XXL: 3 }, unitCost: 55, minStock: 10, clawbackEligible: true, active: true, demo: true, createdAt: now },
      { id: "ppe-shirt-w", name: "חולצת חורף", category: "clothing", sizes: ["S", "M", "L", "XL", "XXL"], stockBySize: { S: 3, M: 6, L: 6, XL: 4, XXL: 1 }, minBySize: { S: 2, M: 3, L: 3, XL: 2, XXL: 2 }, unitCost: 90, minStock: 8, clawbackEligible: true, active: true, demo: true, createdAt: now },
      { id: "ppe-pants", name: "מכנס דגמ״ח", category: "clothing", sizes: ["S", "M", "L", "XL", "XXL"], stockBySize: { S: 3, M: 5, L: 5, XL: 4, XXL: 1 }, minBySize: { S: 2, M: 3, L: 3, XL: 2, XXL: 2 }, unitCost: 120, minStock: 8, clawbackEligible: true, active: true, demo: true, createdAt: now },
      { id: "ppe-galosh", name: "ערדליים", category: "other", sizes: ["אחיד"], stockBySize: { "אחיד": 12 }, unitCost: 60, minStock: 5, clawbackEligible: false, active: true, demo: true, createdAt: now },
    ];
    const _AD = DEFAULT_CONFIG.departments;
    const _except = (ex) => _AD.filter((d) => !ex.includes(d));
    const _normMap = {
      "ppe-helmet": { depts: _except(["הפצה", "שיגור"]), policy: "free" },
      "ppe-shoes": { depts: _AD, policy: "free" },
      "ppe-shoes-up": { depts: _AD, policy: "subsidized", pct: 50 },
      "ppe-vest": { depts: _AD, policy: "free" },
      "ppe-ear": { depts: ["קבלה"], policy: "free" },
      "ppe-shirt-s": { depts: ["הפצה"], policy: "free" },
      "ppe-shirt-w": { depts: ["הפצה"], policy: "free" },
      "ppe-pants": { depts: ["הפצה"], policy: "free" },
    };
    const demoNorms = [];
    Object.entries(_normMap).forEach(([itemId, cfg]) => cfg.depts.forEach((d, k) => { if (d) demoNorms.push({ id: `pn-${itemId}-${k}`, dept: d, itemId, active: true, policy: cfg.policy, workerPct: cfg.pct || 50, periodMonths: PPE_PERIOD_DEFAULT, createdAt: now }); }));
    const _byBag = { id: aId, name: adminU?.name || "ודים" };
    const demoPpe = [
      { id: "pp-1", workerId: "demo-u-w-5-b", workerName: "שי (הפצה)", workerNo: "3011", dept: "הפצה", employmentType: "direct", itemId: "ppe-shirt-s", itemName: "חולצת קיץ", category: "clothing", size: "L", qty: 1, at: now - 6 * DAY, by: _byBag, unitCost: 55, workerCharge: 0, clawbackEligible: true, note: "", origin: "manual", demo: true },
      { id: "pp-2", workerId: "demo-u-w-5-b", workerName: "שי (הפצה)", workerNo: "3011", dept: "הפצה", employmentType: "direct", itemId: "ppe-pants", itemName: "מכנס דגמ״ח", category: "clothing", size: "L", qty: 1, at: now - 6 * DAY, by: _byBag, unitCost: 120, workerCharge: 0, clawbackEligible: true, note: "", origin: "manual", demo: true },
      { id: "pp-3", workerId: "demo-u-w-3-a", workerName: "ניר (קבלה)", workerNo: "3006", dept: "קבלה", employmentType: "contractor", itemId: "ppe-shoes", itemName: "נעלי בטיחות", category: "shoes", size: "43", qty: 1, at: now - 2 * DAY, by: _byBag, unitCost: 240, workerCharge: 240, clawbackEligible: true, note: "קבלן — תשלום מלא", origin: "manual", demo: true },
      { id: "pp-4", workerId: "demo-u-w-3-a", workerName: "ניר (קבלה)", workerNo: "3006", dept: "קבלה", employmentType: "contractor", itemId: "ppe-ear", itemName: "אוזניות מגן", category: "ear", size: "אחיד", qty: 1, at: now - 2 * DAY, by: _byBag, unitCost: 35, workerCharge: 35, clawbackEligible: false, note: "", origin: "manual", demo: true },
      { id: "pp-5", workerId: "demo-u-cl1", workerName: "רונן", workerNo: "2001", dept: "", employmentType: "direct", itemId: "ppe-vest", itemName: "אפוד זוהר", category: "hivis", size: "אחיד", qty: 1, at: now - 1 * DAY, by: _byBag, unitCost: 25, workerCharge: 0, clawbackEligible: true, note: "", origin: "manual", demo: true },
    ];
    await Promise.all([
      ...df.map((f) => store.set(`fleet:${f.id}`, JSON.stringify(f), true)),
      ...FLEET_SEED.map((f) => store.set(`fleet:${f.id}`, JSON.stringify({ ...f, depts: f.depts || [], dept: "", demo: true, createdAt: now }), true)),
      ...dt.map((t) => store.set(`ticket:${t.id}`, JSON.stringify(t), true)),
      ...dp.map((p) => store.set(`pm:${p.id}`, JSON.stringify(p), true)),
      ...(du || []).map((u) => store.set(`user:${u.id}`, JSON.stringify(u), true)),
      ...(dz || []).map((z) => store.set(`czone:${z.id}`, JSON.stringify(z), true)),
      ...(dr || []).map((r) => store.set(`cround:${r.id}`, JSON.stringify(r), true)),
      ...(dc || []).map((c) => store.set(`ccomplaint:${c.id}`, JSON.stringify(c), true)),
      ...(da || []).map((a) => store.set(`cabsence:${a.id}`, JSON.stringify(a), true)),
      ...(dpr || []).map((p) => store.set(`presence:${p.id}`, JSON.stringify(p), true)),
      ...demoTasks.map((t) => store.set(`mtask:${t.id}`, JSON.stringify(t), true)),
      ...demoMeetings.map((m) => store.set(`mmeet:${m.id}`, JSON.stringify(m), true)),
      ...demoPpeItems.map((x) => store.set(`ppeitem:${x.id}`, JSON.stringify(x), true)),
      ...demoPpe.map((x) => store.set(`ppe:${x.id}`, JSON.stringify(x), true)),
      ...demoNorms.map((x) => store.set(`ppenorm:${x.id}`, JSON.stringify(x), true)),
    ]);
    const exTypes = config.vehicleTypes || [];
    const mergedTypes = exTypes.concat((vehicleTypes || []).filter((v) => !exTypes.some((e) => e.name === v.name)));
    await saveConfig({ ...config, departments: DEFAULT_CONFIG.departments, vehicleTypes: mergedTypes, modelType: { ...(config.modelType || {}), ...modelType }, driverEvents });
    await reloadAll();
  };
  const clearDemo = async () => {
    const dels = [];
    for (const pre of ["ticket:", "fleet:", "pm:", "photo:", "user:", "czone:", "cround:", "ccomplaint:", "cabsence:", "presence:", "mtask:", "mmeet:", "ppe:", "ppeitem:", "ppenorm:", "ppereq:", "ppeorder:"]) {
      const arr = await loadColl(pre);
      arr.filter((x) => x && (x.demo || (pre === "fleet:" && String(x.id).startsWith("v-")))).forEach((x) => dels.push(store.del(`${pre}${x.id}`, true)));
    }
    await Promise.all(dels);
    if ((config.driverEvents || []).some((e) => String(e.id).startsWith("de"))) await saveConfig({ ...config, driverEvents: [] });
    await reloadAll();
  };
  const demoActive = tickets.some((t) => t.demo) || fleet.some((f) => f.demo) || pm.some((x) => x.demo);
  const buildBackup = async () => {
    const photos = {};
    for (const t of tickets) {
      if (shouldExportLegacyTicketPhoto(t)) { try { const p = await store.get(`photo:${t.id}`, true); if (p) photos[`photo:${t.id}`] = p; } catch {} }
      if (shouldExportLegacyTicketPhoto(t, "after")) { try { const p = await store.get(`photo:after:${t.id}`, true); if (p) photos[`photo:after:${t.id}`] = p; } catch {} }
    }
    return buildBackupPayload({
      config,
      collections: {
        users, fleet, tickets, pm, presence, zones, rounds, complaints, absences, locations,
        tasks, meetings, ppe, ppeItems, ppeNorms, ppeReqs, ppeOrders, appIssues,
      },
      photos,
    });
  };
  const importBackup = async (data) => {
    if (!data || data.__app !== BACKUP_APP_ID) throw new Error("invalid");
    if (data.config && typeof data.config === "object") await store.set("config:v1", JSON.stringify(data.config), true);
    const writeColl = async (pre, arr) => { for (const x of (Array.isArray(arr) ? arr : [])) if (x && x.id) await store.set(`${pre}${x.id}`, JSON.stringify(x), true); };
    for (const { key, prefix } of BACKUP_COLLECTIONS) await writeColl(prefix, data[key]);
    if (data.photos && typeof data.photos === "object") { for (const [k, v] of Object.entries(data.photos)) { if (typeof v === "string" && (k.startsWith("photo:"))) { try { await store.set(k, v, true); } catch {} } } }
    await reloadAll();
  };
  // Вход техника = начало смены. Берём первый вход за день (не затираем, если уже стартовал; повторный вход днём — не новый старт).
  useEffect(() => {
    if (!session || session.role !== "tech" || impersonating) return;
    let cancelled = false;
    (async () => {
      const prev = await loadPresenceRecord(session.id);
      const today = todayKey();
      const started = prev && prev.day === today && prev.since;
      const rec = started
        ? { ...prev, onShift: true, lastSeen: Date.now() }
        : { id: session.id, name: session.name, onShift: true, since: Date.now(), endedAt: null, lastSeen: Date.now(), day: today };
      if (cancelled) return;
      if (!await savePresenceRecord(rec)) return;
      setPresence((s) => [...s.filter((x) => x.id !== session.id), rec]);
    })();
    return () => { cancelled = true; };
  }, [session && session.id, session && session.role, impersonating]);

  const rolePreview = isRealAdmin ? { active: rolePreviewRole || "admin", realName: session.name, onChange: (role) => setRolePreviewRole(role === "admin" ? null : role) } : null;
  const openIssueReport = () => {
    const fallbackContext = appIssueScreenContext();
    setIssueReportDraft({ screenshot: "", screenshotContext: fallbackContext, captureStatus: "capturing", captureError: "" });
    captureAppIssueScreenshot().then((result) => {
      setIssueReportDraft({
        screenshot: result.screenshot || "",
        screenshotContext: result.context || fallbackContext,
        captureStatus: result.screenshot ? "ready" : "failed",
        captureError: result.error || "",
      });
    });
    setIssueReportOpen(true);
  };
  const shared = { session: effSession, config, users, tickets, pm, fleet, presence, techNames, zones, rounds, complaints, absences, locations, tasks, saveTask, delTask, meetings, saveMeeting, delMeeting, ppe, ppeItems, savePpe, delPpe, savePpeItem, delPpeItem, ppeNorms, saveNorm, delNorm, ppeReqs, savePpeReq, delPpeReq, ppeOrders, savePpeOrder, delPpeOrder, appIssues, saveAppIssue, saveAbsence, delAbsence, saveZone, delZone, saveRound, fileComplaint, resolveComplaint, progressComplaint, approveComplaint, rejectComplaint, escalateComplaint, delComplaint, saveTicket, delTicket, savePm, savePmMany, delPm, delPmMany, saveFleet, saveFleetMany, saveFleetImportBatch, delFleet, saveUser, delUser, saveConfig, setShift: effSetShift, onLogout: effLogout, onProfile: () => setProfileOpen(true), onReportIssue: openIssueReport, rolePreview, theme, toggleTheme, language, setLanguage, t: (key, vars) => uiText(language, key, vars), reloadAll, loadDemo: SEED_POLICY.allowDemoData ? loadDemo : null, clearDemo: SEED_POLICY.allowDemoData ? clearDemo : null, demoActive, getBackup: buildBackup, importBackup: SEED_POLICY.allowBackupImport ? importBackup : null };
  return (
    <div dir={languageDirection(language)} lang={language} className={theme === "dark" ? "app-dark" : ""} style={{ fontFamily: "var(--font-body)" }}>
      <Style />
      {!ready ? <div className="boot"><div className="spinner" /></div>
        : !session ? <Login users={users} config={config} onLogin={login} saveUser={saveUser} theme={theme} toggleTheme={toggleTheme} language={language} setLanguage={setLanguage} zones={zones} onAnonReport={submitAnonymousComplaint} builtinLogins={builtinLoginsForMode(APP_MODE, BUILTIN_LOGINS)} seedPolicy={SEED_POLICY} productionLoginConfig={PRODUCTION_LOGIN_CONFIG} />
          : (<>
            {effSession.role === "admin" || effSession.role === "executive" ? <AdminApp {...shared} />
              : effSession.role === "tech" ? <TechApp {...shared} key="imp-tech" />
                : effSession.role === "worker" ? <WorkerApp {...shared} key="imp-worker" />
                  : effSession.role === "cleaner" ? <CleanerApp {...shared} key="imp-cleaner" />
                  : <UserApp {...shared} key="imp-user" />}
            {issueReportOpen && <Overlay persistent panelClassName="issue-report-shell" onClose={() => setIssueReportOpen(false)}><AppIssueReportModal session={effSession} draft={issueReportDraft} onSave={async (issue) => { const ok = await saveAppIssue(issue); if (ok) setIssueReportOpen(false); return ok; }} onClose={() => setIssueReportOpen(false)} /></Overlay>}
            {profileOpen && <Overlay persistent panelClassName="profile-shell" onClose={() => setProfileOpen(false)}><ProfileModal session={session} onSave={saveMyProfile} onClose={() => setProfileOpen(false)} /></Overlay>}
          </>)}
      {toast && <div role="alert" aria-live="assertive" onClick={() => setToast(null)} style={{ position: "fixed", insetInlineStart: 0, insetInlineEnd: 0, bottom: 0, margin: "0 auto 16px", maxWidth: 420, background: "#B91C1C", color: "#fff", padding: "11px 16px", borderRadius: 12, fontSize: 14, fontWeight: 600, textAlign: "center", boxShadow: "0 8px 28px rgba(0,0,0,.28)", zIndex: 9999, cursor: "pointer", insetInline: 16 }}>{toast}</div>}
      {versionUpdate && <VersionUpdateBanner onRefresh={refreshAppCache} onDismiss={() => { setDismissedVersionCommit(versionUpdate.commit); setVersionUpdate(null); }} />}
    </div>
  );
}

function VersionUpdateBanner({ onRefresh, onDismiss }) {
  return (
    <div className="version-update-banner" role="status" aria-live="polite">
      <div className="version-update-copy">
        <b>גרסה חדשה זמינה</b>
        <span>המערכת עודכנה ברקע. רענון קצר יציג את השינויים האחרונים.</span>
      </div>
      <div className="version-update-actions">
        <button type="button" className="version-update-refresh" onClick={onRefresh}>רענון</button>
        <button type="button" className="version-update-dismiss" aria-label="סגירה" onClick={onDismiss}>×</button>
      </div>
    </div>
  );
}

/* ============================================================ WORKER (עובד) — דיווח תקלה */
function WorkerApp(p) {
  const { session, config, fleet, tickets, saveTicket, onLogout, theme, toggleTheme, language, setLanguage, t = (key) => uiText(language, key) } = p;
  const cleaningEnabled = canPerformCleaning(session);
  const [view, setView] = useState(() => defaultWorkerView(session)); // new | mine | ppe | cleaning | activity
  const [track, setTrack] = useState(null);
  const [subject, setSubject] = useState(""), [description, setDescription] = useState(""), [forkliftId, setForkliftId] = useState("");
  const [photo, setPhoto] = useState(null), [err, setErr] = useState(""), [busy, setBusy] = useState(false), [sent, setSent] = useState(false);
  const [noPhoto, setNoPhoto] = useState(false), [noPhotoReason, setNoPhotoReason] = useState("");
  const [open, setOpen] = useState(null);
  const fileRef = useRef(null);
  const myReports = useMemo(() => tickets.filter((t) => t.reportedBy && t.reportedBy.id === session.id).sort((a, b) => b.createdAt - a.createdAt), [tickets, session.id]);
  const myFleet = useMemo(() => (fleet || []).filter((f) => { const d = f.depts || (f.dept ? [f.dept] : []); return session.dept && d.includes(session.dept); }), [fleet, session.dept]);
  const grabPhoto = (file) => { if (!file) return; const r = new FileReader(); r.onload = (e) => { const img = new Image(); img.onload = () => { const max = 1000; let { width, height } = img; if (width > height && width > max) { height = height * max / width; width = max; } else if (height > max) { width = width * max / height; height = max; } const c = document.createElement("canvas"); c.width = width; c.height = height; c.getContext("2d").drawImage(img, 0, 0, width, height); setPhoto(c.toDataURL("image/jpeg", 0.6)); }; img.src = e.target.result; }; r.readAsDataURL(file); };
  const reset = () => { setTrack(null); setSubject(""); setDescription(""); setForkliftId(""); setPhoto(null); setNoPhoto(false); setNoPhotoReason(""); setErr(""); };
  const submit = async () => {
    if (busy) return;
    if (!track) return setErr("בחרו על מה הדיווח");
    if (!subject.trim()) return setErr("נא להזין כותרת");
    if (track === "transport" && !forkliftId) return setErr("נא לבחור כלי שינוע");
    if (!description.trim()) return setErr("נא לתאר את התקלה");
    if (!photo && !noPhoto) return setErr("צרפו תמונה, או סמנו «אין אפשרות לצרף תמונה»");
    if (!photo && noPhoto && !noPhotoReason.trim()) return setErr("נא לפרט מדוע אין אפשרות לצרף תמונה");
    setErr(""); setBusy(true);
    const id = uid(); const now = Date.now();
    const t = {
      id, track, subject: subject.trim(),
      category: track === "transport" ? "transport" : "", categoryLabel: "", priority: "medium", zone: "",
      asset: track === "transport" ? ((fleet.find((f) => f.id === forkliftId) || {}).code || "") : "",
      forkliftId: track === "transport" ? forkliftId : null, downtimeType: null, wearType: null, downtimeStart: null, downtimeEnd: null,
      description: description.trim(), status: "pending_manager", assignee: "", routedTech: undefined, mgrExec: undefined,
      reportedBy: { id: session.id, name: session.name, dept: session.dept || "", phone: session.phone || "" },
      createdBy: { id: session.id, name: session.name, role: "worker", dept: session.dept || "", phone: session.phone || "", email: session.email || "" },
      createdAt: now, updatedAt: now, dueAt: null, hasPhoto: !!photo, noPhotoReason: (!photo && noPhoto) ? noPhotoReason.trim() : "", closure: null,
      log: [{ at: now, by: session.name, byRole: "worker", text: (!photo && noPhoto) ? `הדיווח נשלח ללא תמונה — ${noPhotoReason.trim()}` : "הדיווח נשלח לאישור מנהל המחלקה", kind: "open" }],
    };
    try { const rec = photo ? { ...t, ...(await TICKET_PHOTOS.save(id, "before", photo)) } : t; if (await saveTicket(rec) === false) { setErr(SAVE_FAILED_MESSAGE); return; } reset(); setSent(true); setTimeout(() => setSent(false), 3500); setView("mine"); }
    catch (e) { setErr("שגיאה בשליחה."); }
    finally { setBusy(false); }
  };
  const toSign = (p.ppeReqs || []).filter((r) => r.workerId === session.id && r.status === "worker_sign");
  const workerTitle = view === "new" ? t("worker.newReport") : view === "ppe" ? t("worker.myPpe") : view === "activity" ? t("worker.activity") : view === "cleaning" ? t("cleaner.title") : t("worker.myReports");
  return (<div className="worker-shell">
    <div className="worker-top">
      <div><div className="wk-title">{workerTitle}</div><div className="wk-sub">{session.name}{session.dept ? " · " + session.dept : ""}</div></div>
      <div className="worker-top-actions"><LanguagePicker value={language} onChange={setLanguage} compact /><button className="icon-btn" onClick={toggleTheme} title={theme === "dark" ? t("common.lightMode") : t("common.darkMode")} aria-label={theme === "dark" ? t("common.lightMode") : t("common.darkMode")}>{theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}</button>{p.onReportIssue && <button className="icon-btn" onClick={p.onReportIssue} title={t("common.reportSystemIssue")} aria-label={t("common.reportSystemIssue")}><Bug size={20} /></button>}{p.onProfile && <button className="icon-btn" onClick={p.onProfile} title={t("common.profile")} aria-label={t("common.profile")}><User size={20} /></button>}<button className="worker-action-btn" onClick={onLogout} title={t("common.logout")} aria-label={t("common.logout")}><LogOut size={18} /><span>{t("common.logout")}</span></button></div>
    </div>
    {p.rolePreview && <div className="worker-preview"><RolePreviewBox rolePreview={p.rolePreview} language={language} /></div>}
    <div className="wk-tabs"><button className={view === "new" ? "on" : ""} onClick={() => setView("new")}><Plus size={16} /> {t("worker.newTab")}</button><button className={view === "mine" ? "on" : ""} onClick={() => setView("mine")}><ListChecks size={16} /> {t("worker.mineTab")}{myReports.length ? ` (${myReports.length})` : ""}</button><button className={view === "ppe" ? "on" : ""} onClick={() => setView("ppe")} style={toSign.length ? { color: "#B91C1C", fontWeight: 700 } : undefined}><PackageCheck size={16} /> {t("worker.ppeTab")}{toSign.length ? ` (${toSign.length})` : ""}</button>{cleaningEnabled && <button className={view === "cleaning" ? "on" : ""} onClick={() => setView("cleaning")}><Sparkles size={16} /> {t("cleaner.title")}</button>}<button className={view === "activity" ? "on" : ""} onClick={() => setView("activity")}><Clock size={16} /> {t("worker.activityTab")}</button></div>
    <div className="worker-body">
      {toSign.length > 0 && view !== "ppe" && <button type="button" onClick={() => setView("ppe")} style={{ width: "100%", textAlign: "start", display: "flex", alignItems: "center", gap: 10, background: "#B91C1C", color: "#fff", border: "none", borderRadius: 12, padding: "14px 16px", marginBottom: 12, cursor: "pointer", boxShadow: "0 2px 10px rgba(185,28,28,0.35)" }}><PenLine size={22} /><div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 15 }}>יש לך {toSign.length === 1 ? "מסמך" : `${toSign.length} מסמכים`} לחתימה</div><div style={{ fontSize: 12.5, opacity: 0.92 }}>לחצו לצפייה ולחתימה על קבלת הציוד</div></div><ChevronLeft size={20} style={{ transform: "scaleX(-1)" }} /></button>}
      
      {sent && <div className="banner" style={{ background: "#DCFCE7", color: "#166534", borderColor: "#86EFAC" }}><CheckCircle2 size={16} /> {t("worker.sent")}</div>}
      {view === "new" ? (<>
        <div className="wk-hint">{t("worker.hint")}</div>
        <div className="field"><span>{t("worker.whatReport")}</span><div className="wk-track-row">
          <button className={"wk-track" + (track === "facility" ? " on" : "")} onClick={() => { setTrack("facility"); setForkliftId(""); }}><Building2 size={22} /><span>{t("worker.facility")}</span></button>
          <button className={"wk-track" + (track === "transport" ? " on" : "")} onClick={() => setTrack("transport")}><Truck size={22} /><span>{t("worker.transport")}</span></button>
        </div></div>
        {track === "transport" && (myFleet.length > 0
          ? <div className="field"><span>כלי שינוע *</span><UnitPicker fleet={myFleet} config={config} value={forkliftId} onChange={(id) => setForkliftId(id)} ui={unitPickerUi()} /></div>
          : <div className="note">אין כלי שינוע המשויכים למחלקה שלך. ניתן לדווח על מבנה, או לפנות למנהל המחלקה.</div>)}
        {track && <>
          <label className="field"><span>{t("worker.subject")}</span><input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="לדוגמה: דליפת מים ליד המחסן" /></label>
          <label className="field"><span>{t("worker.description")}</span><textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="מה קרה? איפה?" /></label>
          <div className="field"><span>{noPhoto ? "תמונה" : t("worker.photoRequired")}</span><input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => grabPhoto(e.target.files?.[0])} />{!noPhoto && (photo ? <div className="photo-prev"><img src={photo} alt="" /><button className="photo-x" onClick={() => setPhoto(null)}><X size={16} /></button></div> : <button className="photo-add" onClick={() => fileRef.current?.click()}><Camera size={20} /> צירוף תמונה</button>)}
            <label className="chk-line" style={{ marginTop: 8 }}><input type="checkbox" checked={noPhoto} onChange={(e) => { setNoPhoto(e.target.checked); if (e.target.checked) setPhoto(null); setErr(""); }} /> {t("worker.noPhoto")}</label>
            {noPhoto && <textarea rows={2} value={noPhotoReason} onChange={(e) => setNoPhotoReason(e.target.value)} placeholder="חובה לפרט: מדוע אין אפשרות לצרף תמונה? (לדוגמה: אין מצלמה במכשיר)" style={{ marginTop: 6 }} />}
          </div>
          {err && <div className="err">{err}</div>}
          <button className="btn-primary full" onClick={submit} disabled={busy}>{busy ? <><span className="spinner sm" /> שולח…</> : <><Send size={16} /> {t("worker.send")}</>}</button>
        </>}
        {!track && err && <div className="err">{err}</div>}
        <div style={{ height: 24 }} />
      </>) : view === "ppe" ? (<PpeMyView ppe={p.ppe} items={p.ppeItems} norms={p.ppeNorms} session={session} reqs={p.ppeReqs} savePpeReq={p.savePpeReq} config={p.config} language={language} />) : view === "cleaning" && cleaningEnabled ? (<CleanerApp {...p} embedded />) : view === "activity" ? (
        <AuditLog session={session} tickets={tickets} fleet={fleet} config={config} language={language} onOpenTicket={(id) => { const t = tickets.find((x) => x.id === id); if (t) setOpen(t); }} />
      ) : (<>
        {myReports.length === 0 ? <Empty text="עדיין לא דיווחת" Icon={ListChecks} sub="פתחו דיווח חדש בלשונית «דיווח חדש»" /> : <div className="cards">{myReports.map((t) => { const s = stOf(t.status); const tr = TRACKS[t.track] || TRACKS.facility; return <button key={t.id} className="wk-card" onClick={() => setOpen(t)}><div className="wk-card-top"><span className="wk-card-subj">{t.subject}</span><span className="badge sm" style={{ background: s.bg, color: s.color }}>{s.label}</span></div><div className="wk-card-sub"><tr.Icon size={13} /> {tr.short} · {fmtDate(t.createdAt)}</div></button>; })}</div>}
        <div style={{ height: 24 }} />
      </>)}
    </div>
    {open && <WorkerReportView report={tickets.find((x) => x.id === open.id) || open} session={session} saveTicket={saveTicket} onClose={() => setOpen(null)} />}
  </div>);
}

function WorkerReportView({ report, session, saveTicket, onClose }) {
  const [photo, setPhoto] = useState(null), [newPhoto, setNewPhoto] = useState(null), [note, setNote] = useState(""), [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  useEffect(() => { let on = true; if (report?.hasPhoto) TICKET_PHOTOS.load(report, "before").then((d) => on && setPhoto(d)); return () => { on = false; }; }, [report?.id, report?.hasPhoto, report?.photoPath]);
  const grab = (file) => { if (!file) return; const r = new FileReader(); r.onload = (e) => { const img = new Image(); img.onload = () => { const max = 1000; let { width, height } = img; if (width > height && width > max) { height = height * max / width; width = max; } else if (height > max) { width = width * max / height; height = max; } const c = document.createElement("canvas"); c.width = width; c.height = height; c.getContext("2d").drawImage(img, 0, 0, width, height); setNewPhoto(c.toDataURL("image/jpeg", 0.6)); }; img.src = e.target.result; }; r.readAsDataURL(file); };
  const s = stOf(report.status); const tr = TRACKS[report.track] || TRACKS.facility;
  const resubmit = async () => {
    if (busy) return; setBusy(true);
    try {
      const photoMeta = newPhoto ? await TICKET_PHOTOS.save(report.id, "before", newPhoto) : {};
      const text = "העובד שלח שוב לאחר תיקון" + (note.trim() ? `: ${note.trim()}` : "");
      if (await saveTicket({ ...report, ...photoMeta, status: "pending_manager", updatedAt: Date.now(), log: [...(report.log || []), { at: Date.now(), by: session.name, byRole: "worker", text, kind: "reopen" }] }) === false) throw new Error("save_failed");
      onClose();
    } finally { setBusy(false); }
  };
  return (<div className="ovl-backdrop" onClick={onClose}><div className="ovl-inner wk-view" onClick={(e) => e.stopPropagation()}>
    <div className="form-head"><button className="icon-btn" aria-label="סגירה" onClick={onClose}><X size={22} /></button><div className="form-title">הדיווח שלי</div></div>
    <div className="body">
      <div className="wk-view-head"><span className="badge sm" style={{ background: s.bg, color: s.color }}>{s.label}</span><span className="wk-view-track"><tr.Icon size={14} /> {tr.short}</span></div>
      <h3 className="wk-view-subj">{report.subject}</h3>
      <div className="wk-view-desc">{report.description}</div>
      {photo && <div className="photo-prev" style={{ marginTop: 10 }}><img src={photo} alt="" /></div>}
      {report.status === "cancelled" && report.rejectReason && <div className="banner" style={{ marginTop: 14, background: "#FEE2E2", color: "#991B1B", borderColor: "#FCA5A5" }}><X size={16} /> הדיווח נדחה — {rejectLabel(report.rejectReason.code)}{report.rejectReason.comment ? `: ${report.rejectReason.comment}` : ""}</div>}
      {report.status === "rework" && (<>
        <div className="banner" style={{ marginTop: 14, background: "var(--primary-soft)", color: "var(--primary)", borderColor: "var(--primary-line)" }}><AlertTriangle size={16} /> המנהל החזיר לתיקון. הוסיפו פרטים/תמונה ושלחו שוב.</div>
        <label className="field" style={{ marginTop: 10 }}><span>הוספת הערה (אופציונלי)</span><textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></label>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => grab(e.target.files?.[0])} />
        {newPhoto ? <div className="photo-prev"><img src={newPhoto} alt="" /><button className="photo-x" onClick={() => setNewPhoto(null)}><X size={16} /></button></div> : <button className="photo-add" onClick={() => fileRef.current?.click()}><Camera size={20} /> החלפת תמונה</button>}
        <button className="btn-primary full" style={{ marginTop: 12 }} onClick={resubmit} disabled={busy}>{busy ? "שולח…" : "שליחה חוזרת"}</button>
      </>)}
      <SectionTitle>היסטוריה</SectionTitle>
      <div className="timeline">{[...(report.log || [])].reverse().map((l, i) => <div className="tl-item" key={i}><div className="tl-dot" /><div className="tl-body"><div className="tl-text">{l.text}</div><div className="tl-meta">{l.by} · {fmtDate(l.at)} {fmtTime(l.at)}</div></div></div>)}</div>
      <div style={{ height: 24 }} />
    </div>
  </div></div>);
}

/* ============================================================ LOGIN */
// Demo-only identities. Production mode disables this list through seed policy.
const BUILTIN_LOGINS = [
  { id: "builtin_admin", name: "ודים", role: "admin", email: "owner@example.local", password: "demo1234", dept: "הנהלה" },
  { id: "builtin_mgr", name: "מנהל מחלקה", role: "user", email: "manager@example.local", password: "demo1234", dept: "" },
  { id: "builtin_tech", name: "טכנאי", role: "tech", pin: "1234", supplier: "", shiftEnd: "16:30", techScope: "transport", techCats: [] },
  { id: "builtin_worker", name: "עובד מחסן", role: "worker", workerNo: "1042", pin: "1234", dept: "" },
  { id: "builtin_cleaner", name: "עובד ניקיון", role: "worker", workerNo: "1050", pin: "1234", dept: "ניקיון", depts: ["ניקיון"] },
];
const ANON_PROBLEMS = [{ label: "רצפה מלוכלכת / שלולית", kind: "dirty" }, { label: "אין סבון", kind: "dirty" }, { label: "אין נייר טואלט", kind: "dirty" }, { label: "פח מלא", kind: "dirty" }, { label: "ריח רע", kind: "dirty" }, { label: "שבר / תקלה (ברז · דלת · תאורה)", kind: "broken" }, { label: "אחר", kind: "dirty" }];
function PublicReport({ zones, onSubmit, onClose, scannedZoneId = "", allowManualZonePick = false, language = DEFAULT_LANGUAGE }) {
  const t = (key, vars) => uiText(language, key, vars);
  const active = useMemo(() => (zones || []).filter((z) => z.active !== false).sort(zoneSort), [zones]);
  const scannedZone = useMemo(() => findScannedCleaningZone(active, scannedZoneId), [active, scannedZoneId]);
  const [zone, setZone] = useState(scannedZone || null), [prob, setProb] = useState(null), [photo, setPhoto] = useState(null), [text, setText] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState(""), [done, setDone] = useState(false), [showScanner, setShowScanner] = useState(false), [showManual, setShowManual] = useState(false), [manualCode, setManualCode] = useState("");
  const fileRef = useRef(null);
  useEffect(() => { if (scannedZone && (!zone || zone.id !== scannedZone.id)) setZone(scannedZone); }, [scannedZone?.id]);
  const grab = (file) => { if (!file) return; const r = new FileReader(); r.onload = (e) => { const img = new Image(); img.onload = () => { const max = 1000; let { width, height } = img; if (width > height && width > max) { height = height * max / width; width = max; } else if (height > max) { width = width * max / height; height = max; } const c = document.createElement("canvas"); c.width = width; c.height = height; c.getContext("2d").drawImage(img, 0, 0, width, height); setPhoto(c.toDataURL("image/jpeg", 0.6)); setErr(""); }; img.src = e.target.result; }; r.readAsDataURL(file); };
  const acceptQrScan = (raw) => {
    setShowScanner(false);
    const scanned = extractCzoneFromRaw(raw);
    const found = findScannedCleaningZone(active, scanned);
    if (!found) {
      setErr(t("public.wrongQr"));
      return;
    }
    setZone(found);
    setErr("");
  };
  const submitManualQr = () => {
    const code = normalizeCleaningQrManualCode(manualCode);
    const found = active.find((z) => cleaningQrMatchesZone(code, z));
    if (!found) {
      setErr(t("public.wrongQr"));
      return;
    }
    setZone(found);
    setErr("");
  };
  const submit = async () => {
    if (busy) return;
    if (!prob) return setErr("נא לבחור סוג בעיה");
    if (!photo) return setErr("חובה לצרף תמונה — הדיווח לא יישלח בלעדיה");
    setBusy(true);
    try {
      const key = `anonrl_${zone.id}`;
      const last = Number(await store.get(key, false) || 0);
      const waitMs = 5 * 60 * 1000 - (Date.now() - last);
      if (waitMs > 0) {
        setBusy(false);
        return setErr(`דיווח כבר נשלח עבור אזור זה. ניתן לדווח שוב בעוד ${Math.max(1, Math.ceil(waitMs / 60000))} דקות.`);
      }
      await store.set(key, String(Date.now()), false);
    } catch (e) {}
    try {
      await onSubmit({ zoneId: zone.id, zoneName: zone.name, zoneLoc: zoneLoc(zone), kind: prob.kind, photo, text: text.trim() || prob.label, reportedById: "", reportedByName: "דיווח אנונימי", reportedByRole: "anonymous" });
    } catch (e) {
      setBusy(false);
      return setErr("שליחת הדיווח נכשלה. נסו שוב בעוד רגע.");
    }
    setDone(true);
  };
  return (<div className="pub-wrap"><div className="pub-card">
    <button className="icon-btn pub-x" aria-label={t("common.close")} onClick={onClose}><X size={20} /></button>
    {done ? <div className="pub-done"><CheckCircle2 size={44} color="#16A34A" /><div className="pub-done-t">{t("public.received")}</div><div className="pub-done-s">{t("public.receivedSub")}</div><button className="btn-primary full" onClick={onClose}>{t("common.close")}</button></div>
      : !zone ? <>
        <div className="pub-logo"><Sparkles size={24} /></div>
        <div className="pub-title">{t("public.title")}</div>
        <div className="pub-sub">{t("public.scanRequired")}</div>
        {active.length === 0 ? <div className="note">{t("public.noZones")}</div>
          : <><button className="btn-primary full pub-scan-btn" onClick={() => { setErr(""); setShowScanner(true); }}><Camera size={16} /> {t("cleaningQr.scanButton")}</button><button className="btn-ghost full sm" style={{ marginTop: 8 }} onClick={() => { setErr(""); setShowManual((v) => !v); }}>{t("cleaningQr.manualToggle")}</button>{showManual && <div className="field" style={{ marginTop: 8 }}><span>{t("cleaningQr.manualLabel")}</span><input value={manualCode} onChange={(e) => { setManualCode(e.target.value); setErr(""); }} placeholder={t("cleaningQr.manualPlaceholder")} /><button className="btn-ghost full sm" style={{ marginTop: 8 }} onClick={submitManualQr}>{t("cleaningQr.manualSubmit")}</button></div>}{allowManualZonePick ? <div className="pub-zones">{active.map((z) => <button key={z.id} className="pub-zone" onClick={() => setZone(z)}><div className="pub-zone-n">{z.name}</div><div className="pub-zone-l">{zoneLoc(z) || "—"}</div></button>)}</div> : <div className="note">{scannedZoneId ? t("public.wrongQr") : t("public.qrOnly")}</div>}</>}
        {err && <div className="err">{err}</div>}
      </> : <>
        <div className="pub-title">{zone.name}</div>
        <div className="pub-sub">{zoneLoc(zone) || ""}</div>
        <div className="field"><span>{t("public.problem")}</span><div className="pub-chips">{ANON_PROBLEMS.map((p) => <button key={p.label} className={"pub-chip" + (prob === p ? " on" : "")} onClick={() => { setProb(p); setErr(""); }}>{p.label}</button>)}</div></div>
        <div className="field"><span>{t("public.photoRequired")}</span><input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => grab(e.target.files?.[0])} />{photo ? <div className="photo-prev"><img src={photo} alt="" /><button className="photo-x" onClick={() => setPhoto(null)}><X size={16} /></button></div> : <button className="photo-add" onClick={() => fileRef.current?.click()}><Camera size={20} /> {t("public.addPhoto")}</button>}</div>
        <label className="field"><span>{t("public.detailsOptional")}</span><input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("public.detailsPlaceholder")} /></label>
        {err && <div className="err">{err}</div>}
        <button className="btn-primary full" onClick={submit} disabled={busy}>{t("public.submit")}</button>
        <button className="btn-ghost full sm" style={{ marginTop: 8 }} onClick={() => { setZone(null); setProb(null); setPhoto(null); setText(""); }}>{t("common.back")}</button>
        <div className="pub-foot">{t("public.approvalFoot")}</div>
      </>}
    {showScanner && <QRScannerOverlay onScan={acceptQrScan} onManual={() => { setShowScanner(false); setShowManual(true); setErr(t("cleaningQr.scanUnsupported")); }} onCancel={() => setShowScanner(false)} />}
  </div></div>);
}

function ScanPublicLanding({ zone, invalid, onReport, onLogin, language = DEFAULT_LANGUAGE }) {
  const t = (key, vars) => uiText(language, key, vars);
  return <div className="scan-public">
    <div className="pub-logo"><Camera size={24} /></div>
    <div className="pub-title">{invalid ? "QR לא מזוהה" : (zone?.name || "סריקת QR")}</div>
    <div className="pub-sub">{invalid ? "QR לא מזוהה — פנו למנהל" : (zoneLoc(zone) || "בחרו פעולה להמשך")}</div>
    {!invalid && <button className="btn-primary full" onClick={onReport}><AlertTriangle size={15} /> דיווח על בעיה</button>}
    <button className="btn-ghost full" style={{ marginTop: 8 }} onClick={onLogin}>כניסה לאפליקציה</button>
  </div>;
}

function InstallAppPrompt({ language = DEFAULT_LANGUAGE }) {
  const t = (key, vars) => uiText(language, key, vars);
  const [installEvent, setInstallEvent] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [standalone, setStandalone] = useState(() => isStandaloneDisplay({ matchMedia: window.matchMedia?.bind(window), navigator: window.navigator }));
  useEffect(() => {
    const updateStandalone = () => setStandalone(isStandaloneDisplay({ matchMedia: window.matchMedia?.bind(window), navigator: window.navigator }));
    const media = window.matchMedia?.("(display-mode: standalone)");
    media?.addEventListener?.("change", updateStandalone);
    const onBeforeInstall = (event) => {
      event.preventDefault();
      setInstallEvent(event);
      setDismissed(false);
    };
    const onInstalled = () => {
      setAccepted(true);
      setInstallEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      media?.removeEventListener?.("change", updateStandalone);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  if (dismissed || accepted) return null;
  const mode = pwaInstallPromptMode({
    beforeInstallPromptEvent: installEvent,
    isStandalone: standalone,
    userAgent: window.navigator?.userAgent || "",
    platform: window.navigator?.platform || "",
    maxTouchPoints: window.navigator?.maxTouchPoints || 0,
  });
  if (mode === "hidden") return null;
  const install = async () => {
    if (!installEvent) return;
    installEvent.prompt();
    const choice = await installEvent.userChoice.catch(() => null);
    if (choice?.outcome === "accepted") setAccepted(true);
    setInstallEvent(null);
  };
  const installIcon = mode === "ios" ? <Smartphone size={18} /> : <MonitorDown size={18} />;
  return <div className="install-prompt">
    <div className="install-ic">{installIcon}</div>
    <div className="install-copy">
      <b>{t("install.title")}</b>
      <span>{mode === "ios" ? t("install.iosHint") : t("install.browserHint")}</span>
    </div>
    {mode === "browser" && <button className="install-btn" type="button" onClick={install} aria-label={t("install.button")} title={t("install.button")}><Download size={16} /></button>}
    <button className="install-x" type="button" onClick={() => setDismissed(true)} aria-label={t("common.close")}><X size={15} /></button>
  </div>;
}

function Login({ users, config, onLogin, saveUser, theme, toggleTheme, language = DEFAULT_LANGUAGE, setLanguage = () => {}, zones, onAnonReport, builtinLogins = [], seedPolicy = SEED_POLICY, productionLoginConfig = PRODUCTION_LOGIN_CONFIG }) {
  const t = (key, vars) => uiText(language, key, vars);
  const [identifier, setIdentifier] = useState(""), [resolved, setResolved] = useState(null), [password, setPassword] = useState(""), [code, setCode] = useState(""), [err, setErr] = useState(""), [remember, setRemember] = useState(true), [pub, setPub] = useState(false), [busy, setBusy] = useState(false);
  const [skipScanLanding, setSkipScanLanding] = useState(false);
  const [initialSetup, setInitialSetup] = useState(null);
  const [passwordChange, setPasswordChange] = useState(null), [newPassword, setNewPassword] = useState(""), [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const active = users.filter((u) => u.active !== false);
  const productionLogin = seedPolicy.requiresServerBootstrapAdmin;
  const scannedZoneId = scannedCleaningZoneIdFromWindow();
  const scannedLandingZone = useMemo(() => findScannedCleaningZone(zones || [], scannedZoneId), [zones, scannedZoneId]);
  const productionConfigured = productionLoginReady(productionLoginConfig);
  useEffect(() => { store.get("login:v1", false).then((v) => { if (!v) return; try { const d = JSON.parse(v); setIdentifier(d.email || d.workerNo || d.phone || ""); } catch {} }); }, []);
  const remember_save = (data) => { if (remember) store.set("login:v1", JSON.stringify(data), false); else store.del("login:v1", false); };
  const finish = (u) => onLogin({ id: u.id, name: u.name, position: u.position || u.jobTitle || "", role: u.role, dept: u.dept, depts: u.depts || (u.dept ? [u.dept] : []), email: u.email || "", phone: u.phone || "", workerNo: u.workerNo || "", supplier: u.supplier || "", shiftStart: u.shiftStart || "", shiftEnd: u.shiftEnd || "16:30", shiftId: u.role === "tech" ? "" : (u.shiftId || ""), techScope: u.techScope || "transport", techCats: u.techCats || [], mgrZones: u.mgrZones || [], shift: u.shift || "", perms: normalizePerms(u), cleaningAccess: u.cleaningAccess || u.cleaning || false });
  const dfltDept = config?.departments?.[0] || "";
  const withDefaultDept = (u) => ({ ...u, dept: u.dept || ((u.role === "user" || u.role === "worker") ? dfltDept : "") });
  const rememberLogin = (u, idType) => {
    if (idType === "email") return remember_save({ email: u.email || identifier.trim(), mode: "user" });
    if (idType === "workerNo") return remember_save({ workerNo: u.workerNo || identifier.trim(), mode: "worker" });
    if (idType === "phone") return remember_save({ phone: u.phone || identifier.trim(), mode: "phone" });
    return remember_save({ mode: "tech" });
  };
  const submitIdentifier = async () => {
    if (productionLogin) {
      const cleanIdentifier = identifier.trim();
      const email = cleanIdentifier.toLowerCase();
      const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!cleanIdentifier) return setErr("הזינו דוא״ל או מספר עובד");
      if (!productionConfigured) return setErr("כניסת ייצור עדיין לא הוגדרה בשרת");
      setBusy(true);
      setErr("");
      try {
        const initial = await validateProductionInitialPassword({ identifier: cleanIdentifier, config: productionLoginConfig });
        if (initial?.needsSetup) {
          setInitialSetup({ source: "production", identifier: cleanIdentifier, identifierType: initial.identifierType || (looksLikeEmail ? "email" : "workerNo"), auth: initial.auth || "password", user: initial.user || { email: looksLikeEmail ? email : "", workerNo: looksLikeEmail ? "" : cleanIdentifier, name: cleanIdentifier, role: looksLikeEmail ? "user" : "worker" } });
          setResolved(null);
          setPassword("");
          setCode("");
          setNewPassword("");
          setNewPasswordConfirm("");
          return;
        }
        if (!looksLikeEmail) return setErr("לא נמצא משתמש מתאים");
        setResolved({ status: "active", identifierType: "email", auth: "password", source: "supabase", user: initial?.user || { email, name: email, role: "admin" } });
        setPassword("");
        setCode("");
      } catch (error) {
        if (error?.message === "initial_secret_already_configured") {
          if (error?.data?.auth === "password") {
            const serverUser = error?.data?.user || {};
            setResolved({
              status: "active",
              identifierType: error?.data?.identifierType || (looksLikeEmail ? "email" : "phone"),
              auth: "password",
              source: "supabase",
              user: {
                ...serverUser,
                email: serverUser.email || email,
                name: serverUser.name || serverUser.email || cleanIdentifier,
                role: serverUser.role || "user"
              }
            });
            setPassword("");
            setCode("");
            return;
          }
          if (!looksLikeEmail) {
            const serverUser = error?.data?.user || {};
            setResolved({
              status: "active",
              identifierType: error?.data?.identifierType || "workerNo",
              auth: error?.data?.auth || "pin",
              source: "production-pin",
              identifier: cleanIdentifier,
              user: {
                ...serverUser,
                name: serverUser.name || cleanIdentifier,
                role: serverUser.role || "worker",
                workerNo: serverUser.workerNo || (error?.data?.identifierType === "phone" ? "" : cleanIdentifier),
                phone: serverUser.phone || (error?.data?.identifierType === "phone" ? cleanIdentifier : "")
              }
            });
            setPassword("");
            setCode("");
            return;
          }
          setResolved({ status: "active", identifierType: "email", auth: "password", source: "supabase", user: { email, name: email, role: "admin" } });
          setPassword("");
          setCode("");
          return;
        }
        if (error?.message === "user_not_found" && looksLikeEmail) {
          setResolved({ status: "active", identifierType: "email", auth: "password", source: "supabase", user: { email, name: email, role: "admin" } });
          setPassword("");
          setCode("");
          return;
        }
        const _em = error?.message || "";
        setErr(
          _em === "user_not_found" ? "לא נמצא משתמש מתאים" :
          _em === "valid_email_required" ? "נדרש דוא״ל תקין לפני הגדרת סיסמה. פנו למנהל המערכת לעדכון המשתמש." :
          _em === "initial_password_auth_not_configured" ? "אימות לא מוגדר בשרת — פנו למנהל המערכת (SUPABASE_SERVICE_ROLE_KEY)" :
          _em === "initial_password_backend_not_configured" ? "שגיאת שרת — דרייבר KV לא מוגדר" :
          `לא ניתן לבדוק משתמש זה כרגע${_em ? ` (${_em})` : ""}`
        );
      } finally {
        setBusy(false);
      }
      return;
    }
    const res = resolveIdentifier(identifier, users, builtinLogins);
    if (res.status === "empty") return setErr("הזינו דוא״ל, טלפון או מספר עובד");
    if (res.status === "archived") return setErr("המשתמש אינו פעיל. פנו למנהל המערכת");
    if (res.status === "not_found") return setErr("לא נמצא משתמש מתאים");
    if (res.auth === "none") { rememberLogin(res.user, res.identifierType); return finish(withDefaultDept(res.user)); }
    if (res.source !== "builtin" && userNeedsInitialLoginSetup(res.user)) {
      setInitialSetup(res);
      setResolved(null);
      setPassword("");
      setCode("");
      setNewPassword("");
      setNewPasswordConfirm("");
      setErr("");
      return;
    }
    setResolved(res);
    setPassword("");
    setCode("");
    setErr("");
  };
  const submitSecret = async () => {
    if (!resolved) return submitIdentifier();
    if (productionLogin && resolved.source === "supabase") {
      if (!productionConfigured) return setErr("כניסת ייצור עדיין לא הוגדרה בשרת");
      if (!password) return setErr("הזינו סיסמה");
      setBusy(true);
      setErr("");
      try {
        const result = await loginWithProductionPassword({ email: resolved.user.email, password, remember, config: productionLoginConfig });
        remember_save({ email: resolved.user.email, mode: "production" });
        if (result.mustChangePassword) {
          setPasswordChange({ accessToken: result.accessToken, auth: result.auth, session: result.session });
          setPassword("");
          setNewPassword("");
          setNewPasswordConfirm("");
          return;
        }
        await onLogin(result.session, { productionAuth: result.auth, remember });
      } catch (error) {
        setErr(error?.message === "production_login_not_configured" ? "כניסת ייצור עדיין לא הוגדרה בשרת" : "הכניסה נכשלה. בדקו דוא״ל וסיסמה או פנו למנהל המערכת");
      } finally {
        setBusy(false);
      }
      return;
    }
    if (productionLogin && resolved.source === "production-pin") {
      if (!productionConfigured) return setErr("כניסת ייצור עדיין לא הוגדרה בשרת");
      if (!code.trim()) return setErr("הזינו קוד אישי");
      setBusy(true);
      setErr("");
      try {
        const result = await loginWithProductionPin({ identifier: resolved.identifier || resolved.user.workerNo || identifier.trim(), pin: code.trim(), remember, config: productionLoginConfig });
        remember_save({ workerNo: result.session?.workerNo || resolved.user.workerNo || identifier.trim(), mode: "worker" });
        await onLogin(result.session, { productionAuth: result.auth, remember });
      } catch (error) {
        setErr(error?.message === "pin_login_failed" ? "הקוד שגוי" : `הכניסה נכשלה${error?.message ? ` (${error.message})` : ""}`);
      } finally {
        setBusy(false);
      }
      return;
    }
    const u = resolved.user;
    if (resolved.auth === "password" && (u.password || "") !== password) return setErr("הסיסמה שגויה");
    if (resolved.auth === "pin" && (u.pin || "") !== code.trim()) return setErr("הקוד שגוי");
    rememberLogin(u, resolved.identifierType);
    finish(withDefaultDept(u));
  };
  const submitInitialSecret = async () => {
    if (!initialSetup?.user) return setErr("נדרש לבחור משתמש מחדש");
    const usesPassword = initialSetup.auth === "password" || isPasswordActivationRole(initialSetup.user.role);
    const nextSecret = newPassword.trim();
    const confirmSecret = newPasswordConfirm.trim();
    if (usesPassword && nextSecret.length < 6) return setErr("בחרו סיסמה בת 6 תווים לפחות");
    if (!usesPassword && nextSecret.length < 4) return setErr("בחרו קוד אישי בן 4 ספרות לפחות");
    if (nextSecret !== confirmSecret) return setErr(usesPassword ? "הסיסמאות אינן זהות" : "הקודים אינם זהים");
    setBusy(true);
    setErr("");
    try {
      if (initialSetup.source === "production") {
        const result = await completeProductionInitialPassword({
          identifier: initialSetup.identifier || identifier,
          password: usesPassword ? nextSecret : undefined,
          pin: usesPassword ? undefined : nextSecret,
          remember,
          config: productionLoginConfig
        });
        if (usesPassword) remember_save({ email: result.session?.email || initialSetup.user.email || identifier.trim().toLowerCase(), mode: "production" });
        else remember_save({ workerNo: result.session?.workerNo || initialSetup.user.workerNo || identifier.trim(), mode: "worker" });
        await onLogin(result.session, { productionAuth: result.auth, remember });
        return;
      }
      if (!saveUser) return setErr("לא ניתן לשמור כניסה בסביבה זו");
      const u = {
        ...initialSetup.user,
        password: usesPassword ? nextSecret : "",
        pin: usesPassword ? "" : nextSecret,
        activationToken: "",
        activationStatus: "activated",
        activatedAt: Date.now()
      };
      if (await saveUser(u) === false) return setErr("שמירת הכניסה נכשלה");
      rememberLogin(u, initialSetup.identifierType);
      finish(withDefaultDept(u));
    } catch (error) {
      const _em = error?.message || "";
      setErr(
        _em === "password_too_short" ? "בחרו סיסמה בת 6 תווים לפחות" :
        _em === "pin_too_short" ? "בחרו קוד אישי בן 4 ספרות לפחות" :
        _em === "valid_email_required" ? "נדרש דוא״ל תקין לפני הגדרת סיסמה. פנו למנהל המערכת לעדכון המשתמש." :
        _em === "initial_secret_already_configured" ? "כבר הוגדרה כניסה למשתמש זה" :
        _em === "initial_password_auth_not_configured" ? "אימות לא מוגדר בשרת — פנו למנהל המערכת (SUPABASE_SERVICE_ROLE_KEY)" :
        _em === "initial_password_backend_not_configured" ? "שגיאת שרת — דרייבר KV לא מוגדר" :
        _em === "user_not_found" ? "המשתמש לא נמצא. פנו למנהל המערכת" :
        _em === "auth_user_create_failed" ? "יצירת משתמש נכשלה. פנו למנהל המערכת" :
        _em === "app_user_upsert_failed" ? "שמירת פרופיל נכשלה. פנו למנהל המערכת" :
        _em === "initial_password_login_failed" ? "ההגדרה הצליחה אך הכניסה נכשלה — נסו להתחבר שוב" :
        `לא ניתן לשמור כניסה כרגע${_em ? ` (${_em})` : ""}`
      );
    } finally {
      setBusy(false);
    }
  };
  const submitNewPassword = async () => {
    if (!passwordChange?.accessToken && !passwordChange?.auth?.cookieSession) return setErr("נדרש להתחבר מחדש");
    if (newPassword.length < 6) return setErr("הסיסמה החדשה חייבת לכלול לפחות 6 תווים");
    if (newPassword !== newPasswordConfirm) return setErr("הסיסמאות אינן זהות");
    setBusy(true);
    setErr("");
    try {
      const result = await changeProductionPassword({ accessToken: passwordChange.accessToken, newPassword, config: productionLoginConfig });
      await onLogin(result.session, { productionAuth: passwordChange.auth, remember });
    } catch (error) {
      setErr(error?.message === "production_login_not_configured" ? "כניסת ייצור עדיין לא הוגדרה בשרת" : "לא ניתן היה להחליף סיסמה. נסו שוב או פנו למנהל המערכת");
    } finally {
      setBusy(false);
    }
  };
  const initialSecretIdentifierLabel = () => {
    if (isPasswordActivationRole(initialSetup?.user?.role)) return "הדוא״ל";
    if (initialSetup?.identifierType === "phone") return "מספר הטלפון";
    return "מספר העובד";
  };
  const initialSecretIdentifierValue = () => (
    initialSetup?.identifierType === "phone"
      ? (initialSetup.user?.phone || initialSetup.identifier || identifier.trim())
      : (initialSetup.user?.workerNo || initialSetup.user?.email || initialSetup.identifier || identifier.trim())
  );
  return (
    <div className="login-bg">
      <div className="login-card">
        <div className="login-card-head">
          <div className="brand"><BrandMark logo={config?.brandLogo} /><div><div className="brand-title">{brandCompanyName(config)}</div>{brandSiteSubtitle(config) && <div className="brand-sub">{brandSiteSubtitle(config)}</div>}</div></div>
          <button className="login-theme" onClick={toggleTheme} aria-label={theme === "dark" ? "מצב בהיר" : "מצב כהה"}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button>
        </div>
        <LanguagePicker value={language} onChange={setLanguage} />
        {scannedZoneId && !skipScanLanding && !passwordChange && !initialSetup && !resolved ? <ScanPublicLanding zone={scannedLandingZone} invalid={!scannedLandingZone} language={language} onReport={() => setPub(true)} onLogin={() => setSkipScanLanding(true)} /> : passwordChange ? (<>
          <div className="login-q">{t("login.firstPassword")}</div>
          <div className="hint" style={{ marginBottom: 10 }}>נדרש להגדיר סיסמה חדשה לפני כניסה למערכת.</div>
          <label className="field"><span>{t("login.newPassword")}</span><input className="ltr-input" dir="ltr" value={newPassword} onChange={(e) => { setNewPassword(e.target.value); setErr(""); }} type="password" placeholder="לפחות 6 תווים" onKeyDown={(e) => e.key === "Enter" && submitNewPassword()} autoFocus /><div className="hint">לפחות 6 תווים. מומלץ לשלב אות גדולה או סימן, אבל אין דרישת מורכבות קשיחה.</div></label>
          <label className="field"><span>{t("login.confirmPassword")}</span><input className="ltr-input" dir="ltr" value={newPasswordConfirm} onChange={(e) => { setNewPasswordConfirm(e.target.value); setErr(""); }} type="password" placeholder="הקלידו שוב" onKeyDown={(e) => e.key === "Enter" && submitNewPassword()} /></label>
          {err && <div className="err">{err}</div>}
          <button className="btn-primary full" onClick={submitNewPassword} disabled={busy}>{busy ? "שומר…" : t("login.saveAndEnter")}</button>
          <button className="btn-ghost full sm" style={{ marginTop: 8 }} onClick={() => { setPasswordChange(null); setResolved(null); setPassword(""); setNewPassword(""); setNewPasswordConfirm(""); setErr(""); }}>{t("login.back")}</button>
        </>) : initialSetup ? (<>
          <div className="login-q">{isPasswordActivationRole(initialSetup.user?.role) ? "הגדרת סיסמה ראשונה" : "הגדרת קוד אישי ראשון"}</div>
          <div className="hint" style={{ marginBottom: 10 }}>שלום {initialSetup.user?.name || ""}. הגדירו {isPasswordActivationRole(initialSetup.user?.role) ? "סיסמה אישית" : "קוד אישי"} לכניסה עם {initialSecretIdentifierLabel()} <bdi dir="ltr">{initialSecretIdentifierValue()}</bdi>.</div>
          <label className="field"><span>{isPasswordActivationRole(initialSetup.user?.role) ? "סיסמה חדשה" : "קוד אישי חדש"}</span><input className="ltr-input" dir="ltr" value={newPassword} onChange={(e) => { setNewPassword(e.target.value); setErr(""); }} type="password" inputMode={isPasswordActivationRole(initialSetup.user?.role) ? undefined : "numeric"} placeholder="" onKeyDown={(e) => e.key === "Enter" && submitInitialSecret()} autoFocus /></label>
          <label className="field"><span>{isPasswordActivationRole(initialSetup.user?.role) ? "אישור סיסמה" : "אישור קוד"}</span><input className="ltr-input" dir="ltr" value={newPasswordConfirm} onChange={(e) => { setNewPasswordConfirm(e.target.value); setErr(""); }} type="password" inputMode={isPasswordActivationRole(initialSetup.user?.role) ? undefined : "numeric"} placeholder="" onKeyDown={(e) => e.key === "Enter" && submitInitialSecret()} /></label>
          {err && <div className="err">{err}</div>}
          <button className="btn-primary full" onClick={submitInitialSecret} disabled={busy}>{busy ? "שומר…" : "שמירה וכניסה"}</button>
          <button className="btn-ghost full sm" style={{ marginTop: 8 }} onClick={() => { setInitialSetup(null); setNewPassword(""); setNewPasswordConfirm(""); setErr(""); }}>{t("login.back")}</button>
        </>) : !resolved ? (<>
          <div className="login-q">{t("login.title")}</div>
          <label className="field"><span>{t("login.identity")}</span><input className="ltr-input" dir="ltr" value={identifier} onChange={(e) => { setIdentifier(e.target.value); setErr(""); }} autoCapitalize="off" placeholder="" onKeyDown={(e) => e.key === "Enter" && submitIdentifier()} autoFocus /></label>
          <label className="chk-line"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> {t("login.remember")}</label>
          {err && <div className="err">{err}</div>}
          <button className="btn-primary full" onClick={submitIdentifier} disabled={busy}>{busy ? "בודק…" : t("login.continue")}</button>
        </>) : (<>
          <div className="login-q">{t("login.hello", { name: resolved.user.name })}</div>
          <div className="hint" style={{ marginBottom: 10 }}>{resolved.identifierType === "email" ? t("login.enterPassword") : t("login.enterPin")}</div>
          {resolved.auth === "password" ? <label className="field"><span>{t("login.password")}</span><input className="ltr-input" dir="ltr" value={password} onChange={(e) => { setPassword(e.target.value); setErr(""); }} type="password" placeholder="" onKeyDown={(e) => e.key === "Enter" && submitSecret()} autoFocus /></label>
            : <label className="field"><span>{t("login.pinCode")}</span><input className="ltr-input" dir="ltr" value={code} onChange={(e) => { setCode(e.target.value); setErr(""); }} type="password" inputMode="numeric" placeholder="" onKeyDown={(e) => e.key === "Enter" && submitSecret()} autoFocus /></label>}
          <label className="chk-line"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> {t("login.remember")}</label>
          {err && <div className="err">{err}</div>}
          <button className="btn-primary full" onClick={submitSecret} disabled={busy}>{busy ? t("login.connecting") : t("login.signIn")}</button>
          <button className="btn-ghost full sm" style={{ marginTop: 8 }} onClick={() => { setResolved(null); setPassword(""); setCode(""); setErr(""); }}>{t("login.back")}</button>
        </>)}
        {seedPolicy.allowBuiltinDemoUsers && <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", marginTop: 12, lineHeight: 1.6, background: "var(--surface-2)", padding: "8px 10px", borderRadius: 8 }}>גישת הדגמה: owner@example.local + סיסמה demo1234 · עובד 1042 + קוד 1234 · טכנאי 1234</div>}
        <div className="login-foot">{seedPolicy.allowBuiltinDemoUsers ? "גרסת הדגמה · ה-PIN/סיסמה אינם אבטחה אמיתית" : <><span><span>{t("login.developedBy")} </span><bdi dir="ltr">Vadim Demchuk</bdi><span> · </span><bdi dir="ltr">2026</bdi></span><span><span>{t("login.version")} </span><bdi dir="ltr">v{APP_VERSION}</bdi></span></>}</div>
        <InstallAppPrompt language={language} />
        <button className="pub-entry" onClick={() => setPub(true)}><AlertTriangle size={15} /> {t("login.reportWithoutLogin")}</button>
      </div>
      {pub && <PublicReport zones={zones} scannedZoneId={scannedZoneId} allowManualZonePick={seedPolicy.allowDemoData} language={language} onSubmit={onAnonReport} onClose={() => setPub(false)} />}
    </div>
  );
}

/* ============================================================ USER APP */
function UserApp(p) {
  const { session, config, fleet, tickets, pm, presence, users, zones, rounds, complaints, saveTicket, saveUser, delUser, fileComplaint, resolveComplaint, onLogout, theme, toggleTheme } = p;
  const [view, setView] = useState("bi");
  const [overlay, setOverlay] = useState(null), [filter, setFilter] = useState("open"), [ticketNav, setTicketNav] = useState(null), [showNotif, setShowNotif] = useState(false), [showAI, setShowAI] = useState(false), [aiDraft, setAiDraft] = useState(null), [pmView, setPmView] = useState(null), [uEdit, setUEdit] = useState(null), [deptTab, setDeptTab] = useState("equip"), [deptNav, setDeptNav] = useState(null), [taskNav, setTaskNav] = useState(null);
  const askAI = (draft) => { setAiDraft(draft || null); setShowAI(true); };
  const goNotif = (go, ev) => { setShowNotif(false); if (go === "tickets") { setView("tickets"); } else if (go === "tasks") { setView("tasks"); } else if (go === "team") { setView("dept"); setDeptTab("team"); } else if (go === "cleaning") { setView("dept"); setDeptTab("cleaning"); } else { setView("dept"); setDeptTab("equip"); setDeptNav(ev?.fleetId ? { fleetId: ev.fleetId, _t: Date.now() } : null); } };
  const notif = useNotifications(session, tickets, pm, fleet, config, presence, zones, rounds, complaints, users, [], p.tasks, p.meetings, p.ppeReqs);
  const mine = useMemo(() => visibleTickets(session, tickets, fleet), [tickets, session, fleet]);
  const ticketRows = useMemo(() => ticketNav ? mine.filter((ticket) => ticketMatchesBIFocus(ticket, ticketNav, { fleet, zones, config })) : mine, [mine, ticketNav, fleet, zones, config]);
  const myPm = useMemo(() => pmVisible(session, pm, fleet), [pm, fleet, session]);
  const deptWorkers = useMemo(() => { const md = userDepts(session); return (users || []).filter((u) => u.role === "worker" && md.includes(u.dept || "")).sort((a, b) => (a.name || "").localeCompare(b.name || "", "he")); }, [users, session]);
  const pmSoon = useMemo(() => myPm.filter((x) => daysLeft(x.nextDue) <= 7).sort((a, b) => a.nextDue - b.nextDue), [myPm]);
  const openTicket = (id) => setOverlay({ type: "detail", id });
  const needAct = ticketRows.filter((t) => ticketRequiresManagerAction(session, t)).length;
  const goUserTickets = (nav = {}) => { setTicketNav(nav.focus || nav.track ? { ...nav } : null); setFilter(nav.st || "open"); setView("tickets"); };
  const goUserDept = (tab = "equip", nav = null) => { setDeptTab(tab); setDeptNav(nav ? { ...nav, _t: Date.now() } : null); setView("dept"); };
  const mayViewUsers = canViewUsers(session);
  const mayManageUsers = canManageUsers(session);
  const mayViewAudit = canViewAudit(session);
  const mayManagePpe = canManagePpe(session);
  const mayViewSuppliers = canViewSuppliers(session);
  const mayManageSuppliers = canManageSuppliers(session);
  const mayManageSettings = canManageSettings(session);
  const activeView = view === "activity" && !mayViewAudit ? "bi" : view === "ppe" && !mayManagePpe ? "bi" : view === "teamAdmin" && !mayViewUsers ? "bi" : view === "suppliers" && !mayViewSuppliers ? "bi" : view === "settings" && !mayManageSettings ? "bi" : view;
  const pageTitle = activeView === "bi" ? "BI" : activeView === "activity" ? "יומן פעילות" : activeView === "ppe" ? "ביגוד עובדים" : activeView === "settings" ? "הגדרות" : activeView === "teamAdmin" ? "צוות ומשתמשים" : activeView === "suppliers" ? "ספקים / קבלנים" : activeView === "dept" ? "המחלקה שלי" : "הקריאות שלי";
  const userNav = [
    { id: "bi", Icon: Gauge, label: "BI", active: activeView === "bi", onClick: () => setView("bi") },
    { id: "tickets", Icon: ListChecks, label: "קריאות", active: activeView === "tickets", onClick: () => { setTicketNav(null); setView("tickets"); } },
    { id: "tasks", Icon: ClipboardList, label: "מטלות", active: activeView === "tasks", onClick: () => setView("tasks") },
    { id: "dept", Icon: Users, label: "המחלקה", active: activeView === "dept", onClick: () => setView("dept") },
    mayManagePpe ? { id: "ppe", Icon: Shirt, label: "ביגוד עובדים", active: activeView === "ppe", onClick: () => setView("ppe") } : null,
    mayViewUsers ? { id: "teamAdmin", Icon: ShieldCheck, label: "צוות ומשתמשים", active: activeView === "teamAdmin", onClick: () => setView("teamAdmin") } : null,
    mayViewSuppliers ? { id: "suppliers", Icon: Building2, label: "ספקים / קבלנים", active: activeView === "suppliers", onClick: () => setView("suppliers") } : null,
    mayManageSettings ? { id: "settings", Icon: Settings, label: "הגדרות", active: activeView === "settings", onClick: () => setView("settings") } : null,
    mayViewAudit ? { id: "activity", Icon: Clock, label: "יומן", active: activeView === "activity", onClick: () => setView("activity") } : null,
  ].filter(Boolean);
  return (
    <div className="app-root">
      <Sidebar session={session} config={config} onLogout={onLogout} notif={notif} onBell={() => setShowNotif((v) => !v)} rolePreview={p.rolePreview} theme={theme} toggleTheme={toggleTheme} onReportIssue={p.onReportIssue} onProfile={p.onProfile}
        primary={{ label: "פתיחת קריאה", onClick: () => setOverlay({ type: "new" }) }}
        nav={userNav} />
      <div className="main-col">
        <TopBar title={pageTitle} subtitle={session.name + (userDepts(session).length ? " · " + userDepts(session).join(", ") : "")} onLogout={onLogout} notif={notif} onBell={() => setShowNotif((v) => !v)} rolePreview={p.rolePreview} theme={theme} toggleTheme={toggleTheme} onProfile={p.onProfile} onReportIssue={p.onReportIssue} demoActive={p.demoActive} />
        <div className="content with-nav">
          {activeView === "bi" ? <BIOverview {...p} onOpenTicket={openTicket} onGoTickets={goUserTickets} onGoAssets={(nav) => goUserDept("equip", nav || {})} onGoCleaning={() => goUserDept("cleaning")} onGoPpe={() => goUserDept("ppe")} onGoTasks={(nav) => { setTaskNav(nav || null); setView("tasks"); }} />
          : activeView === "tickets" ? (<>
            {needAct > 0 && <div className="banner"><AlertTriangle size={16} /> {countLabel(needAct, "קריאה דורשת", "קריאות דורשות")} פעולה שלך</div>}
            {ticketNav?.focus?.label && <div className="note bi-filter-note"><span>{ticketNav.focus.label}</span><button className="btn-ghost sm" onClick={() => setTicketNav(null)}>נקה סינון</button></div>}
            <div className="stat-strip">
              <div className="stat-box"><div className="stat-num">{ticketRows.filter(isOpen).length}</div><div className="stat-lbl">פתוחות</div></div>
              <div className="stat-box"><div className="stat-num" style={{ color: "#0D9488" }}>{needAct}</div><div className="stat-lbl">דורשות פעולה</div></div>
              <div className="stat-box"><div className="stat-num">{ticketRows.length}</div><div className="stat-lbl">סה״כ</div></div>
            </div>
            {(() => { const techs = (users || []).filter((u) => u.role === "tech" && u.active !== false); return <><SectionTitle><HardHat size={15} /> נוכחות טכנאים</SectionTitle>{techs.length === 0 ? <div className="note" style={{ marginBottom: 12 }}>אין טכנאים מוגדרים.</div> : <div className="tech-strip">{techs.map((u) => { const pr = presenceOf(presence, u.id); return <span key={u.id} className="tech-chip"><span className={"presence-dot" + (isPresenceOnline(pr) ? " on" : "")} />{u.name}{u.supplier ? <span className="tech-chip-sup"> · {u.supplier}</span> : ""}<span className="tech-chip-stat">{shiftPresenceStatusText(pr)}{(() => { const z = shiftIdle(pr, u, config); return z.lateMin > 0 ? " · איחר " + z.lateMin + " ד׳" : z.earlyMin > 0 ? " · מוקדם " + z.earlyMin + " ד׳" : ""; })()}</span></span>; })}</div>}</>; })()}
            {pmSoon.length > 0 && <><SectionTitle><CalendarClock size={15} /> טיפולים לכלי המחלקה — להוצאה לטכנאי</SectionTitle><div className="cards" style={{ marginBottom: 6 }}>{pmSoon.slice(0, 6).map((x) => { const d = daysLeft(x.nextDue); const f = pmFleet(x, fleet); return <button key={x.id} className="attn-row" onClick={() => setPmView(x)}><span className="attn-dot" style={{ background: pmColor(d) }} /><span className="attn-main"><span className="attn-subj">{f ? `${unitLabel(f, config)}` : "כלי"}</span><span className="attn-meta">{x.title || "טיפול תקופתי"}</span></span><span className="attn-tag" style={{ color: pmColor(d), background: pmColor(d) + "1a" }}>{d < 0 ? "באיחור" : d === 0 ? "היום" : `בעוד ${d} י׳`}</span></button>; })}</div></>}
            <div className="row-between"><div className="chips">{[["open", "פתוחות"], ["closed", "סגורות"], ["all", "הכל"]].map(([id, lbl]) => <button key={id} className={"chip" + (filter === id ? " on" : "")} onClick={() => { setFilter(id); setTicketNav(null); }}>{lbl}</button>)}</div></div>
            {(() => {
              if (filter === "open") {
                const openT = ticketRows.filter(isOpen);
                const needEquip = openT.filter((t) => t.status === "waiting" && t.waitingReason === "no_equipment");
                const workerReports = openT.filter((t) => isWorkerReport(t) && (t.status === "pending_manager" || t.status === "rework"));
                const awaiting = openT.filter((t) => ticketRequiresManagerAction(session, t) && !needEquip.includes(t) && !workerReports.includes(t));
                const deptFollowUp = openT.filter((t) => ticketNeedsManagerScopeFollowUp(session, t) && !needEquip.includes(t) && !workerReports.includes(t) && !awaiting.includes(t));
                const atTech = openT.filter((t) => ballIn(t) === "tech");
                const atAdmin = openT.filter((t) => ballIn(t) === "admin");
                if (openT.length === 0) return <Empty text="אין קריאות פתוחות" Icon={ListChecks} sub="פתחו קריאה חדשה בלחיצה על הכפתור" />;
                return <>
                  {workerReports.length > 0 && <><SectionTitle><UserPlus size={15} color="#EA580C" /> פעולה שלך — דיווחי עובדים לבדיקה ({workerReports.length})</SectionTitle><div className="cards">{sortByImportance(workerReports, config).map((t) => <TicketCard key={t.id} t={t} admin fleet={fleet} users={users} config={config} onClick={() => openTicket(t.id)} />)}</div></>}
                  {needEquip.length > 0 && <><SectionTitle><Truck size={15} color="#DC2626" /> פעולה שלך — יש להעביר כלי לטכנאי ({needEquip.length})</SectionTitle><div className="cards">{sortByImportance(needEquip, config).map((t) => <TicketCard key={t.id} t={t} admin fleet={fleet} users={users} config={config} onClick={() => openTicket(t.id)} />)}</div></>}
                  {awaiting.length > 0 && <><SectionTitle><CheckCircle2 size={15} color="#0D9488" /> פעולה שלך — ממתינות לאישורך ({awaiting.length})</SectionTitle><div className="cards">{sortByImportance(awaiting, config).map((t) => <TicketCard key={t.id} t={t} admin fleet={fleet} users={users} config={config} onClick={() => openTicket(t.id)} />)}</div></>}
                  {deptFollowUp.length > 0 && <><SectionTitle><Users size={15} color="#64748B" /> מעקב מחלקתי — ממתינות לפעולת הפותח ({deptFollowUp.length})</SectionTitle><div className="cards">{sortByImportance(deptFollowUp, config).map((t) => <TicketCard key={t.id} t={t} admin fleet={fleet} users={users} config={config} onClick={() => openTicket(t.id)} />)}</div></>}
                  <SectionTitle><Wrench size={15} /> מעקב — בטיפול הטכנאי ({atTech.length})</SectionTitle>
                  {atTech.length === 0 ? <div className="note">אין קריאות בטיפול.</div> : <div className="cards">{sortByImportance(atTech, config).map((t) => <TicketCard key={t.id} t={t} admin fleet={fleet} users={users} config={config} onClick={() => openTicket(t.id)} />)}</div>}
                  {atAdmin.length > 0 && <><SectionTitle><ShieldCheck size={15} color="#1F4E8C" /> מעקב — אצל מנהל המערכת ({atAdmin.length})</SectionTitle><div className="cards">{sortByImportance(atAdmin, config).map((t) => <TicketCard key={t.id} t={t} admin fleet={fleet} users={users} config={config} onClick={() => openTicket(t.id)} />)}</div></>}
                </>;
              }
              const list = filter === "closed" ? ticketRows.filter((t) => !isOpen(t)) : ticketRows;
              return list.length === 0 ? <Empty text="אין קריאות להצגה" Icon={ListChecks} /> : <div className="cards">{sortByImportance(list, config).map((t) => <TicketCard key={t.id} t={t} admin fleet={fleet} users={users} config={config} onClick={() => openTicket(t.id)} />)}</div>;
            })()}
          </>) : activeView === "activity" ? (<AuditLog session={session} tickets={tickets} fleet={fleet} config={config} onOpenTicket={openTicket} />) : activeView === "ppe" && mayManagePpe ? (<PpeHub {...p} onAskAI={aiAssistantEnabled(config) ? askAI : null} />) : activeView === "settings" && mayManageSettings ? (<SettingsPanel {...p} />) : activeView === "tasks" ? (<ManageHub {...p} focusTaskId={taskNav} onTaskFocusConsumed={() => setTaskNav(null)} onAskAI={aiAssistantEnabled(config) ? askAI : null} />) : activeView === "teamAdmin" && mayViewUsers ? (<SettingsPanel {...p} only="users" canManageUsers={mayManageUsers} />) : activeView === "suppliers" && mayViewSuppliers ? (<SuppliersPanel config={config} saveConfig={p.saveConfig} orders={p.ppeOrders} fleet={fleet} tickets={tickets} users={users} saveFleet={p.saveFleet} saveUser={saveUser} savePpeOrder={p.savePpeOrder} onOpenTicket={openTicket} canManage={mayManageSuppliers} onAskAI={aiAssistantEnabled(config) ? askAI : null} />) : (<>
            <div className="seg-tabs s5" style={{ maxWidth: 760, marginBottom: 14 }}><button className={deptTab === "equip" ? "on" : ""} onClick={() => setDeptTab("equip")}>כלי שינוע</button><button className={deptTab === "ppe" ? "on" : ""} onClick={() => setDeptTab("ppe")}>ביגוד עובדים</button><button className={deptTab === "reports" ? "on" : ""} onClick={() => setDeptTab("reports")}>דיווחי עובדים</button><button className={deptTab === "cleaning" ? "on" : ""} onClick={() => setDeptTab("cleaning")}>ניקיון</button><button className={deptTab === "team" ? "on" : ""} onClick={() => setDeptTab("team")}>עובדי המחלקה</button></div>
            {deptTab === "ppe" ? <PpeHub {...p} onAskAI={aiAssistantEnabled(config) ? askAI : null} />
              : deptTab === "reports" ? <WorkerReportsAnalytics tickets={tickets} depts={userDepts(session)} />
              : deptTab === "cleaning" ? <ManagerCleaning session={session} zones={zones} rounds={rounds} complaints={complaints} fileComplaint={fileComplaint} resolveComplaint={resolveComplaint} config={config} language={p.language} />
              : deptTab === "team" ? <>
                <div className="row-between"><SectionTitle><Users size={15} /> עובדי המחלקה{session.dept ? ` · ${session.dept}` : ""}</SectionTitle><button className="btn-primary sm" onClick={() => setUEdit({})}><UserPlus size={15} /> הוסף עובד</button></div>
                <div className="note">העובדים מדווחים תקלות שמגיעות אליך לבדיקה. הם נכנסים עם מספר עובד + קוד שתגדירו כאן.</div>
                {deptWorkers.length === 0 ? <Empty text="אין עובדים במחלקה" Icon={Users} sub="הוסיפו עובד בלחיצה על «הוסף עובד»" /> : <div className="cards">{deptWorkers.map((u) => <button key={u.id} className="tcard" onClick={() => setUEdit(u)} style={{ borderInlineStartColor: u.active ? "#16A34A" : "var(--muted)" }}><span className="avatar"><User size={18} /></span><div className="tcard-main"><div className="tcard-row1"><span className="tcard-subj">{u.name}</span><span className="badge sm" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>עובד</span></div><div className="tcard-sub">מס׳ עובד {u.workerNo || "—"} · {u.active ? "פעיל" : "מושבת"} · {userHasLoginSecret(u) ? userPresenceStatusText(presenceOf(presence, u.id)) : workerLoginStateText(u)}</div></div></button>)}</div>}
              </>
              : <ManagerFleet {...p} deptNav={deptNav} onAskAI={aiAssistantEnabled(config) ? askAI : null} />}
          </>)}
        </div>
      </div>
      {activeView === "tickets" && <button className="fab" onClick={() => setOverlay({ type: "new" })}><Plus size={24} /><span>קריאה חדשה</span></button>}
      <MobileBottomNav nav={userNav} primaryIds={["bi", "tickets", "dept"]} />
      {aiAssistantEnabled(config) && <AIFab onClick={() => askAI(null)} />}
      {overlay?.type === "new" && <Overlay persistent onClose={() => setOverlay(null)}><TicketForm {...p} prefill={overlay.prefill} onOpenTicket={(id) => setOverlay({ type: "detail", id })} onCancel={() => setOverlay(null)} onCreate={async (t) => { const ok = await saveTicket(t); if (ok !== false) setOverlay(null); return ok; }} /></Overlay>}
      {overlay?.type === "detail" && <Overlay onClose={() => setOverlay(null)}><TicketDetail {...p} ticket={tickets.find((x) => x.id === overlay.id)} onBack={() => setOverlay(null)} onOpenTicket={(id) => setOverlay({ type: "detail", id })} onRepeat={(pf) => setOverlay({ type: "new", prefill: pf })} onAskAI={aiAssistantEnabled(config) ? askAI : null} /></Overlay>}
      {pmView && <Overlay onClose={() => setPmView(null)}><Suspense fallback={<div className="ovl-inner"><div className="note">טוען שיבוץ טיפול…</div></div>}><FleetPMEntryLazy ui={fleetAssetsUi()} task={pm.find((x) => x.id === pmView.id) || pmView} session={session} fleet={fleet} tickets={tickets} config={config} canManage={false} onClose={() => setPmView(null)} onSave={() => {}} /></Suspense></Overlay>}
      {uEdit && <Overlay persistent onClose={() => setUEdit(null)}><UserForm user={uEdit} config={config} users={users} session={session} canManageUsers={canManageUsers(session)} canDelete={!!uEdit.id} lockRole="worker" lockDept={session.dept || ""} canManageWorkerAccess={canManageWorkerAccess(session)} onCancel={() => setUEdit(null)} onSave={async (u) => { const ok = await saveUser(u); if (ok !== false) setUEdit(shouldKeepWorkerFormOpenForActivationLink(u, canManageWorkerAccess(session)) ? u : null); return ok; }} onDelete={async () => { const ok = await delUser(uEdit.id); if (ok !== false) setUEdit(null); return ok; }} /></Overlay>}
      {showNotif && <NotifPanel notif={notif} language={p.language} onClose={() => setShowNotif(false)} onOpen={(id) => { setShowNotif(false); setView("tickets"); openTicket(id); }} onGo={goNotif} />}
      {showAI && <LazyAIPanel {...p} initialText={aiDraft?.text || ""} initialWorkflow={aiDraft?.workflow} openAiTicketDraft={(prefill) => { setShowAI(false); setAiDraft(null); setOverlay({ type: "new", prefill }); }} onClose={() => { setShowAI(false); setAiDraft(null); }} />}
      {notif.toast && <Toast t={notif.toast} onClose={notif.dismissToast} />}
    </div>
  );
}

/* ============================================================ TECH APP */
function TechApp(p) {
  const { session, config, fleet, tickets, pm, presence, savePm, saveTicket, setShift, techNames, onLogout, theme, toggleTheme } = p;
  const [view, setView] = useState("tickets");
  const [overlay, setOverlay] = useState(null), [filter, setFilter] = useState("open"), [showNotif, setShowNotif] = useState(false), [showAI, setShowAI] = useState(false), [aiDraft, setAiDraft] = useState(null), [pmRun, setPmRun] = useState(null);
  const askAI = (draft) => { setAiDraft(draft || null); setShowAI(true); };
  const notif = useNotifications(session, tickets, pm, fleet, config, presence);
  const myShift = presenceOf(presence, session.id);
  const myIdle = shiftIdle(myShift, session, config);
  const mine = useMemo(() => visibleTickets(session, tickets, fleet), [tickets, session, fleet]);
  const pool = mine.filter((t) => !transportTechnicianAssignee(t, fleet) && ballIn(t) === "tech");
  const myOpen = mine.filter((t) => transportTechnicianAssignee(t, fleet) === session.name && isOpen(t));
  const waitEquip = myOpen.filter((t) => t.status === "waiting" && t.waitingReason === "no_equipment");
  const returnedToMe = myOpen.filter((t) => t.returned && ballIn(t) === "tech");
  const working = myOpen.filter((t) => ballIn(t) === "tech" && !returnedToMe.includes(t));
  const sentApproval = myOpen.filter((t) => (ballIn(t) === "manager" || ballIn(t) === "admin") && !waitEquip.includes(t));
  const myPm = useMemo(() => pmVisible(session, pm, fleet), [pm, fleet, session]);
  const openTicket = (id) => setOverlay({ type: "detail", id });
  const tw = config.techWidgets || {};
  const [sessWarn, setSessWarn] = useState(false), [warnAt, setWarnAt] = useState(0), [extendUntil, setExtendUntil] = useState(0);
  const endTs = useMemo(() => { const [h, m] = (session.shiftEnd || "16:30").split(":").map(Number); const d = new Date(); d.setHours(h || 16, m || 30, 0, 0); if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1); return d.getTime(); }, [session.shiftEnd]);
  const effectiveEnd = extendUntil || endTs;
  const endAndLogout = async () => { await setShift(false); onLogout(); };
  useEffect(() => { if (!myShift.onShift) setShift(true); /* eslint-disable-next-line */ }, [myShift.onShift]);
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      if (now >= effectiveEnd) { endAndLogout(); return; }
      if (sessWarn && warnAt && now >= warnAt + 5 * 60000) { endAndLogout(); return; }
      if (!sessWarn && now >= effectiveEnd - 10 * 60000) { setSessWarn(true); setWarnAt(now); }
    };
    const id = setInterval(tick, 20000); tick();
    return () => clearInterval(id);
  }, [sessWarn, warnAt, effectiveEnd]);
  const extendShift = () => { setExtendUntil(effectiveEnd + 60 * 60000); setSessWarn(false); setWarnAt(0); };
  return (
    <div className="app-root">
      <Sidebar session={session} config={config} onLogout={onLogout} notif={notif} onBell={() => setShowNotif((v) => !v)} rolePreview={p.rolePreview} theme={theme} toggleTheme={toggleTheme} onReportIssue={p.onReportIssue} onProfile={p.onProfile}
        nav={[{ id: "tickets", Icon: ListChecks, label: "קריאות שינוע", active: view === "tickets", onClick: () => setView("tickets") }, { id: "pm", Icon: CalendarClock, label: "לוח טיפולים", active: view === "pm", onClick: () => setView("pm") }, { id: "activity", Icon: Clock, label: "יומן פעילות", active: view === "activity", onClick: () => setView("activity") }]} />
      <div className="main-col">
        <TopBar title={view === "pm" ? "לוח טיפולים" : view === "activity" ? "יומן פעילות" : "קריאות שינוע"} subtitle={session.name + " · טכנאי"} onLogout={onLogout} notif={notif} onBell={() => setShowNotif((v) => !v)} rolePreview={p.rolePreview} theme={theme} toggleTheme={toggleTheme} onProfile={p.onProfile} onReportIssue={p.onReportIssue} demoActive={p.demoActive} />
        <div className="content with-nav">
          {tw.presence !== false && <div className="shift-bar"><div className="shift-info"><span className="presence-dot on" /><div><div className="shift-stat">במשמרת</div><div className="shift-sub">{myShift.since ? "מאז " + fmtTime(myShift.since) : "מחובר"} · עד {fmtTime(effectiveEnd)}{myIdle.lateMin > 0 ? " · איחור " + myIdle.lateMin + " ד׳" : ""}</div></div></div><button className="btn-ghost sm" onClick={endAndLogout}><Power size={15} /> סיום משמרת ויציאה</button></div>}
          {sessWarn && <div className="ovl-backdrop modal2" style={{ zIndex: 60 }}><div className="modal2-panel" style={{ textAlign: "center" }}><div className="modal2-body"><div style={{ fontSize: 38, marginBottom: 6 }}>⏰</div><div className="form-title" style={{ marginBottom: 6 }}>המשמרת עומדת להסתיים</div><div className="note" style={{ margin: "0 0 14px" }}>בעוד כ-10 דקות תתבצע יציאה אוטומטית. ללא בחירה תוך 5 דקות — המערכת תוציא אותך אוטומטית.</div><div className="row2"><button className="btn-ghost" onClick={extendShift}>הארכה ב-60 ד׳</button><button className="btn-primary" onClick={endAndLogout}><Power size={15} /> סיום ויציאה</button></div></div></div></div>}
          {view === "tickets" ? (<>
            <div className="stat-strip">
              <div className="stat-box"><div className="stat-num" style={{ color: "var(--primary)" }}>{pool.length}</div><div className="stat-lbl">ממתינות לקבלה</div></div>
              <div className="stat-box"><div className="stat-num" style={{ color: "#D97706" }}>{working.length + returnedToMe.length}</div><div className="stat-lbl">בטיפולי</div></div>
              {tw.sla !== false && <div className="stat-box"><div className="stat-num" style={{ color: "#DC2626" }}>{mine.filter((t) => ticketMissedSla(t, config)).length}</div><div className="stat-lbl">חריגת SLA</div></div>}
            </div>
            <div className="chips">{[["open", "פעילות"], ["closed", "סגורות"]].map(([id, lbl]) => <button key={id} className={"chip" + (filter === id ? " on" : "")} onClick={() => setFilter(id)}>{lbl}</button>)}</div>
            {filter === "closed" ? (
              mine.filter((t) => !isOpen(t) && t.assignee === session.name).length === 0 ? <Empty text="אין היסטוריה" Icon={Clock} />
                : <div className="cards">{sortByImportance(mine.filter((t) => !isOpen(t) && t.assignee === session.name), config).map((t) => <TicketCard key={t.id} t={t} admin config={config} onClick={() => openTicket(t.id)} />)}</div>
            ) : (<>
              {returnedToMe.length > 0 && <><SectionTitle><RefreshCw size={14} color="#B45309" /> פעולה שלך — הוחזרו לטיפול חוזר ({returnedToMe.length})</SectionTitle><div className="cards">{sortByImportance(returnedToMe, config).map((t) => <TicketCard key={t.id} t={t} admin config={config} onClick={() => openTicket(t.id)} />)}</div></>}
              {waitEquip.length > 0 && <><SectionTitle><Truck size={14} color="#B45309" /> מעקב — ממתין לקבלת כלי ({waitEquip.length})</SectionTitle><div className="cards">{sortByImportance(waitEquip, config).map((t) => <TicketCard key={t.id} t={t} admin config={config} onClick={() => openTicket(t.id)} />)}</div></>}
              <SectionTitle><Bell size={14} /> פעולה שלך — חדשות לקבלה ({pool.length})</SectionTitle>
              {pool.length === 0 ? <div className="note">אין קריאות חדשות.</div> : <div className="cards">{sortByImportance(pool, config).map((t) => <TicketCard key={t.id} t={t} admin config={config} onClick={() => openTicket(t.id)} />)}</div>}
              <SectionTitle><Wrench size={14} /> פעולה שלך — בטיפולי ({working.length})</SectionTitle>
              {working.length === 0 ? <div className="note">אין קריאות בטיפול.</div> : <div className="cards">{sortByImportance(working, config).map((t) => <TicketCard key={t.id} t={t} admin config={config} onClick={() => openTicket(t.id)} />)}</div>}
              {sentApproval.length > 0 && <><SectionTitle><CheckCircle2 size={14} color="#0D9488" /> מעקב — הועברו לאישור ({sentApproval.length})</SectionTitle><div className="cards">{sortByImportance(sentApproval, config).map((t) => <TicketCard key={t.id} t={t} admin config={config} onClick={() => openTicket(t.id)} />)}</div></>}
            </>)}
          </>) : view === "activity" ? (
            <AuditLog session={session} tickets={tickets} fleet={fleet} config={config} onOpenTicket={openTicket} />
          ) : (
            <Suspense fallback={<div className="cards"><Empty text="טוען לוח טיפולים…" Icon={CalendarClock} /></div>}><FleetPMScheduleLazy ui={fleetAssetsUi()} items={myPm} fleet={fleet} onOpen={(x) => setPmRun(x)} config={config} /></Suspense>
          )}
        </div>
      </div>
      <nav className="bottom-nav"><NavBtn active={view === "tickets"} onClick={() => setView("tickets")} Icon={Truck} label="קריאות" /><NavBtn active={view === "pm"} onClick={() => setView("pm")} Icon={CalendarClock} label="טיפולים" /><NavBtn active={view === "activity"} onClick={() => setView("activity")} Icon={Clock} label="יומן" /></nav>
      {aiAssistantEnabled(config) && <AIFab onClick={() => askAI(null)} />}
      {overlay?.type === "detail" && <Overlay onClose={() => setOverlay(null)}><TicketDetail {...p} ticket={tickets.find((x) => x.id === overlay.id)} onBack={() => setOverlay(null)} onOpenTicket={(id) => setOverlay({ type: "detail", id })} onAskAI={aiAssistantEnabled(config) ? askAI : null} /></Overlay>}
      {pmRun && <Overlay onClose={() => setPmRun(null)}><Suspense fallback={<div className="ovl-inner"><div className="note">טוען שיבוץ טיפול…</div></div>}><FleetPMEntryLazy ui={fleetAssetsUi()} task={pm.find((x) => x.id === pmRun.id) || pmRun} session={session} fleet={fleet} tickets={tickets} config={config} canManage={false} onTicket={saveTicket} onClose={() => setPmRun(null)} onSave={savePm} /></Suspense></Overlay>}
      {showNotif && <NotifPanel notif={notif} language={p.language} onClose={() => setShowNotif(false)} onOpen={(id) => { setShowNotif(false); openTicket(id); }} onGo={(go) => { setShowNotif(false); setView(go === "pm" ? "pm" : "tickets"); }} />}
      {showAI && <LazyAIPanel {...p} initialText={aiDraft?.text || ""} initialWorkflow={aiDraft?.workflow} onClose={() => { setShowAI(false); setAiDraft(null); }} />}
      {notif.toast && <Toast t={notif.toast} onClose={notif.dismissToast} />}
    </div>
  );
}

/* ============================================================ ADMIN APP */
function AuditLog(props) {
  return <Suspense fallback={<div className="cards"><Empty text="טוען יומן פעילות…" Icon={Clock} /></div>}>
    <AuditLogLazy
      {...props}
      ui={{
        Empty,
        LOG_KINDS,
        Overlay,
        ROLE_LABEL,
        ReportView,
        SectionTitle,
        XLSX,
        countLabel,
        downloadXlsx,
        driverEvtText,
        fleetDepts,
        fmtDate,
        fmtTime,
        isCompletedCleaningRound,
        localizedUiLabel,
        logKindMeta,
        logKindOf,
        roleLabelFor,
        rowsSafe,
        ticketNo,
        trackOf,
        userDepts,
        visibleTickets
      }}
    />
  </Suspense>;
}
function DriverForm({ fixedCat, existing, isAdmin, session, dupCheck, onCancel, onSave, users, saveUser, config }) {
  const [step, setStep] = useState(1);
  const [driverUserId, setDriverUserId] = useState(existing?.userId || "");
  const [name, setName] = useState(existing?.name || ""), [workNo, setWorkNo] = useState(existing?.workNo || ""), [category, setCategory] = useState(fixedCat || "morning"), [cross, setCross] = useState(!!existing?.cross), [err, setErr] = useState("");
  const isEdit = !!existing;
  const baseVals = () => ({ name: name.trim(), workNo: workNo.trim(), category, cross, userId: driverUserId || (existing && existing.userId) || "" });
  const dups = (dupCheck && workNo.trim()) ? dupCheck(name, workNo) : []; // другие «сиденья» того же рабочего номера
  const next = () => { if (!name.trim()) return setErr("נא להזין שם נהג"); if (!workNo.trim()) return setErr("נא להזין מספר עובד"); if (dups.length) return setErr("לעובד מותר מקום ישיבה אחד בלבד"); if (isEdit) return onSave({ ...baseVals(), needsChip: false }); setErr(""); setStep(2); };
  if (step === 2) return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" onClick={() => setStep(1)} aria-label="חזרה לפרטי הנהג"><ChevronLeft size={24} style={{ transform: "scaleX(-1)" }} /></button><div className="form-title">הוספת עובד — צ׳יפ</div></div>
    <div className="body">
      <div className="hint" style={{ marginBottom: 12 }}>{name} · #{workNo} · {driverShiftMeta(category).label}. בחרו כיצד להוסיף את העובד:</div>
      <button className="choice-btn" onClick={() => onSave({ ...baseVals(), needsChip: true })}><div className="choice-t">{isAdmin ? "הוסף — צריך להנפיק צ׳יפ" : "הוסף ובקש צ׳יפ ממנהל המערכת"}</div><div className="choice-s">{isAdmin ? "העובד יתווסף ויש להנפיק לו צ׳יפ" : "עובד חדש ללא צ׳יפ — הבקשה תישלח לאישור והנפקת צ׳יפ"}</div></button>
      <button className="choice-btn" onClick={() => onSave({ ...baseVals(), needsChip: false })}><div className="choice-t">הוסף — לעובד כבר יש צ׳יפ</div><div className="choice-s">{isAdmin ? "יתווסף מיד" : "יתווסף מיד למערכת, ללא צורך באישור"}</div></button>
      <div style={{ height: 20 }} />
    </div></div>);
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" aria-label="סגירה" onClick={onCancel}><X size={22} /></button><div className="form-title">{isEdit ? "עריכת נהג" : "הוספת נהג"}</div></div>
    <div className="body">
      {isEdit
        ? <><label className="field"><span>שם הנהג *</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="ישראל ישראלי" autoFocus /></label>
      <label className="field"><span>מספר עובד *</span><input value={workNo} onChange={(e) => setWorkNo(e.target.value)} inputMode="numeric" placeholder="1042" /></label></>
        : <UserPicker users={users} config={config} saveUser={saveUser} session={session} canManageUsers={canManageUsers(session)} value={driverUserId} onChange={(u) => { setDriverUserId(u ? u.id : ""); setName(u ? u.name : ""); setWorkNo(u ? (u.workerNo || "") : ""); }} label="נהג (חיפוש לפי שם או מספר)" lockRole="worker" hint="חפשו עובד קיים או צרו חדש — כך הנהג מקושר לכרטיס משתמש." />}
      {!isEdit && <div className="field"><span>משמרת</span><div className="seg-tabs s2">{DRIVER_SHIFTS.map((s) => <button key={s.id} className={category === s.id ? "on" : ""} onClick={() => setCategory(s.id)}>{s.label}</button>)}</div></div>}
      {dups.length > 0 && <div className="dup-block"><AlertTriangle size={14} /> חסום: עובד מס׳ {workNo} כבר משובץ ב-{dups.map((x) => `${x.unit.code} (${driverShiftMeta(x.shift).label})`).join(", ")}. לעובד מותר מקום ישיבה אחד בלבד. כדי לתת לו גישה לכלי נוסף — השתמשו בכפתור «גישה» על הנהג.</div>}
      <label className="chk-line" style={{ marginTop: 6 }}><input type="checkbox" checked={cross} onChange={(e) => setCross(e.target.checked)} /> חוצה משמרת — עובד גם במשמרת השנייה / תופס כלי של מחליפו</label>
      {err && <div className="err">{err}</div>}
      <button className="btn-primary full" disabled={dups.length > 0} onClick={next}>{isEdit ? "שמירה" : "המשך"}</button><div style={{ height: 20 }} />
    </div></div>);
}
function MovePicker({ units, source, onCancel, onSave }) {
  const [unitId, setUnitId] = useState(""), [category, setCategory] = useState(source.cat), [err, setErr] = useState("");
  const opts = units.filter((u) => u.id !== source.unit.id);
  const save = () => { const u = units.find((x) => x.id === unitId); if (!u) return setErr("בחרו כלי יעד"); onSave(u, category); };
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" aria-label="סגירה" onClick={onCancel}><X size={22} /></button><div className="form-title">העברת נהג לכלי אחר</div></div>
    <div className="body">
      <div className="hint" style={{ marginBottom: 10 }}>{source.driver.name} · {driverShiftMeta(source.cat).label} · מ-{source.unit.code}. ההעברה תישלח לאישור מנהל המערכת (שינוי הרשאות במערכת החיצונית).</div>
      <label className="field"><span>כלי יעד</span><select value={unitId} onChange={(e) => setUnitId(e.target.value)}><option value="">— בחרו —</option>{opts.map((u) => { const occ = driverOf(u, category); return <option key={u.id} value={u.id}>{u.code}{driverActive(occ) || driverPending(occ) ? ` · תפוס (${occ.name})` : ""}</option>; })}</select></label>
      <div className="field"><span>משמרת ביעד</span><div className="seg-tabs s2">{DRIVER_SHIFTS.map((s) => <button key={s.id} className={category === s.id ? "on" : ""} onClick={() => setCategory(s.id)}>{s.label}</button>)}</div></div>
      {err && <div className="err">{err}</div>}
      <button className="btn-primary full" onClick={save}>המשך</button><div style={{ height: 20 }} />
    </div></div>);
}
function AccessPicker({ allFleet, config, driver, seatUnitId, onCancel, onSave }) {
  const [sel, setSel] = useState(() => new Set((driver.access || []).map((a) => a.unitId)));
  const [q, setQ] = useState("");
  const opts = (allFleet || []).filter((u) => u.id !== seatUnitId).filter((u) => !q.trim() || `${u.code} ${unitTypeName(u, config)}`.toLowerCase().includes(q.toLowerCase()));
  const toggle = (id) => { const n = new Set(sel); n.has(id) ? n.delete(id) : n.add(id); setSel(n); };
  const save = () => onSave((allFleet || []).filter((u) => sel.has(u.id)).map((u) => ({ unitId: u.id, unitCode: u.code, dept: fleetDepts(u)[0] || "" })));
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" aria-label="סגירה" onClick={onCancel}><X size={22} /></button><div className="form-title">גישת {driver.name} לכלים</div></div>
    <div className="body">
      <div className="hint" style={{ marginBottom: 10 }}>סמנו כלים שהעובד מורשה לתפעל — מעבר לכלי הקבוע שלו, וגם ממחלקות אחרות. זו הרשאת גישה בלבד, אינה תופסת מקום במשמרת.</div>
      <div className="search-wrap"><Search size={18} /><input aria-label="חיפוש כלי להוספת הרשאת נהג" placeholder="חיפוש כלי…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="cards" style={{ maxHeight: "46vh", overflowY: "auto", marginTop: 8 }}>{opts.map((u) => <label key={u.id} className={"acc-row" + (sel.has(u.id) ? " on" : "")}><input type="checkbox" checked={sel.has(u.id)} onChange={() => toggle(u.id)} /><span className="acc-code">{u.code}</span><span className="acc-desc">{unitDesc(u, config)}</span><span className="acc-dept">{fleetDepts(u)[0] || ""}</span></label>)}</div>
      <button className="btn-primary full" onClick={save} style={{ marginTop: 10 }}>שמירת גישה ({sel.size})</button><div style={{ height: 20 }} />
    </div></div>);
}
function DriversBoard({ session, fleet, tickets, config, saveFleet, saveConfig, users, saveUser }) {
  const isAdmin = session.role === "admin";
  const scoped = useMemo(() => fleetForSession(session, fleet).slice().sort((a, b) => (a.code > b.code ? 1 : -1)), [session, fleet]);
  const [catF, setCatF] = useState("all"), [presF, setPresF] = useState("all"), [deptF, setDeptF] = useState("all"), [q, setQ] = useState(""), [focus, setFocus] = useState(null);
  const [form, setForm] = useState(null), [move, setMove] = useState(null), [conflict, setConflict] = useState(null), [relocateA, setRelocateA] = useState(null), [access, setAccess] = useState(null), [msg, setMsg] = useState("");
  const myDept = userDepts(session)[0] || "", saveDriverEvent = async (evt) => !evt || await saveConfig(pushDriverEvent(config, evt), { toastOnFail: false }) !== false;
  const writeDriver = async (unit, cat, d, evt) => {
    if (await saveFleet({ ...unit, drivers: { ...(unit.drivers || {}), [cat]: d } }) === false) { setMsg(SAVE_FAILED_MESSAGE); return false; }
    if (evt) void saveDriverEvent(evt);
    return true;
  };
  const dropDriver = async (unit, cat, evt) => {
    const drivers = { ...(unit.drivers || {}) }; delete drivers[cat];
    if (await saveFleet({ ...unit, drivers }) === false) { setMsg(SAVE_FAILED_MESSAGE); return false; }
    if (evt) void saveDriverEvent(evt);
    return true;
  };
  const submitForm = async (v) => {
    const { unit, existing } = form; const cat = existing ? form.cat : v.category;
    let ok = true;
    if (existing) { ok = await writeDriver(unit, cat, { ...existing, name: v.name, workNo: v.workNo, cross: !!v.cross, userId: v.userId || existing.userId || "" }, { type: "edited", unitId: unit.id, unitCode: unit.code, category: cat, driverName: v.name, workNo: v.workNo, byUid: session.id, byName: session.name, byDept: myDept }); }
    else { const base = { name: v.name, workNo: v.workNo, cross: !!v.cross, userId: v.userId || "", addedByUid: session.id, addedByName: session.name, addedByDept: isAdmin ? "הנהלה" : myDept, at: Date.now(), needsChip: !!v.needsChip };
      const immediate = isAdmin || !v.needsChip; // менеджер без чипа → сразу; с чипом → запрос
      if (immediate) ok = await writeDriver(unit, cat, { ...base, status: "active" }, { type: "add", status: "active", unitId: unit.id, unitCode: unit.code, category: cat, driverName: v.name, workNo: v.workNo, needsChip: !!v.needsChip, byUid: session.id, byName: session.name, byDept: isAdmin ? "הנהלה" : myDept });
      else ok = await writeDriver(unit, cat, { ...base, status: "pending_add", reqAt: Date.now() }, { type: "add_req", unitId: unit.id, unitCode: unit.code, category: cat, driverName: v.name, workNo: v.workNo, needsChip: true, byUid: session.id, byName: session.name, byDept: myDept }); }
    if (ok === false) return;
    setForm(null);
  };
  const submitMove = async (b, toUnit, toCat) => { const { unit, cat, driver } = b; return writeDriver(unit, cat, { ...driver, status: "pending_move", moveTo: { unitId: toUnit.id, unitCode: toUnit.code, category: toCat }, reqAt: Date.now() }, { type: "move_req", unitId: unit.id, unitCode: unit.code, category: cat, toUnitCode: toUnit.code, toCategory: toCat, driverName: driver.name, workNo: driver.workNo, needsChip: !!driver.needsChip, byUid: session.id, byName: session.name, byDept: myDept }); };
  const handleBTarget = async (toUnit, toCat) => { const b = move; const occ = driverOf(toUnit, toCat); if (driverActive(occ) || driverPending(occ)) { setConflict({ b, toUnit, toCat, occ }); setMove(null); } else if (await submitMove(b, toUnit, toCat) !== false) { setMove(null); } };
  const doDeletePrev = async () => { const c = conflict; if (await del(c.toUnit, c.toCat, c.occ) === false) return; if (await submitMove(c.b, c.toUnit, c.toCat) === false) return; setConflict(null); };
  const doSwap = async (zUnit, zCat) => { const r = relocateA; if (await submitMove(r.bMove.b, r.bMove.toUnit, r.bMove.toCat) === false) return; if (await submitMove({ unit: r.a.unit, cat: r.a.cat, driver: r.a.driver }, zUnit, zCat) === false) return; setRelocateA(null); };
  const del = async (unit, cat, d) => dropDriver(unit, cat, { type: "deleted", unitId: unit.id, unitCode: unit.code, category: cat, driverName: d.name, workNo: d.workNo, byUid: session.id, byName: session.name, byDept: myDept });
  const submitAccess = async (list) => { const { unit, cat, driver } = access; if (await writeDriver(unit, cat, { ...driver, access: list }, { type: "access", unitId: unit.id, unitCode: unit.code, category: cat, driverName: driver.name, workNo: driver.workNo, byUid: session.id, byName: session.name, byDept: myDept, sub: String(list.length) }) !== false) setAccess(null); };
  const approve = async (unit, cat) => {
    setMsg("");
    const d = driverOf(unit, cat); if (!d) return;
    if (d.status === "pending_add") await writeDriver(unit, cat, { ...d, status: "active", decidedAt: Date.now(), decidedBy: session.name }, { type: "approved", sub: "add", unitId: unit.id, unitCode: unit.code, category: cat, driverName: d.name, byName: session.name, reqByUid: d.addedByUid, reqByName: d.addedByName });
    else if (d.status === "pending_move" && d.moveTo) { const tgt = fleet.find((x) => x.id === d.moveTo.unitId); const occ = tgt ? driverOf(tgt, d.moveTo.category) : null; if (occ && occ !== d && (driverActive(occ) || driverPending(occ))) { setMsg(`היעד תפוס (${tgt?.code} · ${driverShiftMeta(d.moveTo.category).label}) — יש לאשר/לטפל קודם בהעברת ${occ.name}`); return; } const src = { ...(unit.drivers || {}) }; delete src[cat]; if (await saveFleet({ ...unit, drivers: src }) === false) return setMsg(SAVE_FAILED_MESSAGE); if (tgt) { const nd = { ...d, status: "active", decidedAt: Date.now(), decidedBy: session.name }; delete nd.moveTo; if (await saveFleet({ ...tgt, drivers: { ...(tgt.drivers || {}), [d.moveTo.category]: nd } }) === false) return setMsg(SAVE_FAILED_MESSAGE); } void saveDriverEvent({ type: "approved", sub: "move", unitId: unit.id, unitCode: unit.code, category: cat, toUnitCode: d.moveTo.unitCode, driverName: d.name, byName: session.name, reqByUid: d.addedByUid, reqByName: d.addedByName }); }
  };
  const reject = async (unit, cat) => { const d = driverOf(unit, cat); if (!d) return; if (d.status === "pending_add") await dropDriver(unit, cat, { type: "rejected", sub: "add", unitId: unit.id, unitCode: unit.code, category: cat, driverName: d.name, byName: session.name, reqByUid: d.addedByUid, reqByName: d.addedByName }); else if (d.status === "pending_move") { const nd = { ...d, status: "active", decidedAt: Date.now() }; delete nd.moveTo; await writeDriver(unit, cat, nd, { type: "rejected", sub: "move", unitId: unit.id, unitCode: unit.code, category: cat, driverName: d.name, byName: session.name, reqByUid: d.addedByUid, reqByName: d.addedByName }); } };
  const myShift = session.shift || "";
  const canEditCat = (cat) => isAdmin || !myShift || myShift === cat;
  const reqs = isAdmin ? pendingDriverReqs(fleet) : [];
  const ins = useMemo(() => {
    const idle = scoped.filter((f) => !DRIVER_SHIFTS.some((s) => driverActive(driverOf(f, s.id))));
    const perCat = DRIVER_SHIFTS.map((s) => ({ s, missing: scoped.filter((f) => !driverActive(driverOf(f, s.id))).length, have: scoped.filter((f) => driverActive(driverOf(f, s.id))).length }));
    const conflict = crossConflicts(scoped);
    const dups = dupWorkers(scoped);
    return { idle, perCat, conflict, suggest: crossSuggestions(scoped), dups, idleIds: new Set(idle.map((f) => f.id)), conflictIds: new Set(conflict.map((f) => f.id)), dupIds: new Set(dups.flatMap((g) => g.map((a) => a.unit.id))), total: scoped.length };
  }, [scoped]);
  const toggleFocus = (id) => { setFocus((cur) => cur === id ? null : id); setCatF("all"); setPresF("all"); };
  const rows = scoped.filter((f) => {
    if (deptF !== "all" && !fleetDepts(f).includes(deptF)) return false;
    if (focus === "idle" && !ins.idleIds.has(f.id)) return false;
    if (focus === "miss-morning" && driverActive(driverOf(f, "morning"))) return false;
    if (focus === "miss-night" && driverActive(driverOf(f, "night"))) return false;
    if (focus === "conflict" && !ins.conflictIds.has(f.id)) return false;
    if (focus === "dups" && !ins.dupIds.has(f.id)) return false;
    if (catF !== "all" || presF !== "all") { const cats = catF === "all" ? DRIVER_SHIFTS.map((s) => s.id) : [catF]; const has = cats.some((c) => driverActive(driverOf(f, c)) || driverPending(driverOf(f, c))); if (presF === "has" && !has) return false; if (presF === "none" && has) return false; }
    if (q.trim()) { const hay = `${f.code} ${unitTypeName(f, config)} ${DRIVER_SHIFTS.map((s) => { const d = driverOf(f, s.id); return d ? d.name + " " + (d.workNo || "") : ""; }).join(" ")}`.toLowerCase(); if (!hay.includes(q.toLowerCase())) return false; }
    return true;
  });
  const Sel = ({ label, value, onChange, children }) => (<label className="flt-field"><span className="flt-lbl">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)}><option value="all">הכל</option>{children}</select></label>);
  const Chip = ({ unit, cat, d }) => {
    const owned = driverOwned(d, session); const pend = driverPending(d);
    return <div className={"drv-chip" + (pend ? " pend" : "")}>
      <div className="drv-info"><span className="drv-name">{d.name}</span><span className="drv-no">#{d.workNo}</span>{d.cross ? <span className="drv-cross">חוצה</span> : null}{d.needsChip && d.status === "pending_add" ? <span className="drv-flag">צ׳יפ</span> : null}</div>
      {pend ? <div className="drv-pend">{d.status === "pending_add" ? "ממתין לאישור הוספה" : `ממתין להעברה ל-${d.moveTo?.unitCode || ""}`}</div> : <div className="drv-by">{d.at ? "משובץ מ-" + fmtDate(d.at) : ""}</div>}
      {d.access && d.access.length > 0 ? <div className="drv-access"><ListChecks size={11} /> גישה: {d.access.map((a) => a.unitCode).join(", ")}</div> : null}
      <div className="drv-acts">
        {isAdmin && pend ? <><button className="drv-ok" onClick={() => approve(unit, cat)} title="אישור בקשת נהג" aria-label={`אישור בקשת נהג ${d.name} עבור ${unit.code}`}><Check size={14} /></button><button className="drv-no2" onClick={() => reject(unit, cat)} title="דחיית בקשת נהג" aria-label={`דחיית בקשת נהג ${d.name} עבור ${unit.code}`}><X size={14} /></button></> : null}
        {!pend && canEditCat(cat) ? <><button className="icon-btn sm" onClick={() => setForm({ unit, cat, existing: d })} title="עריכה" aria-label={`עריכת נהג ${d.name}`}><PenLine size={13} /></button><button className="icon-btn sm" onClick={() => setAccess({ unit, cat, driver: d })} title="גישה לכלים נוספים" aria-label={`ניהול גישה לכלים נוספים עבור ${d.name}`}><ListChecks size={13} /></button><button className="icon-btn sm" onClick={() => setMove({ unit, cat, driver: d })} title="החלפת כלי" aria-label={`החלפת כלי עבור ${d.name}`}><Truck size={13} /></button><button className="icon-btn sm danger" onClick={() => del(unit, cat, d)} title="מחיקה" aria-label={`מחיקת נהג ${d.name}`}><Trash2 size={13} /></button></> : null}
      </div>
    </div>;
  };
  return (<>
    <SectionTitle><Users size={15} /> נהגים וכיסוי משמרות</SectionTitle>
    {msg && <div className="banner" style={{ background: "#FEE2E2", color: "#991B1B", borderColor: "#FCA5A5" }}><AlertTriangle size={16} /> {msg}<button onClick={() => setMsg("")} aria-label="סגירת הודעה" title="סגירת הודעה" style={{ marginInlineStart: "auto", background: "none", border: "none", color: "inherit", cursor: "pointer" }}><X size={15} /></button></div>}
    {isAdmin && reqs.length > 0 && <><div className="banner" style={{ background: "#FEF3C7", color: "#92400E", borderColor: "#FCD34D" }}><AlertTriangle size={16} /> {reqs.length} בקשות נהגים ממתינות לאישורך</div>
      <div className="cards" style={{ marginBottom: 8 }}>{reqs.map(({ unit, cat, driver }) => <div key={unit.id + cat} className="req-row"><div className="req-main"><div className="req-t">{driver.status === "pending_add" ? "הוספת נהג" : "העברת נהג"} · {driver.name} <span className="drv-no">#{driver.workNo}</span></div><div className="req-s">{unit.code} · {driverShiftMeta(cat).label}{driver.status === "pending_move" ? ` → ${driver.moveTo?.unitCode} (${driverShiftMeta(driver.moveTo?.category).label})` : ""}{driver.needsChip ? " · צריך צ׳יפ" : ""} · מ-{driver.addedByName || "—"}</div></div><div className="req-acts"><button className="btn-primary sm" onClick={() => approve(unit, cat)}><Check size={14} /> אישור</button><button className="btn-ghost sm" onClick={() => reject(unit, cat)}><X size={14} /> דחייה</button></div></div>)}</div></>}
    <div className="ins-grid">
      <button className={"ins-card clk" + (focus === "idle" ? " on" : "")} onClick={() => toggleFocus("idle")}><div className="ins-n" style={{ color: ins.idle.length ? "#DC2626" : "#16A34A" }}>{ins.idle.length}</div><div className="ins-l">כלים ללא נהג כלל</div></button>
      {ins.perCat.map(({ s, missing }) => <button key={s.id} className={"ins-card clk" + (focus === "miss-" + s.id ? " on" : "")} onClick={() => toggleFocus("miss-" + s.id)}><div className="ins-n" style={{ color: missing ? s.color : "#16A34A" }}>{missing}</div><div className="ins-l">ללא נהג · {s.label}</div></button>)}
      <button className={"ins-card clk" + (focus === "conflict" ? " on" : "")} onClick={() => toggleFocus("conflict")}><div className="ins-n" style={{ color: ins.conflict.length ? "#EA580C" : "#16A34A" }}>{ins.conflict.length}</div><div className="ins-l">התנגשות חוצת-משמרת</div></button>
      <button className={"ins-card clk" + (focus === "dups" ? " on" : "")} onClick={() => toggleFocus("dups")}><div className="ins-n" style={{ color: ins.dups.length ? "#EA580C" : "#16A34A" }}>{ins.dups.length}</div><div className="ins-l">עובד ביותר מכלי אחד</div></button>
    </div>
    {focus && <div className="focus-bar"><span>מסונן: {focus === "idle" ? "ללא נהג כלל" : focus === "conflict" ? "התנגשות חוצת-משמרת" : focus === "dups" ? "עובד בכמה כלים" : focus === "miss-morning" ? "ללא נהג בבוקר" : "ללא נהג בלילה"} · {countLabel(rows.length, "כלי", "כלים")}</span><button onClick={() => setFocus(null)}><X size={13} /> ניקוי</button></div>}
    {ins.suggest.length > 0 && <div className="advice-box"><div className="advice-h"><Sparkles size={14} /> הצעות אופטימיזציה</div>{ins.suggest.map((s, i) => <div key={i} className="advice-row">העבירו את <b>{s.driver.name}</b> ({driverShiftMeta(s.shift).label}) מ-{s.fromCode} ל-<b>{s.toCode}</b> — פנוי במשמרת זו. <span className="advice-why">{s.reason}</span></div>)}</div>}
    {ins.conflict.length > 0 && <div className="hint" style={{ margin: "2px 2px 8px" }}>נהג חוצה-משמרת תופס כלי לצד מחליפו: {ins.conflict.map((f) => f.code).join(", ")}</div>}
    {ins.dups.length > 0 && <div className="hint" style={{ margin: "2px 2px 8px" }}>עובדים המשובצים ביותר מכלי אחד: {ins.dups.map((g) => `${g[0].driver.name} (${g.map((a) => a.unit.code).join("/")})`).join(" · ")}</div>}
    <div className="search-wrap"><Search size={18} /><input aria-label="חיפוש כיסוי נהגים לפי כלי או שם נהג" placeholder="חיפוש לפי כלי או שם נהג…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
    <div className="fleet-filters">
      <Sel label="משמרת" value={catF} onChange={setCatF}>{DRIVER_SHIFTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</Sel>
      <Sel label="נהג" value={presF} onChange={setPresF}><option value="has">יש נהג</option><option value="none">ללא נהג</option></Sel>
      {isAdmin && <Sel label="מחלקה" value={deptF} onChange={setDeptF}>{(config.departments || []).map((d) => <option key={d}>{d}</option>)}</Sel>}
    </div>
    {rows.length === 0 ? <Empty text="אין כלים להצגה" Icon={Truck} sub="נסו לשנות פילטרים" /> : (() => {
      const groups = new Map();
      rows.forEach((f) => { const dep = fleetDepts(f)[0] || "ללא מחלקה"; if (!groups.has(dep)) groups.set(dep, []); groups.get(dep).push(f); });
      const arr = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], "he"));
      const card = (f) => { const blk = unitBlock(f, tickets, config); return <div key={f.id} className={"drv-unit" + (blk ? " blocked" : "")} style={blk ? { borderColor: blk.level.color } : {}}><div className="drv-unit-head"><span className="drv-unit-code">{f.code}</span><span className="drv-unit-desc">{unitDesc(f, config)}</span>{blk && <span className="blk-chip" style={{ background: blk.level.color, marginInlineStart: "auto" }}><ShieldAlert size={11} /> מושבת</span>}</div><div className="drv-slots">{(catF === "all" ? DRIVER_SHIFTS : DRIVER_SHIFTS.filter((s) => s.id === catF)).map((s) => { const d = driverOf(f, s.id); return <div key={s.id} className="drv-slot"><span className="drv-cat" style={{ background: s.color + "1a", color: s.color }}>{s.label}</span>{d ? <Chip unit={f} cat={s.id} d={d} /> : (canEditCat(s.id) ? <button className="drv-add" onClick={() => setForm({ unit: f, cat: s.id, existing: null })}><Plus size={14} /> הוסף נהג</button> : <span className="drv-cat" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>לא שובץ נהג</span>)}</div>; })}</div></div>; };
      return arr.map(([dep, units]) => <div key={dep} className="dept-group"><div className="dept-head"><span className="dept-line" /><span className="dept-name">מחלקה · {dep}</span><span className="dept-count">{countLabel(units.length, "כלי", "כלים")}</span><span className="dept-line" /></div><div className="cards">{units.map(card)}</div></div>);
    })()}
    {form && <Overlay persistent onClose={() => setForm(null)}><DriverForm fixedCat={form.cat} existing={form.existing} isAdmin={isAdmin} session={session} users={users} saveUser={saveUser} config={config} dupCheck={(name, workNo) => (name.trim() || workNo.trim()) ? driverDupes(scoped, { name, workNo }, form.unit.id, form.existing ? form.cat : null) : []} onCancel={() => setForm(null)} onSave={submitForm} /></Overlay>}
    {move && <Overlay persistent onClose={() => setMove(null)}><MovePicker units={scoped} source={move} onCancel={() => setMove(null)} onSave={handleBTarget} /></Overlay>}
    {conflict && <Overlay persistent onClose={() => setConflict(null)}><div className="ovl-inner"><div className="form-head"><button className="icon-btn" onClick={() => setConflict(null)} aria-label="סגירת הודעת כלי תפוס"><X size={22} /></button><div className="form-title">הכלי תפוס</div></div>
      <div className="body">
        <div className="hint" style={{ marginBottom: 12 }}>ב-{conflict.toUnit.code} ({driverShiftMeta(conflict.toCat).label}) כבר משובץ <b>{conflict.occ.name}</b> (#{conflict.occ.workNo}). מה לעשות כדי לשבץ את {conflict.b.driver.name}?</div>
        <button className="choice-btn" onClick={doDeletePrev}><div className="choice-t">מחק את {conflict.occ.name} והעבר לכאן את {conflict.b.driver.name}</div><div className="choice-s">העובד הקודם יוסר מהמערכת (ללא אישור) · ההעברה תישלח לאישורך</div></button>
        <button className="choice-btn" onClick={() => { setRelocateA({ a: { unit: conflict.toUnit, cat: conflict.toCat, driver: conflict.occ }, bMove: { b: conflict.b, toUnit: conflict.toUnit, toCat: conflict.toCat } }); setConflict(null); }}><div className="choice-t">העבר גם את {conflict.occ.name} לכלי אחר</div><div className="choice-s">שתי בקשות העברה נפרדות יישלחו לאישורך (החלפה צולבת)</div></button>
        <button className="btn-ghost full" onClick={() => setConflict(null)}>ביטול</button><div style={{ height: 20 }} />
      </div></div></Overlay>}
    {relocateA && <Overlay persistent onClose={() => setRelocateA(null)}><MovePicker units={scoped} source={{ unit: relocateA.a.unit, cat: relocateA.a.cat, driver: relocateA.a.driver }} onCancel={() => setRelocateA(null)} onSave={doSwap} /></Overlay>}
    {access && <Overlay persistent onClose={() => setAccess(null)}><AccessPicker allFleet={fleet} config={config} driver={access.driver} seatUnitId={access.unit.id} onCancel={() => setAccess(null)} onSave={submitAccess} /></Overlay>}
  </>);
}
function ProblemUnitsPanel({ fleet, tickets, config, onOpen }) {
  const list = useMemo(() => problemUnits(fleet, tickets, config), [fleet, tickets, config]);
  if (!list.length) return null;
  return (<div style={{ marginBottom: 14 }}>
    <SectionTitle><AlertTriangle size={15} /> כלים בעייתיים — תקלות חוזרות</SectionTitle>
    <div className="hint" style={{ margin: "0 2px 8px" }}>כלים עם ריבוי קריאות ב-90 הימים האחרונים — כדאי לתת תשומת לב ולשקול טיפול שורש.</div>
    <div className="cards">{list.slice(0, 8).map(({ f, h, reasons }) => <button key={f.id} className="prob-row" onClick={() => onOpen && onOpen(f.id)}>
      <span className="prob-dot" style={{ background: h.color }} />
      <span className="prob-main"><span className="prob-code">{f.code} · {unitDesc(f, config)}</span><span className="prob-reasons">{reasons.length ? reasons.map(([c, n]) => `${c} (${n})`).join(" · ") : "ללא פירוט סיבות"}</span></span>
      <span className="prob-stat"><b style={{ color: h.color }}>{h.count90}</b> {h.count90 === 1 ? "קריאה" : "קריאות"} · {h.label}</span>
    </button>)}</div>
  </div>);
}
function ManagerFleet(p) {
  const { session, fleet, config, tickets, saveFleet, saveConfig, deptNav, onAskAI } = p;
  const [tab, setTab] = useState("units"), [openId, setOpenId] = useState(null), [pmView, setPmView] = useState(null);
  const scoped = useMemo(() => fleetForSession(session, fleet).slice().sort((a, b) => (a.code > b.code ? 1 : -1)), [session, fleet]);
  const myPm = useMemo(() => pmVisible(session, p.pm, fleet), [p.pm, fleet, session]);
  const showDocs = canFleetDocs(session), showTickets = canFleetTickets(session);
  const driverReqCount = session.role === "admin" ? pendingDriverReqs(fleet).length : 0;
  useEffect(() => {
    if (!deptNav) return;
    if (deptNav.tab === "pm") setTab("pm");
    if (deptNav.tab === "fleet" || deptNav.tab === "units") setTab("units");
    if (deptNav.fleetId && scoped.some((f) => f.id === deptNav.fleetId)) { setTab("units"); setOpenId(deptNav.fleetId); }
  }, [deptNav?._t, scoped]);
  return (<>
    <div className="manager-fleet-page">
      <div className="seg-tabs s3 manager-fleet-tabs" style={{ maxWidth: 480, marginBottom: 12 }}><button className={tab === "units" ? "on" : ""} onClick={() => setTab("units")}>כלים</button><button className={tab === "drivers" ? "on" : ""} onClick={() => setTab("drivers")}>נהגים / כיסוי{driverReqCount > 0 && <span className="tab-badge">{driverReqCount}</span>}</button><button className={tab === "pm" ? "on" : ""} onClick={() => setTab("pm")}>לוח טיפולים</button></div>
      {tab === "drivers" ? <DriversBoard session={session} fleet={fleet} tickets={tickets} config={config} saveFleet={saveFleet} saveConfig={saveConfig} users={p.users} saveUser={p.saveUser} />
        : tab === "pm" ? <><div className="note" style={{ marginBottom: 10 }}>טיפולים תקופתיים לכלי המחלקה. יש להוציא את הכלי לטכנאי במועד; הטכנאי יעדכן ביצוע.</div><Suspense fallback={<div className="cards"><Empty text="טוען לוח טיפולים…" Icon={CalendarClock} /></div>}><FleetPMScheduleLazy ui={fleetAssetsUi()} items={myPm} fleet={fleet} onOpen={(x) => setPmView(x)} config={config} /></Suspense></>
        : <>
        <ProblemUnitsPanel fleet={scoped} tickets={tickets} config={config} onOpen={(id) => setOpenId(id)} />
        <SectionTitle><Truck size={15} /> כלי השינוע של מחלקותיי ({scoped.length})</SectionTitle>
        {scoped.length === 0 ? <Empty text="אין כלים משויכים למחלקותיך" Icon={Truck} /> : <div className="ftable manager-fleet-table"><div className="ftable-head manager-fleet-row"><span>מספר</span><span>סוג / דגם</span><span>ספק</span><span>נהגים</span></div>{scoped.map((f) => { const dc = DRIVER_SHIFTS.filter((s) => driverActive(driverOf(f, s.id))).length; const blk = unitBlock(f, tickets, config); return <button key={f.id} className={"ftable-row manager-fleet-row" + (blk ? " blocked" : "")} onClick={() => setOpenId(f.id)} style={blk ? { borderInlineStartColor: blk.level.color } : {}}><span className="ft-code">{f.code}</span><span className="ft-model"><b>{unitDesc(f, config)}</b>{blk && <span className="blk-chip" style={{ background: blk.level.color }}><ShieldAlert size={11} /> מושבת</span>}</span><span className="ft-sup">{f.supplier || "—"}</span><span className="ft-doc">{dc}/{DRIVER_SHIFTS.length} נהגים</span></button>; })}</div>}
      </>}
    </div>
    {openId && <Overlay onClose={() => setOpenId(null)}><Suspense fallback={<div className="ovl-inner"><div className="note">טוען כרטיס כלי…</div></div>}><FleetAssetCardLazy ui={fleetAssetsUi()} fleet={fleet.find((x) => x.id === openId)} config={config} tickets={tickets} canDocs={showDocs} canTickets={showTickets} onClose={() => setOpenId(null)} onAskAI={onAskAI} onBlock={async (reason) => { await p.saveTicket(buildBlockTicket(fleet.find((x) => x.id === openId), config, { name: session.name, role: session.role }, reason)); }} /></Suspense></Overlay>}
    {pmView && <Overlay onClose={() => setPmView(null)}><Suspense fallback={<div className="ovl-inner"><div className="note">טוען שיבוץ טיפול…</div></div>}><FleetPMEntryLazy ui={fleetAssetsUi()} task={p.pm.find((x) => x.id === pmView.id) || pmView} session={session} fleet={fleet} tickets={tickets} config={config} canManage={false} onClose={() => setPmView(null)} onSave={() => {}} /></Suspense></Overlay>}
  </>);
}
/* ============================================================ CLEANING TRACK (ניקיון / סבבים) — Phase 1 */
const CLEANING_UNASSIGNED_AREA = "ללא אזור מערכת";
const cleaningAreaName = (z) => (z?.areaName || z?.area || z?.building || "").trim() || CLEANING_UNASSIGNED_AREA;
const zoneLoc = (z) => [cleaningAreaName(z), z.floor].filter((x) => x && x !== CLEANING_UNASSIGNED_AREA).join(" · ");
const zoneSort = (a, b) => cleaningAreaName(a).localeCompare(cleaningAreaName(b), "he") || (a.floor || "").localeCompare(b.floor || "", "he") || (a.name || "").localeCompare(b.name || "", "he");
const cleaningAreaOptions = (config, zones = []) => {
  const seen = new Set();
  const add = (value) => {
    const name = String(value || "").trim();
    if (!name || seen.has(name)) return null;
    seen.add(name);
    return name;
  };
  return [
    ...(config?.zones || []).map(add).filter(Boolean),
    ...(zones || []).map((z) => add(cleaningAreaName(z))).filter(Boolean).filter((x) => x !== CLEANING_UNASSIGNED_AREA),
  ];
};
const groupCleaningByArea = (items, getZone = (x) => x) => {
  const map = new Map();
  (items || []).forEach((item) => {
    const zone = getZone(item) || {};
    const area = cleaningAreaName(zone);
    if (!map.has(area)) map.set(area, { area, items: [] });
    map.get(area).items.push(item);
  });
  return [...map.values()].sort((a, b) => {
    if (a.area === CLEANING_UNASSIGNED_AREA && b.area !== CLEANING_UNASSIGNED_AREA) return 1;
    if (b.area === CLEANING_UNASSIGNED_AREA && a.area !== CLEANING_UNASSIGNED_AREA) return -1;
    return a.area.localeCompare(b.area, "he");
  });
};
const groupCleaningByFloor = (items, getZone = (x) => x) => {
  const map = new Map();
  (items || []).forEach((item) => {
    const zone = getZone(item) || {};
    const floor = (zone.floor || "").trim();
    const key = floor || "";
    if (!map.has(key)) map.set(key, { floor: key, items: [] });
    map.get(key).items.push(item);
  });
  return [...map.values()].sort((a, b) => {
    if (!a.floor && b.floor) return 1;
    if (!b.floor && a.floor) return -1;
    return a.floor.localeCompare(b.floor, "he");
  });
};
const DEFAULT_CLEAN_CHECKLIST = [
  { id: "floor", label: "שטיפת רצפה", translations: { en: "Floor washing", ru: "Мытье пола", ar: "غسل الأرضية", hi: "फर्श धोना", ti: "መሬት ምሕጻብ" } },
  { id: "soap", label: "מילוי סבון", translations: { en: "Refill soap", ru: "Пополнить мыло", ar: "تعبئة الصابون", hi: "साबुन भरना", ti: "ሳሙና ምምላእ" } },
  { id: "paper", label: "נייר טואלט", translations: { en: "Toilet paper", ru: "Туалетная бумага", ar: "ورق تواليت", hi: "टॉयलेट पेपर", ti: "ናይ ሽቓቕ ወረቐት" } },
  { id: "towels", label: "מגבות נייר", translations: { en: "Paper towels", ru: "Бумажные полотенца", ar: "مناشف ورقية", hi: "पेपर टॉवल", ti: "ናይ ወረቐት መንጸፊ" } },
  { id: "bins", label: "פינוי פחים", translations: { en: "Empty bins", ru: "Вынести мусор", ar: "تفريغ السلال", hi: "कूड़ेदान खाली करना", ti: "መጕሓፊ ምፍሳስ" } },
  { id: "surfaces", label: "ניגוב משטחים", translations: { en: "Wipe surfaces", ru: "Протереть поверхности", ar: "مسح الأسطح", hi: "सतह पोंछना", ti: "ገጻት ምድራዝ" } }
];
const cleaningChecklistLabel = (item, language = DEFAULT_LANGUAGE) => {
  const code = normalizeLanguageCode(language);
  return (code !== DEFAULT_LANGUAGE && item?.translations?.[code]) || item?.label || "";
};
const lastRoundOf = (zoneId, rounds) => (rounds || []).filter((r) => r.zoneId === zoneId).reduce((m, r) => (r.at > m ? r.at : m), 0);
const dayStart = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
const dayLabel = (ts) => { const t = dayStart(Date.now()); if (ts === t) return "היום"; if (ts === t - 86400000) return "אתמול"; return fmtDate(ts); };
// ימי פעילות של אזור ניקיון (0=ראשון … 6=שבת). ברירת מחדל לאזורים ישנים ללא הגדרה: כל יום (תאימות לאחור).
const WEEKDAYS = [{ d: 0, short: "א׳", label: "ראשון" }, { d: 1, short: "ב׳", label: "שני" }, { d: 2, short: "ג׳", label: "שלישי" }, { d: 3, short: "ד׳", label: "רביעי" }, { d: 4, short: "ה׳", label: "חמישי" }, { d: 5, short: "ו׳", label: "שישי" }, { d: 6, short: "ש׳", label: "שבת" }];
const WORK_WEEK = [0, 1, 2, 3, 4]; // ראשון–חמישי
const zoneActiveDays = (z) => (Array.isArray(z.activeDays) ? z.activeDays : [0, 1, 2, 3, 4, 5, 6]);
const isCleaningDay = (z, ts) => zoneActiveDays(z).includes(new Date(ts).getDay());
const activeDaysLabel = (z) => { const d = zoneActiveDays(z); if (d.length === 7) return "כל יום"; if (d.length === 5 && WORK_WEEK.every((x) => d.includes(x))) return "א׳–ה׳"; if (!d.length) return "ללא ימים"; return WEEKDAYS.filter((w) => d.includes(w.d)).map((w) => w.short).join(" · "); };
const zoneCleanerIds = (zone = {}) => {
  const ids = Array.isArray(zone.cleanerIds) ? zone.cleanerIds : [];
  if (zone.cleanerId) ids.unshift(zone.cleanerId);
  return [...new Set(ids.map(String).filter(Boolean))];
};
const isZoneCleaner = (zone, userId) => zoneCleanerIds(zone).includes(String(userId || ""));
const zoneCleanerNames = (zone = {}, users = []) => {
  const byId = new Map((users || []).map((u) => [String(u.id), u.name]));
  const names = Array.isArray(zone.cleanerNames) ? zone.cleanerNames : [];
  const fromIds = zoneCleanerIds(zone).map((id) => byId.get(id)).filter(Boolean);
  if (zone.cleanerName) names.unshift(zone.cleanerName);
  return [...new Set([...fromIds, ...names].map((x) => String(x || "").trim()).filter(Boolean))];
};
const zoneCleanerLabel = (zone, users = []) => zoneCleanerNames(zone, users).join(", ") || "ללא אחראי";
// פריטי הצ׳קליסט שרלוונטיים לחלון מסוים. win.items === undefined/null ⇒ כל הפריטים (תאימות לאחור + כולל פריטים עתידיים).
const windowItems = (zone, win) => { const cl = zone.checklist || []; if (!win || !Array.isArray(win.items)) return cl; const set = new Set(win.items); return cl.filter((c) => set.has(c.id)); };
const parseHM = (hm) => cleaningWindowMinutes({ time: hm });
const windowAbs = (win, ts) => dayStart(ts) + cleaningWindowMinutes(win) * 60000;
const zoneTodayStatuses = (zone, rounds, now, cfg = {}) => {
  if (!isCleaningDay(zone, now)) return []; // לא יום ניקיון של האזור — אין חלונות / אין "פוספס"
  const reminderMs = clampCleaningReminderMins(cfg?.cleaningReminderMins ?? 30) * 60000;
  const ws = (zone.windows || []).slice().sort((a, b) => parseHM(a.time) - parseHM(b.time));
  const ds = dayStart(now), eod = ds + 86400000;
  return ws.map((win) => {
    const { target, tol, slotStart, slotEnd } = cleaningWindowBounds(win, ds);
    const round = (rounds || []).find((r) => isCompletedCleaningRound(r) && r.zoneId === zone.id && r.at >= ds && r.at < eod && (r.winId ? r.winId === win.id : (r.at >= slotStart && r.at < slotEnd)));
    let status;
    if (round) status = "done";
    else if (now < slotStart) status = slotStart - now <= reminderMs ? "upcoming" : "pending";
    else if (now <= target + tol) status = "due";
    else if (now < slotEnd) status = "overdue";
    else status = "missed";
    return { win, status, target, slotStart, slotEnd, round };
  });
};
const WIN_META = { done: { label: "בוצע", color: "#16A34A", bg: "#DCFCE7" }, due: { label: "כעת", color: "#B45309", bg: "#FEF3C7" }, overdue: { label: "באיחור", color: "#EA580C", bg: "#FFEDD5" }, missed: { label: "פוספס", color: "#DC2626", bg: "#FEE2E2" }, upcoming: { label: "מתקרב", color: "#1F4E8C", bg: "var(--primary-soft)" }, pending: { label: "מתוכנן", color: "#64748B", bg: "var(--surface-2)" } };
const materializeMissedCleaningRounds = async ({ zones = [], rounds = [], now = Date.now(), config = {}, saveRound, inFlightRef }) => {
  if (!saveRound) return;
  const ds = dayStart(now), eod = ds + 86400000;
  const records = [];
  (zones || []).filter((z) => z.active !== false).forEach((zone) => {
    const statuses = zoneTodayStatuses(zone, rounds, now, config);
    records.push(...cleaningMissedRoundRecordsForStatuses({ zone, statuses, rounds, dayStart: ds, dayEnd: eod, zoneLoc: zoneLoc(zone) }));
  });
  for (const record of records) {
    if (inFlightRef?.current?.has(record.id)) continue;
    inFlightRef?.current?.add(record.id);
    try {
      await saveRound(record);
    } finally {
      inFlightRef?.current?.delete(record.id);
    }
  }
};
const dayCompliance = (zone, rounds, dayTs, now) => {
  if (!isCleaningDay(zone, dayTs)) return []; // יום ללא ניקיון מתוכנן — לא נספר בעמידה ביעדים
  const ws = (zone.windows || []).slice().sort((a, b) => parseHM(a.time) - parseHM(b.time));
  const ds = dayStart(dayTs), eod = ds + 86400000;
  return ws.map((win) => {
    const { target, tol, slotStart, slotEnd } = cleaningWindowBounds(win, ds);
    const resolved = slotEnd <= now; const r = (rounds || []).find((x) => isCompletedCleaningRound(x) && x.zoneId === zone.id && x.at >= ds && x.at < eod && (x.winId ? x.winId === win.id : (x.at >= slotStart && x.at < slotEnd)));
    return { resolved, done: !!r, onTime: r ? r.at <= target + tol : false };
  });
};
const COMPLAINT_KIND = { dirty: { label: "לכלוך", color: "#1F4E8C", Icon: Sparkles }, broken: { label: "תקלה / שבר", color: "#B45309", Icon: Wrench }, round: { label: "הערות סבב", color: "#DC2626", Icon: AlertTriangle } };
const hasCleaningPhoto = (record) => !!(record?.photo || record?.photoPath);
function CleaningPhoto({ record, className = "cmp-photo", style }) {
  const [src, setSrc] = useState(record?.photo || null);
  useEffect(() => {
    let live = true;
    setSrc(record?.photo || null);
    if (!record?.photo && record?.photoPath) CLEANING_PHOTOS.load(record).then((data) => { if (live) setSrc(data || null); });
    return () => { live = false; };
  }, [record?.photo, record?.photoPath]);
  return src ? <img className={className || undefined} style={style} src={src} alt="" /> : null;
}
function ComplaintCard({ c, onResolve, onApprove, onReject, onEscalate, onOpen }) {
  const k = COMPLAINT_KIND[c.kind] || COMPLAINT_KIND.dirty; const Ic = k.Icon;
  const anon = c.reportedByRole === "anonymous";
  const escalated = c.escalatedTo === "admin";
  const border = (c.status === "resolved" || c.status === "rejected") ? "var(--muted)" : c.status === "pending" ? "#1F4E8C" : escalated ? "#DC2626" : k.color;
  const srcLabel = anon ? "דיווח אנונימי · לא מאומת" : `${c.reportedByName}${c.reportedByRole === "user" ? " · מנהל מחלקה" : c.reportedByRole === "admin" ? " · מנהל מערכת" : c.reportedByRole === "worker" ? " · עובד" : c.reportedByRole === "cleaner" ? " · עובד ניקיון" : ""}`;
  const nIss = (c.issues || []).length;
  const statusLine = c.status === "pending" ? <span className="badge sm" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>ממתין לאישור</span>
    : c.status === "resolved" ? <span className="cmp-done"><CheckCircle2 size={13} /> טופל{c.resolvedBy ? " · " + c.resolvedBy : ""}</span>
      : c.status === "rejected" ? <span className="cmp-done" style={{ color: "var(--muted)" }}><X size={13} /> נדחה{c.resolvedBy ? " · " + c.resolvedBy : ""}</span>
        : escalated ? <span className="badge sm" style={{ background: "#FEE2E2", color: "#DC2626" }}>הועבר למנהל המערכת</span>
          : c.ownerRole === "admin" ? (c.progress === "in_progress" ? <span className="badge sm" style={{ background: "#FEF3C7", color: "#B45309" }}>בטיפול{c.progressNote ? " · " + c.progressNote : ""}</span> : <span className="badge sm" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>התקבל — בטיפול ההנהלה</span>)
            : c.kind === "broken" ? <span className="cmp-done" style={{ color: "var(--muted)" }}><Wrench size={13} /> מסלול אחזקה</span>
              : <span className="cmp-done" style={{ color: "var(--muted)" }}>אצל עובד הניקיון</span>;
  if (onOpen) return (<button className="cmp-card clk" style={{ borderInlineStartColor: border, width: "100%", textAlign: "start", cursor: "pointer" }} onClick={() => onOpen(c)}>
    <CleaningPhoto record={c} />
    <div className="cmp-body">
      <div className="cmp-row1"><span className="badge sm" style={{ background: k.color + "22", color: k.color }}><Ic size={12} /> {k.label}{nIss > 1 ? " · " + nIss : ""}</span><span className="cmp-zone">{c.zoneName}</span><ChevronLeft size={15} style={{ marginInlineStart: "auto", color: "var(--muted)" }} /></div>
      <div className="cmp-meta">{c.zoneLoc ? c.zoneLoc + " · " : ""}{srcLabel} · {timeAgo(c.at)}</div>
      {c.text && <div className="cmp-text" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.text}</div>}
      <div style={{ marginTop: 4 }}>{statusLine}</div>
    </div>
  </button>);
  return (<div className="cmp-card" style={{ borderInlineStartColor: border }}>
    <CleaningPhoto record={c} />
    <div className="cmp-body">
      <div className="cmp-row1"><span className="badge sm" style={{ background: k.color + "22", color: k.color }}><Ic size={12} /> {k.label}</span>{c.status === "pending" && <span className="badge sm" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>ממתין לאישור</span>}{escalated && (c.status === "open") && <span className="badge sm" style={{ background: "#FEE2E2", color: "#DC2626" }}>הועבר למנהל המערכת</span>}<span className="cmp-zone">{c.zoneName}</span></div>
      <div className="cmp-meta">{c.zoneLoc ? c.zoneLoc + " · " : ""}{srcLabel} · {timeAgo(c.at)}{c.ticketId ? " · נפתחה קריאת אחזקה" : ""}</div>
      {c.text && <div className="cmp-text">{c.text}</div>}
      {!hasCleaningPhoto(c) && c.noPhotoReason && <div className="cmp-text" style={{ color: "var(--muted)", fontStyle: "italic" }}><Camera size={12} /> ללא תמונה · {c.noPhotoReason}</div>}
      {c.status === "pending" && onApprove
        ? <div className="cmp-actions"><button className="btn-primary sm" onClick={() => onApprove(c)}><Check size={14} /> אישור</button><button className="btn-ghost sm" onClick={() => onReject(c)}><X size={14} /> דחייה</button></div>
        : c.status === "resolved" ? <div className="cmp-done"><CheckCircle2 size={13} /> טופל{c.resolvedBy ? " · " + c.resolvedBy : ""}</div>
          : c.status === "rejected" ? <div className="cmp-done" style={{ color: "var(--muted)" }}><X size={13} /> נדחה{c.resolvedBy ? " · " + c.resolvedBy : ""}</div>
            : c.status === "open" && c.kind === "broken" ? <div className="cmp-done" style={{ color: "var(--muted)" }}><Wrench size={13} /> בטיפול במסלול האחזקה</div>
              : (onResolve || onEscalate) ? <div className="cmp-actions">{onResolve && <button className="btn-primary sm" onClick={() => onResolve(c)}><Check size={14} /> סומן כטופל</button>}{onEscalate && !escalated && <button className="btn-ghost sm" onClick={() => onEscalate(c)}>העברה למנהל</button>}</div>
                : <div className="cmp-done" style={{ color: "var(--muted)" }}>{escalated ? "ממתין לטיפול מנהל המערכת" : "אצל עובד הניקיון"}</div>}
    </div>
  </div>);
}

function ComplaintDetail({ c, round, zone, caps, onApprove, onReject, onResolve, onProgress, onEscalate, onDelete, onClose }) {
  const k = COMPLAINT_KIND[c.kind] || COMPLAINT_KIND.dirty; const Ic = k.Icon;
  const [rejectMode, setRejectMode] = useState(false), [reason, setReason] = useState(""), [resolveMode, setResolveMode] = useState(false), [note, setNote] = useState(""), [progMode, setProgMode] = useState(false), [pNote, setPNote] = useState(c.progressNote || "");
  const inProg = c.progress === "in_progress";
  const anon = c.reportedByRole === "anonymous";
  const src = anon ? "דיווח אנונימי" : `${c.reportedByName}${c.reportedByRole === "user" ? " · מנהל מחלקה" : c.reportedByRole === "admin" ? " · מנהל מערכת" : c.reportedByRole === "worker" ? " · עובד" : c.reportedByRole === "cleaner" ? " · עובד ניקיון" : ""}`;
  const issues = c.issues || [];
  const cp = caps || {};
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" aria-label="סגירה" onClick={onClose}><X size={22} /></button><div className="form-title">פרטי דיווח</div></div>
    <div className="body">
      <div className="round-zone"><div className="rz-name">{c.zoneName}</div><div className="rz-loc">{c.zoneLoc || "—"} · {src} · {fmtDate(c.at)} {fmtTime(c.at)}</div><span className="badge sm" style={{ background: k.color + "22", color: k.color }}><Ic size={12} /> {k.label}</span></div>
      {c.text && <div className="field"><span>תיאור</span><div className="cmp-text">{c.text}</div></div>}
      {issues.length > 0 && <div className="field"><span><AlertTriangle size={14} /> הערות ({countLabel(issues.length, "הערה", "הערות")})</span><div className="cards">{issues.map((iss, i) => <div key={i} className="cmp-card" style={{ borderInlineStartColor: "#DC2626" }}><CleaningPhoto record={iss} /><div className="cmp-body"><div className="cmp-row1"><span className="badge sm" style={{ background: "#FEE2E2", color: "#DC2626" }}>{iss.label || "פריט"}</span></div><div className="cmp-text">{iss.reason}</div></div></div>)}</div></div>}
      {hasCleaningPhoto(c) && issues.length === 0 && <div className="field"><span>תמונה</span><CleaningPhoto record={c} className="" style={{ width: "100%", borderRadius: 12 }} /></div>}
      {!hasCleaningPhoto(c) && c.noPhotoReason && <div className="field"><span>תמונה</span><div className="cmp-text" style={{ color: "var(--muted)", fontStyle: "italic" }}><Camera size={12} /> ללא תמונה · {c.noPhotoReason}</div></div>}
      {round && <div className="field"><span>מקור</span><div className="audit-row"><span className="audit-kdot" style={{ background: "var(--primary)" }} /><div className="audit-main"><div className="audit-text">סבב ניקיון{round.winTime ? " · " + round.winTime : ""}</div><div className="audit-meta">{round.byName} · {fmtTime(round.at)} · {round.doneCount}/{countLabel(round.total, "פריט", "פריטים")}</div></div></div></div>}
      <div className="field"><span>סטטוס והיסטוריה</span><div className="cmp-meta">
        {c.status === "pending" ? "ממתין לאישור" : c.status === "resolved" ? "טופל" : c.status === "rejected" ? "נדחה" : inProg ? "בטיפול" : c.ownerRole === "admin" ? "התקבל — בטיפול ההנהלה" : c.escalatedTo === "admin" ? "הועבר למנהל המערכת" : "אצל עובד הניקיון"}
        {c.approvedBy ? ` · אושר ע״י ${c.approvedBy}` : ""}{c.resolvedBy ? ` · נסגר ע״י ${c.resolvedBy}` : ""}
        {inProg && c.progressNote ? <div style={{ marginTop: 4, color: "#B45309" }}>בטיפול: {c.progressNote}</div> : null}
        {c.response ? <div style={{ marginTop: 4 }}>תגובה: {c.response}</div> : null}{c.rejectReason ? <div style={{ marginTop: 4 }}>סיבת דחייה: {c.rejectReason}</div> : null}
      </div></div>
      {progMode && <div className="field"><span>סטטוס טיפול (יוצג למדווח)</span><textarea rows={2} value={pNote} onChange={(e) => setPNote(e.target.value)} placeholder="לדוגמה: הוזמן — ממתין לאספקה" /></div>}
      {rejectMode && <div className="field"><span>סיבת דחייה (חובה — העובד יראה)</span><textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="מדוע הדיווח נדחה?" /></div>}
      {resolveMode && <div className="field"><span>תגובה לעובד (רשות)</span><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="מה נעשה? (יוצג למדווח)" /></div>}
      <div className="cmp-actions" style={{ flexWrap: "wrap" }}>
        {cp.approve && c.status === "pending" && !rejectMode && <button className="btn-primary sm" onClick={() => onApprove(c)}><Check size={14} /> אישור — קבלה לטיפול</button>}
        {cp.reject && c.status === "pending" && (rejectMode ? <button className="btn-primary sm" disabled={!reason.trim()} onClick={() => onReject({ ...c, rejectReason: reason.trim() })}><X size={14} /> אישור דחייה</button> : <button className="btn-ghost sm" onClick={() => setRejectMode(true)}><X size={14} /> דחייה</button>)}
        {cp.resolve && c.status === "open" && !inProg && (progMode ? <button className="btn-primary sm" disabled={!pNote.trim()} onClick={() => onProgress({ ...c, progressNote: pNote.trim() })}><Clock size={14} /> שמירת סטטוס</button> : <button className="btn-ghost sm" onClick={() => setProgMode(true)}><Clock size={14} /> סמן «בטיפול»</button>)}
        {cp.resolve && c.status === "open" && (resolveMode ? <button className="btn-primary sm" onClick={() => onResolve({ ...c, response: note.trim() })}><Check size={14} /> סגירה כטופל</button> : <button className="btn-primary sm" onClick={() => setResolveMode(true)}><Check size={14} /> סומן כטופל</button>)}
        {cp.escalate && c.status === "open" && c.escalatedTo !== "admin" && c.ownerRole !== "admin" && <button className="btn-ghost sm" onClick={() => onEscalate(c)}>העברה למנהל המערכת</button>}
        {cp.delete && <ConfirmBtn className="btn-danger sm" label="מחיקת דיווח" onConfirm={() => onDelete(c)} />}
      </div>
      <div style={{ height: 20 }} />
    </div></div>);
}

function ZoneForm({ zone, config, zones = [], cleaners, managers, onCancel, onSave, onDelete, canDelete, deleteBlockers = null, onOpenBlocker = () => {} }) {
  const [zoneId] = useState(zone.id || uid());
  const [zoneCode] = useState(zone.code || ("Z" + Math.random().toString(36).slice(2, 6).toUpperCase()));
  const areaOptions = useMemo(() => cleaningAreaOptions(config, zones), [config, zones]);
  const [name, setName] = useState(zone.name || ""), [areaName, setAreaName] = useState((zone.areaName || zone.area || zone.building || "").trim()), [floor, setFloor] = useState(zone.floor || ""), [code, setCode] = useState(zone.code || "");
  const [checklist, setChecklist] = useState(zone.checklist?.length ? zone.checklist : DEFAULT_CLEAN_CHECKLIST);
  const [windows, setWindows] = useState(zone.windows?.length ? zone.windows : [{ id: uid(), time: "06:00", tol: 60 }]);
  const [cleanerIds, setCleanerIds] = useState(() => zoneCleanerIds(zone)), [active, setActive] = useState(zone.active !== false), [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeDays, setActiveDays] = useState(Array.isArray(zone.activeDays) ? zone.activeDays : (zone.id ? [0, 1, 2, 3, 4, 5, 6] : WORK_WEEK));
  const [mgrIds, setMgrIds] = useState((managers || []).filter((m) => (m.mgrZones || []).includes(zone.id)).map((m) => m.id));
  const [openWin, setOpenWin] = useState(null);
  const [openChecklistTranslations, setOpenChecklistTranslations] = useState({});
  const blockerCount = cleaningZoneBlockerCount(deleteBlockers);
  const toggleDay = (d) => setActiveDays((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d]).sort((a, b) => a - b));
  const toggleWinItem = (i, id) => setWindows((s) => s.map((w, j) => { if (j !== i) return w; const valid = checklist.filter((c) => (c.label || "").trim()).map((c) => c.id); const cur = Array.isArray(w.items) ? w.items.filter((x) => valid.includes(x)) : valid.slice(); const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]; return { ...w, items: next.length >= valid.length ? null : next }; }));
  const setCl = (i, v) => setChecklist((s) => s.map((x, j) => (j === i ? { ...x, label: v } : x)));
  const setClTranslation = (i, code, value) => setChecklist((s) => s.map((x, j) => (j === i ? { ...x, translations: { ...(x.translations || {}), [code]: value } } : x)));
  const draftClTranslations = (i) => setChecklist((s) => s.map((x, j) => (j === i ? { ...x, translations: draftCleaningChecklistTranslations(x.label, x.translations) } : x)));
  const setWin = (i, k, v) => setWindows((s) => s.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const save = async () => {
    if (!areaName.trim()) return setErr("נא לבחור אזור מערכת");
    if (!name.trim()) return setErr("נא להזין שם אזור");
    const cl = checklist.filter((c) => (c.label || "").trim()).map((c) => normalizeCleaningChecklistItem({ ...c, id: c.id || uid() }));
    if (!cl.length) return setErr("נא להוסיף לפחות פריט אחד בצ׳קליסט");
    if (!activeDays.length) return setErr("נא לבחור לפחות יום פעילות אחד");
    const selectedCleaners = cleanerIds.map((id) => cleaners.find((c) => c.id === id)).filter(Boolean);
    const clIds = new Set(cl.map((c) => c.id));
    setErr("");
    setBusy(true);
    try {
      const area = areaName.trim();
      const ok = await onSave({ id: zoneId, code: code.trim() || zoneCode, name: name.trim(), areaName: area, building: area, floor: floor.trim(), checklist: cl, windows: windows.filter((w) => w.time).map((w) => { const items = Array.isArray(w.items) ? w.items.filter((id) => clIds.has(id)) : null; return { id: w.id || uid(), time: w.time, tol: +w.tol || 0, items: (items && items.length < cl.length) ? items : null }; }), activeDays: activeDays.slice().sort((a, b) => a - b), cleanerIds, cleanerNames: selectedCleaners.map((c) => c.name), cleanerId: cleanerIds[0] || "", cleanerName: selectedCleaners[0]?.name || "", active, demo: zone.demo || false, createdAt: zone.createdAt || Date.now() }, mgrIds);
      if (ok === false) setErr("השמירה נכשלה — בדקו חיבור ונסו שוב.");
    } catch {
      setErr("השמירה נכשלה — בדקו חיבור ונסו שוב.");
    } finally {
      setBusy(false);
    }
  };
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" aria-label="סגירה" onClick={onCancel}><X size={22} /></button><div className="form-title">{zone.id ? "עריכת אזור ניקיון" : "אזור ניקיון חדש"}</div></div>
    <div className="body">
      <label className="field"><span>אזור מערכת *</span><select value={areaName} onChange={(e) => setAreaName(e.target.value)}><option value="">— בחרו מתוך אזורי האחזקה —</option>{areaOptions.length > 0 && <optgroup label="אזורי אחזקה">{areaOptions.map((area) => <option key={area} value={area}>{area}</option>)}</optgroup>}</select><div className="hint">הרשימה נמשכת מהגדרות אחזקה › אזורים. כך ניקיון, קריאות ודוחות משתמשים באותה מפת אתר.</div></label>
      <div className="field-row"><label className="field"><span>קומה / מיקום משנה</span><input value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="קומה 2 / אגף מזרח / כניסה" /></label><label className="field"><span>שם אזור ניקיון *</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="לדוגמה: שירותים / מטבחון / משרדים" /></label></div>
      <div className="field"><span>צ׳קליסט האזור *</span>
        {checklist.map((c, i) => {
          const rowKey = c.id || String(i);
          const translationsOpen = !!openChecklistTranslations[rowKey];
          return <div key={rowKey} className="cl-edit-block">
            <div className="cl-row"><input value={c.label} onChange={(e) => setCl(i, e.target.value)} placeholder="פריט לבדיקה" /><button className="btn-ghost sm cl-translate-btn" type="button" onClick={() => setOpenChecklistTranslations((s) => ({ ...s, [rowKey]: !translationsOpen }))}>{translationsOpen ? "סגירת תרגומים" : "תרגומים"}</button><button className="icon-btn sm" aria-label={`מחק פריט צ׳קליסט: ${c.label || "ללא שם"}`} onClick={() => setChecklist((s) => s.filter((_, j) => j !== i))}><Trash2 size={16} /></button></div>
            {translationsOpen && <div className="cl-translations">
              <div className="cl-translation-head"><span>תרגומים לעובדים</span><button className="btn-ghost sm" type="button" onClick={() => draftClTranslations(i)}>טיוטת תרגום</button></div>
              <div className="hint">התרגום נשמר רק אחרי בדיקה. אם שפה נשארת ריקה, העובד יראה את הטקסט המקורי בעברית.</div>
              {cleaningChecklistTranslationLanguages().map((language) => <label key={language.code} className="field cl-translation-field"><span>{language.nativeName}</span><input dir={language.dir} value={(c.translations || {})[language.code] || ""} onChange={(e) => setClTranslation(i, language.code, e.target.value)} placeholder={language.englishName} /></label>)}
            </div>}
          </div>;
        })}
        <button className="btn-ghost sm" onClick={() => setChecklist((s) => [...s, { id: uid(), label: "" }])}><Plus size={14} /> הוספת פריט</button>
      </div>
      <div className="field"><span>חלונות סבב (שעה + סטייה מותרת בדקות)</span>
        {windows.map((w, i) => { const valid = checklist.filter((c) => (c.label || "").trim()); const sel = Array.isArray(w.items) ? w.items : null; const cnt = sel ? valid.filter((c) => sel.includes(c.id)).length : valid.length; return <div key={w.id || i} style={{ marginBottom: 8 }}>
          <div className="cl-row"><TimeInput value={w.time} onChange={(value) => setWin(i, "time", value)} /><div className="win-tol">± <input type="number" min="0" value={w.tol} onChange={(e) => setWin(i, "tol", e.target.value)} /> ד׳</div><button className="icon-btn sm" aria-label={`מחק חלון סבב: ${w.time || "ללא שעה"}`} onClick={() => setWindows((s) => s.filter((_, j) => j !== i))}><Trash2 size={16} /></button></div>
          <button className="btn-ghost sm" type="button" onClick={() => setOpenWin(openWin === i ? null : i)} style={{ marginTop: 4 }}>{openWin === i ? "▾" : "▸"} פריטים בסבב זה ({cnt}/{countLabel(valid.length, "פריט", "פריטים")}){cnt < valid.length ? " · חלקי" : ""}</button>
          {openWin === i && (valid.length === 0 ? <div className="hint">הגדירו תחילה פריטי צ׳קליסט למעלה.</div> : <div style={{ padding: "6px 8px", background: "var(--surface-2)", borderRadius: 10, marginTop: 4 }}>{valid.map((c) => { const on = sel ? sel.includes(c.id) : true; return <label key={c.id} className="chk-line"><input type="checkbox" checked={on} onChange={() => toggleWinItem(i, c.id)} /> {c.label}</label>; })}</div>)}
        </div>; })}
        <button className="btn-ghost sm" onClick={() => setWindows((s) => [...s, { id: uid(), time: "12:00", tol: 60, items: null }])}><Plus size={14} /> הוספת חלון</button>
        <div className="hint">לכל סבב אפשר לבחור אילו פריטים נבדקים בו (כברירת מחדל — כולם). למשל סבב אמצע היום יכול לכלול רק חלק מהפריטים.</div>
      </div>
      <div className="field"><span>ימי פעילות (באילו ימים האזור מנוקה)</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>{WEEKDAYS.map((w) => { const on = activeDays.includes(w.d); return <button key={w.d} type="button" onClick={() => toggleDay(w.d)} className={"pr-pick" + (on ? " on" : "")} style={on ? { background: "var(--primary)", color: "#fff", borderColor: "var(--primary)", minWidth: 40, justifyContent: "center" } : { minWidth: 40, justifyContent: "center" }}>{w.short}</button>; })}</div>
        <div className="hint">בימים שלא נבחרו לא ייווצרו סבבים ולא יירשם «פוספס». ברירת מחדל: ראשון–חמישי.</div>
      </div>
      <div className="field"><span>אחראי סבבים</span>
        {cleaners.length === 0 ? <div className="hint">אין עדיין עובדי ניקיון פעילים.</div> : <div className="chk-grid">{cleaners.map((c) => {
          const on = cleanerIds.includes(c.id);
          return <label key={c.id} className={"chk-pill" + (on ? " on" : "")}><input type="checkbox" checked={on} onChange={() => setCleanerIds((s) => s.includes(c.id) ? s.filter((x) => x !== c.id) : [...s, c.id])} /> {c.name}</label>;
        })}</div>}
        <div className="hint">אפשר לבחור כמה אחראים. הראשון שנבחר נשמר כברירת מחדל לאחור, וכל האחראים יראו את האזור והדיווחים שלו.</div>
      </div>
      {managers && <div className="field"><span>מנהלי מחלקה שרואים את האזור</span>{managers.length === 0 ? <div className="hint">אין מנהלי מחלקה. הוסיפו תחת «צוות ומשתמשים».</div> : <div className="chk-grid">{managers.map((m) => <label key={m.id} className={"chk-pill" + (mgrIds.includes(m.id) ? " on" : "")}><input type="checkbox" checked={mgrIds.includes(m.id)} onChange={() => setMgrIds((s) => s.includes(m.id) ? s.filter((x) => x !== m.id) : [...s, m.id])} /> {m.name}</label>)}</div>}<div className="hint">אותה הגדרה כמו ב«צוות ומשתמשים» של המנהל — נשמרת לשני הכיוונים.</div></div>}
      <label className="chk-line"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> אזור פעיל</label>
      {canDelete && blockerCount > 0 && <div className="note" style={{ marginTop: 8, borderColor: "#FDE68A" }}><AlertTriangle size={14} /> מחיקת האזור תמחק גם את ההיסטוריה המקושרת אליו.
        <div className="u-filters" style={{ marginTop: 8 }}>
          {(deleteBlockers?.rounds || []).length > 0 && <button type="button" className="btn-ghost sm" onClick={() => onOpenBlocker("rounds")}>סבבים: {deleteBlockers.rounds.length}</button>}
          {(deleteBlockers?.complaints || []).length > 0 && <button type="button" className="btn-ghost sm" onClick={() => onOpenBlocker("complaints")}>דיווחים: {deleteBlockers.complaints.length}</button>}
          {(deleteBlockers?.managers || []).length > 0 && <span className="badge sm" style={{ background: "#FEF3C7", color: "#92400E" }}>יוסר ממנהלים: {deleteBlockers.managers.map((m) => m.name || "—").join(", ")}</span>}
        </div>
      </div>}
      {err && <div className="err">{err}</div>}
      <button className="btn-primary full" onClick={save} disabled={busy}>{busy ? "שומר…" : "שמירה"}</button>
      {canDelete && <ConfirmBtn className="btn-danger full" style={{ marginTop: 10 }} label={blockerCount > 0 ? "מחיקת אזור והיסטוריה" : "מחיקת אזור"} onConfirm={onDelete} />}
      <div style={{ height: 24 }} />
    </div></div>);
}

function ZoneTag({ zone, onClose }) {
  const qrUrl = cleaningQrUrlFromWindow(zone.id);
  const [qrDataUrl, setQrDataUrl] = useState("");
  useEffect(() => {
    let alive = true;
    setQrDataUrl("");
    loadQrCode()
      .then((QRCode) => QRCode.toDataURL(qrUrl || ("czone:" + zone.id), { errorCorrectionLevel: "M", margin: 0, width: 220 }))
      .then((url) => { if (alive) setQrDataUrl(url); })
      .catch(() => { if (alive) setQrDataUrl(""); });
    return () => { alive = false; };
  }, [qrUrl, zone.id]);
  return (<div className="ovl-inner qr-label-sheet"><div className="form-head qr-label-controls"><button className="icon-btn" aria-label="סגירה" onClick={onClose}><X size={22} /></button><div className="form-title">מדבקת QR להדפסה</div></div>
    <div className="body qr-label-body">
      <div className="qr-label-actions qr-label-controls">
        <button className="btn-primary full sm" onClick={() => { try { window.print(); } catch (e) {} }}><Printer size={15} /> הדפסת מדבקה</button>
      </div>
      <div className="zone-tag-page">
        <div className="zone-tag">
          <div className="zt-name">{zone.name}</div>
          <div className="zt-loc">{zoneLoc(zone) || zone.name}</div>
          {qrDataUrl ? <img className="zt-qr" alt="QR" src={qrDataUrl} /> : <div className="zt-qr-fallback"><ClipboardCheck size={40} /></div>}
          <div className="zt-code">{zone.code}</div>
          <div className="zt-hint">QR אזור ראשי · סריקה לדיווח או לסבב ניקיון</div>
        </div>
      </div>
    </div></div>);
}

function CleaningAdmin(p) {
  const { zones, rounds, users, absences, saveZone, delZone, saveUser, saveRound, complaints, fileComplaint, resolveComplaint, progressComplaint, approveComplaint, rejectComplaint, delComplaint, onAskAI } = p;
  const cleaners = useMemo(() => (users || []).filter(isActiveCleaningWorker), [users]);
  const managers = useMemo(() => (users || []).filter((u) => u.role === "user" && u.active !== false), [users]);
  const [tab, setTab] = useState("today"), [edit, setEdit] = useState(null), [tag, setTag] = useState(null), [rep, setRep] = useState(null), [showClosed, setShowClosed] = useState(false);
  const [rZone, setRZone] = useState("all"), [rProblems, setRProblems] = useState(false), [rDetail, setRDetail] = useState(null), [cDetail, setCDetail] = useState(null);
  const [cZone, setCZone] = useState("all");
  const [zoneMapView, setZoneMapView] = useState("zones");
  const missedInFlight = useRef(new Set());
  const list = useMemo(() => (zones || []).slice().sort(zoneSort), [zones]);
  const roundsByDay = useMemo(() => { const g = {}; (rounds || []).slice().filter((r) => (rZone === "all" || r.zoneId === rZone) && (!rProblems || (r.issues || []).length > 0)).sort((a, b) => b.at - a.at).slice(0, 200).forEach((r) => { const k = dayStart(r.at); (g[k] = g[k] || []).push(r); }); return Object.entries(g).sort((a, b) => b[0] - a[0]); }, [rounds, rZone, rProblems]);
  const complaintScope = useMemo(() => (complaints || []).filter((c) => cZone === "all" || c.zoneId === cZone), [complaints, cZone]);
  const pending = useMemo(() => complaintScope.filter((c) => c.status === "pending").sort((a, b) => b.at - a.at), [complaintScope]);
  const openC = useMemo(() => complaintScope.filter((c) => c.status === "open").sort((a, b) => b.at - a.at), [complaintScope]);
  const escC = useMemo(() => openC.filter((c) => c.escalatedTo === "admin"), [openC]);
  const adminOwnedC = useMemo(() => openC.filter((c) => c.escalatedTo !== "admin" && c.ownerRole === "admin"), [openC]);
  const plainOpenC = useMemo(() => openC.filter((c) => c.escalatedTo !== "admin" && c.ownerRole !== "admin"), [openC]);
  const closedC = useMemo(() => complaintScope.filter((c) => c.status === "resolved" || c.status === "rejected").sort((a, b) => (b.resolvedAt || b.at) - (a.resolvedAt || a.at)), [complaintScope]);
  const needAttn = pending.length + openC.length;
  const editDeleteBlockers = useMemo(() => edit?.id ? cleaningZoneDeleteBlockers(edit.id, { rounds, complaints, users }) : null, [edit?.id, rounds, complaints, users]);
  const openZoneBlocker = (kind) => {
    const zoneId = edit?.id || "all";
    setEdit(null);
    if (kind === "rounds") {
      setTab("rounds");
      setRZone(zoneId);
      setRProblems(false);
      return;
    }
    if (kind === "complaints") {
      setTab("complaints");
      setCZone(zoneId);
      return;
    }
    setTab("zones");
  };
  const today = useMemo(() => {
    const now = Date.now();
    const rows = list.filter((z) => z.active !== false).map((z) => ({ z, sts: zoneTodayStatuses(z, rounds, now, p.config) }));
    const tot = rows.reduce((n, r) => n + r.sts.length, 0);
    const done = rows.reduce((n, r) => n + r.sts.filter((s) => s.status === "done").length, 0);
    const action = rows.filter((r) => r.sts.some((s) => isCleaningRoundActionableStatus(s.status)));
    const actionN = action.reduce((n, r) => n + r.sts.filter((s) => isCleaningRoundActionableStatus(s.status)).length, 0);
    const missed = rows.filter((r) => r.sts.some((s) => s.status === "missed"));
    const missedN = missed.reduce((n, r) => n + r.sts.filter((s) => s.status === "missed").length, 0);
    return { rows, tot, done, action, actionN, missed, missedN };
  }, [list, rounds]);
  const zoneWindowConflicts = useMemo(() => {
    const map = new Map();
    list.forEach((z) => {
      const counts = {};
      (z.windows || []).forEach((w) => { if (w.time) counts[w.time] = (counts[w.time] || 0) + 1; });
      Object.entries(counts).forEach(([time, count]) => { if (count > 1) map.set(`${z.id}|${time}`, count); });
    });
    return map;
  }, [list]);
  const cleanerTimeline = useMemo(() => {
    const groups = new Map();
    const addGroup = (id, name, unassigned = false) => {
      const label = String(name || "").trim();
      const normalized = label.toLocaleLowerCase("he").replace(/\s+/g, " ");
      const key = unassigned ? "__unassigned" : normalized ? `name:${normalized}` : `id:${id || "unknown"}`;
      if (!groups.has(key)) groups.set(key, { id: key, name: label || "ללא אחראי", unassigned, items: [], itemKeys: new Set(), conflicts: 0 });
      const group = groups.get(key);
      if (!group.name && label) group.name = label;
      return group;
    };
    list.filter((z) => z.active !== false).forEach((z) => {
      const ids = zoneCleanerIds(z);
      const assignees = ids.length ? ids.map((id) => ({ id, name: cleaners.find((c) => c.id === id)?.name || zoneCleanerNames(z, users).find(Boolean) || "אחראי" })) : [{ id: "__unassigned", name: "ללא אחראי", unassigned: true }];
      const wins = (z.windows || []).length ? z.windows : [{ id: `${z.id}-none`, time: "", tol: 0 }];
      assignees.forEach((person) => {
        const group = addGroup(person.id, person.name, person.unassigned);
        wins.forEach((win) => {
          const itemKey = `${z.id}|${win.id || win.time || ""}`;
          if (group.itemKeys.has(itemKey)) return;
          group.itemKeys.add(itemKey);
          group.items.push({ zone: z, win, timeKey: win.time || "—", zoneConflict: zoneWindowConflicts.has(`${z.id}|${win.time}`) });
        });
      });
    });
    groups.forEach((group) => {
      const byTime = new Map();
      group.items.forEach((item) => {
        if (!item.win.time) return;
        const k = item.win.time;
        if (!byTime.has(k)) byTime.set(k, []);
        byTime.get(k).push(item);
      });
      byTime.forEach((items) => {
        if (items.length > 1) {
          group.conflicts += items.length;
          items.forEach((item) => { item.personConflict = true; });
        }
      });
      group.items.sort((a, b) => parseHM(a.win.time) - parseHM(b.win.time) || (a.zone.name || "").localeCompare(b.zone.name || "", "he"));
    });
    return [...groups.values()].sort((a, b) => Number(a.unassigned) - Number(b.unassigned) || a.name.localeCompare(b.name, "he"));
  }, [list, cleaners, users, zoneWindowConflicts]);
  useEffect(() => {
    materializeMissedCleaningRounds({ zones: list, rounds, now: Date.now(), config: p.config, saveRound, inFlightRef: missedInFlight });
  }, [list, rounds, p.config, saveRound]);
  const winChips = (sts) => <div className="win-chips">{sts.map((s, i) => <span key={i} className="win-chip" style={{ background: WIN_META[s.status].bg, color: WIN_META[s.status].color }}>{s.win.time}</span>)}</div>;
  const roundOrdinal = (sts, win) => {
    const i = (sts || []).findIndex((s) => s.win === win || s.win?.id === win?.id);
    return i >= 0 ? `סבב ${i + 1} מתוך ${sts.length}` : "";
  };
  const zoneTodayStatButtons = (z, sts) => {
    const doneN = sts.filter((s) => s.status === "done").length;
    const missedN = sts.filter((s) => s.status === "missed").length;
    const dueN = sts.filter((s) => isCleaningRoundActionableStatus(s.status)).length;
    const issueN = (complaints || []).filter((c) => c.zoneId === z.id && c.status !== "rejected" && c.status !== "resolved").length;
    return <div className="clean-stat-row">
      <button type="button" className="clean-stat-chip" onClick={() => { setTab("rounds"); setRZone(z.id); setRProblems(false); }}>בוצעו {doneN}/{sts.length}</button>
      {dueN > 0 && <button type="button" className="clean-stat-chip warn" onClick={() => { setTab("today"); }}>לביצוע {dueN}</button>}
      {missedN > 0 && <button type="button" className="clean-stat-chip bad" onClick={() => { setTab("rounds"); setRZone(z.id); setRProblems(false); }}>פוספסו {missedN}</button>}
      {issueN > 0 && <button type="button" className="clean-stat-chip bad" onClick={() => { setTab("complaints"); setCZone(z.id); }}>בעיות {issueN}</button>}
    </div>;
  };
  const zoneWindowChips = (z) => {
    const wins = (z.windows || []).slice().sort((a, b) => parseHM(a.time) - parseHM(b.time));
    if (!wins.length) return <div className="clean-zone-windows"><span className="clean-window-chip muted">ללא חלונות</span></div>;
    return <div className="clean-zone-windows">{wins.map((w, i) => {
      const dup = zoneWindowConflicts.has(`${z.id}|${w.time}`);
      return <span key={w.id || i} className={"clean-window-chip" + (dup ? " dup" : "")}>{w.time || "—"}{dup ? " · כפול" : ""}</span>;
    })}</div>;
  };
  const zoneCard = (z) => {
    const lr = lastRoundOf(z.id, rounds);
    const hasConflict = (z.windows || []).some((w) => zoneWindowConflicts.has(`${z.id}|${w.time}`));
    return <div key={z.id} className="tcard clean-map-card" style={{ borderInlineStartColor: hasConflict ? "#B45309" : z.active !== false ? "var(--primary)" : "var(--muted)" }}>
      <span className="avatar"><Sparkles size={18} /></span>
      <div className="tcard-main">
        <div className="tcard-row1 clean-tcard-head"><span className="tcard-subj">{z.name}</span><span className="badge sm" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>{countLabel((z.windows || []).length, "סבב", "סבבים")} · {activeDaysLabel(z)}</span></div>
        <div className="clean-zone-meta"><span>{zoneLoc(z) || "—"}</span><span>אחראי: {zoneCleanerLabel(z, users)}</span><span>{lr ? "נוקה " + timeAgo(lr) : "טרם נוקה"}</span></div>
        {zoneWindowChips(z)}
      </div>
      <div className="tcard-actions"><button className="icon-btn sm" title="דיווח על בעיה" aria-label={`דיווח על בעיה באזור ${z.name}`} onClick={() => setRep(z)}><AlertTriangle size={17} /></button><button className="icon-btn sm" title="תווית / QR" aria-label={`הדפסת תווית QR לאזור ${z.name}`} onClick={() => setTag(z)}><Printer size={17} /></button><button className="icon-btn sm" title="עריכה" aria-label={`עריכת אזור ${z.name}`} onClick={() => setEdit(z)}><PenLine size={17} /></button></div>
    </div>;
  };
  const renderCleanerTimeline = () => <div className="clean-owner-grid">{cleanerTimeline.map((group) => {
    const zoneCount = new Set(group.items.map((item) => item.zone.id)).size;
    return <section key={group.id} className={"clean-owner-card" + (group.unassigned ? " unassigned" : "")}>
      <div className="clean-owner-head">
        <div><div className="clean-owner-title">{group.name}</div><div className="clean-owner-meta">{countLabel(zoneCount, "אזור", "אזורים")} · {countLabel(group.items.filter((x) => x.win.time).length, "סבב", "סבבים")}</div></div>
        {group.conflicts > 0 && <span className="clean-conflict-badge">כפילות זמן</span>}
      </div>
      <div className="clean-owner-rows">{group.items.length === 0 ? <div className="note">אין אזורים משויכים.</div> : group.items.map((item, i) => <button key={`${item.zone.id}-${item.win.id || i}-${i}`} type="button" className="clean-owner-row" onClick={() => setEdit(item.zone)}>
        <span className={"clean-owner-time" + (!item.win.time ? " muted" : "")}>{item.win.time || "—"}</span>
        <span className="clean-owner-main"><span className="clean-owner-zone">{item.zone.name}</span><span className="clean-owner-sub">{zoneLoc(item.zone) || "—"} · {activeDaysLabel(item.zone)}</span></span>
        {(item.personConflict || item.zoneConflict) && <span className="clean-conflict-badge soft">{item.personConflict ? "אחראי באותה שעה" : "כפילות באזור"}</span>}
      </button>)}</div>
    </section>;
  })}</div>;
  const zoneSelectOptions = groupCleaningByArea(list).map((g) => <optgroup key={g.area} label={g.area}>{g.items.map((z) => <option key={z.id} value={z.id}>{z.floor ? `${z.floor} · ` : ""}{z.name}</option>)}</optgroup>);
  const renderAreaSections = (items, renderItem, getZone = (x) => x) => groupCleaningByArea(items, getZone).map((areaGroup) => {
    const actionCount = areaGroup.items.reduce((n, item) => {
      const sts = item.sts || [];
      return n + sts.filter((s) => isCleaningRoundActionableStatus(s.status)).length;
    }, 0);
    return <section key={areaGroup.area} className="clean-area-group">
      <div className="clean-area-head"><div><div className="clean-area-title"><Building2 size={15} /> {areaGroup.area}</div><div className="clean-area-meta">{countLabel(areaGroup.items.length, "אזור ניקיון", "אזורי ניקיון")}{actionCount ? ` · ${actionCount} דורשים פעולה` : ""}</div></div></div>
      {groupCleaningByFloor(areaGroup.items, getZone).map((floorGroup) => <div key={floorGroup.floor || "_none"} className="clean-floor-group">
        {floorGroup.floor && <div className="clean-floor-title">{floorGroup.floor}</div>}
        <div className="cards">{floorGroup.items.map(renderItem)}</div>
      </div>)}
    </section>;
  });
  const askCleaningAI = onAskAI ? () => {
    const tk = todayKey();
    const away = (absences || []).filter((a) => a.from <= tk && (a.to || a.from) >= tk).map((a) => a.name || a.userId || "—");
    const unassigned = list.filter((z) => z.active !== false && zoneCleanerIds(z).length === 0).map((z) => z.name);
    const riskZones = [
      ...today.action.slice(0, 3).map(({ z, sts }) => {
        const activeWin = sts.find((s) => isCleaningRoundActionableStatus(s.status));
        return `${z.name}${activeWin?.win?.time ? ` · ${activeWin.win.time}` : ""}`;
      }),
      ...today.missed.slice(0, 2).map(({ z }) => `${z.name} · פוספס`)
    ];
    onAskAI(cleaningDashboardAiPrompt({
      labels: {
        zones: list.filter((z) => z.active !== false).length,
        doneRounds: today.done,
        totalRounds: today.tot,
        actionableRounds: today.actionN,
        missedRounds: today.missedN,
        pendingComplaints: pending.length,
        openComplaints: openC.length,
        escalatedComplaints: escC.length,
        absentCleaners: away,
        unassignedZones: unassigned,
        riskZones
      }
    }));
  } : null;
  return (<>
    <div className="seg-tabs s4" style={{ maxWidth: 560, marginBottom: 14 }}><button className={tab === "today" ? "on" : ""} onClick={() => setTab("today")}>היום</button><button className={tab === "zones" ? "on" : ""} onClick={() => setTab("zones")}>אזורים</button><button className={tab === "complaints" ? "on" : ""} onClick={() => setTab("complaints")}>דיווחים{needAttn ? ` (${needAttn})` : ""}</button><button className={tab === "rounds" ? "on" : ""} onClick={() => setTab("rounds")}>סבבים</button></div>
    {tab === "today" ? (list.length === 0 ? <Empty text="אין אזורים עדיין" Icon={Sparkles} sub="הוסיפו אזור בלשונית «אזורים»" /> : <>
      <div className="comp-card"><div className="comp-big">{today.done}/{today.tot}</div><div className="comp-lbl">סבבים בוצעו היום</div><div className="comp-bar"><span style={{ width: (today.tot ? Math.round(today.done / today.tot * 100) : 0) + "%" }} /></div>{askCleaningAI && <button className="btn-ghost sm" style={{ marginTop: 10 }} onClick={askCleaningAI}><Sparkles size={15} /> שאל AI</button>}</div>
      {(() => { const tk = todayKey(); const away = (absences || []).filter((a) => a.from <= tk && (a.to || a.from) >= tk); if (!away.length) return null; const zonesOf = (uid) => (zones || []).filter((z) => isZoneCleaner(z, uid) && z.active !== false).map((z) => z.name); return <div className="note" style={{ borderColor: "#FDE68A", marginBottom: 8 }}><CalendarClock size={13} /> בחופשה היום — נדרש כיסוי: {away.map((a) => `${a.name}${zonesOf(a.userId).length ? " (" + zonesOf(a.userId).join(", ") + ")" : ""}`).join(" · ")}</div>; })()}
      {today.action.length > 0 && <><SectionTitle><AlertTriangle size={15} /> דורש פעולה ({today.actionN})</SectionTitle>{renderAreaSections(today.action, ({ z, sts }) => { const actionable = sts.filter((s) => isCleaningRoundActionableStatus(s.status)); const activeWin = actionable[0]; return <div key={z.id} className="tcard" style={{ borderInlineStartColor: activeWin?.status === "overdue" ? "#EA580C" : "#B45309" }}><div className="tcard-main"><div className="tcard-row1 clean-tcard-head"><span className="tcard-subj">{z.name}</span><span className="badge sm" style={{ background: "#FEF3C7", color: "#B45309" }}>{activeWin ? `${roundOrdinal(sts, activeWin.win)} · ${activeWin.win.time}` : `${actionable.length} לביצוע`}</span></div><div className="tcard-sub">{zoneLoc(z) ? zoneLoc(z) + " · " : ""}{zoneCleanerLabel(z, users)}</div>{zoneTodayStatButtons(z, sts)}{winChips(sts)}</div></div>; }, (x) => x.z)}</>}
      {today.missed.length > 0 && <><SectionTitle><Clock size={15} /> פוספסו היום ({today.missedN})</SectionTitle><div className="note" style={{ marginBottom: 8 }}>חלונות שכבר עברו נשמרים להיסטוריה ולניתוח, אבל לא מוצגים לעובד כמשימה לביצוע.</div>{renderAreaSections(today.missed, ({ z, sts }) => <div key={z.id} className="tcard" style={{ borderInlineStartColor: "#DC2626" }}><div className="tcard-main"><div className="tcard-row1 clean-tcard-head"><span className="tcard-subj">{z.name}</span><span className="badge sm" style={{ background: "#FEE2E2", color: "#DC2626" }}>{sts.filter((s) => s.status === "missed").length} פוספסו</span></div><div className="tcard-sub">{zoneLoc(z) ? zoneLoc(z) + " · " : ""}{zoneCleanerLabel(z, users)}</div>{zoneTodayStatButtons(z, sts)}{winChips(sts)}</div></div>, (x) => x.z)}</>}
      <SectionTitle><Sparkles size={15} /> כל האזורים היום</SectionTitle>
      {renderAreaSections(today.rows, ({ z, sts }) => <div key={z.id} className="tcard"><span className="avatar"><Sparkles size={18} /></span><div className="tcard-main"><div className="tcard-row1 clean-tcard-head"><span className="tcard-subj">{z.name}</span></div><div className="tcard-sub">{zoneLoc(z) || "—"} · {zoneCleanerLabel(z, users)}</div>{zoneTodayStatButtons(z, sts)}{winChips(sts)}</div></div>, (x) => x.z)}
    </>)
      : tab === "rounds" ? (<>
        <div className="u-filters" style={{ marginBottom: 12 }}><select value={rZone} onChange={(e) => setRZone(e.target.value)}><option value="all">כל האזורים</option>{zoneSelectOptions}</select><button className={"wtoggle" + (rProblems ? " on" : "")} onClick={() => setRProblems((v) => !v)}><AlertTriangle size={14} /> רק עם הערות</button></div>
        {roundsByDay.length === 0 ? <Empty text="אין סבבים להצגה" Icon={Sparkles} sub="שנו את הסינון או המתינו לסבבים" /> : roundsByDay.map(([day, rs]) => <div key={day} style={{ marginBottom: 16 }}><div className="day-h">{dayLabel(+day)}</div><div className="cards">{rs.map((r) => { const prob = (r.issues || []).length > 0; const missed = !isCompletedCleaningRound(r); return <button key={r.id} className="audit-row clk" onClick={() => setRDetail(r)} style={(prob || missed) ? { borderInlineStartColor: missed ? "#DC2626" : "#DC2626", borderInlineStartWidth: 3, borderInlineStartStyle: "solid" } : {}}><span className="audit-time">{fmtTime(r.at)}</span><span className="audit-kdot" style={{ background: missed ? "#DC2626" : prob ? "#DC2626" : "#16A34A" }} /><div className="audit-main"><div className="audit-text">{r.zoneName}{r.zoneLoc ? " · " + r.zoneLoc : ""}{r.winTime ? " · " + r.winTime : ""}</div><div className="audit-meta">{missed ? "פוספס · לא בוצע" : `${r.byName} · ${r.doneCount}/${countLabel(r.total, "פריט", "פריטים")}`}{!missed && r.isCover ? " · כיסוי" + (r.coverFor ? " עבור " + r.coverFor : "") : ""}{prob ? ` · ${countLabel(r.issues.length, "הערה", "הערות")}` : ""}</div></div><ChevronLeft size={16} /></button>; })}</div></div>)}
      </>)
      : tab === "complaints" ? (<>
        <div className="u-filters" style={{ marginBottom: 12 }}><select value={cZone} onChange={(e) => setCZone(e.target.value)}><option value="all">כל האזורים</option>{zoneSelectOptions}</select>{cZone !== "all" && <button className="btn-ghost sm" onClick={() => setCZone("all")}>ניקוי סינון</button>}</div>
        {(pending.length + openC.length + closedC.length) === 0 ? <Empty text="אין דיווחים" Icon={Sparkles} sub="דיווחי לכלוך ותקלות יופיעו כאן" /> : <>
        {pending.length > 0 && <><SectionTitle><Clock size={15} /> ממתין לאישורך ({pending.length})</SectionTitle><div className="note" style={{ marginBottom: 8 }}>דיווחים מעובדים, מאחראי סבבים ומדיווח אנונימי. הקישו לפתיחה — אישור או דחייה עם סיבה.</div><div className="cards">{pending.map((c) => <ComplaintCard key={c.id} c={c} onOpen={setCDetail} />)}</div></>}
        {escC.length > 0 && <><SectionTitle><AlertTriangle size={15} /> הועבר אליך לטיפול ({escC.length})</SectionTitle><div className="cards">{escC.map((c) => <ComplaintCard key={c.id} c={c} onOpen={setCDetail} />)}</div></>}
        {adminOwnedC.length > 0 && <><SectionTitle><AlertTriangle size={15} /> בטיפולך ({adminOwnedC.length})</SectionTitle><div className="note" style={{ marginBottom: 8 }}>דיווחים מעובדי הניקיון שקיבלת לטיפול. סגרו כטופל לאחר הטיפול — העובד יראה את התגובה.</div><div className="cards">{adminOwnedC.map((c) => <ComplaintCard key={c.id} c={c} onOpen={setCDetail} />)}</div></>}
        {plainOpenC.length > 0 && <><SectionTitle><Clock size={15} /> אצל עובד הניקיון ({plainOpenC.length})</SectionTitle><div className="cards">{plainOpenC.map((c) => <ComplaintCard key={c.id} c={c} onOpen={setCDetail} />)}</div></>}
        {closedC.length > 0 && <><button className="day-toggle" onClick={() => setShowClosed((v) => !v)}>{showClosed ? "▾" : "▸"} טופלו / נדחו ({closedC.length})</button>{showClosed && <div className="cards">{closedC.map((c) => <ComplaintCard key={c.id} c={c} onOpen={setCDetail} />)}</div>}</>}
      </>}
      </>)
      : (<>
        <div className="row-between"><SectionTitle><Sparkles size={15} /> אזורי ניקיון ({list.length})</SectionTitle><button className="btn-primary sm" onClick={() => setEdit({})}><Plus size={15} /> אזור חדש</button></div>
        {cleaners.length === 0 && <div className="note" style={{ marginBottom: 10 }}>אין עדיין עובדים עם גישה לניקיון. הוסיפו עובד למחלקת ניקיון תחת «צוות ומשתמשים» כדי לשייך אחראי לאזור.</div>}
        {list.length === 0 ? <Empty text="אין אזורים עדיין" Icon={Sparkles} sub="הוסיפו אזור בלחיצה על «אזור חדש»" /> : <>
          <div className="seg-tabs s2 clean-map-switch"><button className={zoneMapView === "zones" ? "on" : ""} onClick={() => setZoneMapView("zones")}>לפי אזורים</button><button className={zoneMapView === "people" ? "on" : ""} onClick={() => setZoneMapView("people")}>לפי אחראים</button></div>
          {zoneMapView === "people" ? renderCleanerTimeline() : renderAreaSections(list, zoneCard)}
        </>}
      </>)}
    {edit && <Overlay onClose={() => setEdit(null)}><ZoneForm zone={edit} config={p.config} zones={zones} cleaners={cleaners} managers={managers} canDelete={!!edit.id} deleteBlockers={editDeleteBlockers} onOpenBlocker={openZoneBlocker} onCancel={() => setEdit(null)} onSave={async (z, mgrIds) => {
      if (!await saveZone(z)) return false;
      const managerResults = await Promise.all((managers || []).map((m) => {
        const has = (m.mgrZones || []).includes(z.id);
        const want = (mgrIds || []).includes(m.id);
        if (has === want) return true;
        return saveUser({ ...m, mgrZones: want ? [...(m.mgrZones || []), z.id] : (m.mgrZones || []).filter((x) => x !== z.id) });
      }));
      if (managerResults.some((ok) => ok === false)) return false;
      setEdit(null);
      return true;
    }} onDelete={async () => { if (await delZone(edit.id)) setEdit(null); }} /></Overlay>}
    {tag && <Overlay panelClassName="qr-label-panel" onClose={() => setTag(null)}><ZoneTag zone={tag} onClose={() => setTag(null)} /></Overlay>}
    {rDetail && <Overlay onClose={() => setRDetail(null)}><RoundDetail round={rDetail} zone={(zones || []).find((z) => z.id === rDetail.zoneId)} onClose={() => setRDetail(null)} /></Overlay>}
    {cDetail && <Overlay onClose={() => setCDetail(null)}><ComplaintDetail c={cDetail} round={cDetail.fromRoundId ? (rounds || []).find((r) => r.id === cDetail.fromRoundId) : null} zone={(zones || []).find((z) => z.id === cDetail.zoneId)} caps={{ approve: true, reject: true, resolve: cDetail.ownerRole === "admin" || cDetail.escalatedTo === "admin", delete: true }} onApprove={(c) => { approveComplaint(c); setCDetail(null); }} onReject={(c) => { rejectComplaint(c); setCDetail(null); }} onResolve={(c) => { resolveComplaint(c); setCDetail(null); }} onProgress={(c) => { progressComplaint(c); setCDetail(null); }} onDelete={async (c) => { if (await delComplaint(c.id)) setCDetail(null); }} onClose={() => setCDetail(null)} /></Overlay>}
    {rep && <Overlay onClose={() => setRep(null)}><ComplaintForm zone={rep} session={p.session} onCancel={() => setRep(null)} onSave={async (c) => { const ok = await fileComplaint(c); if (ok !== false) setRep(null); return ok; }} /></Overlay>}
  </>);
}

function RoundForm({ zone, win, session, onCancel, onSave, scanToken = false, config, language = DEFAULT_LANGUAGE }) {
  const t = (key, vars) => uiText(language, key, vars);
  const [done, setDone] = useState({}), [issues, setIssues] = useState({}), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const [scanOk, setScanOk] = useState(!appModeRequiresCleaningQr(APP_MODE) || !!scanToken), [showScanner, setShowScanner] = useState(false), [showManual, setShowManual] = useState(false), [manualReason, setManualReason] = useState(""), [manualEntry, setManualEntry] = useState(null);
  const fileRef = useRef(null); const photoTarget = useRef(null);
  const resize = (file, cb) => { if (!file) return; const r = new FileReader(); r.onload = (e) => { const img = new Image(); img.onload = () => { const max = 1000; let { width, height } = img; if (width > height && width > max) { height = height * max / width; width = max; } else if (height > max) { width = width * max / height; height = max; } const c = document.createElement("canvas"); c.width = width; c.height = height; c.getContext("2d").drawImage(img, 0, 0, width, height); cb(c.toDataURL("image/jpeg", 0.6)); }; img.src = e.target.result; }; r.readAsDataURL(file); };
  const cl = windowItems(zone, win);
  const doneCount = cl.filter((c) => done[c.id]).length;
  const isCover = zoneCleanerIds(zone).length > 0 && !isZoneCleaner(zone, session.id);
  const toggleIssue = (id) => { setErr(""); setIssues((s) => { if (s[id]) { const n = { ...s }; delete n[id]; return n; } return { ...s, [id]: { reason: "", photo: null, kind: "dirty" } }; }); setDone((d) => (d[id] ? { ...d, [id]: false } : d)); };
  const setIssueReason = (id, v) => setIssues((s) => ({ ...s, [id]: { ...s[id], reason: v } }));
  const setIssueKind = (id, k) => setIssues((s) => ({ ...s, [id]: { ...s[id], kind: k } }));
  const grabIssuePhoto = (file) => { const id = photoTarget.current; if (!id) return; resize(file, (d) => setIssues((s) => ({ ...s, [id]: { ...s[id], photo: d } }))); };
  const acceptScan = (raw) => {
    const scanned = extractCzoneFromRaw(raw);
    if (scanned !== zone.id) return setErr(scanned ? t("cleaningRound.qrWrong") : t("cleaningRound.qrMissing"));
    setErr("");
    setShowScanner(false);
    setScanOk(true);
  };
  const submitManualEntry = () => {
    const reason = manualReason.trim();
    if (!reason) return setErr(t("cleaningRound.manualReasonRequired"));
    setManualEntry({ reason, at: Date.now() });
    setScanOk(true);
    setShowManual(false);
    setErr("");
  };
  const submit = async () => {
    if (busy) return;
    const issArr = Object.entries(issues).map(([itemId, v]) => ({ itemId, label: cleaningChecklistLabel(cl.find((c) => c.id === itemId) || {}, language), reason: (v.reason || "").trim(), photo: v.photo || null, kind: v.kind === "broken" ? "broken" : "dirty" }));
    if (issArr.some((i) => !i.reason)) return setErr(t("cleaningRound.issueReasonRequired"));
    const unaddressed = cl.filter((c) => !done[c.id] && !issues[c.id]);
    if (unaddressed.length) return setErr(t("cleaningRound.unaddressed", { items: unaddressed.map((c) => cleaningChecklistLabel(c, language)).join(", ") }));
    setErr("");
    setBusy(true);
    try {
      const ok = await onSave({ id: uid(), zoneId: zone.id, zoneName: zone.name, zoneLoc: zoneLoc(zone), winId: win?.id || null, winTime: win?.time || null, at: Date.now(), byUid: session.id, byName: session.name, byRole: session.role, isCover: !!isCover, coverFor: isCover ? zoneCleanerLabel(zone) : "", items: done, doneCount, total: cl.length, issues: issArr, manualEntry: !!manualEntry, manualEntryReason: manualEntry?.reason || "" });
      if (ok === false) {
        setErr(t("cleaningRound.saveFailed"));
        setBusy(false);
      }
    } catch {
      setErr(t("cleaningRound.saveFailed"));
      setBusy(false);
    }
  };
  if (!scanOk) return <div className="ovl-inner"><div className="form-head"><button className="icon-btn" aria-label={t("common.close")} onClick={onCancel}><X size={22} /></button><div className="form-title">{t("cleaningRound.scanRequiredTitle")}</div></div>
    <div className="body">
      <div className="scan-required"><div>{t("cleaningRound.scanRequiredBody")}</div><button className="btn-primary full" onClick={() => setShowScanner(true)}><Camera size={16} /> {t("cleaningRound.scanQr")}</button><button className="btn-ghost full" onClick={() => setShowManual(true)}>{t("cleaningRound.scanTrouble")}</button></div>
      {showManual && <div className="manual-entry"><div>{t("cleaningRound.manualReasonLabel")}</div><textarea rows={3} value={manualReason} onChange={(e) => setManualReason(e.target.value)} /><button className="btn-primary full" onClick={submitManualEntry}>{t("cleaningRound.continueManual")}</button></div>}
      {err && <div className="err">{err}</div>}
      {showScanner && <QRScannerOverlay onScan={acceptScan} onManual={() => { setShowScanner(false); setShowManual(true); }} onCancel={() => setShowScanner(false)} />}
    </div></div>;
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" aria-label={t("common.close")} onClick={onCancel}><X size={22} /></button><div className="form-title">{t("cleaningRound.title")}{win?.time ? " · " + win.time : ""}</div></div>
    <div className="body">
      <div className="round-zone"><div className="rz-name">{zone.name}</div><div className="rz-loc">{zoneLoc(zone) || "—"}{win?.time ? " · " + t("cleaningRound.roundAt", { time: win.time }) : ""}</div>{isCover && <span className="badge sm" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>{t("cleaner.coverBadge")}{zoneCleanerLabel(zone) !== "ללא אחראי" ? " · " + t("cleaner.coverFor", { name: zoneCleanerLabel(zone) }) : " — " + t("cleaningRound.notYourZone")}</span>}</div>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => grabIssuePhoto(e.target.files?.[0])} />
      <div className="field"><span>{t("cleaningRound.checklist")} · {doneCount}/{t("cleaningRound.itemsCount", { count: cl.length })}{Object.keys(issues).length ? ` · ${t("cleaningRound.issuesCount", { count: Object.keys(issues).length })}` : ""}</span>
        <div className="round-cl">{cl.map((c) => { const iss = issues[c.id]; return <div key={c.id} style={{ border: iss ? "1.5px solid #FCA5A5" : "1px solid var(--line)", borderRadius: 10, marginBottom: 6, overflow: "hidden", background: iss ? "#FEF2F2" : "transparent" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px" }}>
            <label className={"round-item" + (done[c.id] ? " on" : "")} style={{ flex: 1, margin: 0, border: "none", padding: 0, background: "transparent" }}><input type="checkbox" checked={!!done[c.id]} onChange={(e) => { const v = e.target.checked; setDone((s) => ({ ...s, [c.id]: v })); if (v) setIssues((s) => { if (!s[c.id]) return s; const n = { ...s }; delete n[c.id]; return n; }); }} /><span className="ri-box">{done[c.id] && <Check size={14} />}</span>{cleaningChecklistLabel(c, language)}</label>
            <button type="button" className="icon-btn sm" title={iss ? t("cleaningRound.clearIssue") : t("cleaningRound.markIssue")} aria-label={iss ? t("cleaningRound.clearIssue") : t("cleaningRound.markIssue")} onClick={() => toggleIssue(c.id)} style={{ color: iss ? "#DC2626" : "var(--muted)", background: iss ? "#FEE2E2" : "var(--surface-2)" }}>{iss ? <X size={16} /> : <AlertTriangle size={16} />}</button>
          </div>
          {iss && <div style={{ padding: "0 10px 10px" }}>
            <div className="pr-row" style={{ marginBottom: 6 }}><button type="button" className={"pr-pick" + (iss.kind !== "broken" ? " on" : "")} onClick={() => setIssueKind(c.id, "dirty")} style={iss.kind !== "broken" ? { background: "var(--primary)", color: "#fff", borderColor: "var(--primary)" } : {}}>{t("cleaningRound.dirtyKind")}</button><button type="button" className={"pr-pick" + (iss.kind === "broken" ? " on" : "")} onClick={() => setIssueKind(c.id, "broken")} style={iss.kind === "broken" ? { background: "#DC2626", color: "#fff", borderColor: "#DC2626" } : {}}>{t("cleaningRound.brokenKind")}</button></div>
            <textarea rows={2} value={iss.reason} onChange={(e) => setIssueReason(c.id, e.target.value)} placeholder={iss.kind === "broken" ? t("cleaningRound.brokenPlaceholder") : t("cleaningRound.dirtyPlaceholder")} />
            <div style={{ marginTop: 6 }}>{iss.photo ? <div className="photo-prev"><img src={iss.photo} alt="" /><button className="photo-x" onClick={() => setIssues((s) => ({ ...s, [c.id]: { ...s[c.id], photo: null } }))}><X size={16} /></button></div> : <button type="button" className="photo-add" onClick={() => { photoTarget.current = c.id; fileRef.current?.click(); }}><Camera size={18} /> {t("cleaningRound.photoOptional")}</button>}</div>
          </div>}
        </div>; })}</div>
        <div className="hint">{t("cleaningRound.hint")}</div>
      </div>
      {err && <div className="err">{err}</div>}
      {(() => { const addressed = cl.filter((c) => done[c.id] || issues[c.id]).length; const ni = Object.keys(issues).length; return <button className="btn-primary full" onClick={submit} disabled={busy}>{addressed === cl.length ? (ni ? t("cleaningRound.finishWithIssues", { count: ni }) : t("cleaningRound.finish")) : t("cleaningRound.finishProgress", { done: addressed, total: cl.length })}</button>; })()}
      <div style={{ height: 20 }} />
    </div></div>);
}

function RoundDetail({ round, zone, onClose }) {
  const win = zone && round.winId ? (zone.windows || []).find((w) => w.id === round.winId) : null;
  const items = zone ? windowItems(zone, win) : [];
  const issues = round.issues || [];
  const missed = !isCompletedCleaningRound(round);
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" aria-label="סגירה" onClick={onClose}><X size={22} /></button><div className="form-title">פרטי סבב</div></div>
    <div className="body">
      <div className="round-zone"><div className="rz-name">{round.zoneName}</div><div className="rz-loc">{round.zoneLoc || "—"}{round.winTime ? " · סבב " + round.winTime : ""}</div>{missed && <span className="badge sm" style={{ background: "#FEE2E2", color: "#DC2626" }}>פוספס</span>}{issues.length > 0 && <span className="badge sm" style={{ background: "#FEE2E2", color: "#DC2626" }}>{countLabel(issues.length, "הערה", "הערות")}</span>}{round.manualEntry && <span className="badge sm" style={{ background: "#FEF3C7", color: "#B45309", border: "1px solid #FCD34D" }}>ידני · {round.manualEntryReason || "ללא סיבה"}</span>}</div>
      <div className="field"><span>סיכום</span>
        <div className="audit-row"><span className="audit-kdot" style={{ background: missed ? "#DC2626" : issues.length ? "#DC2626" : "#16A34A" }} /><div className="audit-main"><div className="audit-text">{missed ? "סבב פוספס" : round.byName}{!missed && round.isCover ? " · כיסוי" + (round.coverFor ? " עבור " + round.coverFor : "") : ""}</div><div className="audit-meta">{dayLabel(dayStart(round.at))} · {fmtTime(round.at)}{missed ? " · לא בוצע" : ` · בוצעו ${round.doneCount}/${countLabel(round.total, "פריט", "פריטים")}`}</div></div></div>
      </div>
      {issues.length > 0 && <div className="field"><span style={{ color: "#DC2626" }}><AlertTriangle size={14} /> הערות / בעיות ({countLabel(issues.length, "הערה", "הערות")})</span>
        <div className="cards">{issues.map((iss, i) => <div key={i} className="cmp-card" style={{ borderInlineStartColor: "#DC2626" }}><CleaningPhoto record={iss} /><div className="cmp-body"><div className="cmp-row1"><span className="badge sm" style={{ background: "#FEE2E2", color: "#DC2626" }}><AlertTriangle size={12} /> {iss.label || "פריט"}</span></div><div className="cmp-text">{iss.reason}</div><div className="cmp-meta">נפתח דיווח אוטומטי</div></div></div>)}</div>
      </div>}
      {items.length > 0 && <div className="field"><span>פירוט צ׳קליסט</span><div className="round-cl">{items.map((c) => { const ok = round.items && round.items[c.id]; const flagged = issues.some((x) => x.itemId === c.id); return <div key={c.id} className="round-item" style={{ cursor: "default", opacity: ok ? 1 : 0.55 }}><span className="ri-box" style={ok ? {} : { borderColor: "var(--muted)" }}>{ok && <Check size={14} />}</span>{c.label}{flagged && <AlertTriangle size={13} color="#DC2626" style={{ marginInlineStart: 6 }} />}{!ok && !flagged && <span style={{ color: "var(--muted)", fontSize: 12, marginInlineStart: 6 }}>· לא סומן</span>}</div>; })}</div></div>}
      <div style={{ height: 20 }} />
  </div></div>);
}

function RoundDoneScreen({ round, zones, rounds, session, config, onClose }) {
  const zone = (zones || []).find((z) => z.id === round.zoneId) || { id: round.zoneId, name: round.zoneName };
  const now = Date.now();
  const withCurrent = [round, ...(rounds || []).filter((r) => r.id !== round.id)];
  const zoneRemaining = zoneTodayStatuses(zone, withCurrent, now, config).filter(({ status }) => status !== "done" && status !== "missed");
  const activeOther = (zones || [])
    .filter((z) => z.active !== false && isZoneCleaner(z, session.id) && z.id !== zone.id)
    .map((z) => ({ z, next: zoneTodayStatuses(z, withCurrent, now, config).find(({ status }) => isCleaningRoundActionableStatus(status)) }))
    .filter((x) => x.next)
    .sort((a, b) => parseHM(a.next.win.time) - parseHM(b.next.win.time));
  return <div className="ovl-inner"><div className="form-head"><button className="icon-btn" aria-label="סגירה" onClick={onClose}><X size={22} /></button><div className="form-title">הסבב הושלם</div></div>
    <div className="body">
      <div className="done-hero"><CheckCircle2 size={38} /><div>הסבב הושלם · {zone.name}</div></div>
      <SectionTitle>חלונות שנותרו היום באזור זה</SectionTitle>
      {zoneRemaining.length ? <div className="task-list">{zoneRemaining.map(({ win, status }) => <div key={win.id} className="task-row" style={{ cursor: "default", borderInlineStartColor: WIN_META[status]?.color || "#64748B" }}><div className="task-row-main"><div className="task-row-t">{win.time}</div><div className="task-row-sub">{WIN_META[status]?.label || status}</div></div></div>)}</div> : <div className="note">✓ כל חלונות היום לאזור זה הושלמו</div>}
      <SectionTitle>אזורים אחרים עם חלון פעיל</SectionTitle>
      {activeOther.length ? <div className="task-list">{activeOther.map(({ z, next }) => <div key={z.id} className="task-row" style={{ cursor: "default", borderInlineStartColor: WIN_META[next.status]?.color || "#64748B" }}><div className="task-row-main"><div className="task-row-t">{z.name}</div><div className="task-row-sub">{next.win.time} · {WIN_META[next.status]?.label || next.status}</div></div></div>)}</div> : <div className="note">אין חלונות פעילים נוספים כרגע.</div>}
      <button className="btn-primary full" style={{ marginTop: 14 }} onClick={onClose}>חזור לאזורים שלי</button>
    </div></div>;
}

function ComplaintForm({ zone, session, onCancel, onSave }) {
  const [kind, setKind] = useState("dirty"), [photo, setPhoto] = useState(null), [text, setText] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const [noPhoto, setNoPhoto] = useState(false), [noPhotoReason, setNoPhotoReason] = useState("");
  const fileRef = useRef(null);
  const grab = (file) => { if (!file) return; const r = new FileReader(); r.onload = (e) => { const img = new Image(); img.onload = () => { const max = 1000; let { width, height } = img; if (width > height && width > max) { height = height * max / width; width = max; } else if (height > max) { width = width * max / height; height = max; } const c = document.createElement("canvas"); c.width = width; c.height = height; c.getContext("2d").drawImage(img, 0, 0, width, height); setPhoto(c.toDataURL("image/jpeg", 0.6)); setErr(""); }; img.src = e.target.result; }; r.readAsDataURL(file); };
  const submit = async () => {
    if (busy) return;
    if (!photo && !noPhoto) return setErr("צרפו תמונה, או סמנו «אין אפשרות לצרף תמונה»");
    if (!photo && noPhoto && !noPhotoReason.trim()) return setErr("נא לפרט מדוע אין אפשרות לצרף תמונה");
    setErr("");
    setBusy(true);
    try {
      const ok = await onSave({ zoneId: zone.id, zoneName: zone.name, zoneLoc: zoneLoc(zone), kind, photo: photo || null, noPhotoReason: (!photo && noPhoto) ? noPhotoReason.trim() : "", text: text.trim(), reportedById: session.id, reportedByName: session.name, reportedByRole: session.role });
      if (ok === false) {
        setErr("השמירה נכשלה — בדקו חיבור ונסו שוב.");
        setBusy(false);
      }
    } catch {
      setErr("השמירה נכשלה — בדקו חיבור ונסו שוב.");
      setBusy(false);
    }
  };
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" aria-label="סגירה" onClick={onCancel}><X size={22} /></button><div className="form-title">דיווח על בעיה באזור</div></div>
    <div className="body">
      <div className="round-zone"><div className="rz-name">{zone.name}</div><div className="rz-loc">{zoneLoc(zone) || "—"}</div></div>
      <div className="field"><span>סוג הבעיה</span><div className="pr-row"><button className={"pr-pick" + (kind === "dirty" ? " on" : "")} onClick={() => setKind("dirty")} style={kind === "dirty" ? { background: "var(--primary)", color: "#fff", borderColor: "var(--primary)" } : {}}><Sparkles size={15} /> לכלוך — נדרש ניקיון</button><button className={"pr-pick" + (kind === "broken" ? " on" : "")} onClick={() => setKind("broken")} style={kind === "broken" ? { background: "#B45309", color: "#fff", borderColor: "#B45309" } : {}}><Wrench size={15} /> תקלה / שבר</button></div>{kind === "broken" && <div className="hint">ייפתח כקריאת אחזקה רגילה ויעבור לטיפול הצוות הטכני.</div>}</div>
      <div className="field"><span>תמונה {noPhoto ? "" : "* (חובה)"}</span><input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => grab(e.target.files?.[0])} />{!noPhoto && (photo ? <div className="photo-prev"><img src={photo} alt="" /><button className="photo-x" onClick={() => setPhoto(null)}><X size={16} /></button></div> : <button className="photo-add" onClick={() => fileRef.current?.click()}><Camera size={20} /> צירוף תמונה</button>)}
        <label className="chk-line" style={{ marginTop: 8 }}><input type="checkbox" checked={noPhoto} onChange={(e) => { setNoPhoto(e.target.checked); if (e.target.checked) setPhoto(null); setErr(""); }} /> אין אפשרות לצרף תמונה</label>
        {noPhoto && <textarea rows={2} value={noPhotoReason} onChange={(e) => setNoPhotoReason(e.target.value)} placeholder="חובה לפרט: מדוע אין אפשרות לצרף תמונה?" style={{ marginTop: 6 }} />}
      </div>
      <label className="field"><span>תיאור (רשות)</span><input value={text} onChange={(e) => setText(e.target.value)} placeholder="לדוגמה: שלולית על הרצפה ליד הכיור" /></label>
      {err && <div className="err">{err}</div>}
      <button className="btn-primary full" onClick={submit} disabled={busy}>{busy ? "שולח…" : "שליחת דיווח"}</button>
      <div style={{ height: 20 }} />
    </div></div>);
}

function ZoneSpec({ zone, onClose }) {
  const ws = (zone.windows || []).slice().sort((a, b) => parseHM(a.time) - parseHM(b.time));
  const cl = zone.checklist || [];
  const days = zoneActiveDays(zone);
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" aria-label="סגירה" onClick={onClose}><X size={22} /></button><div className="form-title">מפרט האזור</div></div>
    <div className="body">
      <div className="round-zone"><div className="rz-name">{zone.name}</div><div className="rz-loc">{zoneLoc(zone) || "—"} · אחראי: {zoneCleanerLabel(zone)}</div></div>
      <div className="field"><span><CalendarClock size={14} /> ימי פעילות · {activeDaysLabel(zone)}</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>{WEEKDAYS.map((w) => { const on = days.includes(w.d); return <span key={w.d} className="badge sm" style={on ? { background: "var(--primary)", color: "#fff", minWidth: 34, justifyContent: "center" } : { background: "var(--surface-2)", color: "var(--muted)", minWidth: 34, justifyContent: "center" }}>{w.short}</span>; })}</div>
      </div>
      <div className="field"><span><Clock size={14} /> סבבים וצ׳קליסט לכל סבב ({ws.length})</span>
        {ws.length === 0
          ? (cl.length === 0 ? <div className="hint">לא הוגדרו חלונות וצ׳קליסט.</div> : <div className="round-cl">{cl.map((c) => <div key={c.id} className="round-item" style={{ cursor: "default" }}><span className="ri-box"><Check size={14} /></span>{c.label}</div>)}</div>)
          : ws.map((w) => { const items = windowItems(zone, w); const partial = Array.isArray(w.items); return <div key={w.id} style={{ background: "var(--surface-2)", borderRadius: 10, padding: "8px 10px", marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 700 }}><span>סבב {w.time}</span><span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 12 }}>± {(+w.tol || 0)} ד׳ · {partial ? countLabel(items.length, "פריט", "פריטים") + " מתוך " + countLabel(cl.length, "פריט", "פריטים") : "כל הפריטים"}</span></div>
              {items.length === 0 ? <div className="hint">אין פריטים בסבב זה.</div> : <div className="round-cl" style={{ marginTop: 4 }}>{items.map((c) => <div key={c.id} className="round-item" style={{ cursor: "default" }}><span className="ri-box"><Check size={14} /></span>{c.label}</div>)}</div>}
            </div>; })}
      </div>
      <div style={{ height: 20 }} />
    </div></div>);
}

function ReportFlow({ zones, session, onSubmit, onClose, scannedZoneId = "", allowManualZonePick = false }) {
  const active = useMemo(() => (zones || []).filter((z) => z.active !== false).sort(zoneSort), [zones]);
  const scannedZone = useMemo(() => findScannedCleaningZone(active, scannedZoneId), [active, scannedZoneId]);
  const [stage, setStage] = useState(scannedZone ? "form" : "scan"), [zone, setZone] = useState(scannedZone);
  useEffect(() => {
    if (scannedZone && (!zone || zone.id !== scannedZone.id)) {
      setZone(scannedZone);
      setStage("form");
    }
  }, [scannedZone?.id]);
  if (stage === "form" && zone) return <ComplaintForm zone={zone} session={session} onCancel={onClose} onSave={onSubmit} />;
  return (<div className="pub-wrap"><div className="pub-card">
    <button className="icon-btn pub-x" aria-label="סגירה" onClick={onClose}><X size={20} /></button>
    {stage === "scan" ? <>
      <div className="pub-logo"><Camera size={24} /></div>
      <div className="pub-title">סריקת QR של האזור</div>
      <div className="pub-sub">סרקו את ה-QR שמודבק באזור כדי לפתוח דיווח. בחירה ידנית חסומה במצב ייצור כדי למנוע דיווח מרחוק.</div>
      {allowManualZonePick ? <button className="btn-primary full" style={{ marginTop: 14 }} onClick={() => setStage("pick")}><Camera size={16} /> בחירת אזור לבדיקה</button> : <div className="note">{scannedZoneId ? "קוד ה-QR שנסרק לא שייך לאזור שבאחריותך או שאינו פעיל." : "פתחו את המסך דרך סריקת QR באזור עצמו."}</div>}
      {allowManualZonePick && <div className="pub-foot">במצב הדגמה/בדיקה ניתן לבחור ידנית כדי לבדוק את התהליך.</div>}
    </> : <>
      <div className="pub-logo"><Sparkles size={24} /></div>
      <div className="pub-title">בחירת אזור</div>
      <div className="pub-sub">תוצאת הסריקה — בחרו את האזור שדווח.</div>
      {active.length === 0 ? <div className="note">אין אזורים פעילים במחלקתך.</div> : <div className="pub-zones">{active.map((z) => <button key={z.id} className="pub-zone" onClick={() => { setZone(z); setStage("form"); }}><div className="pub-zone-n">{z.name}</div><div className="pub-zone-l">{zoneLoc(z) || "—"}</div></button>)}</div>}
      <button className="btn-ghost full sm" style={{ marginTop: 8 }} onClick={() => setStage("scan")}>חזרה לסריקה</button>
    </>}
  </div></div>);
}

function QRScannerOverlay({ onScan, onCancel, onManual }) {
  const videoRef = useRef(null), canvasRef = useRef(null), rafRef = useRef(0), streamRef = useRef(null);
  const [err, setErr] = useState(""), [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    let alive = true;
    let scanQr = null;
    const scannerReady = loadJsQr()
      .then((scanner) => { scanQr = scanner; })
      .catch(() => { if (alive) setErr("לא ניתן לטעון את סורק ה-QR."); throw new Error("qr_scanner_load_failed"); });
    const stop = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      streamRef.current?.getTracks?.().forEach((track) => track.stop());
      streamRef.current = null;
    };
    const tick = () => {
      if (!alive) return;
      const video = videoRef.current, canvas = canvasRef.current;
      if (video && canvas && video.readyState >= 2 && video.videoWidth && video.videoHeight) {
        const w = video.videoWidth, h = video.videoHeight;
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(video, 0, 0, w, h);
        const imageData = ctx.getImageData(0, 0, w, h);
        const result = scanQr?.(imageData.data, w, h);
        const scanned = extractCzoneFromRaw(result?.data || "");
        if (scanned) {
          stop();
          onScan(`czone:${scanned}`);
          return;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    navigator.mediaDevices?.getUserMedia?.({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then((stream) => {
        if (!alive) { stream.getTracks().forEach((track) => track.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play?.().catch(() => {});
        }
        return scannerReady;
      })
      .then(() => {
        if (!alive) return;
        rafRef.current = requestAnimationFrame(tick);
      })
      .catch((error) => {
        if (error?.message === "qr_scanner_load_failed") return;
        const name = error?.name || "";
        setErr(name === "NotAllowedError" || name === "SecurityError" ? "לא ניתנה גישה למצלמה" : "מצלמה לא זמינה");
      });
    const timeout = setTimeout(() => alive && setTimedOut(true), 15000);
    return () => { alive = false; clearTimeout(timeout); stop(); };
  }, [onScan]);
  return <div className="qr-overlay">
    <div className="qr-viewfinder">
      <video ref={videoRef} playsInline muted />
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <div className="qr-frame"><span /></div>
    </div>
    <div className="qr-copy">
      <b>סריקת QR של האזור</b>
      <span>{err || (timedOut ? "לא מצליח לסרוק?" : "כוונו את המצלמה לקוד ה-QR")}</span>
    </div>
    <div className="qr-btns">
      <button className="btn-primary" onClick={onManual}>לא מצליח לסרוק</button>
      <button className="btn-ghost" onClick={onCancel}>ביטול</button>
    </div>
  </div>;
}

function CleaningQrRequired({ zone, scannedZoneId, onClose, language = DEFAULT_LANGUAGE, onScanSuccess = null }) {
  const wrong = !!scannedZoneId;
  const t = (key, vars) => uiText(language, key, vars);
  const [scanErr, setScanErr] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [showManual, setShowManual] = useState(false), [showScanner, setShowScanner] = useState(false);
  const finishScan = (raw) => {
    const text = String(raw || "").trim();
    if (cleaningQrMatchesZone(text, zone)) {
      setScanErr("");
      onScanSuccess?.();
      return true;
    }
    setScanErr(text ? t("cleaningQr.scanWrong") : t("cleaningQr.scanMissing"));
    return false;
  };
  const submitManual = () => finishScan(manualCode);
  return (<div className="pub-wrap"><div className="pub-card">
    <button className="icon-btn pub-x" aria-label={t("common.close")} onClick={onClose}><X size={20} /></button>
    <div className="pub-logo"><Camera size={24} /></div>
    <div className="pub-title">{t("cleaningQr.title")}</div>
    <div className="pub-sub">{zone?.name ? t("cleaningQr.forZone", { zone: zone.name }) : t("cleaningQr.generic")}</div>
    <div className="note">{wrong ? t("cleaningQr.wrong") : t("cleaningQr.remoteBlocked")}</div>
    {onScanSuccess && <>
      <button className="btn-primary full" style={{ marginTop: 10 }} onClick={() => setShowScanner(true)}><Camera size={16} /> {t("cleaningQr.scanButton")}</button>
      <button className="btn-ghost full sm" style={{ marginTop: 8 }} onClick={() => setShowManual((v) => !v)}>{t("cleaningQr.manualToggle")}</button>
      {showManual && <div className="field" style={{ marginTop: 8 }}><span>{t("cleaningQr.manualLabel")}</span><input value={manualCode} onChange={(e) => setManualCode(e.target.value)} placeholder={t("cleaningQr.manualPlaceholder")} /><button className="btn-ghost full sm" style={{ marginTop: 8 }} onClick={submitManual}>{t("cleaningQr.manualSubmit")}</button></div>}
      {scanErr && <div className="err" style={{ marginTop: 10 }}>{scanErr}</div>}
      {showScanner && <QRScannerOverlay onScan={(raw) => { setShowScanner(false); finishScan(raw); }} onManual={() => { setShowScanner(false); setShowManual(true); }} onCancel={() => setShowScanner(false)} />}
    </>}
    <button className="btn-ghost full sm" style={{ marginTop: 10 }} onClick={onClose}>{t("common.close")}</button>
  </div></div>);
}

function CleanerApp(p) {
  const { session, zones, rounds, complaints, saveRound, resolveComplaint, escalateComplaint, fileComplaint, tickets, pm, fleet, config, presence, onLogout, theme, toggleTheme, language, setLanguage, t = (key) => uiText(language, key), absences, saveAbsence, delAbsence } = p;
  const [run, setRun] = useState(null), [qrBlockedZone, setQrBlockedZone] = useState(null), [sent, setSent] = useState(false), [doneRound, setDoneRound] = useState(null), [showNotif, setShowNotif] = useState(false), [showDone, setShowDone] = useState(false), [rDetail, setRDetail] = useState(null), [cDetail, setCDetail] = useState(null), [showCover, setShowCover] = useState(false), [showAbs, setShowAbs] = useState(false), [absFrom, setAbsFrom] = useState(""), [absTo, setAbsTo] = useState("");
  const [qrArrivalZone, setQrArrivalZone] = useState(null);
  const scannedZoneId = scannedCleaningZoneIdFromWindow();
  const notif = useNotifications(session, tickets, pm, fleet, config, presence, zones, rounds, complaints, [], absences);
  const now = Date.now();
  const active = useMemo(() => (zones || []).filter((z) => z.active !== false).sort(zoneSort), [zones]);
  const mine = useMemo(() => active.filter((z) => isZoneCleaner(z, session.id)), [active, session.id]);
  const others = useMemo(() => active.filter((z) => !isZoneCleaner(z, session.id)), [active, session.id]);
  const missedInFlight = useRef(new Set());
  const todo = useMemo(() => { const out = []; mine.forEach((z) => zoneTodayStatuses(z, rounds, now, config).forEach(({ win, status }) => { if (status === "due" || status === "overdue") out.push({ z, win, status }); })); return out.sort((a, b) => parseHM(a.win.time) - parseHM(b.win.time)); }, [mine, rounds, config]);
  const missedToday = useMemo(() => { const out = []; mine.forEach((z) => zoneTodayStatuses(z, rounds, now, config).forEach((s) => { if (s.status === "missed") out.push({ z, ...s }); })); return out.sort((a, b) => parseHM(a.win.time) - parseHM(b.win.time)); }, [mine, rounds, config]);
  const doneToday = useMemo(() => (rounds || []).filter((r) => isCompletedCleaningRound(r) && r.byUid === session.id && dayStart(r.at) === dayStart(now)).sort((a, b) => b.at - a.at), [rounds]);
  const autoQrOpened = useRef(false);
  const actionableRoundForZone = (z) => zoneTodayStatuses(z, rounds, Date.now(), config).find(({ status }) => isCleaningRoundActionableStatus(status));
  useEffect(() => {
    materializeMissedCleaningRounds({ zones: mine, rounds, now: Date.now(), config, saveRound, inFlightRef: missedInFlight });
  }, [mine, rounds, config, saveRound]);
  useEffect(() => {
    if (autoQrOpened.current || !scannedZoneId) return;
    const z = mine.find((zone) => zone.id === scannedZoneId);
    if (!z || !cleaningQrAccess({ appMode: APP_MODE, scannedZoneId, zoneId: z.id }).allowed) return;
    const target = actionableRoundForZone(z);
    autoQrOpened.current = true;
    if (!target) {
      setQrArrivalZone(z);
      return;
    }
    setRun({ zone: z, win: target.win, scanToken: true });
  }, [mine, scannedZoneId, rounds, config]);
  const myComplaints = useMemo(() => { const ids = new Set(mine.map((z) => z.id)); return (complaints || []).filter((c) => c.status === "open" && c.ownerRole !== "admin" && ids.has(c.zoneId)).sort((a, b) => b.at - a.at); }, [complaints, mine]);
  const myReports = useMemo(() => (complaints || []).filter((c) => c.reportedById === session.id).sort((a, b) => b.at - a.at).slice(0, 30), [complaints, session.id]);
  const doSave = async (r) => {
    const roundRecord = { ...r, issues: (r.issues || []).map((issue) => issue.photo ? { ...issue, photo: null, hasPhoto: true } : issue) };
    if (await saveRound(roundRecord) === false) return false;
    const iss = r.issues || [];
    const mk = (kind, list) => ({ zoneId: r.zoneId, zoneName: r.zoneName, zoneLoc: r.zoneLoc, kind, photo: (list.find((x) => x.photo) || {}).photo || null, text: list.length === 1 ? (list[0].label ? list[0].label + ": " : "") + list[0].reason : `${countLabel(list.length, kind === "broken" ? "תקלה" : "הערה", kind === "broken" ? "תקלות" : "הערות")} בסבב${r.winTime ? " " + r.winTime : ""}`, issues: list, fromRoundId: r.id, reportedById: session.id, reportedByName: session.name, reportedByRole: session.role });
    const broken = iss.filter((x) => x.kind === "broken");
    const dirty = iss.filter((x) => x.kind !== "broken");
    const complaintResults = [];
    if (broken.length) complaintResults.push(await fileComplaint(mk("broken", broken)));
    if (dirty.length) complaintResults.push(await fileComplaint(mk("round", dirty)));
    if (complaintResults.some((ok) => ok === false)) return false;
    setRun(null);
    setDoneRound(r);
    setSent(true);
    setTimeout(() => setSent(false), 2600);
    return true;
  };
  const areaSections = (items, renderItem, getZone = (x) => x) => groupCleaningByArea(items, getZone).map((areaGroup) => <section key={areaGroup.area} className="clean-area-group compact">
    <div className="clean-area-head"><div><div className="clean-area-title"><Building2 size={14} /> {areaGroup.area}</div><div className="clean-area-meta">{countLabel(areaGroup.items.length, "אזור", "אזורים")}</div></div></div>
    {groupCleaningByFloor(areaGroup.items, getZone).map((floorGroup) => <div key={floorGroup.floor || "_none"} className="clean-floor-group">
      {floorGroup.floor && <div className="clean-floor-title">{floorGroup.floor}</div>}
      <div className="cards">{floorGroup.items.map(renderItem)}</div>
    </div>)}
  </section>);
  const card = (z, cover) => {
    const sts = zoneTodayStatuses(z, rounds, now, config); const lr = lastRoundOf(z.id, rounds);
    const oc = (complaints || []).filter((c) => c.zoneId === z.id && c.status === "open" && c.ownerRole !== "admin").length;
    const notDay = sts.length === 0;
    const dueNow = sts.find((s) => isCleaningRoundActionableStatus(s.status));
    const nextP = sts.find((s) => s.status === "pending");
    const missed = sts.filter((s) => s.status === "missed");
    const allDone = sts.length > 0 && sts.every((s) => s.status === "done");
    const roundOrdinal = (win) => {
      const idx = sts.findIndex((s) => s.win === win || s.win?.id === win?.id);
      return idx >= 0 ? t("cleaner.roundOrdinal", { index: idx + 1, total: sts.length, time: win.time }) : t("cleaner.window", { time: win.time });
    };
    let st, target;
    if (notDay) st = { txt: t("cleaner.notCleaningDay"), color: "var(--muted)", bg: "var(--surface-2)" };
    else if (dueNow) { st = { txt: roundOrdinal(dueNow.win), color: WIN_META[dueNow.status].color, bg: WIN_META[dueNow.status].bg, go: 1 }; target = dueNow.win; }
    else if (allDone) st = { txt: t("cleaner.doneForToday"), color: "#16A34A", bg: "#DCFCE7" };
    else if (nextP) st = { txt: t("cleaner.nextRound", { time: nextP.win.time }), color: "#1F4E8C", bg: "var(--primary-soft)" };
    else if (missed.length) st = { txt: t("cleaner.missedRound", { time: missed[0].win.time }), color: "#DC2626", bg: "#FEE2E2" };
    else st = { txt: "—", color: "var(--muted)", bg: "var(--surface-2)" };
    const border = cover ? "#1F4E8C" : (st.go ? st.color : (allDone ? "#16A34A" : "var(--primary)"));
    const subMissed = !notDay && !dueNow && nextP && missed.length ? " · " + t("cleaner.missedShort", { times: missed.map((m) => m.win.time).join(",") }) : "";
    const openRound = () => {
      if (!target) return;
      const qr = cleaningQrAccess({ appMode: APP_MODE, scannedZoneId, zoneId: z.id });
      if (!qr.allowed) return setQrBlockedZone(z);
      setRun({ zone: z, win: target, scanToken: qr.reason === "scan_matched" });
    };
    return <button key={z.id} className="tcard clk" disabled={!target} onClick={openRound} style={{ borderInlineStartColor: border, ...(target ? {} : { opacity: 0.95 }) }}><span className="avatar"><Sparkles size={18} /></span><div className="tcard-main"><div className="tcard-row1"><span className="tcard-subj">{z.name}</span>{cover && <span className="badge sm" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>{t("cleaner.coverBadge")}{zoneCleanerLabel(z) !== "ללא אחראי" ? " · " + t("cleaner.coverFor", { name: zoneCleanerLabel(z) }) : ""}</span>}{oc > 0 && <span className="badge sm" style={{ background: "#FEE2E2", color: "#DC2626" }}>{t("cleaner.reportsBadge", { count: oc })}</span>}</div><div style={{ textAlign: "center", margin: "5px 0 3px" }}><span className="badge" style={{ background: st.bg, color: st.color, fontWeight: 700 }}>{st.txt}</span></div><div className="tcard-sub">{zoneLoc(z) || "—"} · {lr ? t("cleaner.cleanedAgo", { time: timeAgo(lr) }) : t("cleaner.neverCleaned")}{subMissed}</div></div>{target && <ChevronLeft size={18} className="ni-go" />}</button>;
  };
  return (<div className={"worker-shell" + (p.embedded ? " embedded-cleaning-shell" : "")}>
    {!p.embedded && <div className="worker-top">
      <div><div className="wk-title">{t("cleaner.title")}</div><div className="wk-sub">{session.name}</div></div>
      <div className="worker-top-actions"><LanguagePicker value={language} onChange={setLanguage} compact /><button className="icon-btn" onClick={toggleTheme} title={theme === "dark" ? t("common.lightMode") : t("common.darkMode")} aria-label={theme === "dark" ? t("common.lightMode") : t("common.darkMode")}>{theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}</button><button className="icon-btn bell" onClick={() => setShowNotif((v) => !v)} title={t("common.notifications")} aria-label={t("common.notifications")}><Bell size={20} />{notif?.unread > 0 && <span className="dot">{notif.unread > 9 ? "9+" : notif.unread}</span>}</button>{p.onReportIssue && <button className="icon-btn" onClick={p.onReportIssue} title={t("common.reportSystemIssue")} aria-label={t("common.reportSystemIssue")}><Bug size={20} /></button>}{p.onProfile && <button className="icon-btn" onClick={p.onProfile} title={t("common.profile")} aria-label={t("common.profile")}><User size={20} /></button>}<button className="worker-action-btn" onClick={onLogout} title={t("common.logout")} aria-label={t("common.logout")}><LogOut size={18} /><span>{t("common.logout")}</span></button></div>
    </div>}
    {!p.embedded && p.rolePreview && <div className="worker-preview"><RolePreviewBox rolePreview={p.rolePreview} language={language} /></div>}
    <main className="content">
      {qrArrivalZone && <div className="toast-ok"><MapPin size={16} /> {t("cleaner.qrArrived", { zone: qrArrivalZone.name })}</div>}
      {sent && <div className="toast-ok"><CheckCircle2 size={16} /> {t("cleaner.roundSaved")}</div>}
      {todo.length > 0 && <div className="todo-card"><div className="todo-h"><Clock size={15} /> {t("cleaner.todoNow", { count: todo.length })}</div>{areaSections(todo, ({ z, win, status }, i) => { const sts = zoneTodayStatuses(z, rounds, now, config); const idx = sts.findIndex((s) => s.win === win || s.win?.id === win?.id); return <button key={`${z.id}-${win.id || i}`} className="todo-row" onClick={() => { const qr = cleaningQrAccess({ appMode: APP_MODE, scannedZoneId, zoneId: z.id }); if (!qr.allowed) return setQrBlockedZone(z); setRun({ zone: z, win, scanToken: qr.reason === "scan_matched" }); }}><span className="todo-dot" style={{ background: WIN_META[status].color }} /><div className="todo-main"><div className="todo-zone">{z.name}</div><div className="todo-sub">{zoneLoc(z) ? zoneLoc(z) + " · " : ""}{idx >= 0 ? t("cleaner.roundOrdinal", { index: idx + 1, total: sts.length, time: win.time }) : t("cleaner.window", { time: win.time })} · {t(`cleaner.status.${status}`)}</div></div><ChevronLeft size={16} /></button>; }, (x) => x.z)}</div>}
      {missedToday.length > 0 && <div className="clean-missed-note"><AlertTriangle size={15} /> {t("cleaner.missedNotice", { count: missedToday.length, windows: missedToday.map((m) => `${m.z.name} ${m.win.time}`).join(" · ") })}</div>}
      {myComplaints.length > 0 && <><SectionTitle><AlertTriangle size={15} /> {t("cleaner.openReports", { count: myComplaints.length })}</SectionTitle><div className="cards">{myComplaints.map((c) => <ComplaintCard key={c.id} c={c} onOpen={setCDetail} />)}</div></>}
      {active.length === 0 ? <Empty text={t("cleaner.noZones")} Icon={Sparkles} sub={t("cleaner.managerDefinesZones")} /> : <>
        <SectionTitle><Sparkles size={15} /> {t("cleaner.myZones", { count: mine.length })}</SectionTitle>
        {mine.length === 0 ? <Empty text={t("cleaner.noAssignedZones")} Icon={Sparkles} /> : areaSections(mine, (z) => card(z))}
        {others.length > 0 && <div style={{ marginTop: 6 }}><button className="day-toggle" onClick={() => setShowCover((v) => !v)}>{showCover ? "▾" : "▸"} {t("cleaner.peerCover", { count: others.length })}</button>{showCover ? areaSections(others, (z) => card(z, true)) : <div className="hint" style={{ marginInlineStart: 4 }}>{t("cleaner.peerCoverHint")}</div>}</div>}
        {doneToday.length > 0 && <div style={{ marginTop: 6 }}><button className="day-toggle" onClick={() => setShowDone((v) => !v)}>{showDone ? "▾" : "▸"} {t("cleaner.doneToday", { count: doneToday.length })}</button>{showDone && <div className="cards">{doneToday.map((r) => { const prob = (r.issues || []).length > 0; return <button key={r.id} className="audit-row clk" onClick={() => setRDetail(r)} style={prob ? { borderInlineStartColor: "#DC2626", borderInlineStartWidth: 3, borderInlineStartStyle: "solid" } : {}}><span className="audit-time">{fmtTime(r.at)}</span><span className="audit-kdot" style={{ background: prob ? "#DC2626" : "#16A34A" }} /><div className="audit-main"><div className="audit-text">{r.zoneName}{r.winTime ? " · " + r.winTime : ""}{r.manualEntry ? " · ידני" : ""}</div><div className="audit-meta">{t("cleaner.itemsProgress", { done: r.doneCount, total: r.total })}{r.isCover ? " · " + t("cleaner.coverBadge") + (r.coverFor ? " " + t("cleaner.coverFor", { name: r.coverFor }) : "") : ""}{prob ? ` · ${t("cleaner.issuesCount", { count: r.issues.length })}` : ""}{r.manualEntryReason ? " · " + r.manualEntryReason : ""}</div></div><ChevronLeft size={16} /></button>; })}</div>}</div>}
      </>}
      {myReports.length > 0 && <div style={{ marginTop: 6 }}><SectionTitle><AlertTriangle size={15} /> {t("cleaner.myReports", { count: myReports.length })}</SectionTitle><div className="cards">{myReports.map((c) => <ComplaintCard key={c.id} c={c} onOpen={setCDetail} />)}</div></div>}
      {(() => { const myAbs = (absences || []).filter((a) => a.userId === session.id && (a.to || a.from) >= todayKey()).sort((a, b) => (a.from > b.from ? 1 : -1)); return <div style={{ marginTop: 6 }}>
        <button className="day-toggle" onClick={() => setShowAbs((v) => !v)}>{showAbs ? "▾" : "▸"} {t("cleaner.plannedAbsence", { count: myAbs.length ? ` (${myAbs.length})` : "" })}</button>
        {showAbs && <div className="panel" style={{ marginTop: 6 }}>
          <div className="hint" style={{ marginBottom: 8 }}>{t("cleaner.absenceHint")}</div>
          {myAbs.map((a) => <div key={a.id} className="reg-row" style={{ marginBottom: 6 }}><span style={{ flex: 1 }}>{fmtDate(new Date(a.from).getTime())}{(a.to && a.to !== a.from) ? " – " + fmtDate(new Date(a.to).getTime()) : ""}</span><button className="reg-del" onClick={() => delAbsence(a.id)}><Trash2 size={15} /></button></div>)}
          <div className="field-row absence-date-row" style={{ marginTop: 6 }}><label className="field"><span>{t("cleaner.fromDate")}</span><DateInput value={absFrom} onChange={setAbsFrom} /></label><label className="field"><span>{t("cleaner.toDate")}</span><DateInput value={absTo} onChange={setAbsTo} /></label></div>
          <button className="btn-ghost sm" disabled={!absFrom || (absTo && absTo < absFrom)} onClick={() => { saveAbsence({ id: uid(), userId: session.id, name: session.name, from: absFrom, to: absTo || absFrom, at: Date.now() }); setAbsFrom(""); setAbsTo(""); }}><Plus size={14} /> {t("cleaner.addAbsence")}</button>
        </div>}
      </div>; })()}
    </main>
    {run && <Overlay onClose={() => setRun(null)}><RoundForm zone={run.zone} win={run.win} session={session} scanToken={run.scanToken} config={config} language={language} onCancel={() => setRun(null)} onSave={doSave} /></Overlay>}
    {qrBlockedZone && <Overlay onClose={() => setQrBlockedZone(null)}><CleaningQrRequired zone={qrBlockedZone} scannedZoneId={scannedZoneId} language={language} onClose={() => setQrBlockedZone(null)} onScanSuccess={() => { const target = actionableRoundForZone(qrBlockedZone); setQrBlockedZone(null); if (target) setRun({ zone: qrBlockedZone, win: target.win, scanToken: true }); }} /></Overlay>}
    {doneRound && <Overlay onClose={() => setDoneRound(null)}><RoundDoneScreen round={doneRound} zones={zones} rounds={rounds} session={session} config={config} onClose={() => setDoneRound(null)} /></Overlay>}
    {rDetail && <Overlay onClose={() => setRDetail(null)}><RoundDetail round={rDetail} zone={(zones || []).find((z) => z.id === rDetail.zoneId)} onClose={() => setRDetail(null)} /></Overlay>}
    {cDetail && <Overlay onClose={() => setCDetail(null)}><ComplaintDetail c={cDetail} round={cDetail.fromRoundId ? (rounds || []).find((r) => r.id === cDetail.fromRoundId) : null} zone={(zones || []).find((z) => z.id === cDetail.zoneId)} caps={{ resolve: cDetail.ownerRole !== "admin" && mine.some((z) => z.id === cDetail.zoneId), escalate: cDetail.ownerRole !== "admin" && mine.some((z) => z.id === cDetail.zoneId) }} onResolve={(c) => { resolveComplaint(c); setCDetail(null); }} onEscalate={(c) => { escalateComplaint(c); setCDetail(null); }} onClose={() => setCDetail(null)} /></Overlay>}
    {showNotif && <NotifPanel notif={notif} language={language} onClose={() => setShowNotif(false)} onOpen={() => setShowNotif(false)} onGo={() => setShowNotif(false)} />}
  </div>);
}

function ManagerCleaning({ session, zones, rounds, complaints, fileComplaint, resolveComplaint, config, language = DEFAULT_LANGUAGE }) {
  const [rep, setRep] = useState(null), [report, setReport] = useState(false), [showClosed, setShowClosed] = useState(false), [spec, setSpec] = useState(null), [cDetail, setCDetail] = useState(null);
  const scannedZoneId = scannedCleaningZoneIdFromWindow();
  const autoQrOpened = useRef(false);
  const mz = session.mgrZones || [];
  const myZones = useMemo(() => (zones || []).filter((z) => mz.includes(z.id)).sort(zoneSort), [zones, mz]);
  useEffect(() => {
    if (autoQrOpened.current || !scannedZoneId) return;
    const z = myZones.find((zone) => zone.id === scannedZoneId);
    if (!z) return;
    autoQrOpened.current = true;
    setRep(z);
  }, [myZones, scannedZoneId]);
  const open = useMemo(() => (complaints || []).filter((c) => mz.includes(c.zoneId) && c.status === "open").sort((a, b) => b.at - a.at), [complaints, mz]);
  const closed = useMemo(() => (complaints || []).filter((c) => mz.includes(c.zoneId) && (c.status === "resolved" || c.status === "rejected")).sort((a, b) => (b.resolvedAt || b.at) - (a.resolvedAt || a.at)), [complaints, mz]);
  const now = Date.now();
  const renderAreaSections = (items, renderItem, getZone = (x) => x) => groupCleaningByArea(items, getZone).map((areaGroup) => <section key={areaGroup.area} className="clean-area-group">
    <div className="clean-area-head"><div><div className="clean-area-title"><Building2 size={15} /> {areaGroup.area}</div><div className="clean-area-meta">{countLabel(areaGroup.items.length, "אזור ניקיון", "אזורי ניקיון")}</div></div></div>
    {groupCleaningByFloor(areaGroup.items, getZone).map((floorGroup) => <div key={floorGroup.floor || "_none"} className="clean-floor-group">
      {floorGroup.floor && <div className="clean-floor-title">{floorGroup.floor}</div>}
      <div className="cards">{floorGroup.items.map(renderItem)}</div>
    </div>)}
  </section>);
  if (!mz.length) return <Empty text="לא שויכו אזורי ניקיון למחלקתך" Icon={Sparkles} sub="מנהל המערכת משייך אזורים בפרופיל שלך" />;
  return (<>
    <div className="note" style={{ marginBottom: 12 }}>מצב הניקיון באזורים של מחלקתך. ניתן לדווח על בעיה — הדיווח מגיע אליך, לעובד הניקיון של האזור ולמנהל המערכת.</div>
    <button className="btn-primary full" style={{ marginBottom: 14 }} onClick={() => setReport(true)}><AlertTriangle size={15} /> דיווח על בעיה (סריקת QR)</button>
    <SectionTitle><Sparkles size={15} /> אזורי מחלקתי ({myZones.length})</SectionTitle>
    {myZones.length === 0 ? <Empty text="אין אזורים פעילים" Icon={Sparkles} /> : renderAreaSections(myZones, (z) => { const sts = zoneTodayStatuses(z, rounds, now, config); const lr = lastRoundOf(z.id, rounds); const zo = open.filter((c) => c.zoneId === z.id).length; return <div key={z.id} className="tcard" style={{ borderInlineStartColor: sts.some((s) => s.status === "missed") ? "#DC2626" : "var(--primary)" }}><span className="avatar"><Sparkles size={18} /></span><div className="tcard-main"><div className="tcard-row1"><span className="tcard-subj">{z.name}</span>{zo > 0 && <span className="badge sm" style={{ background: "#FEE2E2", color: "#DC2626" }}>{zo} דיווחים</span>}</div><div className="tcard-sub">{zoneLoc(z) || "—"} · {activeDaysLabel(z)} · {lr ? "נוקה " + timeAgo(lr) : "טרם נוקה"}</div>{sts.length > 0 ? <div className="win-chips">{sts.map((s, i) => <span key={i} className="win-chip" style={{ background: WIN_META[s.status].bg, color: WIN_META[s.status].color }}>{s.win.time}</span>)}</div> : <div className="win-chips"><span className="win-chip" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>לא יום ניקיון</span></div>}</div><div className="tcard-actions"><button className="icon-btn sm" title="מפרט האזור — ימים, שעות וצ׳קליסט" aria-label={`מפרט אזור ${z.name}`} onClick={() => setSpec(z)}><ClipboardList size={17} /></button><button className="icon-btn sm" title="דיווח על בעיה" aria-label={`דיווח על בעיה באזור ${z.name}`} onClick={() => setRep(z)}><AlertTriangle size={17} /></button></div></div>; })}
    {open.length > 0 && <><SectionTitle><AlertTriangle size={15} /> דיווחים פתוחים ({countLabel(open.length, "דיווח", "דיווחים")})</SectionTitle><div className="note" style={{ marginBottom: 8 }}>הקישו לצפייה בפרטים המלאים. דיווחי לכלוך נסגרים ע״י עובד הניקיון; דיווחים מעובד הניקיון בטיפול ההנהלה.</div><div className="cards">{open.map((c) => <ComplaintCard key={c.id} c={c} onOpen={setCDetail} />)}</div></>}
    {closed.length > 0 && <><button className="day-toggle" onClick={() => setShowClosed((v) => !v)}>{showClosed ? "▾" : "▸"} טופלו / נדחו ({closed.length})</button>{showClosed && <div className="cards">{closed.map((c) => <ComplaintCard key={c.id} c={c} onOpen={setCDetail} />)}</div>}</>}
    {rep && <Overlay onClose={() => setRep(null)}>{cleaningQrAccess({ appMode: APP_MODE, scannedZoneId, zoneId: rep.id }).allowed ? <ComplaintForm zone={rep} session={session} onCancel={() => setRep(null)} onSave={async (c) => { const ok = await fileComplaint(c); if (ok !== false) setRep(null); return ok; }} /> : <CleaningQrRequired zone={rep} scannedZoneId={scannedZoneId} language={language} onClose={() => setRep(null)} />}</Overlay>}
    {report && <Overlay onClose={() => setReport(false)}><ReportFlow zones={myZones} session={session} scannedZoneId={scannedZoneId} allowManualZonePick={SEED_POLICY.allowDemoData} onSubmit={async (c) => { const ok = await fileComplaint(c); if (ok !== false) setReport(false); return ok; }} onClose={() => setReport(false)} /></Overlay>}
    {spec && <Overlay onClose={() => setSpec(null)}><ZoneSpec zone={spec} onClose={() => setSpec(null)} /></Overlay>}
    {cDetail && <Overlay onClose={() => setCDetail(null)}><ComplaintDetail c={cDetail} round={cDetail.fromRoundId ? (rounds || []).find((r) => r.id === cDetail.fromRoundId) : null} zone={(zones || []).find((z) => z.id === cDetail.zoneId)} caps={{ resolve: cDetail.ownerRole !== "admin" && cDetail.status === "open" }} onResolve={(c) => { resolveComplaint(c); setCDetail(null); }} onClose={() => setCDetail(null)} /></Overlay>}
  </>);
}

function AssetsHub(p) {
  const { assetNav } = p;
  const [t, setT] = useState("fleet");
  useEffect(() => { if (assetNav?.tab) setT(assetNav.tab); }, [assetNav?._t]);
  return (<>
    <div className="seg-tabs s2" style={{ maxWidth: 360, marginBottom: 14 }}><button className={t === "fleet" ? "on" : ""} onClick={() => setT("fleet")}>כלים ונהגים</button><button className={t === "pm" ? "on" : ""} onClick={() => setT("pm")}>לוח טיפולים</button></div>
    <Suspense fallback={<div className="note">טוען כלי שינוע וטיפולים…</div>}>
      <FleetAssetsModuleLazy {...p} mode={t} assetNav={assetNav} ui={fleetAssetsUi()} />
    </Suspense>
  </>);
}
function fleetAssetsUi() {
  return {
    AlertTriangle, BarChart3, CalendarClock, Check, CheckCircle2, ChevronLeft, ClipboardList, Clock, Cog, ConfirmBtn, DateInput, Download, DriversBoard, Empty, ExternalLink, FileSpreadsheet, FileText, ListChecks, Meta, Overlay, Package, PenLine, Plus, Printer, RefreshCw, ReportView, Search, SectionTitle, ShieldAlert, Sparkles, Trash2, Truck, Users, Wrench, X,
    DOC_DEFS, FORKLIFT_TYPES, FREQS, HE_DOW, HE_MONTHS, PRIORITIES, SAVE_FAILED_MESSAGE, SEED_POLICY, TRACKS, WEAR, XLSX,
    assetHealth, buildBlockTicket, buildVehicleTypes, canManageSettings, clampPmDailyCapacity, clearBlockPatches, compactDocLabel, countLabel, dateToTs, daysLeft, docDaysLabel, docStatus, docWarnColor, downloadXlsx, downtimeMs, esc, fleetDepts, fleetInDept, flattenVehicleTypes, fmtDate, fmtDur, freqOf, ils, isOpen, loadReadExcelFile, machineDocs, mergeFleetCatalogAdditions, modelTypeName, nextWorkdayFrom, notifyUser, pendingDriverReqs, pmColor, pmFreqForUnit, reasonBall, reasonPauses, reasonsForRole, resolveHydraulics, rowsSafe, slaForTicket, stOf, startOfDay, ticketNo, ticketWaitReasonLabel, toWorkday, tsToDate, uid, unitBlock, unitDesc, unitLabel, unitModelCode, unitNote, unitTypeName, waitReasonLabel
  };
}

function unitPickerUi() {
  return { ChevronLeft, Search, fleetDepts, unitDesc, unitModelCode, unitTypeName };
}

function manageHubUi() {
  return {
    CalendarClock,
    Check,
    CheckCircle2,
    ChevronLeft,
    ClipboardList,
    Clock,
    ConfirmBtn,
    DateInput,
    Empty,
    FileSpreadsheet,
    ListChecks,
    Overlay,
    PenLine,
    Plus,
    Search,
    SectionTitle,
    SlidersHorizontal,
    Sparkles,
    TimeInput,
    Trash2,
    X,
    PRIORITIES,
    TASK_STATUS,
    TASK_MODES,
    MEETING_TYPES,
    PRANK,
    PRIO_ALIAS,
    RECUR_LABEL,
    RECUR_MS,
    DT_PALETTE,
    XLSX,
    BROWSER_AI_ENABLED,
    SAVE_FAILED_MESSAGE,
    callClaude,
    canManageSettings,
    countLabel,
    dateToTs,
    downloadXlsx,
    findTaskImportMatch,
    fmtDate,
    fmtTime,
    loadPapa,
    loadReadExcelFile,
    meetingVisible,
    mtgCfg,
    mtgType,
    normalizeTaskActionRecord,
    notifyUser,
    originLabel,
    prOf,
    rowsSafe,
    taskActionSourceFields,
    taskModeLabel,
    taskOpen,
    taskOverdue,
    taskSourceInfo,
    taskStatuses,
    taskVisible,
    tsToDate,
    tstOf,
    uid,
    uName
  };
}

function ManageHub(props) {
  return (
    <Suspense fallback={<div className="note">טוען מטלות ופגישות…</div>}>
      <ManageHubLazy {...props} ui={manageHubUi()} />
    </Suspense>
  );
}

/* ============================================================ PPE · בגדי עבודה ומגן (Stage 1) */
const PPE_CATS = [
  { id: "clothing", label: "בגדי עבודה", clawback: true },
  { id: "shoes", label: "נעלי בטיחות", clawback: true },
  { id: "gloves", label: "כפפות", clawback: false },
  { id: "head", label: "קסדה / כובע מגן", clawback: true },
  { id: "eye", label: "משקפי מגן", clawback: false },
  { id: "ear", label: "הגנת שמע", clawback: false },
  { id: "hivis", label: "אפוד זוהר", clawback: true },
  { id: "other", label: "אחר", clawback: false },
];
const ppeCatLabel = (id) => (PPE_CATS.find((c) => c.id === id) || {}).label || id || "—";
const ppeIsIssue = (x) => x.origin !== "clawback" && x.origin !== "return" && x.origin !== "restock";
const ppeMoveType = (x) => x.origin === "restock" ? "restock" : x.origin === "return" ? "return" : x.origin === "clawback" ? "clawback" : "issue";
const PPE_MOVE = { issue: { label: "הנפקה", color: "#475569" }, restock: { label: "חידוש מלאי", color: "#16A34A" }, "return": { label: "החזרה", color: "#0D9488" }, clawback: { label: "קיזוז בעזיבה", color: "#B45309" } };
const ppeMoveLabel = (t) => (PPE_MOVE[t] || {}).label || t;
const ppeSizes = (it) => (it && it.sizes && it.sizes.length) ? it.sizes : ["אחיד"];
const szLbl = (s) => (s === "אחיד" || !s) ? "ללא מידה" : s;
const ppeStockOf = (it, size) => (it && it.stockBySize && typeof it.stockBySize[size] === "number") ? it.stockBySize[size] : 0;
const ppeTotalStock = (it) => ppeSizes(it).reduce((s, z) => s + ppeStockOf(it, z), 0);
const ppeMinOf = (it, sz) => it ? (it.minBySize ? (it.minBySize[sz] || 0) : (ppeSizes(it).length <= 1 ? (it.minStock || 0) : 0)) : 0;
const ppeMaxOf = (it, sz) => (it && it.maxBySize && it.maxBySize[sz]) || 0;
const ppeLowSize = (it, sz) => { const m = ppeMinOf(it, sz); return m > 0 && ppeStockOf(it, sz) < m; };
const ppeLow = (it) => ppeSizes(it).some((sz) => ppeLowSize(it, sz));
const ppeMinTotal = (it) => ppeSizes(it).reduce((s, sz) => s + ppeMinOf(it, sz), 0);
const ppeDeficits = (it) => ppeSizes(it).map((sz) => ({ size: sz, need: Math.max(0, ppeMinOf(it, sz) - ppeStockOf(it, sz)) })).filter((d) => d.need > 0);
const ppeOnOrder = (it, sz, orders) => ppeOpenOrderQty(it, sz, orders);
const ppeNetDeficits = (it, orders) => ppeSmartReorderLinesForItem(it, orders);
const ppeRecipients = (users) => (users || []).filter((u) => (isWorkerLike(u) || u.role === "tech") && u.active !== false).sort((a, b) => (a.name || "").localeCompare(b.name || "", "he"));
const employLabel = (t) => t === "contractor" ? "קבלן" : "ישיר";
const empOf = (u) => u ? (u.employmentType || (u.role === "tech" ? "contractor" : "direct")) : "direct";
const ppeWorkerDept = (u) => u ? (u.dept || (normalizeCleaningAccess(u).source === "legacy-role" ? "ניקיון" : u.role === "tech" ? "אחזקה" : "")) : "";
const PPE_CAT_ICON = { clothing: Shirt, shoes: Footprints, gloves: Hand, head: HardHat, eye: Glasses, ear: Headphones, hivis: Shirt, other: Package };
const ppeCatIcon = (c) => PPE_CAT_ICON[c] || Package;
const ppeNeedGroup = (it) => it ? (it.needGroup || (it.category === "shoes" ? "shoes" : it.category) || it.id) : "";
const PPE_RETURNABLE_DEFAULT = { head: true, hivis: true, eye: true, ear: true };
const ppeReturnable = (it) => it ? (it.returnable != null ? !!it.returnable : !!PPE_RETURNABLE_DEFAULT[it.category]) : false;
const ppeIsUpgrade = (it, items) => { if (!it) return false; const g = ppeNeedGroup(it); const peers = (items || []).filter((x) => ppeNeedGroup(x) === g); return peers.length > 1 && peers.some((p) => (p.unitCost || 0) < (it.unitCost || 0)); };
const ppeNormItemIds = (norms, dept) => (norms || []).filter((n) => n.dept === dept && n.active !== false).map((n) => n.itemId);
const allowedItemsForDept = (items, norms, dept) => {
  const active = (items || []).filter((x) => x.active !== false);
  if (!dept) return [];
  const ids = ppeNormItemIds(norms, dept);
  return active.filter((x) => ids.includes(x.id));
};
const PPE_PERIOD_DEFAULT = 12;
const PPE_CLAWBACK_DEFAULT = [{ maxDays: 14, pct: 100 }, { maxDays: 30, pct: 66 }, { maxDays: 90, pct: 33 }];
const ppeNormFor = (norms, dept, itemId) => (norms || []).find((n) => n.dept === dept && n.itemId === itemId && n.active !== false);
const ppeClawbackTable = (config) => (config && config.ppeClawback && config.ppeClawback.length) ? config.ppeClawback : PPE_CLAWBACK_DEFAULT;
const ppeRecencyPct = (table, days) => { const rows = [...(table || [])].sort((a, b) => a.maxDays - b.maxDays); for (const r of rows) if (days <= r.maxDays) return r.pct; return 0; };
const ppeHeldCount = (ppe, workerId, itemId, sinceAt) => { const f = (ppe || []).filter((x) => x.workerId === workerId && x.itemId === itemId && (!sinceAt || x.at >= sinceAt)); const iss = f.filter((x) => ppeIsIssue(x)).length; const ret = f.filter((x) => x.origin === "return").length; return Math.max(0, iss - ret); };
const ppeLastHeldIssue = (ppe, workerId, itemId, sinceAt) => (ppe || []).filter((x) => x.workerId === workerId && x.itemId === itemId && ppeIsIssue(x) && (!sinceAt || x.at >= sinceAt)).sort((a, b) => b.at - a.at)[0] || null;
const ppeComputeCharge = (item, emp, norm, lastIssueAt, qty, now, outstanding) => {
  const full = (item.unitCost || 0) * Math.max(1, qty || 1);
  if (ppeReturnable(item)) {
    if (outstanding) return { charge: full, reason: "הפריט הקודם לא התקבל אצל מנהל המערכת — חיוב מלא" };
    return { charge: 0, reason: "החלפה ללא חיוב — מותנה באישור מנהל מערכת וקבלת הפריט הקודם" };
  }
  if (emp === "contractor") return { charge: full, reason: "קבלן — מחיר מלא" };
  const periodMs = ((norm && norm.periodMonths) || PPE_PERIOD_DEFAULT) * 30 * 86400000;
  if (lastIssueAt && (now - lastIssueAt) < periodMs) return { charge: full, reason: "לקיחה לפני תום התקופה — מחיר מלא" };
  if (norm && norm.policy === "subsidized") { const pct = norm.workerPct != null ? norm.workerPct : 50; return { charge: Math.round(full * pct / 100), reason: `סבסוד — העובד משלם ${pct}%` }; }
  return { charge: 0, reason: "חינם (מותנה — חיוב בעזיבה מוקדמת)" };
};
const ppeLastIssueAt = (ppe, workerId, itemId, beforeAt, sinceAt) => {
  const rows = (ppe || []).filter((x) => x.workerId === workerId && x.itemId === itemId && ppeIsIssue(x) && (beforeAt == null || x.at < beforeAt) && (!sinceAt || x.at >= sinceAt));
  return rows.length ? Math.max(...rows.map((x) => x.at)) : null;
};
const ppeEligibility = (ppe, workerId, item, norm, now, sinceAt) => {
  if (!item) return null;
  const last = ppeLastIssueAt(ppe, workerId, item.id, null, sinceAt);
  if (!last) return { last: null };
  const days = Math.max(0, Math.floor((now - last) / 86400000));
  const period = (norm && norm.periodMonths) || PPE_PERIOD_DEFAULT;
  const remainDays = Math.ceil(period * 30 - days);
  return { last, days, withinPeriod: remainDays > 0, remainDays };
};
const ppeMaxWindow = (table) => (table || []).reduce((m, r) => Math.max(m, r.maxDays || 0), 0);
const ppeExitCharge = (iss, item, table, now, returned) => {
  if (!iss.clawbackEligible || !ppeIsIssue(iss)) return 0;
  const full = (iss.unitCost || 0) * (iss.qty || 1);
  const remaining = Math.max(0, full - (iss.workerCharge || 0));
  if (remaining <= 0) return 0;
  const days = Math.max(0, Math.floor((now - iss.at) / 86400000));
  if (ppeReturnable(item)) { if (returned) return 0; return Math.round(remaining * ppeRecencyPct(table, days) / 100); }
  return days <= ppeMaxWindow(table) ? remaining : 0;
};

function PpeItemForm({ item, onCancel, onSave, onDelete }) {
  const it = item || {};
  const [name, setName] = useState(it.name || "");
  const [sku, setSku] = useState(it.sku || "");
  const [category, setCategory] = useState(it.category || "clothing");
  const [sizesStr, setSizesStr] = useState((it.sizes || []).filter((s) => s !== "אחיד").join(", "));
  const [stock, setStock] = useState({ ...(it.stockBySize || {}) });
  const [minB, setMinB] = useState(() => { if (it.minBySize) return { ...it.minBySize }; const ss = (it.sizes || []).filter((z) => z !== "אחיד"); if (!ss.length && it.minStock) return { "אחיד": it.minStock }; return {}; });
  const [unitCost, setUnitCost] = useState(it.unitCost != null ? String(it.unitCost) : "");
  const [clawback, setClawback] = useState(it.clawbackEligible != null ? !!it.clawbackEligible : ((PPE_CATS.find((c) => c.id === (it.category || "clothing")) || {}).clawback !== false));
  const [returnable, setReturnable] = useState(it.returnable != null ? !!it.returnable : !!PPE_RETURNABLE_DEFAULT[it.category || "clothing"]);
  const [active, setActive] = useState(it.active !== false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const sizes = sizesStr.split(",").map((s) => s.trim()).filter(Boolean);
  const effSizes = sizes.length ? sizes : ["אחיד"];
  const setOne = (sz, v) => setStock((s) => ({ ...s, [sz]: Math.max(0, parseInt(v || "0", 10) || 0) }));
  const [maxB, setMaxB] = useState(() => it.maxBySize ? { ...it.maxBySize } : {});
  const setMinOne = (sz, v) => setMinB((s) => ({ ...s, [sz]: Math.max(0, parseInt(v || "0", 10) || 0) }));
  const setMaxOne = (sz, v) => setMaxB((s) => ({ ...s, [sz]: Math.max(0, parseInt(v || "0", 10) || 0) }));
  const onCat = (c) => { setCategory(c); const m = PPE_CATS.find((x) => x.id === c); if (m) setClawback(m.clawback !== false); };
  const save = async () => {
    if (busy) return false;
    if (!name.trim()) return setErr("נא להזין שם פריט");
    const sb = {}, mb = {}, mxb = {}; effSizes.forEach((sz) => { sb[sz] = Math.max(0, parseInt(stock[sz] || 0, 10) || 0); const m = Math.max(0, parseInt(minB[sz] || 0, 10) || 0); if (m > 0) mb[sz] = m; const mx = Math.max(0, parseInt(maxB[sz] || 0, 10) || 0); if (mx > 0) mxb[sz] = mx; });
    setBusy(true); setErr("");
    const ok = await onSave({ id: it.id || uid(), name: name.trim(), category, sizes: effSizes, stockBySize: sb, unitCost: Math.max(0, parseFloat(unitCost || "0") || 0), minBySize: mb, maxBySize: mxb, minStock: Object.values(mb).reduce((a, b) => a + b, 0), clawbackEligible: !!clawback, returnable: !!returnable, sku: sku.trim(), active, createdAt: it.createdAt || Date.now(), demo: it.demo || false });
    setBusy(false);
    if (ok === false) {
      setErr("השמירה נכשלה. הפריט לא נסגר כדי שלא יאבד מידע.");
      return false;
    }
    return true;
  };
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" aria-label="סגירה" onClick={onCancel}><X size={22} /></button><div className="form-title">{it.id ? "עריכת פריט" : "פריט חדש"}</div></div>
    <div className="body">
      <label className="field"><span>שם הפריט *</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="לדוגמה: מעיל עבודה כתום" /></label>
      <label className="field"><span>מק״ט (מספר קטלוגי לספק)</span><input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="לדוגמה: 4587-XL" /></label>
      <label className="field"><span>קטגוריה</span><input value={(PPE_CATS.find((c) => c.id === category) || {}).label || category} onChange={(e) => onCat(e.target.value)} placeholder="לדוגמה: ביגוד, נעליים, כפפות" list="ppe-cat-suggest" /><datalist id="ppe-cat-suggest">{PPE_CATS.map((c) => <option key={c.id} value={c.label} />)}</datalist></label>
      <label className="field"><span>מידות (מופרדות בפסיק — השאירו ריק לפריט במידה אחידה)</span><input value={sizesStr} onChange={(e) => setSizesStr(e.target.value)} placeholder="S, M, L, XL" /></label>
      <div className="field"><span>מלאי ומינימום לפי מידה</span><div style={{ overflowX: "auto", marginTop: 4 }}><table style={{ borderCollapse: "collapse", fontSize: 13, minWidth: 320 }}><thead><tr>{["מידה", "במלאי", "מינימום", "מקסימום"].map((h, hi) => <th key={h} style={{ textAlign: hi === 0 ? "start" : "center", padding: "4px 8px", color: "var(--muted)", fontWeight: 600, fontSize: 12, borderBottom: "1px solid var(--border)" }}>{h}</th>)}</tr></thead><tbody>{effSizes.map((sz) => <tr key={sz}><td style={{ padding: "4px 8px", fontWeight: 700, whiteSpace: "nowrap" }}>{szLbl(sz)}</td><td style={{ padding: "3px 6px" }}><input type="number" min="0" value={stock[sz] ?? 0} onChange={(e) => setOne(sz, e.target.value)} style={{ width: 64, textAlign: "center" }} /></td><td style={{ padding: "3px 6px" }}><input type="number" min="0" value={minB[sz] ?? 0} onChange={(e) => setMinOne(sz, e.target.value)} style={{ width: 64, textAlign: "center" }} /></td><td style={{ padding: "3px 6px" }}><input type="number" min="0" value={maxB[sz] ?? 0} onChange={(e) => setMaxOne(sz, e.target.value)} style={{ width: 64, textAlign: "center" }} /></td></tr>)}</tbody></table></div></div>
      <label className="field"><span>עלות רכישה ליחידה (₪)</span><input type="number" min="0" step="0.5" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} placeholder="0" /></label>
      <div style={{ marginTop: 2 }}><label className="chk-line"><input type="checkbox" checked={clawback} onChange={(e) => setClawback(e.target.checked)} /> כפוף לקיזוז בעזיבה</label><div className="hint" style={{ marginInlineStart: 26 }}>אם העובד עוזב לפני תום תקופת הוותק — נגבה קיזוז יחסי על הפריט לפי טבלת הקיזוז.</div></div>
      <div style={{ marginTop: 2 }}><label className="chk-line"><input type="checkbox" checked={returnable} onChange={(e) => setReturnable(e.target.checked)} /> נאסף בחזרה בעזיבה</label><div className="hint" style={{ marginInlineStart: 26 }}>פריט שנאסף בעזיבה וחוזר למלאי (קסדה/אוזניות/אפוד). פריטים אישיים כמו נעליים ובגדים אינם נאספים.</div></div>
      <div style={{ marginTop: 2 }}><label className="chk-line"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> פריט פעיל</label><div className="hint" style={{ marginInlineStart: 26 }}>פריט פעיל מופיע בקטלוג, בהנפקות ובהזמנות. כיבוי מסתיר אותו מבלי למחוק היסטוריה.</div></div>
      {err && <div className="err">{err}</div>}
      <button className="btn-primary full" onClick={save} disabled={busy}>{busy ? "שומר..." : "שמירה"}</button>
      {it.id && onDelete && <ConfirmBtn className="btn-danger full" style={{ marginTop: 10 }} label="מחיקת פריט" onConfirm={onDelete} />}
      <div style={{ height: 24 }} />
    </div></div>);
}

function PpeRestock({ item, onCancel, onSave, session, onLog }) {
  const [add, setAdd] = useState({});
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const sizes = ppeSizes(item);
  const setOne = (sz, v) => setAdd((s) => ({ ...s, [sz]: Math.max(0, parseInt(v || "0", 10) || 0) }));
  const save = async () => {
    if (busy) return false;
    const sb = { ...(item.stockBySize || {}) };
    sizes.forEach((sz) => { sb[sz] = (sb[sz] || 0) + (add[sz] || 0); });
    setBusy(true); setErr("");
    const ok = await onSave({ ...item, stockBySize: sb });
    setBusy(false);
    if (ok === false) {
      setErr("עדכון המלאי נכשל. הנתונים נשארו פתוחים כדי לנסות שוב.");
      return false;
    }
    if (onLog) {
      const moves = sizes.filter((sz) => (add[sz] || 0) > 0).map((sz) => ({ id: uid(), origin: "restock", itemId: item.id, itemName: item.name, category: item.category, size: sz, qty: add[sz], at: Date.now(), by: session ? { id: session.id, name: session.name } : null, unitCost: item.unitCost || 0, workerCharge: 0, note: "" }));
      if (moves.length && await onLog(moves) === false) {
        setErr("המלאי עודכן, אך יומן התנועה לא נשמר. בדקו חיבור ונסו לרענן.");
        return false;
      }
    }
    return true;
  };
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" aria-label="סגירה" onClick={onCancel}><X size={22} /></button><div className="form-title">הוספת מלאי · {item.name}</div></div>
    <div className="body"><div className="field"><span>כמות להוספה לפי מידה</span><div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>{sizes.map((sz) => <label key={sz} style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 96 }}><span style={{ fontSize: 12, color: "var(--muted)" }}>{szLbl(sz)} (כעת {ppeStockOf(item, sz)})</span><input type="number" min="0" value={add[sz] ?? 0} onChange={(e) => setOne(sz, e.target.value)} style={{ width: 96 }} /></label>)}</div></div>
      {err && <div className="err">{err}</div>}
      <button className="btn-primary full" onClick={save} disabled={busy}>{busy ? "שומר..." : "עדכון מלאי"}</button><div style={{ height: 24 }} /></div></div>);
}

function UserPicker({ users, config, saveUser, value, onChange, label, pool, lockRole, hint, suggestName, session, canManageUsers: mayManageUsers = false, canManageWorkerAccess: canWorkerAccess = false }) {
  const list = scopedUsersForActor(pool || users || [], session || {}, { role: lockRole || "", canManageUsers: mayManageUsers, sameShift: lockRole === "worker" });
  const scopedDefaults = session && !mayManageUsers && lockRole === "worker" ? scopedWorkerDefaultsForActor(session) : {};
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(null);
  const sel = list.find((u) => u.id === value) || (created && created.id === value ? created : null);
  const ql = q.trim().toLowerCase();
  const matches = ql ? list.filter((u) => (u.name || "").toLowerCase().includes(ql) || String(u.workerNo || "").includes(q.trim())).slice(0, 8) : [];
  const rowStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", padding: "9px 12px", background: "var(--surface)", border: "none", borderBottom: "1px solid var(--border)", cursor: "pointer", textAlign: "start" };
  if (sel) return <div className="field"><span>{label}</span><div className="row-between" style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "8px 12px" }}><span style={{ fontWeight: 600 }}>{sel.name}{sel.workerNo ? ` · מס׳ ${sel.workerNo}` : ""}{sel.dept ? ` · ${sel.dept}` : ""}</span><button className="btn-ghost sm" onClick={() => { onChange(null); setCreated(null); setQ(""); }}>שנה</button></div></div>;
  return (<div className="field"><span>{label}</span>
    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="הקלידו שם או מספר עובד" />
    {suggestName && !q.trim() && <button className="btn-ghost sm" style={{ marginTop: 6 }} onClick={() => setQ(suggestName)}><Search size={13} /> נהג משמרת: {suggestName}</button>}
    {q.trim() ? <div style={{ marginTop: 6, border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
      {matches.map((u) => <button key={u.id} style={rowStyle} onClick={() => { onChange(u); setQ(""); }}><span style={{ fontWeight: 600 }}>{u.name}</span><span style={{ color: "var(--muted)", fontSize: 12 }}>{ROLE_LABEL[u.role]}{u.workerNo ? ` · ${u.workerNo}` : ""}{u.dept ? ` · ${u.dept}` : ""}</span></button>)}
      {matches.length === 0 && <div className="hint" style={{ padding: "10px 12px", color: "#B45309" }}>לא נמצא «{q.trim()}» במערכת.</div>}
      {saveUser && <button style={{ ...rowStyle, borderBottom: "none", color: "var(--primary)", fontWeight: 600, justifyContent: "flex-start", gap: 6 }} onClick={() => setCreating(true)}><Plus size={14} /> {matches.length === 0 ? `צור עובד חדש «${q.trim()}»` : "לא ברשימה — צור חדש"}</button>}
    </div> : (hint ? <div className="hint">{hint}</div> : null)}
    {creating && <Overlay persistent panelClassName="user-picker-form-panel" onClose={() => setCreating(false)}><UserForm user={{ ...scopedDefaults, ...(/^\d+$/.test(q.trim()) ? { workerNo: q.trim() } : (q.trim() ? { name: q.trim() } : {})) }} config={config} users={users} session={session} canManageUsers={mayManageUsers} canDelete={false} lockRole={lockRole || "worker"} canManageWorkerAccess={canWorkerAccess} onCancel={() => setCreating(false)} onSave={async (u) => { const saved = await saveUser(u); if (saved !== false) { const next = saved?.id ? saved : u; setCreated(next); onChange(next); setCreating(false); setQ(""); } return saved; }} /></Overlay>}
  </div>);
}

const PPE_SIGN_DEFAULT = "אני, {שם} (מספר עובד {מספר}), מאשר/ת בזאת כי קיבלתי את פריטי הציוד המפורטים בטבלה שלעיל במצב תקין, וכי הוסברו לי תנאי השימוש, ההחזרה והקיזוז החלים עליהם.";
function SignaturePad({ value, onChange, required }) {
  const ref = useRef(null);
  const drawing = useRef(false);
  const [resign, setResign] = useState(false);
  const pos = (e) => { const c = ref.current; const r = c.getBoundingClientRect(); const t = e.touches ? e.touches[0] : e; return { x: (t.clientX - r.left) * (c.width / r.width), y: (t.clientY - r.top) * (c.height / r.height) }; };
  const start = (e) => { e.preventDefault(); drawing.current = true; const ctx = ref.current.getContext("2d"); const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
  const move = (e) => { if (!drawing.current) return; e.preventDefault(); const ctx = ref.current.getContext("2d"); const p = pos(e); ctx.lineTo(p.x, p.y); ctx.strokeStyle = "#111"; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.stroke(); };
  const end = () => { if (!drawing.current) return; drawing.current = false; try { onChange(ref.current.toDataURL("image/png")); } catch (e) {} };
  const clear = () => { const c = ref.current; c.getContext("2d").clearRect(0, 0, c.width, c.height); onChange(""); };
  if (value && !resign) return (<div className="field" style={{ marginTop: 10 }}><span>חתימת העובד {required ? "(חובה)" : "(אופציונלי)"}</span><div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 8, background: "#fff", textAlign: "center" }}><img src={value} style={{ maxHeight: 90, maxWidth: "100%" }} alt="signature" /><div className="hint" style={{ color: "#0D9488", marginTop: 4 }}>חתימה התקבלה ✓</div></div><button className="btn-ghost sm" style={{ marginTop: 6 }} onClick={() => { setResign(true); onChange(""); }}>חתום מחדש</button></div>);
  return (<div className="field" style={{ marginTop: 10 }}><span>חתימת העובד {required ? "(חובה)" : "(אופציונלי)"}</span><canvas ref={ref} width={420} height={140} style={{ width: "100%", height: 140, border: "1px dashed var(--border)", borderRadius: 10, background: "#fff", touchAction: "none" }} onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end} onTouchStart={start} onTouchMove={move} onTouchEnd={end} /><button className="btn-ghost sm" style={{ marginTop: 6 }} onClick={clear}>נקה חתימה</button></div>);
}
function ppeDocBody(recs, worker, config) {
  const w = worker || {};
  const tpl = (config && config.ppeSignText) || PPE_SIGN_DEFAULT;
  const today = fmtDate(Date.now());
  const dept = w.dept || (typeof ppeWorkerDept === "function" ? ppeWorkerDept(w) : "") || "";
  const fill = (s) => (s || "").split("{שם}").join(w.name || "").split("{מספר}").join(w.workerNo || "").split("{מחלקה}").join(dept).split("{תאריך}").join(today);
  const list = (recs || []).filter((r) => r.origin !== "return");
  const td = 'style="border:1px solid #999;padding:8px;text-align:right;font-size:14px"';
  const th = 'style="border:1px solid #999;padding:8px;text-align:right;font-size:14px;background:#f0f0f0"';
  const rows = list.map((r) => '<tr' + (r.flagged ? ' style="background:#FEF3C7"' : '') + '><td ' + td + '>' + (r.itemName || '') + '</td><td ' + td + '>' + (r.size || '') + '</td><td ' + td + '>' + (r.qty || 1) + '</td><td ' + td + '>' + ((r.workerCharge > 0) ? ('\u20aa' + r.workerCharge) : '\u05d7\u05d9\u05e0\u05dd') + (r.chargeReason ? '<div style="font-size:11px;color:#777;margin-top:2px">' + r.chargeReason + (r.flagged ? ' \u26a0' : '') + '</div>' : '') + '</td></tr>').join('');
  const cb = (list.find((r) => r.clawbackSnapshot && r.clawbackSnapshot.length) || {}).clawbackSnapshot || (typeof ppeClawbackTable === "function" ? ppeClawbackTable(config) : []);
  const cbRows = (cb || []).map((r) => '<tr><td ' + td + '>עד ' + r.maxDays + ' ימים מיום הקבלה</td><td ' + td + '>' + r.pct + '% מהעלות</td></tr>').join('') + '<tr><td ' + td + '>לאחר מכן</td><td ' + td + '>ללא חיוב</td></tr>';
  const sigRec = (recs || []).find((r) => r.signature);
  const processedBy = (((recs || []).find((r) => r.by && r.by.name) || {}).by || {}).name || "";
  const initiator = ((recs || []).find((r) => r.initiatedByName) || {}).initiatedByName || "";
  const initAt = ((recs || []).find((r) => r.initiatedAt) || {}).initiatedAt || (((recs || [])[0] || {}).at);
  const company = (config && config.companyName) || "";
  return '<div style="font-family:Arial,Helvetica,sans-serif;direction:rtl;color:#111;padding:18px;background:#fff">'
    + '<div style="font-size:18px;font-weight:700">אישור קבלת ציוד מגן' + (company ? ' · ' + company : '') + '</div>'
    + '<div style="color:#555;font-size:13px;margin-top:2px">תאריך: ' + today + ' · עובד: ' + (w.name || '') + (w.workerNo ? ' · מספר ' + w.workerNo : '') + (dept ? ' · ' + dept : '') + '</div>'
    + '<table style="width:100%;border-collapse:collapse;margin:16px 0"><thead><tr><th ' + th + '>פריט</th><th ' + th + '>מידה</th><th ' + th + '>כמות</th><th ' + th + '>חיוב</th></tr></thead><tbody>' + rows + '</tbody></table>'
    + '<div style="font-size:14px;font-weight:700;margin-top:6px">תנאי קיזוז בעזיבה (לפריטים שאינם מוחזרים)</div>'
    + '<table style="width:100%;border-collapse:collapse;margin:6px 0 12px"><thead><tr><th ' + th + '>תקופה מיום הקבלה</th><th ' + th + '>שיעור קיזוז</th></tr></thead><tbody>' + cbRows + '</tbody></table>'
    + '<div style="line-height:1.8;font-size:14px;margin:14px 0">' + fill(tpl) + '</div>'
    + '<div style="display:flex;gap:24px;margin-top:28px"><div style="flex:1;text-align:center"><div style="height:70px;border-bottom:1px solid #333;display:flex;align-items:flex-end;justify-content:center">' + (sigRec && sigRec.signature ? '<img src="' + sigRec.signature + '" style="max-width:220px;max-height:68px"/>' : '') + '</div><div style="font-size:12px;color:#444;margin-top:4px">חתימת העובד · ' + (w.name || '') + (w.workerNo ? ' · ' + w.workerNo : '') + '</div></div>'
    + '<div style="flex:1;text-align:center"><div style="height:70px;border-bottom:1px solid #333;display:flex;align-items:flex-end;justify-content:center;font-size:15px;padding-bottom:6px">' + today + '</div><div style="font-size:12px;color:#444;margin-top:4px">תאריך</div></div></div>'
    + '<div style="margin-top:18px;font-size:12px;color:#444;border-top:1px solid #ddd;padding-top:8px">טופל ע״י: ' + (initiator || processedBy || '—') + (initAt ? ' · ' + (typeof fmtDate === "function" ? fmtDate(initAt) : "") : "") + '</div>'
    + '</div>';
}
function ppePrintDoc(recs, worker, config) {
  const html = '<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><title>אישור קבלת ציוד</title></head><body>' + ppeDocBody(recs, worker, config) + '</body></html>';
  try {
    const f = document.createElement("iframe");
    f.style.position = "fixed"; f.style.right = "0"; f.style.bottom = "0"; f.style.width = "0"; f.style.height = "0"; f.style.border = "0";
    document.body.appendChild(f);
    const d = f.contentWindow.document; d.open(); d.write(html); d.close();
    setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) {} setTimeout(() => { try { document.body.removeChild(f); } catch (e) {} }, 1500); }, 350);
  } catch (e) {}
}
function PpeWorkerPicker({ users, config, session, saveUser, value, onChange, deptScope, lock }) {
  const mayManageUsers = canManageUsers(session);
  const scopedWorkerUsers = scopedUsersForActor(ppeRecipients(users), session || {}, { role: "worker", canManageUsers: mayManageUsers, sameShift: true });
  const recips = scopedWorkerUsers.filter((u) => !deptScope || !deptScope.length || (u.dept && deptScope.includes(u.dept)));
  const scopedDefaults = !mayManageUsers ? scopedWorkerDefaultsForActor(session || {}) : {};
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(null);
  const sel = recips.find((u) => u.id === value) || (created && created.id === value ? created : null);
  const ql = q.trim().toLowerCase();
  const matches = ql ? recips.filter((u) => (u.name || "").toLowerCase().includes(ql) || String(u.workerNo || "").includes(q.trim())).slice(0, 8) : [];
  const rowStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", padding: "9px 12px", background: "var(--surface)", border: "none", borderBottom: "1px solid var(--border)", cursor: "pointer", textAlign: "start" };
  if (sel) return <div className="field"><span>עובד מקבל *</span><div className="row-between" style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "8px 12px" }}><span style={{ fontWeight: 600 }}>{sel.name}{sel.workerNo ? ` · מס׳ ${sel.workerNo}` : ""}{sel.dept ? ` · ${sel.dept}` : ""}{empOf(sel) === "contractor" ? " · קבלן" : ""}</span>{!lock && <button className="btn-ghost sm" onClick={() => { onChange(""); setCreated(null); }}>שנה</button>}</div></div>;
  return (<div className="field"><span>עובד מקבל * (חיפוש לפי שם או מספר)</span>
    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="הקלידו מספר עובד או שם" autoFocus />
    {q.trim() ? <div style={{ marginTop: 6, border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
      {matches.map((u) => <button key={u.id} style={rowStyle} onClick={() => { onChange(u.id); setQ(""); }}><span style={{ fontWeight: 600 }}>{u.name}</span><span style={{ color: "var(--muted)", fontSize: 12 }}>{ROLE_LABEL[u.role]}{u.workerNo ? ` · ${u.workerNo}` : ""}{u.dept ? ` · ${u.dept}` : ""}</span></button>)}
      {matches.length === 0 && <div className="hint" style={{ padding: "10px 12px", color: "#B45309" }}>לא נמצא עובד «{q.trim()}» במערכת.</div>}
      <button style={{ ...rowStyle, borderBottom: "none", color: "var(--primary)", fontWeight: 600, justifyContent: "flex-start", gap: 6 }} onClick={() => setCreating(true)}><Plus size={14} /> {matches.length === 0 ? `צור עובד חדש «${q.trim()}»` : "לא ברשימה — צור עובד חדש"}</button>
    </div> : <div className="hint">הקלידו מספר עובד — המערכת תאתר אותו. לא קיים? תוכלו ליצור אותו כאן (חיפוש לפי מספר מונע כפילות).</div>}
    {creating && <Overlay persistent panelClassName="user-picker-form-panel" onClose={() => setCreating(false)}><UserForm user={{ ...scopedDefaults, ...(/^\d+$/.test(q.trim()) ? { workerNo: q.trim() } : (q.trim() ? { name: q.trim() } : {})) }} config={config} users={users} session={session} canManageUsers={mayManageUsers} canDelete={false} lockRole="worker" canManageWorkerAccess={canManageWorkerAccess(session)} onCancel={() => setCreating(false)} onSave={async (u) => { const saved = await saveUser(u); if (saved !== false) { const next = saved?.id ? saved : u; setCreated(next); onChange(next.id); setCreating(false); setQ(""); } return saved; }} /></Overlay>}
  </div>);
}

function PpeIssueForm({ users, items, norms, ppe, config, session, saveUser, deptScope, onCancel, onIssue, initial, submitLabel, title, lockWorker, requester }) {
  const [workerId, setWorkerId] = useState(initial?.workerId || "");
  const [emp, setEmp] = useState("direct");
  const [empTouched, setEmpTouched] = useState(false);
  const [note, setNote] = useState(initial?.note || "");
  const [lines, setLines] = useState(() => (initial?.lines || []).map((l) => ({ key: uid(), itemId: l.itemId, size: l.size, qty: String(l.qty || 1), charge: String(l.workerCharge || 0), chargeTouched: false, retPrev: !!l.retPrev })));
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const worker = ppeRecipients(users).find((u) => u.id === workerId);
  const reset = (worker && worker.ppeResetAt) || 0;
  useEffect(() => { if (worker) setEmp(empOf(worker)); }, [workerId]);
  const allowed = allowedItemsForDept(items, norms, worker ? ppeWorkerDept(worker) : "");
  const itemOf = (id) => (items || []).find((x) => x.id === id);
  const chargeInfo = (it, qty, retPrev) => { if (!it) return { charge: 0, reason: "" }; const q = Math.max(1, parseInt(qty || "1", 10) || 1); const norm = worker ? ppeNormFor(norms, ppeWorkerDept(worker), it.id) : null; const last = worker ? ppeLastIssueAt(ppe, worker.id, it.id, null, reset) : null; const out = worker ? (ppeHeldCount(ppe, worker.id, it.id, reset) > 0 && !retPrev) : false; return ppeComputeCharge(it, emp, norm, last, q, Date.now(), out); };
  const autoCharge = (it, qty, retPrev) => chargeInfo(it, qty, retPrev).charge;
  const addLine = () => setLines((s) => [...s, { key: uid(), itemId: "", size: "", qty: "1", charge: "0", chargeTouched: false }]);
  const toggleItem = (it) => { const ex = lines.find((l) => l.itemId === it.id); if (ex) { rmLine(ex.key); return; } const g = ppeNeedGroup(it); setLines((s) => { const pruned = s.filter((l) => { const li = itemOf(l.itemId); return !(li && ppeNeedGroup(li) === g); }); return [...pruned, { key: uid(), itemId: it.id, size: ppeSizes(it)[0], qty: "1", charge: String(autoCharge(it, "1")), chargeTouched: false }]; }); };
  const setLine = (key, patch) => setLines((s) => s.map((l) => l.key === key ? { ...l, ...patch } : l));
  const rmLine = (key) => setLines((s) => s.filter((l) => l.key !== key));
  useEffect(() => { setLines((s) => s.map((l) => l.chargeTouched ? l : { ...l, charge: String(autoCharge(itemOf(l.itemId), l.qty, l.retPrev)) })); }, [workerId, emp]);
  const filled = lines.filter((l) => l.itemId);
  const [sig, setSig] = useState(initial && initial.signature ? initial.signature : "");
  const [sigMode, setSigMode] = useState(null);
  const [docRecs, setDocRecs] = useState(null);
  const save = async (opts = {}) => {
    if (saving) return;
    if (!worker) return setErr("בחרו עובד");
    if (!filled.length) return setErr("הוסיפו לפחות פריט אחד");
    if (!sig && !opts.remote) return setErr("נדרשת חתימת העובד לפני ההמשך");
    const recs = filled.map((l) => { const it = itemOf(l.itemId); const sz = l.size || ppeSizes(it)[0]; const q = Math.max(1, parseInt(l.qty || "1", 10) || 1); const ci = chargeInfo(it, l.qty, l.retPrev); const chg = Math.max(0, parseFloat(l.charge || "0") || 0); return { id: uid(), workerId: worker.id, workerName: worker.name, workerNo: worker.workerNo || "", dept: ppeWorkerDept(worker), employmentType: emp, itemId: it.id, itemName: it.name, category: it.category, size: sz, qty: q, at: Date.now(), by: { id: session.id, name: session.name }, unitCost: it.unitCost || 0, workerCharge: chg, clawbackEligible: !!it.clawbackEligible, note: note.trim(), origin: "manual", signature: sig || "", clawbackSnapshot: (typeof ppeClawbackTable === "function" ? ppeClawbackTable(config) : []), chargeReason: ci.reason || "", flagged: (chg > 0 && /לא הוחזר|לא התקבל|לפני תום|מוקדמת|הקודם|ללא החזרה/.test(ci.reason || "")), initiatedByName: session.name, initiatedAt: Date.now(), awaitWorkerSign: !!opts.remote, retPrev: !!l.retPrev, returnRequested: requester && !!l.retPrev }; });
    const extra = [];
    if (!requester) filled.forEach((l) => { const it = itemOf(l.itemId); if (l.retPrev && ppeReturnable(it) && worker) { const prev = ppeLastHeldIssue(ppe, worker.id, it.id, reset); if (prev) extra.push({ id: uid(), workerId: worker.id, workerName: worker.name, workerNo: worker.workerNo || "", dept: ppeWorkerDept(worker), employmentType: emp, itemId: prev.itemId, itemName: prev.itemName, category: prev.category, size: prev.size, qty: prev.qty || 1, restocked: true, at: Date.now(), by: { id: session.id, name: session.name }, unitCost: prev.unitCost || 0, workerCharge: 0, note: "הוחזר עם הנפקה חדשה", origin: "return", linkedIssueId: prev.id }); } });
    const __all = [...recs, ...extra];
    if (!requester && sig) setDocRecs(__all);
    else {
      setSaving(true);
      try {
        const ok = await onIssue(__all);
        if (ok === false) setErr(SAVE_FAILED_MESSAGE);
      } finally {
        setSaving(false);
      }
    }
  };
  if (docRecs) return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" aria-label="חזרה" onClick={() => setDocRecs(null)}><ChevronLeft size={24} style={{ transform: "scaleX(-1)" }} /></button><div className="form-title">אישור קבלת ציוד</div></div>
    <div className="body">
      <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)" }} dangerouslySetInnerHTML={{ __html: ppeDocBody(docRecs, worker, config) }} />
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}><button className="btn-ghost" onClick={() => setDocRecs(null)}><ChevronLeft size={16} style={{ transform: "scaleX(-1)" }} /> חזרה לתיקון</button><button className="btn-ghost full" onClick={() => ppePrintDoc(docRecs, worker, config)}><Printer size={16} /> הדפס / שמור PDF</button><button className="btn-primary full" disabled={saving} onClick={async () => { setSaving(true); try { const ok = await onIssue(docRecs); if (ok === false) setErr(SAVE_FAILED_MESSAGE); } finally { setSaving(false); } }}>{saving ? "שומר..." : "סיום ושמירה"}</button></div>
      {err && <div className="err">{err}</div>}
      <div className="hint" style={{ marginTop: 8 }}>אם ההדפסה חסומה בתצוגה המוטמעת — המסמך מוצג כאן לצילום; בגרסה המותקנת ההדפסה / שמירה ל-PDF תעבוד.</div>
      <div style={{ height: 20 }} />
    </div></div>);
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" aria-label="סגירה" onClick={onCancel}><X size={22} /></button><div className="form-title">{title || "הנפקת ציוד"}</div></div>
    <div className="body">
      <PpeWorkerPicker users={users} config={config} session={session} saveUser={saveUser} deptScope={deptScope} value={workerId} onChange={(id) => setWorkerId(id)} lock={lockWorker} />
      {worker && <>
        {allowed.length === 0 && <div className="note" style={{ color: "#B45309" }}>אין פריטים זמינים למחלקת העובד{worker.dept ? ` («${worker.dept}»)` : ""}. הגדירו «דרישות מחלקה» או הוסיפו פריטים פעילים לקטלוג.</div>}
        <SectionTitle>פריטים להנפקה</SectionTitle>
        {allowed.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>{allowed.flatMap((it) => { const l = lines.find((x) => x.itemId === it.id); const sel = !!l; const IconC = ppeCatIcon(it.category); const up = ppeIsUpgrade(it, items); const out = ppeTotalStock(it) <= 0; const els = [<button key={it.id + "-t"} type="button" onClick={() => toggleItem(it)} disabled={out && !sel} style={{ position: "relative", flex: "1 1 96px", maxWidth: 150, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "10px 6px", borderRadius: 10, border: sel ? "2px solid #0D9488" : "1px solid var(--border)", background: sel ? "rgba(13,148,136,0.08)" : "var(--surface)", cursor: (out && !sel) ? "not-allowed" : "pointer", opacity: (out && !sel) ? 0.45 : 1 }}><IconC size={22} color={sel ? "#0D9488" : "var(--muted)"} />{up && <span style={{ position: "absolute", top: 4, insetInlineEnd: 6, color: "#D97706", fontSize: 12 }}>★</span>}<span style={{ fontSize: 12, fontWeight: 600, textAlign: "center", lineHeight: 1.2 }}>{it.name}</span><span style={{ fontSize: 11, color: "var(--muted)" }}>{ppeTotalStock(it)} במלאי</span>{(() => { const el = worker ? ppeEligibility(ppe, worker.id, it, ppeNormFor(norms, ppeWorkerDept(worker), it.id), Date.now(), reset) : null; return el && el.last ? <span style={{ position: "absolute", top: 4, insetInlineStart: 6, fontSize: 10, fontWeight: 700, color: el.withinPeriod ? "#B45309" : "#0D9488" }} title={el.withinPeriod ? "בתוקף" : "זכאי"}>{el.withinPeriod ? "● בתוקף" : "✓"}</span> : null; })()}</button>]; if (sel) { const sizes = ppeSizes(it); const curSize = l.size || sizes[0]; const stockHere = ppeStockOf(it, curSize); els.push(<div key={it.id + "-d"} style={{ flexBasis: "100%", border: "1px solid var(--border)", borderRadius: 10, padding: 10, background: "var(--surface)" }}><div className="chips">{sizes.map((sz) => { const st = ppeStockOf(it, sz); return <button key={sz} className={"chip" + (curSize === sz ? " on" : "")} onClick={() => setLine(l.key, { size: sz })}>{szLbl(sz)} · {st}</button>; })}</div><div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}><div><div style={{ fontWeight: 700 }}>חיוב: {Number(l.charge) > 0 ? ils(Number(l.charge)) : "חינם"}</div><div className="hint">{chargeInfo(it, l.qty, l.retPrev).reason}{l.chargeTouched ? " · תוקן ידנית" : ""}</div></div>{!requester && (l.chargeTouched ? <input type="number" min="0" step="0.5" value={l.charge} onChange={(e) => setLine(l.key, { charge: e.target.value, chargeTouched: true })} style={{ width: 90 }} /> : <button className="btn-ghost sm" onClick={() => setLine(l.key, { chargeTouched: true })}>תיקון ידני</button>)}</div>{ppeReturnable(it) && worker && ppeHeldCount(ppe, worker.id, it.id, reset) > 0 && <label className="chk-line" style={{ margin: "6px 0 0", fontSize: 13 }}><input type="checkbox" checked={!!l.retPrev} onChange={(e) => setLine(l.key, { retPrev: e.target.checked, charge: String(autoCharge(it, l.qty, e.target.checked)), chargeTouched: false })} /> {requester ? "העובד יחזיר את הפריט הקודם למנהל המערכת לאישור קבלה" : "הפריט הקודם התקבל אצל מנהל המערכת (אחרת — חיוב מלא)"}</label>}{requester && l.retPrev && <div className="hint" style={{ marginTop: 4, color: "#B45309" }}>הבקשה תעבור למנהל המערכת. ההחלפה תהיה ללא חיוב רק אחרי אישור שהפריט הקודם התקבל בפועל.</div>}{(() => { const el = worker ? ppeEligibility(ppe, worker.id, it, ppeNormFor(norms, ppeWorkerDept(worker), it.id), Date.now(), reset) : null; return el && el.last ? <div className="hint" style={{ marginTop: 4, color: el.withinPeriod ? "#B45309" : "var(--muted)" }}>{el.withinPeriod ? `כבר הונפק לפני ${el.days} ימים · זכאות מתחדשת בעוד ${el.remainDays} ימים — הנפקה חוזרת בחיוב מלא` : `הונפק לאחרונה לפני ${el.days} ימים · בתוקף לזכאות`}</div> : null; })()}{stockHere < 1 && <div className="hint" style={{ color: "#B45309" }}>אין מלאי במידה זו — יתאפס בהנפקה.</div>}</div>); } return els; })}</div>}
        <label className="field" style={{ marginTop: 10 }}><span>הערה (משותפת)</span><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="לא חובה" /></label>
        {requester ? (sigMode === "here" ? (<><SignaturePad value={sig} onChange={setSig} required={true} />{err && <div className="err">{err}</div>}<div style={{ display: "flex", gap: 8 }}><button className="btn-ghost" onClick={() => { setSigMode(null); setSig(""); }}>חזרה</button><button className="btn-primary full" disabled={saving} onClick={() => save()}>{saving ? "שומר..." : (submitLabel || "שליחת בקשה לאישור")}</button></div></>) : (<div style={{ marginTop: 12 }}><div className="hint" style={{ marginBottom: 8 }}>נדרשת חתימת העובד. בחרו כיצד להחתים:</div>{err && <div className="err">{err}</div>}<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button className="btn-primary full" disabled={saving} onClick={() => save({ remote: true })}><Send size={15} /> {saving ? "שומר..." : "שלח לעובד לחתימה"}</button><button className="btn-ghost full" onClick={() => setSigMode("here")}><PenLine size={15} /> החתם את העובד כאן</button></div></div>)) : (<><SignaturePad value={sig} onChange={setSig} required={true} />{err && <div className="err">{err}</div>}<button className="btn-primary full" disabled={saving} onClick={() => save()}>{saving ? "שומר..." : (submitLabel || ("רישום הנפקה" + (filled.length > 1 ? ` (${filled.length} פריטים)` : "")))}</button></>)}
      </>}
      {!worker && err && <div className="err">{err}</div>}
      <div style={{ height: 24 }} />
    </div></div>);
}

function PpeIssueCard({ iss, onClose, onFilterWorker, onDelete, onPrint, docHtml }) {
  const Row = ({ k, v }) => <div className="row-between" style={{ padding: "7px 0", borderBottom: "1px solid var(--border)" }}><span style={{ color: "var(--muted)" }}>{k}</span><span style={{ fontWeight: 600, textAlign: "start" }}>{v}</span></div>;
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" aria-label="סגירה" onClick={onClose}><X size={22} /></button><div className="form-title">פרטי הנפקה</div></div>
    <div className="body">
      {docHtml && <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)", marginBottom: 12 }} dangerouslySetInnerHTML={{ __html: docHtml }} />}
      <Row k="עובד" v={iss.workerName + (iss.workerNo ? ` · מס׳ ${iss.workerNo}` : "")} />
      <Row k="שיוך" v={employLabel(iss.employmentType) + (iss.dept ? ` · ${iss.dept}` : "")} />
      <Row k="פריט" v={`${iss.itemName}${iss.size && iss.size !== "אחיד" ? ` · ${iss.size}` : ""} ×${iss.qty}`} />
      <Row k="קטגוריה" v={ppeCatLabel(iss.category)} />
      <Row k="עלות רכישה" v={ils((iss.unitCost || 0) * (iss.qty || 1))} />
      <Row k="חיוב העובד" v={iss.workerCharge > 0 ? ils(iss.workerCharge) : "חינם"} />
      <Row k="הונפק" v={`${fmtDate(iss.at)} · ${(iss.by && iss.by.name) || "—"}`} />
      {iss.note && <div className="note" style={{ marginTop: 8 }}>{iss.note}</div>}
      {onPrint && <button className="btn-primary full" style={{ marginTop: 12 }} onClick={onPrint}><Printer size={15} /> הורד / הדפס אישור (PDF)</button>}
      <button className="btn-ghost full" style={{ marginTop: 12 }} onClick={onFilterWorker}>הצג את כל ההנפקות של {iss.workerName}</button>
      <ConfirmBtn className="btn-danger full" style={{ marginTop: 10 }} label="מחיקת הנפקה (המלאי יוחזר)" onConfirm={onDelete} />
      <div style={{ height: 24 }} />
    </div></div>);
}

function PpeItemCard({ item, ppe, onEdit, onClose, onRestock }) {
  const moves = (ppe || []).filter((x) => x.itemId === item.id).sort((a, b) => b.at - a.at).slice(0, 12);
  const low = ppeLow(item);
  const Row = ({ k, v }) => (v != null && v !== "") ? <div className="row-between" style={{ padding: "6px 0", borderBottom: "1px solid var(--border)" }}><span style={{ color: "var(--muted)" }}>{k}</span><span style={{ fontWeight: 600 }}>{v}</span></div> : null;
  const movQty = (x) => { const t = ppeMoveType(x); return t === "issue" ? "−" + (x.qty || 1) : t === "restock" ? "＋" + (x.qty || 0) : t === "return" ? "＋" + (x.qty || 1) : "—"; };
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" aria-label="סגירה" onClick={onClose}><X size={22} /></button><div className="form-title">{item.name}</div></div>
    <div className="body">
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}><span className="badge sm" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>{ppeCatLabel(item.category)}</span>{low && <span className="badge sm" style={{ background: "#FEE2E2", color: "#B91C1C" }}>מלאי נמוך</span>}{item.active === false && <span className="badge sm" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>מושבת</span>}</div>
      <div className="field"><span>מלאי / מינימום לפי מידה</span><div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>{ppeSizes(item).map((sz) => { const lw = ppeLowSize(item, sz); const m = ppeMinOf(item, sz); return <span key={sz} style={{ padding: "4px 10px", borderRadius: 8, background: lw ? "#FEE2E2" : "var(--surface-2)", color: lw ? "#B91C1C" : "inherit", fontSize: 13 }}>{szLbl(sz)}: <b>{ppeStockOf(item, sz)}</b>{m ? ` / מינ׳ ${m}` : ""}</span>; })}</div></div>
      <div style={{ marginTop: 8 }}>
        <Row k="סה״כ במלאי" v={ppeTotalStock(item)} />
        <Row k="מק״ט" v={item.sku} />
        <Row k="עלות ליחידה" v={ils(item.unitCost || 0)} />
        <Row k="מלאי מינימום (סה״כ)" v={ppeMinTotal(item)} />
        <Row k="כפוף לקיזוז בעזיבה" v={item.clawbackEligible ? "כן" : "לא"} />
        <Row k="נאסף בחזרה בעזיבה" v={ppeReturnable(item) ? "כן" : "לא"} />
      </div>
      <SectionTitle>תנועות אחרונות</SectionTitle>
      {moves.length === 0 ? <Empty text="אין תנועות לפריט" Icon={Package} /> : <div className="task-list">{moves.map((x) => { const t = ppeMoveType(x); const col = t === "restock" ? "#16A34A" : t === "return" ? "#0D9488" : t === "clawback" ? "#B45309" : "#475569"; return <div key={x.id} className="task-row" style={{ borderInlineStartColor: col, cursor: "default" }}><div className="task-row-main"><div className="task-row-t">{ppeMoveLabel(t)}{x.size && x.size !== "אחיד" ? ` · ${x.size}` : ""}{x.workerName ? ` · ${x.workerName}` : ""}</div><div className="task-row-sub">{fmtDate(x.at)} · {(x.by && x.by.name) || "—"}</div></div><div className="task-row-side"><span className="task-due" style={{ fontWeight: 700, color: col }}>{movQty(x)}</span></div></div>; })}</div>}
      {onRestock && <button className="btn-ghost full" style={{ marginTop: 14 }} onClick={onRestock}><Plus size={15} /> עדכון מלאי ידני</button>}<button className="btn-primary full" style={{ marginTop: 10 }} onClick={onEdit}><PenLine size={15} /> עריכת פריט</button>
      <div style={{ height: 24 }} />
    </div></div>);
}

function PpeCatalog({ items, ppe, onSave, onDelete, session, savePpe }) {
  const [edit, setEdit] = useState(null), [view, setView] = useState(null), [restock, setRestock] = useState(null);
  const list = [...(items || [])].sort((a, b) => ((a.active === false ? 1 : 0) - (b.active === false ? 1 : 0)) || (a.name > b.name ? 1 : -1));
  const del = async (it) => { const ok = await onDelete(it.id); if (ok !== false) { setEdit(null); setView(null); } return ok; };
  return (<>
    <div className="row-between" style={{ marginBottom: 10 }}><SectionTitle><Package size={15} /> קטלוג ציוד</SectionTitle><button className="btn-primary sm" onClick={() => setEdit({})}><Plus size={15} /> הוסף פריט</button></div>
    {list.length === 0 ? <Empty text="הקטלוג ריק" Icon={Package} sub="הוסיפו פריט ציוד מגן/בגדי עבודה" /> : <div className="cards">{list.map((it) => { const low = ppeLow(it); return <button key={it.id} className="tcard" onClick={() => setView(it)} style={{ borderInlineStartColor: it.active === false ? "var(--muted)" : (low ? "#DC2626" : "#0D9488"), cursor: "pointer", textAlign: "start" }}>
      <div className="tcard-main">
        <div className="tcard-row1"><span className="tcard-subj">{it.name}</span><span className="badge sm" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>{ppeCatLabel(it.category)}</span>{low && <span className="badge sm" style={{ background: "#FEE2E2", color: "#B91C1C" }}>מלאי נמוך</span>}{it.active === false && <span className="badge sm" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>מושבת</span>}</div>
        <div className="tcard-sub" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>{ppeSizes(it).map((sz) => <span key={sz} style={{ padding: "2px 8px", borderRadius: 6, background: "var(--surface-2)", fontSize: 12 }}>{szLbl(sz)}: <b>{ppeStockOf(it, sz)}</b></span>)}</div>
        <div className="tcard-sub" style={{ marginTop: 4 }}>סה״כ {ppeTotalStock(it)} · עלות {ils(it.unitCost || 0)} · מינ׳ {ppeMinTotal(it)}{it.sku ? ` · מק״ט ${it.sku}` : ""}{it.clawbackEligible ? " · כפוף לקיזוז" : ""}</div>
      </div>
    </button>; })}</div>}
    {view && <Overlay onClose={() => setView(null)}><PpeItemCard item={view} ppe={ppe} onEdit={() => { setEdit(view); setView(null); }} onRestock={() => { setRestock(view); setView(null); }} onClose={() => setView(null)} /></Overlay>}
    {restock && <Overlay persistent onClose={() => setRestock(null)}><PpeRestockFlow items={items} preItem={restock} session={session} savePpe={savePpe} savePpeItem={onSave} onClose={() => setRestock(null)} /></Overlay>}
    {edit && <Overlay persistent onClose={() => setEdit(null)}><PpeItemForm item={edit.id ? edit : null} onCancel={() => setEdit(null)} onSave={async (x) => { const ok = await onSave(x); if (ok !== false) setEdit(null); return ok; }} onDelete={edit.id ? (() => del(edit)) : null} /></Overlay>}
  </>);
}

function PpeNorms({ items, norms, config, onSave, onDelete }) {
  const depts = config.departments || [];
  const [dept, setDept] = useState(depts[0] || "");
  const active = (items || []).filter((x) => x.active !== false);
  const activeIds = new Set(active.map((x) => x.id));
  const recFor = (id) => (norms || []).find((n) => n.dept === dept && n.itemId === id);
  const toggle = async (it) => { const ex = recFor(it.id); if (ex) await onDelete(ex.id); else await onSave({ id: uid(), dept, itemId: it.id, active: true, policy: it.clawbackEligible ? "subsidized" : "free", workerPct: 50, periodMonths: PPE_PERIOD_DEFAULT, createdAt: Date.now() }); };
  const patch = async (rec, p) => { await onSave({ ...rec, ...p }); };
  const cnt = (norms || []).filter((n) => n.dept === dept && activeIds.has(n.itemId)).length;
  return (<>
    <div className="row-between" style={{ marginBottom: 10 }}><SectionTitle><ClipboardCheck size={15} /> דרישות מחלקה ומדיניות חיוב</SectionTitle></div>
    <div className="hint" style={{ marginBottom: 10 }}>בחרו אילו פריטים זמינים בכל מחלקה ומה מדיניות החיוב. מחלקה ללא הגדרה — מציגה את כל הפריטים, ללא הקצאה (מחיר מלא).</div>
    <label className="field" style={{ maxWidth: 320 }}><span>מחלקה{cnt ? ` · ${countLabel(cnt, "פריט מוגדר", "פריטים מוגדרים")}` : " · ללא הגדרה"}</span><select value={dept} onChange={(e) => setDept(e.target.value)}>{depts.map((d) => <option key={d}>{d}</option>)}</select></label>
    {active.length === 0 ? <Empty text="הקטלוג ריק" Icon={Package} sub="הוסיפו פריטים בקטלוג תחילה" /> : <div className="cards">{active.map((it) => { const rec = recFor(it.id); const on = !!rec; return <div key={it.id} className="tcard" style={{ borderInlineStartColor: on ? "#0D9488" : "var(--line)", cursor: "default" }}><div className="tcard-main">
      <label className="chk-line" style={{ margin: 0 }}><input type="checkbox" checked={on} onChange={() => toggle(it)} /> <b>{it.name}</b> · {ppeCatLabel(it.category)} · {ils(it.unitCost || 0)}</label>
      {on && <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <div className="seg-tabs s2" style={{ maxWidth: 220 }}><button className={rec.policy !== "subsidized" ? "on" : ""} onClick={() => patch(rec, { policy: "free" })}>חינם</button><button className={rec.policy === "subsidized" ? "on" : ""} onClick={() => patch(rec, { policy: "subsidized" })}>מסובסד</button></div>
        {rec.policy === "subsidized" && <label className="ppe-policy-inline">העובד משלם <input type="number" min="0" max="100" value={rec.workerPct != null ? rec.workerPct : 50} onChange={(e) => patch(rec, { workerPct: Math.max(0, Math.min(100, parseInt(e.target.value || "0", 10) || 0)) })} />%</label>}
        <label className="ppe-policy-inline">תקופת זכאות <input type="number" min="1" value={rec.periodMonths || PPE_PERIOD_DEFAULT} onChange={(e) => patch(rec, { periodMonths: Math.max(1, parseInt(e.target.value || "1", 10) || 1) })} /> חודשים</label>
      </div>}
    </div></div>; })}</div>}
  </>);
}


function PpeRestockFlow({ items, session, savePpe, savePpeItem, onClose, preItem }) {
  const [selId, setSelId] = useState(preItem ? preItem.id : ""), [q, setQ] = useState("");
  const active = (items || []).filter((x) => x.active !== false);
  const sel = active.find((x) => x.id === selId);
  if (sel) return <PpeRestock item={sel} session={session} onLog={async (moves) => { for (const m of moves) if (await savePpe(m) === false) return false; return true; }} onCancel={() => { if (preItem) onClose(); else setSelId(""); }} onSave={async (x) => { const ok = await savePpeItem(x); if (ok !== false) onClose(); return ok; }} />;
  const ql = q.trim().toLowerCase();
  const shown = ql ? active.filter((x) => (x.name || "").toLowerCase().includes(ql) || String(x.sku || "").toLowerCase().includes(ql)) : active;
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" aria-label="סגירה" onClick={onClose}><X size={22} /></button><div className="form-title">חידוש מלאי — בחירת פריט</div></div>
    <div className="body">
      <label className="field"><span>בחרו פריט להוספת מלאי</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש לפי שם או מק״ט" autoFocus /></label>
      <div className="cards">{shown.map((it) => <button key={it.id} className="tcard" onClick={() => setSelId(it.id)} style={{ borderInlineStartColor: ppeLow(it) ? "#DC2626" : "#0D9488", cursor: "pointer", textAlign: "start" }}><div className="tcard-main"><div className="tcard-row1"><span className="tcard-subj">{it.name}</span><span className="badge sm" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>{ppeCatLabel(it.category)}</span></div><div className="tcard-sub" style={{ marginTop: 4 }}>סה״כ {ppeTotalStock(it)}{it.sku ? ` · מק״ט ${it.sku}` : ""}</div></div></button>)}{shown.length === 0 && <Empty text="לא נמצא פריט" Icon={Package} />}</div>
      <div style={{ height: 24 }} />
    </div></div>);
}

function PpeMoveCard({ mov, onClose, onFilterWorker }) {
  const t = ppeMoveType(mov);
  const Row = ({ k, v }) => (v != null && v !== "") ? <div className="row-between" style={{ padding: "6px 0", borderBottom: "1px solid var(--border)" }}><span style={{ color: "var(--muted)" }}>{k}</span><span style={{ fontWeight: 600 }}>{v}</span></div> : null;
  const qtyTxt = t === "issue" ? "−" + (mov.qty || 1) : t === "restock" ? "＋" + (mov.qty || 0) : t === "return" ? (mov.restocked ? "＋" + (mov.qty || 1) : (mov.qty || 1) + " (נמחק)") : "—";
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" aria-label="סגירה" onClick={onClose}><X size={22} /></button><div className="form-title">{ppeMoveLabel(t)}</div></div>
    <div className="body">
      <div style={{ fontWeight: 800, fontSize: 18 }}>{mov.itemName}{mov.size && mov.size !== "אחיד" ? ` · ${mov.size}` : ""}</div>
      <div style={{ marginTop: 10 }}>
        <Row k="סוג תנועה" v={ppeMoveLabel(t)} />
        <Row k="קטגוריה" v={ppeCatLabel(mov.category)} />
        <Row k="כמות" v={qtyTxt} />
        <Row k="תאריך" v={fmtDate(mov.at)} />
        <Row k="עובד" v={mov.workerName} />
        <Row k="מחלקה" v={mov.dept} />
        {mov.workerCharge > 0 ? <Row k="חיוב עובד" v={ils(mov.workerCharge)} /> : null}
        <Row k="בוצע ע״י" v={mov.by && mov.by.name} />
        <Row k="הערה" v={mov.note} />
      </div>
      {onFilterWorker && <button className="btn-ghost full" style={{ marginTop: 12 }} onClick={onFilterWorker}>סינון תנועות העובד</button>}
      <div style={{ height: 24 }} />
    </div></div>);
}

function PpeLog({ ppe, items, norms, users, config, session, deptScope, canIssue, canExit, reqMode, savePpe, delPpe, savePpeItem, saveUser, mStart, mEnd, mLabel, orders, savePpeOrder, delPpeOrder }) {
  const [edit, setEdit] = useState(false), [openId, setOpenId] = useState(null), [wf, setWf] = useState(""), [exit, setExit] = useState(false), [openG, setOpenG] = useState({});
  const [ordOpen, setOrdOpen] = useState(false);
  const ordN = (orders || []).filter((o) => o.status === "draft" || o.status === "sent").length;
  const [fType, setFType] = useState("all"), [q, setQ] = useState("");
  const now = Date.now();
  const _mS = mStart != null ? mStart : new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const _mE = mEnd != null ? mEnd : now + 1;
  const _mL = mLabel || "החודש";
  const base = deptScope ? (ppe || []).filter((x) => x.dept && deptScope.includes(x.dept)) : (ppe || []);
  const sorted = [...base].sort((a, b) => b.at - a.at);
  const ql = q.trim().toLowerCase();
  const list = sorted.filter((x) => (fType === "all" || ppeMoveType(x) === fType) && (!wf || x.workerId === wf) && (ql ? ((x.itemName || "").toLowerCase().includes(ql) || (x.workerName || "").toLowerCase().includes(ql) || String(x.workerNo || "").includes(q.trim())) : (x.at >= _mS && x.at < _mE)));
  const anyFilter = !!(ql || wf);
  const groupOf = (x) => { const t = ppeMoveType(x); if (t === "issue") { const d = x.dept || "ללא מחלקה"; return { key: "iss:" + d, label: "הנפקות · מחלקה " + d }; } if (t === "restock") { if (x.orderId) return { key: "ord:" + x.orderId, label: (x.note && x.note.indexOf("קבלת הזמנה") === 0) ? x.note : "קבלת הזמנה" }; return { key: "rs", label: "חידוש מלאי ידני" }; } if (t === "return" || t === "clawback") { if (x.exitId) return { key: "exit:" + x.exitId, label: "עזיבת עובד · " + (x.workerName || "") }; if (t === "return") return { key: "ret", label: "החזרות עם הנפקה חוזרת" }; return { key: "cb", label: "קיזוזים" }; } return { key: "other", label: "אחר" }; };
  const groups = []; const gmap = {}; list.forEach((x) => { const g = groupOf(x); if (!gmap[g.key]) { gmap[g.key] = { key: g.key, label: g.label, items: [], at: x.at }; groups.push(gmap[g.key]); } gmap[g.key].items.push(x); if (x.at > gmap[g.key].at) gmap[g.key].at = x.at; }); groups.sort((a, b) => b.at - a.at);
  const last30 = sorted.filter((x) => x.at >= _mS && x.at < _mE);
  const iss30 = last30.filter(ppeIsIssue);
  const charge30 = iss30.reduce((s, x) => s + (x.workerCharge || 0), 0);
  const restockQty30 = last30.filter((x) => x.origin === "restock").reduce((s, x) => s + (x.qty || 0), 0);
  const ret30 = last30.filter((x) => x.origin === "return").length;
  const lowItems = (items || []).filter((x) => x.active !== false && ppeLow(x));
  const issue = async (recs) => { if (await ppeIssueRecs(recs, items, savePpeItem, savePpe) !== false) setEdit(false); };
  const removeIssue = async (rec) => {
    const it = (items || []).find((x) => x.id === rec.itemId);
    if (it) {
      const sb = { ...(it.stockBySize || {}) };
      sb[rec.size] = (sb[rec.size] || 0) + rec.qty;
      if (await savePpeItem({ ...it, stockBySize: sb }) === false) return;
    }
    if (await delPpe(rec.id) !== false) setOpenId(null);
  };
  const wfWorker = wf ? (users || []).find((u) => u.id === wf) : null;
  const TYPES = [["all", "הכל"], ["issue", "הנפקות"], ["restock", "חידושי מלאי"], ["return", "החזרות"], ["clawback", "קיזוזים"]];
  const movQty = (x) => { const t = ppeMoveType(x); if (t === "issue") return "−" + (x.qty || 1); if (t === "restock") return "＋" + (x.qty || 0); if (t === "return") return x.restocked ? "＋" + (x.qty || 1) : (x.qty || 1) + " · נמחק"; return ""; };
  const exportReport = () => { const rows = list.map((x) => ({ "תאריך": fmtDate(x.at), "סוג תנועה": ppeMoveLabel(ppeMoveType(x)), "פריט": x.itemName, "קטגוריה": ppeCatLabel(x.category), "מידה": x.size, "כמות": x.qty || 0, "עובד": x.workerName || "", "מספר עובד": x.workerNo || "", "מחלקה": x.dept || "", "חיוב": x.workerCharge || 0, "ביצע": (x.by && x.by.name) || "" })); if (!rows.length) return; try { const ws = XLSX.utils.json_to_sheet(rowsSafe(rows)); ws["!cols"] = Object.keys(rows[0]).map(() => ({ wch: 14 })); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "תנועות מלאי"); downloadXlsx(wb, `ppe-movements_${new Date().toISOString().slice(0, 10)}.xlsx`); } catch (e) {} };
  const open = openId ? sorted.find((x) => x.id === openId) : null;
  return (<>
    <div className="row-between" style={{ marginBottom: 10 }}><SectionTitle><PackageCheck size={15} /> תנועות מלאי</SectionTitle><div style={{ display: "flex", gap: 8 }}>{canExit && <button className="btn-ghost sm" onClick={() => setExit(true)}>עזיבת עובד</button>}{canIssue && <button className="btn-primary sm" onClick={() => setEdit(true)}><Plus size={15} /> הנפקה</button>}{reqMode && <span className="hint" style={{ alignSelf: "center" }}>להנפקה — פנה למנהל הציוד</span>}</div></div>
    <div className="kpi-strip"><div className="kpi-mini"><span className="kpi-mini-v">{iss30.length}</span><span className="kpi-mini-l">{"הנפקות · " + _mL}</span></div><div className="kpi-mini"><span className="kpi-mini-v" style={{ color: "#16A34A" }}>＋{restockQty30}</span><span className="kpi-mini-l">{"חידושי מלאי · " + _mL}</span></div><div className="kpi-mini"><span className="kpi-mini-v">{ret30}</span><span className="kpi-mini-l">{"החזרות · " + _mL}</span></div><div className="kpi-mini"><span className="kpi-mini-v">{ils(charge30)}</span><span className="kpi-mini-l">{"חיוב עובדים · " + _mL}</span></div><div className="kpi-mini"><span className="kpi-mini-v" style={lowItems.length ? { color: "#DC2626" } : {}}>{lowItems.length}</span><span className="kpi-mini-l">פריטים במלאי נמוך</span></div></div>
    {(canIssue || (orders || []).length > 0) && <div style={{ marginBottom: 10 }}><button className="task-row" onClick={() => setOrdOpen((v) => !v)} style={{ borderInlineStartColor: "var(--primary)", background: "var(--surface-2)" }}><div className="task-row-main"><div className="task-row-t">הזמנות רכש{ordN ? ` · ${countLabel(ordN, "הזמנה פתוחה", "הזמנות פתוחות")}` : ""}</div><div className="task-row-sub">קבלות ויצירת הזמנות לספק</div></div><div className="task-row-side"><ChevronLeft size={16} style={{ transform: ordOpen ? "rotate(-90deg)" : "none", transition: "transform .15s" }} /></div></button>{ordOpen && <div style={{ marginTop: 8 }}><PpeOrders embedded orders={orders} items={items} config={config} session={session} savePpeOrder={savePpeOrder} delPpeOrder={delPpeOrder} savePpeItem={savePpeItem} savePpe={savePpe} /></div>}</div>}
    <div className="seg-tabs" style={{ flexWrap: "wrap", marginBottom: 10 }}>{TYPES.map(([k, l]) => <button key={k} className={fType === k ? "on" : ""} onClick={() => setFType(k)}>{l}</button>)}</div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10, alignItems: "center" }}>
      <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="חיפוש תנועות מלאי לפי פריט, עובד או מספר" placeholder="חיפוש פריט / עובד / מספר (בכל התקופה)" style={{ minWidth: 200, flex: "1 1 200px" }} />{q && <button className="btn-ghost sm" onClick={() => setQ("")}>נקה</button>}
      <button className="btn-ghost sm" style={{ marginInlineStart: "auto" }} onClick={exportReport} disabled={!list.length} title={!list.length ? "אין נתונים לייצוא" : ""}>{ql ? `ייצוא Excel (${list.length})` : `ייצוא ${_mL} (${list.length})`}</button>
    </div>
    {wfWorker && <div className="tag-bar">מסונן לפי עובד: <b>{wfWorker.name}</b> <button className="btn-ghost sm" onClick={() => setWf("")}>נקה סינון</button></div>}
    {list.length === 0 ? <Empty text="אין תנועות" Icon={PackageCheck} sub="הנפקות, חידושי מלאי והחזרות יופיעו כאן" /> : <div className="task-list">{groups.map((g) => { const isO = openG[g.key] !== undefined ? openG[g.key] : anyFilter; const net = g.items.reduce((s2, x) => { const tt = ppeMoveType(x); return s2 + (tt === "issue" ? -(x.qty || 1) : (tt === "restock" || (tt === "return" && x.restocked)) ? (x.qty || 1) : 0); }, 0); return <div key={g.key} style={{ marginBottom: 6 }}><button className="task-row" onClick={() => setOpenG((o) => ({ ...o, [g.key]: !isO }))} style={{ borderInlineStartColor: "#94A3B8", background: "var(--surface-2)" }}><div className="task-row-main"><div className="task-row-t">{g.label}</div><div className="task-row-sub">{countLabel(g.items.length, "תנועה", "תנועות")} · {fmtDate(g.at)}</div></div><div className="task-row-side">{net !== 0 && <span className="task-due" style={{ fontWeight: 700, color: net > 0 ? "#16A34A" : "#475569" }}>{net > 0 ? "＋" + net : net}</span>}<ChevronLeft size={16} style={{ transform: isO ? "rotate(-90deg)" : "none", transition: "transform .15s" }} /></div></button>{isO && <div style={{ paddingInlineStart: 8 }}>{g.items.map((x) => { const t = ppeMoveType(x); const col = t === "restock" ? "#16A34A" : t === "return" ? "#0D9488" : t === "clawback" ? "#B45309" : (x.employmentType === "contractor" ? "#EA580C" : "#0D9488"); const who = x.workerName || ""; return <button key={x.id} className="task-row" onClick={() => setOpenId(x.id)} style={{ borderInlineStartColor: col }}><div className="task-row-main"><div className="task-row-t">{x.itemName}{x.size && x.size !== "אחיד" ? ` · ${x.size}` : ""}{who ? ` · ${who}` : ""}</div><div className="task-row-sub">{ppeMoveLabel(t)} · {ppeCatLabel(x.category)}{x.dept ? ` · ${x.dept}` : ""} · {(x.by && x.by.name) || "—"}</div></div><div className="task-row-side"><span className="task-due">{fmtDate(x.at)}</span><span className="task-due" style={{ fontWeight: 700, color: col }}>{movQty(x)}</span>{x.workerCharge > 0 ? <span className="task-due" style={{ fontWeight: 700, color: "#B45309" }}>{ils(x.workerCharge)}</span> : null}</div></button>; })}</div>}</div>; })}</div>}
    {edit && <Overlay persistent onClose={() => setEdit(false)}><PpeIssueForm users={users} items={(items || []).filter((x) => x.active !== false)} norms={norms} ppe={ppe} config={config} session={session} saveUser={saveUser} deptScope={deptScope} onCancel={() => setEdit(false)} onIssue={issue} /></Overlay>}
    {exit && <Overlay persistent onClose={() => setExit(false)}><PpeExitSettlement ppe={ppe} users={users} items={items} config={config} session={session} savePpe={savePpe} savePpeItem={savePpeItem} saveUser={saveUser} onClose={() => setExit(false)} /></Overlay>}
    
    {open && (ppeMoveType(open) === "issue" ? <Overlay onClose={() => setOpenId(null)}><PpeIssueCard iss={open} onClose={() => setOpenId(null)} onFilterWorker={() => { setWf(open.workerId); setOpenId(null); }} onDelete={() => removeIssue(open)} docHtml={(() => { const batch = (ppe || []).filter((r) => r.workerId === open.workerId && Math.abs((r.at || 0) - (open.at || 0)) < 60000 && r.origin !== "return"); const worker = (users || []).find((u) => u.id === open.workerId) || { name: open.workerName, workerNo: open.workerNo, dept: open.dept }; return ppeDocBody(batch.length ? batch : [open], worker, config); })()} onPrint={() => { const batch = (ppe || []).filter((r) => r.workerId === open.workerId && Math.abs((r.at || 0) - (open.at || 0)) < 60000 && r.origin !== "return"); const worker = (users || []).find((u) => u.id === open.workerId) || { name: open.workerName, workerNo: open.workerNo, dept: open.dept }; ppePrintDoc(batch.length ? batch : [open], worker, config); }} /></Overlay> : <Overlay onClose={() => setOpenId(null)}><PpeMoveCard mov={open} onClose={() => setOpenId(null)} onFilterWorker={open.workerId ? () => { setWf(open.workerId); setOpenId(null); } : null} /></Overlay>)}
  </>);
}

function PpeSignTemplate({ config, onSave }) {
  const [txt, setTxt] = useState(config.ppeSignText || PPE_SIGN_DEFAULT);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");
  const save = async () => { setErr(""); const ok = await onSave({ ...config, ppeSignText: txt }); if (ok === false) return setErr(SAVE_FAILED_MESSAGE); setSaved(true); setTimeout(() => setSaved(false), 1500); };
  return (<>
    <div className="row-between" style={{ marginBottom: 10 }}><SectionTitle><FileText size={15} /> תבנית אישור קבלת ציוד (חתימה)</SectionTitle></div>
    <div className="hint" style={{ marginBottom: 6 }}>ההצהרה שהעובד חותם עליה באישור הקבלה. שדות אוטומטיים: {"{שם}, {מספר}, {מחלקה}, {תאריך}"}. טבלת הפריטים ותנאי הקיזוז מתווספים אוטומטית.</div>
    {err && <div className="note" style={{ color: "#DC2626", marginBottom: 6 }}>{err}</div>}
    <textarea rows={5} aria-label="תבנית אישור קבלת ציוד" value={txt} onChange={(e) => setTxt(e.target.value)} style={{ width: "100%" }} />
    <button className="btn-primary" style={{ marginTop: 10 }} onClick={save}>{saved ? "נשמר ✓" : "שמירת תבנית"}</button>
  </>);
}
function PpeClawbackSettings({ config, onSave }) {
  const [rows, setRows] = useState(ppeClawbackTable(config).map((r) => ({ maxDays: String(r.maxDays), pct: String(r.pct) })));
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");
  const setOne = (i, k, v) => setRows((s) => s.map((r, j) => j === i ? { ...r, [k]: v } : r));
  const add = () => setRows((s) => [...s, { maxDays: "", pct: "" }]);
  const rm = (i) => setRows((s) => s.filter((_, j) => j !== i));
  const save = async () => { setErr(""); const clean = rows.map((r) => ({ maxDays: Math.max(0, parseInt(r.maxDays || "0", 10) || 0), pct: Math.max(0, Math.min(100, parseInt(r.pct || "0", 10) || 0)) })).filter((r) => r.maxDays > 0).sort((a, b) => a.maxDays - b.maxDays); const ok = await onSave({ ...config, ppeClawback: clean }); if (ok === false) return setErr(SAVE_FAILED_MESSAGE); setSaved(true); setTimeout(() => setSaved(false), 1500); };
  return (<>
    <div className="row-between" style={{ marginBottom: 10 }}><SectionTitle><ClipboardCheck size={15} /> קיזוז בעזיבה — מדרגות לפי ותק</SectionTitle></div>
    <div className="hint" style={{ marginBottom: 10 }}>כמה אחוז מהיתרה (מחיר מלא פחות מה ששולם) ינוכה מעובד שעוזב, לפי כמה ימים עברו מההנפקה. מעבר למדרגה האחרונה — 0%. דוגמה: עד 30 יום 100%, עד 90 יום 75%, וכו׳.</div>
    {err && <div className="note" style={{ color: "#DC2626", marginBottom: 6 }}>{err}</div>}
    <div className="cards">{rows.map((r, i) => <div key={i} className="tcard" style={{ cursor: "default" }}><div className="tcard-main" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>עד <input type="number" min="1" value={r.maxDays} onChange={(e) => setOne(i, "maxDays", e.target.value)} style={{ width: 80 }} /> ימים</label>
      <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>ניכוי <input type="number" min="0" max="100" value={r.pct} onChange={(e) => setOne(i, "pct", e.target.value)} style={{ width: 70 }} />%</label>
      <button className="icon-btn" aria-label="הסר מדרגת קיזוז" title="הסר מדרגת קיזוז" onClick={() => rm(i)} style={{ marginInlineStart: "auto" }}><X size={18} /></button>
    </div></div>)}</div>
    <button className="btn-ghost sm" style={{ marginTop: 8 }} onClick={add}><Plus size={14} /> הוסף מדרגה</button>
    <button className="btn-primary full" style={{ marginTop: 12 }} onClick={save}>{saved ? "נשמר ✓" : "שמירת מדרגות"}</button>
  </>);
}

const ppeArchiveWorker = async (worker, plan, deps) => {
  const { items, savePpe, savePpeItem, saveUser, session } = deps;
  const now = Date.now();
  const base = { workerId: worker.id, workerName: worker.name, workerNo: worker.workerNo || "", dept: worker.dept || "", employmentType: worker.employmentType || "direct", qty: 0, at: now, exitId: ("exit_" + now + "_" + worker.id), by: { id: session.id, name: session.name }, clawbackEligible: false };
  for (const r of (plan.keep || [])) if (await savePpe({ id: uid(), ...base, itemId: r.iss.itemId, itemName: r.iss.itemName, category: r.iss.category, size: r.iss.size, unitCost: r.iss.unitCost || 0, workerCharge: r.amount, note: "קיזוז בעזיבה", origin: "clawback", linkedIssueId: r.iss.id }) === false) return false;
  for (const r of (plan.returns || [])) {
    if (await savePpe({ id: uid(), ...base, itemId: r.iss.itemId, itemName: r.iss.itemName, category: r.iss.category, size: r.iss.size, unitCost: r.iss.unitCost || 0, qty: r.iss.qty || 1, restocked: true, workerCharge: 0, note: "הוחזר למלאי בעזיבה", origin: "return", linkedIssueId: r.iss.id }) === false) return false;
    const it = (items || []).find((x) => x.id === r.iss.itemId); if (it) { const sb = { ...(it.stockBySize || {}) }; sb[r.iss.size] = (sb[r.iss.size] || 0) + (r.iss.qty || 1); if (await savePpeItem({ ...it, stockBySize: sb }) === false) return false; }
  }
  if (await saveUser({ ...worker, active: false, status: "archived", exitAt: now }) === false) return false;
  return true;
};

function PpeExitSettlement({ ppe, users, items, config, session, savePpe, savePpeItem, saveUser, onClose, initialWid }) {
  const [q, setQ] = useState(""), [wid, setWid] = useState(initialWid || ""), [ret, setRet] = useState({}), [done, setDone] = useState(false), [err, setErr] = useState("");
  const now = Date.now(), table = ppeClawbackTable(config);
  const recips = (users || []).filter((u) => (isWorkerLike(u) || u.role === "tech") && u.active !== false);
  const ql = q.trim().toLowerCase();
  const matches = ql ? recips.filter((u) => (u.name || "").toLowerCase().includes(ql) || String(u.workerNo || "").includes(q.trim())).slice(0, 8) : [];
  const worker = recips.find((u) => u.id === wid);
  const issued = worker ? (ppe || []).filter((x) => x.workerId === worker.id && ppeIsIssue(x) && x.at >= ((worker && worker.ppeResetAt) || 0)) : [];
  const rows = issued.map((x) => { const it = (items || []).find((i) => i.id === x.itemId); const retbl = ppeReturnable(it || x); const returned = retbl ? !!ret[x.id] : false; const amount = ppeExitCharge(x, it || x, table, now, returned); return { iss: x, retbl, returned, amount, days: Math.max(0, Math.floor((now - x.at) / 86400000)) }; });
  const keep = rows.filter((r) => r.amount > 0).map((r) => ({ iss: r.iss, amount: r.amount }));
  const returns = rows.filter((r) => r.retbl && r.returned).map((r) => ({ iss: r.iss }));
  const total = keep.reduce((s, r) => s + r.amount, 0);
  const rowStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", padding: "9px 12px", background: "var(--surface)", border: "none", borderBottom: "1px solid var(--border)", cursor: "pointer", textAlign: "start" };
  const confirm = async () => { setErr(""); const ok = await ppeArchiveWorker(worker, { keep, returns }, { items, savePpe, savePpeItem, saveUser, session }); if (ok !== false) setDone(true); else setErr(SAVE_FAILED_MESSAGE); };
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" aria-label="סגירה" onClick={onClose}><X size={22} /></button><div className="form-title">עזיבת עובד — החזרת ציוד וקיזוז</div></div>
    <div className="body">
      {!worker ? <>
        <label className="field"><span>עובד עוזב (חיפוש לפי מספר או שם)</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="הקלידו מספר עובד או שם" autoFocus /></label>
        {q.trim() && <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>{matches.map((u) => <button key={u.id} style={rowStyle} onClick={() => { setWid(u.id); setQ(""); }}><span style={{ fontWeight: 600 }}>{u.name}</span><span style={{ color: "var(--muted)", fontSize: 12 }}>{u.workerNo ? `מס׳ ${u.workerNo}` : ""}{u.dept ? ` · ${u.dept}` : ""}</span></button>)}{matches.length === 0 && <div className="hint" style={{ padding: "10px 12px" }}>לא נמצא עובד פעיל תואם.</div>}</div>}
      </> : done ? <div className="note" style={{ marginTop: 4, color: "#0D9488" }}>העובד הועבר לארכיון. קיזוז/החזרות נרשמו ביומן.</div> : <>
        <div className="row-between" style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "8px 12px", marginBottom: 10 }}><span style={{ fontWeight: 600 }}>{worker.name}{worker.workerNo ? ` · מס׳ ${worker.workerNo}` : ""}{worker.dept ? ` · ${worker.dept}` : ""}</span><button className="btn-ghost sm" onClick={() => setWid("")}>שנה</button></div>
        {err && <div className="err" style={{ marginBottom: 8 }}>{err}</div>}
        {rows.length === 0 ? <div className="note" style={{ marginTop: 4 }}>לא הונפק לעובד ציוד הדורש טיפול — ניתן לארכב ישירות.</div> : <>
          <SectionTitle>ציוד שהונפק — החזרה / קיזוז</SectionTitle>
          <div className="task-list">{rows.map((r) => <div key={r.iss.id} className="task-row" style={{ borderInlineStartColor: r.returned ? "#0D9488" : (r.amount > 0 ? "#B45309" : "var(--muted)"), cursor: "default" }}>
            <div className="task-row-main"><div className="task-row-t">{r.iss.itemName}{r.iss.size && r.iss.size !== "אחיד" ? ` · ${r.iss.size}` : ""}</div><div className="task-row-sub">לפני {r.days} ימים · {r.retbl ? "נאסף בחזרה" : "לא נאסף"}{r.amount > 0 ? ` · חיוב ${ils(r.amount)}` : (r.returned ? " · הוחזר" : " · ללא חוב")}</div></div>
            <div className="task-row-side">{r.retbl ? <label className="chk-line" style={{ margin: 0, fontSize: 13 }}><input type="checkbox" checked={r.returned} onChange={(e) => setRet((s) => ({ ...s, [r.iss.id]: e.target.checked }))} /> הוחזר</label> : null}<span className="task-due" style={{ fontWeight: 700, color: r.amount > 0 ? "#B45309" : "#0D9488" }}>{r.amount > 0 ? ils(r.amount) : "₪0"}</span></div>
          </div>)}</div>
          <div className="row-between" style={{ marginTop: 12, padding: "10px 12px", background: "var(--surface-2)", borderRadius: 10, fontWeight: 700 }}><span>סה״כ לניכוי מהעובד</span><span style={{ color: total > 0 ? "#B45309" : "#0D9488" }}>{ils(total)}</span></div>
        </>}
        <button className="btn-primary full" style={{ marginTop: 12 }} onClick={confirm}>לסגור במערכת ולהעביר לארכיון{total > 0 ? ` · קיזוז ${ils(total)}` : ""}</button>
      </>}
      <div style={{ height: 24 }} />
    </div></div>);
}

function ArchiveWorkerCard({ worker, ppe, onClose, onRestore, onDelete }) {
  const recs = (ppe || []).filter((x) => x.workerId === worker.id).sort((a, b) => b.at - a.at);
  const issued = recs.filter((x) => x.origin !== "clawback" && x.origin !== "return");
  const owed = recs.reduce((s, x) => s + (x.workerCharge || 0), 0);
  const typeLabel = (x) => x.origin === "clawback" ? "קיזוז בעזיבה" : x.origin === "return" ? "החזרה" : "הנפקה";
  const Row = ({ k, v }) => <div className="row-between" style={{ padding: "6px 0", borderBottom: "1px solid var(--border)" }}><span style={{ color: "var(--muted)" }}>{k}</span><span style={{ fontWeight: 600 }}>{v}</span></div>;
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" aria-label="סגירה" onClick={onClose}><X size={22} /></button><div className="form-title">כרטיס עובד בארכיון</div></div>
    <div className="body">
      <div style={{ fontWeight: 800, fontSize: 18 }}>{worker.name}</div>
      <div style={{ marginTop: 10, marginBottom: 8 }}>
        <Row k="תפקיד" v={ROLE_LABEL[worker.role] || worker.role} />
        <Row k="מספר עובד" v={worker.workerNo || "—"} />
        <Row k="מחלקה" v={worker.dept || "—"} />
        {worker.supplier ? <Row k="קבלן" v={worker.supplier} /> : null}
        <Row k="נסגר במערכת" v={worker.exitAt ? fmtDate(worker.exitAt) : "—"} />
        <Row k="פריטים שהונפקו" v={issued.length} />
        {owed > 0 ? <Row k="חוב שנותר" v={ils(owed)} /> : null}
      </div>
      <SectionTitle><PackageCheck size={15} /> היסטוריית ציוד</SectionTitle>
      {recs.length === 0 ? <Empty text="לא הונפק ציוד" Icon={PackageCheck} /> : <div className="task-list">{recs.map((x) => <div key={x.id} className="task-row" style={{ borderInlineStartColor: x.origin === "clawback" ? "#B45309" : x.origin === "return" ? "#0D9488" : "var(--muted)", cursor: "default" }}><div className="task-row-main"><div className="task-row-t">{x.itemName}{x.size && x.size !== "אחיד" ? ` · ${x.size}` : ""}{x.qty > 1 ? ` ×${x.qty}` : ""}</div><div className="task-row-sub">{ppeCatLabel(x.category)} · {typeLabel(x)} · {fmtDate(x.at)}</div></div><div className="task-row-side"><span className="task-due" style={{ fontWeight: 700, color: x.workerCharge > 0 ? "#B45309" : "#0D9488" }}>{x.workerCharge > 0 ? ils(x.workerCharge) : (x.origin === "return" ? "הוחזר" : "חינם")}</span></div></div>)}</div>}
      {onRestore && <button className="btn-primary full" style={{ marginTop: 14 }} onClick={() => onRestore(worker)}>שחזור עובד — חזרה לעבודה (ללא ביגוד)</button>}
      <div className="hint" style={{ marginTop: 6 }}>שחזור מחזיר את העובד לרשימה הפעילה עם מספר העובד וההיסטוריה, ומאפס את זכאות הביגוד — הוא מתחיל «ללא ביגוד» כעובד חדש. הרישומים הקודמים נשמרים בכרטיס זה.</div>
      {onDelete && <ConfirmBtn className="btn-danger full" style={{ marginTop: 12 }} label="מחיקה סופית מהארכיון" onConfirm={() => onDelete(worker)} />}
      {onDelete && <div className="hint" style={{ marginTop: 6 }}>מחיקה סופית מיועדת רק לרשומה שנפתחה בטעות. היסטוריית ציוד ויומן שנשמרו בנפרד לא נמחקים כאן.</div>}
      <div style={{ height: 24 }} />
    </div></div>);
}

function PpeMyView({ ppe, items, norms, session, reqs, savePpeReq, config, language = DEFAULT_LANGUAGE }) {
  const t = (key, vars) => uiText(language, key, vars);
  const [signing, setSigning] = useState(null);
  const [wsig, setWsig] = useState("");
  const [rejMode, setRejMode] = useState(false);
  const [rejReason, setRejReason] = useState("");
  const [signErr, setSignErr] = useState("");
  const toSign = (reqs || []).filter((r) => r.workerId === session.id && r.status === "worker_sign").sort((a, b) => b.at - a.at);
  const reset = (session && session.ppeResetAt) || 0;
  const mine = (ppe || []).filter((x) => x.workerId === session.id && x.at >= reset);
  const received = mine.filter((x) => ppeIsIssue(x)).sort((a, b) => b.at - a.at);
  const owed = mine.reduce((s, x) => s + (x.workerCharge || 0), 0);
  const myDept = ppeWorkerDept(session); const myNorms = (norms || []).filter((n) => n.dept === myDept && n.active !== false);
  const have = new Set(received.map((x) => x.itemId));
  const missing = myNorms.filter((n) => !have.has(n.itemId)).map((n) => (items || []).find((it) => it.id === n.itemId)).filter(Boolean);
  return (<div style={{ padding: 16 }}>
    {toSign.length > 0 && <div style={{ marginBottom: 14 }}>{toSign.map((r) => <div key={r.id} style={{ background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: 12, padding: 14, marginBottom: 8 }}><div style={{ fontWeight: 800, marginBottom: 4 }}>מסמך הממתין לחתימתך</div><div style={{ fontSize: 13, color: "#92400E", marginBottom: 8 }}>{(r.lines || []).map((l) => `${l.itemName}${l.size && l.size !== "אחיד" ? ` (${l.size})` : ""}${l.qty > 1 ? ` ×${l.qty}` : ""}`).join(" · ")}</div><button className="btn-primary full" onClick={() => { setSigning(r); setWsig(""); setRejMode(false); setRejReason(""); setSignErr(""); }}><PenLine size={15} /> צפה וחתום</button></div>)}</div>}
    {signing && (() => { const w = { name: signing.workerName, workerNo: signing.workerNo, dept: signing.dept }; const dr = (signing.lines || []).map((l) => ({ itemName: l.itemName, size: l.size, qty: l.qty, category: l.category, workerCharge: l.workerCharge || 0, chargeReason: l.chargeReason || "", clawbackEligible: !!l.clawbackEligible, clawbackSnapshot: (typeof ppeClawbackTable === "function" ? ppeClawbackTable(config) : []) })); return <Overlay persistent onClose={() => setSigning(null)}><div className="ovl-inner"><div className="form-head"><button className="icon-btn" aria-label="סגירה" onClick={() => setSigning(null)}><X size={22} /></button><div className="form-title">חתימה על קבלת ציוד</div></div><div className="body"><div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)" }} dangerouslySetInnerHTML={{ __html: ppeDocBody(dr, w, config) }} />{rejMode ? (<div style={{ marginTop: 12 }}><label className="field"><span>סיבת הסירוב</span><textarea value={rejReason} onChange={(e) => setRejReason(e.target.value)} placeholder="לא חובה" /></label><div style={{ display: "flex", gap: 8 }}><button className="btn-ghost" onClick={() => setRejMode(false)}>חזרה</button><button className="btn-danger full" onClick={async () => { setSignErr(""); const ok = await savePpeReq({ ...signing, status: "rejected", rejectReason: rejReason.trim(), rejectedByWorker: true, decidedBy: { id: session.id, name: session.name }, decidedAt: Date.now() }); if (ok !== false) setSigning(null); else setSignErr(SAVE_FAILED_MESSAGE); }}>אישור סירוב</button></div></div>) : (<><SignaturePad value={wsig} onChange={setWsig} required={true} /><div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}><button className="btn-danger" onClick={() => setRejMode(true)}>סירוב לחתום</button><button className="btn-primary full" disabled={!wsig} onClick={async () => { if (!wsig) return; setSignErr(""); const ok = await savePpeReq({ ...signing, status: "pending", signature: wsig, workerSignedAt: Date.now(), awaitWorkerSign: false }); if (ok !== false) setSigning(null); else setSignErr(SAVE_FAILED_MESSAGE); }}><CheckCircle2 size={15} /> מאשר וחותם</button></div></>)}{signErr && <div className="err" style={{ marginTop: 8 }}>{signErr}</div>}<div style={{ height: 20 }} /></div></div></Overlay>; })()}
    <SectionTitle><PackageCheck size={15} /> {t("ppe.myEquipment")}</SectionTitle>
    {received.length === 0 ? <Empty text={t("ppe.noneIssued")} Icon={PackageCheck} /> : <div className="task-list">{received.map((x) => <div key={x.id} className="task-row" style={{ borderInlineStartColor: "#0D9488" }}><div className="task-row-main"><div className="task-row-t">{x.itemName}{x.size && x.size !== "אחיד" ? ` · ${x.size}` : ""}{x.qty > 1 ? ` ×${x.qty}` : ""}</div><div className="task-row-sub">{ppeCatLabel(x.category)} · {fmtDate(x.at)}</div></div><div className="task-row-side"><span className="task-due" style={{ fontWeight: 700, color: x.workerCharge > 0 ? "#B45309" : "#0D9488" }}>{x.workerCharge > 0 ? ils(x.workerCharge) : t("ppe.free")}</span></div></div>)}</div>}
    {owed > 0 && <div className="row-between" style={{ marginTop: 10, padding: "10px 12px", background: "var(--surface-2)", borderRadius: 10, fontWeight: 700 }}><span>{t("ppe.totalCharge")}</span><span style={{ color: "#B45309" }}>{ils(owed)}</span></div>}
    {missing.length > 0 && <div style={{ marginTop: 16 }}><SectionTitle>{t("ppe.unusedEntitlement")}</SectionTitle><div className="chips">{missing.map((it) => <span key={it.id} className="chip">{it.name}</span>)}</div></div>}
    <div style={{ height: 24 }} />
  </div>);
}

function PpeDashboard(props) {
  return (
    <Suspense fallback={<div className="note">טוען לוח ביגוד…</div>}>
      <PpeDashboardLazy
        {...props}
        ui={{
          Empty,
          SectionTitle,
          countLabel,
          ils,
          ppeCatIcon,
          ppeCatLabel,
          ppeIsIssue,
          ppeIsUpgrade,
          ppeLow,
          ppeLowSize,
          ppeMinOf,
          ppeMinTotal,
          ppeNetDeficits,
          ppeSizes,
          ppeStockOf,
          ppeTotalStock,
          szLbl
        }}
      />
    </Suspense>
  );
}

const ppeIssueRecs = async (recs, items, savePpeItem, savePpe) => {
  const arr = Array.isArray(recs) ? recs : [recs];
  const delta = {};
  arr.forEach((r) => { const sgn = r.origin === "return" ? 1 : (ppeIsIssue(r) ? -1 : 0); if (!sgn) return; delta[r.itemId] = delta[r.itemId] || {}; delta[r.itemId][r.size] = (delta[r.itemId][r.size] || 0) + sgn * (r.qty || 1); });
  for (const itemId of Object.keys(delta)) { const it = (items || []).find((x) => x.id === itemId); if (it) { const sb = { ...(it.stockBySize || {}) }; Object.entries(delta[itemId]).forEach(([sz, d]) => { sb[sz] = Math.max(0, (sb[sz] || 0) + d); }); if (await savePpeItem({ ...it, stockBySize: sb }) === false) return false; } }
  for (const r of arr) if (await savePpe(r) === false) return false;
  return true;
};

function PpeRequester({ ppe, items, norms, reqs, users, config, session, saveUser, savePpeReq, delPpeReq, deptScope }) {
  const [form, setForm] = useState(false);
  const mine = (reqs || []).filter((r) => r.by && r.by.id === session.id).sort((a, b) => b.at - a.at);
  const pend = mine.filter(ppeRequestNeedsAction);
  const done = mine.filter((r) => !ppeRequestNeedsAction(r));
  const submit = async (recs) => {
    const arr = Array.isArray(recs) ? recs : [recs];
    if (!arr.length) return;
    const r0 = arr[0];
    const req = { id: uid(), status: (r0.awaitWorkerSign ? "worker_sign" : "pending"), awaitWorkerSign: !!r0.awaitWorkerSign, workerId: r0.workerId, workerName: r0.workerName, workerNo: r0.workerNo || "", dept: r0.dept || "", lines: arr.map((r) => ({ itemId: r.itemId, itemName: r.itemName, category: r.category, size: r.size, qty: r.qty, workerCharge: r.workerCharge || 0, chargeReason: r.chargeReason || "", clawbackEligible: !!r.clawbackEligible, unitCost: r.unitCost || 0, retPrev: !!r.retPrev, returnRequested: !!r.returnRequested })), note: (r0.note || "").trim(), signature: r0.signature || "", by: { id: session.id, name: session.name }, at: Date.now() };
    if (await savePpeReq(req) !== false) setForm(false);
  };
  const chip = (r) => r.status === "approved" ? <span className="badge sm" style={{ background: "#DCFCE7", color: "#166534" }}>{ppeRequestStatusLabel(r.status)}</span> : r.status === "rejected" ? <span className="badge sm" style={{ background: "#FEE2E2", color: "#B91C1C" }}>{ppeRequestStatusLabel(r.status)}</span> : r.status === "worker_sign" ? <span className="badge sm" style={{ background: "#FEF9C3", color: "#854D0E" }}>{ppeRequestStatusLabel(r.status)}</span> : <span className="badge sm" style={{ background: "#FEF3C7", color: "#92400E" }}>{ppeRequestStatusLabel(r.status)}</span>;
  const lineTxt = ppeRequestLineSummary;
  const Card = ({ r }) => <div className="task-row" style={{ borderInlineStartColor: r.status === "approved" ? "#0D9488" : r.status === "rejected" ? "#DC2626" : "#D97706", cursor: "default" }}>
    <div className="task-row-main"><div className="task-row-t">{r.workerName}{r.workerNo ? ` · מס׳ ${r.workerNo}` : ""}</div><div className="task-row-sub">{lineTxt(r)}</div>{r.status === "rejected" && r.rejectReason && <div className="task-row-sub" style={{ color: "#B91C1C" }}>סיבת דחייה: {r.rejectReason}</div>}</div>
    <div className="task-row-side"><span className="task-due">{fmtDate(r.at)}</span>{chip(r)}{ppeRequestNeedsAction(r) && <button className="btn-ghost sm" onClick={() => delPpeReq(r.id)}>ביטול</button>}</div>
  </div>;
  return (<>
    <div className="row-between" style={{ marginBottom: 10 }}><SectionTitle><Shirt size={15} /> בקשות הנפקת ביגוד</SectionTitle><button className="btn-primary sm" onClick={() => setForm(true)}><Plus size={15} /> שלח בקשה</button></div>
    <div className="hint" style={{ marginBottom: 10 }}>בחרו עובד מהמחלקות שלכם ואת הפריטים הדרושים. הבקשה תישלח למנהל הציוד/HR לאישור והנפקה. ניפוק מהמלאי מתבצע רק לאחר אישור.</div>
    {pend.length > 0 && <><SectionTitle>ממתינות לאישור ({pend.length})</SectionTitle><div className="task-list">{pend.map((r) => <Card key={r.id} r={r} />)}</div></>}
    {done.length > 0 && <div style={{ marginTop: 14 }}><SectionTitle>היסטוריה</SectionTitle><div className="task-list">{done.slice(0, 20).map((r) => <Card key={r.id} r={r} />)}</div></div>}
    {mine.length === 0 && <Empty text="טרם נשלחו בקשות" Icon={Shirt} sub="לחצו «שלח בקשה» כדי לבקש ניפוק לעובד" />}
    {form && <Overlay persistent onClose={() => setForm(false)}><PpeIssueForm users={users} items={(items || []).filter((x) => x.active !== false)} norms={norms} ppe={ppe} config={config} session={session} saveUser={saveUser} deptScope={deptScope} onCancel={() => setForm(false)} onIssue={submit} submitLabel="שלח בקשה" title="בקשת הנפקת ציוד" requester={true} /></Overlay>}
  </>);
}

function PpeRequests({ ppe, reqs, items, norms, users, config, session, savePpe, delPpe, savePpeItem, saveUser, savePpeReq, delPpeReq, compact }) {
  const [approve, setApprove] = useState(null);
  const [rejId, setRejId] = useState(null);
  const [reason, setReason] = useState("");
  const [showDone, setShowDone] = useState(false);
  const all = (reqs || []).slice();
  const pend = all.filter(ppeRequestNeedsAction).sort((a, b) => a.at - b.at);
  const done = all.filter((r) => !ppeRequestNeedsAction(r)).sort((a, b) => (b.decidedAt || b.at) - (a.decidedAt || a.at));
  const onApprove = async (recs) => {
    const arr = (Array.isArray(recs) ? recs : [recs]).map((x) => ({ ...x, initiatedByName: (approve && approve.by && approve.by.name) || x.initiatedByName || "", initiatedAt: (approve && approve.at) || x.initiatedAt || Date.now() }));
    if (await ppeIssueRecs(arr, items, savePpeItem, savePpe) === false) return false;
    const r = approve;
    if (r && await savePpeReq({ ...r, status: "approved", decidedBy: { id: session.id, name: session.name }, decidedAt: Date.now(), issueIds: arr.map((x) => x.id) }) === false) return false;
    setApprove(null);
    return true;
  };
  const doReject = async (r) => {
    if (await savePpeReq({ ...r, status: "rejected", rejectReason: reason.trim(), decidedBy: { id: session.id, name: session.name }, decidedAt: Date.now() }) !== false) {
      setRejId(null); setReason("");
    }
  };
  const lineTxt = ppeRequestLineSummary;
  const lineCount = (r) => (r.lines || []).length;
  const qtyCount = (r) => (r.lines || []).reduce((sum, line) => sum + Number(line.qty || 0), 0);
  const rejectOpen = (r) => rejId === r.id;
  return (<>
    <div className="row-between" style={{ marginBottom: 10 }}><SectionTitle><ClipboardList size={15} /> בקשות הנפקה</SectionTitle></div>
    {pend.length === 0 ? <Empty text="אין בקשות ממתינות" Icon={ClipboardList} sub="בקשות מהמנהלים יופיעו כאן לאישור" /> : <div className="ppe-request-list">{pend.map((r) => <div key={r.id} className={"ppe-request-row" + (rejectOpen(r) ? " rejecting" : "")}>
      <div className="ppe-req-worker">
        <span className="ppe-req-ic"><Shirt size={16} /></span>
        <div className="ppe-req-text">
          <div className="ppe-req-title">{r.workerName || "עובד"}</div>
          <div className="ppe-req-meta">{r.workerNo ? <><span>מס׳</span> <span className="ltr-inline">{r.workerNo}</span></> : "ללא מספר"}{r.dept ? <><span className="sep">·</span><span>{r.dept}</span></> : null}</div>
        </div>
      </div>
      <div className="ppe-req-main">
        <div className="ppe-req-title">{lineTxt(r) || "בקשת ציוד"}</div>
        <div className="ppe-req-meta">{countLabel(lineCount(r), "שורה", "שורות")} · {countLabel(qtyCount(r), "יחידה", "יחידות")}{r.note ? <><span className="sep">·</span><span className="ppe-req-note">{r.note}</span></> : null}</div>
      </div>
      <div className="ppe-req-by">
        <span className="ppe-req-kicker">מאת</span>
        <span>{(r.by && r.by.name) || "—"}</span>
        <span className="ppe-req-date">{fmtDate(r.at)}</span>
      </div>
      <div className="ppe-req-status"><span className={"badge sm" + (r.status === "worker_sign" ? " warn" : "")}>{ppeRequestStatusLabel(r.status)}</span></div>
      {!rejectOpen(r) ? <div className="ppe-req-actions">
        <button className="icon-btn sm approve" onClick={() => setApprove(r)} title="אישור והנפקה" aria-label={`אישור והנפקה עבור ${r.workerName || "עובד"}`}><Check size={15} /></button>
        <button className="icon-btn sm danger" onClick={() => { setRejId(r.id); setReason(""); }} title="דחייה" aria-label={`דחיית בקשה עבור ${r.workerName || "עובד"}`}><X size={15} /></button>
      </div> : <div className="ppe-req-reject">
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="סיבת דחייה" autoFocus />
        <button className="icon-btn sm danger fill" onClick={() => doReject(r)} title="אישור דחייה" aria-label={`אישור דחיית בקשה עבור ${r.workerName || "עובד"}`}><X size={15} /></button>
        <button className="icon-btn sm" onClick={() => { setRejId(null); setReason(""); }} title="ביטול דחייה" aria-label="ביטול דחייה"><RefreshCw size={14} /></button>
      </div>}
    </div>)}</div>}
    {!compact && done.length > 0 && <div style={{ marginTop: 16 }}><button className="btn-ghost sm" onClick={() => setShowDone((v) => !v)}>{showDone ? "הסתר" : "הצג"} בקשות מטופלות ({done.length})</button>{showDone && <div className="task-list" style={{ marginTop: 8 }}>{done.slice(0, 30).map((r) => <div key={r.id} className="task-row" style={{ borderInlineStartColor: r.status === "approved" ? "#0D9488" : "#DC2626", cursor: "default" }}><div className="task-row-main"><div className="task-row-t">{r.workerName} · {lineTxt(r)}</div><div className="task-row-sub">{r.status === "approved" ? "אושרה והונפקה" : `נדחתה${r.rejectReason ? ` — ${r.rejectReason}` : ""}`} · {(r.decidedBy && r.decidedBy.name) || ""} · {fmtDate(r.decidedAt || r.at)}</div></div></div>)}</div>}</div>}
    {approve && <Overlay persistent onClose={() => setApprove(null)}><PpeIssueForm users={users} items={items} norms={norms} ppe={ppe} config={config} session={session} saveUser={saveUser} deptScope={null} initial={{ workerId: approve.workerId, lines: approve.lines.map((l) => ({ itemId: l.itemId, size: l.size, qty: l.qty, workerCharge: l.workerCharge || 0, retPrev: !!l.retPrev })), note: approve.note, signature: approve.signature }} lockWorker={true} onCancel={() => setApprove(null)} onIssue={onApprove} submitLabel="אישור והנפקה" title="אישור בקשה והנפקה" /></Overlay>}
  </>);
}

const ppeOrderUi = () => ({
  ConfirmBtn,
  DateInput,
  Empty,
  Overlay,
  SAVE_FAILED_MESSAGE,
  SectionTitle,
  XLSX,
  countLabel,
  downloadXlsx,
  fmtDate,
  ppeCatLabel,
  ppeLowSize,
  ppeMaxOf,
  ppeMinOf,
  ppeNetDeficits,
  ppeSizes,
  ppeSmartReorderLines,
  ppeStockOf,
  rowsSafe,
  supplierHasPpeScope,
  supplierTypeFromMeta,
  supMeta,
  szLbl,
  uid
});

function PpeOrderForm(props) {
  return (
    <Suspense fallback={<div className="note">טוען טופס הזמנה…</div>}>
      <PpeOrderFormLazy {...props} ui={ppeOrderUi()} />
    </Suspense>
  );
}

function PpeOrders(props) {
  return (
    <Suspense fallback={<div className="note">טוען הזמנות רכש…</div>}>
      <PpeOrdersLazy {...props} ui={ppeOrderUi()} />
    </Suspense>
  );
}

const monthRange = (y, m) => [new Date(y, m, 1).getTime(), new Date(y, m + 1, 1).getTime()];
const monthLabelOf = (y, m) => HE_MONTHS[m] + " " + y;
function MonthPicker({ y, m, onChange }) {
  const [open, setOpen] = useState(false);
  const [vy, setVy] = useState(y);
  useEffect(() => { if (open) setVy(y); }, [open]);
  const go = (dm) => { let Y = y, M = m + dm; if (M < 0) { M = 11; Y--; } else if (M > 11) { M = 0; Y++; } onChange(Y, M); };
  const _now = new Date(); const isFuture = (Y, M) => (Y > _now.getFullYear() || (Y === _now.getFullYear() && M > _now.getMonth()));
  return (<div style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 2 }}>
    <button className="icon-btn" title="חודש הבא" aria-label="חודש הבא" disabled={isFuture(y, m + 1)} onClick={() => { if (!isFuture(y, m + 1)) go(1); }}><ChevronLeft size={18} /></button>
    <button className="btn-ghost sm" title="בחירת חודש" aria-label="בחירת חודש" onClick={() => setOpen((o) => !o)} style={{ minWidth: 112, fontWeight: 700, justifyContent: "center" }}>{HE_MONTHS[m]} {y}</button>
    <button className="icon-btn" title="חודש קודם" aria-label="חודש קודם" onClick={() => go(-1)}><ChevronLeft size={18} style={{ transform: "scaleX(-1)" }} /></button>
    {open && <><div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 49 }} /><div style={{ position: "absolute", top: "115%", insetInlineEnd: 0, zIndex: 50, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.18)", width: 232 }}>
      <div className="row-between" style={{ marginBottom: 8 }}><button className="icon-btn" title="שנה הבאה" aria-label="שנה הבאה" disabled={vy >= _now.getFullYear()} onClick={() => { if (vy < _now.getFullYear()) setVy(vy + 1); }}><ChevronLeft size={16} /></button><b>{vy}</b><button className="icon-btn" title="שנה קודמת" aria-label="שנה קודמת" onClick={() => setVy(vy - 1)}><ChevronLeft size={16} style={{ transform: "scaleX(-1)" }} /></button></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>{HE_MONTHS.map((nm, i) => { const fut = isFuture(vy, i); return <button key={i} className={"chip" + (vy === y && i === m ? " on" : "")} disabled={fut} style={fut ? { opacity: 0.4 } : {}} onClick={() => { if (!fut) { onChange(vy, i); setOpen(false); } }}>{nm.slice(0, 4)}</button>; })}</div>
    </div></>}
  </div>);
}

function PpeHub(p) {
  const { ppe, ppeItems, ppeNorms, ppeReqs, ppeOrders, users, config, session, ppeNav, savePpe, delPpe, savePpeItem, delPpeItem, saveNorm, delNorm, savePpeReq, delPpeReq, savePpeOrder, delPpeOrder, saveUser, saveConfig, onAskAI } = p;
  const lvl = permLevel(session, "ppe");
  const isFull = permRank(lvl) >= permRank("full");
  const deptScope = isFull ? null : (userDepts(session).length ? userDepts(session) : ["__none__"]);
  const pendN = (ppeReqs || []).filter(ppeRequestNeedsAction).length;
  const ordersN = (ppeOrders || []).filter((o) => o.status === "draft" || o.status === "sent").length;
  const [sub, setSub] = useState("dash");
  const [orderForm, setOrderForm] = useState(null);
  const _nd = new Date();
  const [mY, setMY] = useState(_nd.getFullYear());
  const [mM, setMM] = useState(_nd.getMonth());
  const [mStart, mEnd] = monthRange(mY, mM);
  const mLabel = monthLabelOf(mY, mM);
  const openOrder = () => { const activeItems = (ppeItems || []).filter((x) => x.active !== false); if (!activeItems.length) { setSub("catalog"); return; } setOrderForm({ lines: [] }); };
  useEffect(() => { if (["dash", "log", "catalog", "settings"].includes(ppeNav?.sub)) setSub(ppeNav.sub); }, [ppeNav?._t]);
  if (!canRequestPpe(session)) return <div className="note">אין הרשאה לבקשת או ניהול ביגוד עובדים.</div>;
  if (!isFull) return <PpeRequester ppe={ppe} items={ppeItems} norms={ppeNorms} reqs={ppeReqs} users={users} config={config} session={session} saveUser={saveUser} savePpeReq={savePpeReq} delPpeReq={delPpeReq} deptScope={deptScope} />;
  const tab = sub;
  return (<>
    <div className="seg-tabs" style={{ flexWrap: "wrap", marginBottom: 14 }}><button className={sub === "dash" ? "on" : ""} onClick={() => setSub("dash")}>לוח מלאי</button><button className={sub === "log" ? "on" : ""} onClick={() => setSub("log")}>תנועות מלאי</button><button className={sub === "catalog" ? "on" : ""} onClick={() => setSub("catalog")}>קטלוג</button><button className={sub === "settings" ? "on" : ""} onClick={() => setSub("settings")}>הגדרות</button></div>
    {(tab === "dash" || tab === "log") && <div className="row-between" style={{ marginBottom: 10, alignItems: "center" }}><span className="hint">נתונים לחודש</span><MonthPicker y={mY} m={mM} onChange={(Y, M) => { setMY(Y); setMM(M); }} /></div>}
    {tab === "dash" ? <div className="ppe-dash-flow">{pendN > 0 && <section className="ppe-dash-section"><PpeRequests ppe={ppe} reqs={ppeReqs} items={ppeItems} norms={ppeNorms} users={users} config={config} session={session} savePpe={savePpe} delPpe={delPpe} savePpeItem={savePpeItem} saveUser={saveUser} savePpeReq={savePpeReq} delPpeReq={delPpeReq} compact /></section>}<section className="ppe-dash-section"><PpeDashboard items={ppeItems} ppe={ppe} config={config} pend={pendN} onPend={() => window.scrollTo({ top: 0, behavior: "smooth" })} onCreateOrder={openOrder} onCatalog={() => setSub("catalog")} onMovements={() => setSub("log")} mStart={mStart} mEnd={mEnd} mLabel={mLabel} orders={ppeOrders} onAskAI={onAskAI} /></section></div>
      : tab === "catalog" ? <PpeCatalog items={ppeItems} ppe={ppe} session={session} savePpe={savePpe} onSave={savePpeItem} onDelete={delPpeItem} />
      : tab === "settings" ? <><PpeNorms items={ppeItems} norms={ppeNorms} config={config} onSave={saveNorm} onDelete={delNorm} /><div style={{ height: 18 }} /><PpeClawbackSettings config={config} onSave={saveConfig} /><div style={{ height: 18 }} /><PpeSignTemplate config={config} onSave={saveConfig} /></>
      : <PpeLog ppe={ppe} items={ppeItems} norms={ppeNorms} users={users} config={config} session={session} deptScope={deptScope} canIssue={true} canExit={true} reqMode={false} mStart={mStart} mEnd={mEnd} mLabel={mLabel} orders={ppeOrders} savePpeOrder={savePpeOrder} delPpeOrder={delPpeOrder} savePpe={savePpe} delPpe={delPpe} savePpeItem={savePpeItem} saveUser={saveUser} />}
    {orderForm && <Overlay persistent onClose={() => setOrderForm(null)}><PpeOrderForm order={orderForm} items={ppeItems} orders={ppeOrders} session={session} config={config} onCancel={() => setOrderForm(null)} onSave={async (o) => { const ok = await savePpeOrder(o); if (ok !== false) setOrderForm(null); return ok; }} /></Overlay>}
  </>);
}

function biOverviewUi() {
  return {
    AlertTriangle,
    Bar,
    BarChart3,
    Building2,
    CalendarClock,
    CheckCircle2,
    ChevronLeft,
    ClipboardList,
    Clock,
    FileText,
    Gauge,
    Kpi,
    ListChecks,
    SectionTitle,
    Shirt,
    Sparkles,
    Truck,
    Wrench,
    biDepartmentRiskRows,
    biPeriodRange,
    biScopeForSession,
    biTicketHeatmapRows,
    ballHolder,
    catOf,
    countLabel,
    dayCompliance,
    daysLeft,
    docStatus,
    downtimeMs,
    fmtDate,
    fmtDur,
    fmtTime,
    ils,
    isCleaningRoundActionableStatus,
    isOpen,
    isOverdue,
    lifecycleOwnerLabel,
    needsHandler,
    normalizedTicketLifecycleStages,
    ppeIsIssue,
    ppeLow,
    ppeRequestNeedsAction,
    ppeRequestStatusLabel,
    recurringFacilityZoneRows,
    stOf,
    taskOpen,
    taskOverdue,
    ticketLifecycleWaitReasonStats,
    ticketNo,
    ticketWaitReasonLabel,
    unitLabel,
    uName,
    waitReasonLabel,
    waitReasonLifecycleMeta,
    zoneTodayStatuses
  };
}

function BIOverview(props) {
  return (
    <Suspense fallback={<div className="note">טוען BI…</div>}>
      <BIOverviewLazy {...props} ui={biOverviewUi()} />
    </Suspense>
  );
}
function ticketMatchesBIFocus(ticket, nav = {}, { fleet = [], zones = [], config = {} } = {}) {
  const focus = nav.focus || {};
  const currentTrack = trackOf(ticket);
  if (nav.track && nav.track !== "all" && currentTrack !== nav.track) return false;
  if (focus.forkliftId && ticket.forkliftId !== focus.forkliftId) return false;
  if (Array.isArray(focus.statuses) && focus.statuses.length && !focus.statuses.includes(ticket.status)) return false;
  if (focus.supplier && (ticket.closure?.costSupplier || "") !== focus.supplier) return false;
  if (focus.waitReason && ticket.waitingReason !== focus.waitReason) return false;
  if (focus.lifecycleKey && !ticketHasLifecycleStage(ticket, focus.lifecycleKey, { isOpen })) return false;
  if (focus.heatmapMetric && !ticketMatchesBiHeatmapMetric(ticket, focus.heatmapMetric, { isOpenTicket: isOpen, isOverdueTicket: (item) => ticketMissedSla(item, config) })) return false;
  if (focus.assignee && ticket.assignee !== focus.assignee) return false;
  if (focus.minAgeDays != null || focus.maxAgeDays != null) {
    const ageDays = Math.max(0, (Date.now() - (ticket.createdAt || Date.now())) / 86400000);
    if (focus.minAgeDays != null && ageDays < Number(focus.minAgeDays)) return false;
    if (focus.maxAgeDays != null && ageDays >= Number(focus.maxAgeDays)) return false;
  }
  if (focus.minIdleDays != null || focus.maxIdleDays != null) {
    const idleDays = Math.max(0, (Date.now() - (ticket.updatedAt || ticket.createdAt || Date.now())) / 86400000);
    if (focus.minIdleDays != null && idleDays < Number(focus.minIdleDays)) return false;
    if (focus.maxIdleDays != null && idleDays >= Number(focus.maxIdleDays)) return false;
  }
  if (focus.overdue && !ticketMissedSla(ticket, config)) return false;
  if (focus.criticalEscalated && !isCriticalEscalated(ticket, config)) return false;
  if (focus.activeCriticalTransport && !(currentTrack === "transport" && ticket.downtimeType === "critical" && !isCriticalEscalated(ticket, config))) return false;
  if (focus.assetKey && (ticket.asset || "") !== focus.assetKey) return false;
  if (focus.zoneKey && (ticket.zone || "") !== focus.zoneKey) return false;
  if (focus.categoryId && catOf(ticket).id !== focus.categoryId) return false;
  if (!biFocusDepartmentMatches(ticket, focus, { fleet, zones })) return false;
  return true;
}

function AdminApp(p) {
  const { session, config, fleet, tickets, pm, presence, users, zones, rounds, complaints, absences, fileComplaint, resolveComplaint, saveTicket, onLogout, theme, toggleTheme } = p;
  const [tab, setTab] = useState("bi"), [overlay, setOverlay] = useState(null), [showNotif, setShowNotif] = useState(false), [showAI, setShowAI] = useState(false), [aiDraft, setAiDraft] = useState(null), [tFilter, setTFilter] = useState(null), [assetNav, setAssetNav] = useState(null), [ppeNav, setPpeNav] = useState(null), [taskNav, setTaskNav] = useState(null);
  const notif = useNotifications(session, tickets, pm, fleet, config, presence, zones, rounds, complaints, users, absences, p.tasks, p.meetings, p.ppeReqs, p.ppeItems, p.ppeOrders);
  const openTicket = (id) => setOverlay({ type: "detail", id });
  const goFilter = (f) => { setTFilter({ ...f, _t: Date.now() }); setTab("tickets"); };
  const clearTicketFilter = () => setTFilter(null);
  const goAsset = (nav) => { setAssetNav({ ...nav, _t: Date.now() }); setTab("assets"); };
  const goPpe = (nav = {}) => { setPpeNav({ ...nav, _t: Date.now() }); setTab("ppe"); };
  const askAI = (draft) => { setAiDraft(draft || null); setShowAI(true); };
  const isAdminRole = session.role === "admin";
  const mayViewUsers = canViewUsers(session);
  const mayManageUsers = canManageUsers(session);
  const mayViewAssets = canFleetDocs(session) || canFleetTickets(session) || isAdminRole;
  const mayViewSuppliers = canViewSuppliers(session);
  const mayManageSuppliers = canManageSuppliers(session);
  const mayManageSettings = canManageSettings(session);
  const mayViewAudit = canViewAudit(session);
  const blockedTab = {
    assets: !mayViewAssets,
    tasks: !isAdminRole,
    ppe: !isAdminRole,
    cleaning: !isAdminRole,
    team: !mayViewUsers,
    suppliers: !mayViewSuppliers,
    activity: !mayViewAudit,
    settings: !mayManageSettings
  };
  const activeTab = blockedTab[tab] ? "bi" : tab;
  const nav = [
    { id: "bi", Icon: Gauge, label: "BI" },
    { id: "tickets", Icon: ListChecks, label: "קריאות" },
    isAdminRole ? { id: "tasks", Icon: ClipboardList, label: "מטלות" } : null,
    isAdminRole ? { id: "ppe", Icon: Shirt, label: "ביגוד עובדים" } : null,
    mayViewAssets ? { id: "assets", Icon: Truck, label: "כלי שינוע" } : null,
    isAdminRole ? { id: "cleaning", Icon: Sparkles, label: "בקרת ניקיון" } : null,
    mayViewUsers ? { id: "team", Icon: Users, label: "צוות ומשתמשים" } : null,
    mayViewSuppliers ? { id: "suppliers", Icon: Building2, label: "ספקים / קבלנים" } : null,
    mayViewAudit ? { id: "activity", Icon: Clock, label: "יומן פעילות" } : null,
    mayManageSettings ? { id: "settings", Icon: Settings, label: "הגדרות" } : null,
  ].filter(Boolean).map((n) => ({ ...n, active: activeTab === n.id, onClick: () => { if (n.id === "tickets") clearTicketFilter(); setTab(n.id); } }));
  return (
    <div className="app-root">
      <Sidebar session={session} config={config} onLogout={onLogout} notif={notif} onBell={() => setShowNotif((v) => !v)} nav={nav} rolePreview={p.rolePreview} theme={theme} toggleTheme={toggleTheme} onReportIssue={p.onReportIssue} onProfile={p.onProfile} primary={{ label: "פתיחת קריאה", onClick: () => setOverlay({ type: "new" }) }} />
      <div className="main-col">
        <TopBar title="CMMS CDSL" subtitle={session.name} onLogout={onLogout} notif={notif} onBell={() => setShowNotif((v) => !v)} rolePreview={p.rolePreview} theme={theme} toggleTheme={toggleTheme} onProfile={p.onProfile} onReportIssue={p.onReportIssue} demoActive={p.demoActive} />
        <div className="content with-nav">
          {activeTab === "bi" && <BIOverview {...p} onOpenTicket={openTicket} onGoTickets={(focus) => goFilter(focus || {})} onGoAssets={(nav) => goAsset(nav || {})} onGoCleaning={isAdminRole ? () => setTab("cleaning") : null} onGoPpe={isAdminRole ? () => setTab("ppe") : null} onGoTasks={isAdminRole ? (nav) => { setTaskNav(nav || null); setTab("tasks"); } : null} onAskAI={aiAssistantEnabled(config) ? askAI : null} />}
          {activeTab === "tickets" && <><div className="row-between" style={{ marginBottom: 12 }}><SectionTitle>קריאות</SectionTitle><button className="btn-primary sm" onClick={() => setOverlay({ type: "new" })}><Plus size={15} /> קריאה חדשה</button></div><AdminTickets tickets={tickets} fleet={fleet} users={users} zones={zones} config={config} onOpen={openTicket} initial={tFilter} onInitialConsumed={clearTicketFilter} /></>}
          {activeTab === "assets" && <AssetsHub {...p} assetNav={assetNav} onAskAI={aiAssistantEnabled(config) ? askAI : null} />}
          {activeTab === "tasks" && <ManageHub {...p} focusTaskId={taskNav} onTaskFocusConsumed={() => setTaskNav(null)} onAskAI={aiAssistantEnabled(config) ? askAI : null} />}
          {activeTab === "ppe" && <PpeHub {...p} ppeNav={ppeNav} onAskAI={aiAssistantEnabled(config) ? askAI : null} />}
          {activeTab === "cleaning" && <CleaningAdmin {...p} onAskAI={aiAssistantEnabled(config) ? askAI : null} />}
          {activeTab === "team" && <SettingsPanel {...p} only="users" canManageUsers={mayManageUsers} />}
          {activeTab === "activity" && <AuditLog session={session} tickets={tickets} fleet={fleet} config={config} rounds={rounds} onOpenTicket={openTicket} />}
          {activeTab === "suppliers" && <SuppliersPanel config={config} saveConfig={p.saveConfig} orders={p.ppeOrders} fleet={fleet} tickets={tickets} users={users} saveFleet={p.saveFleet} saveUser={p.saveUser} savePpeOrder={p.savePpeOrder} onOpenTicket={openTicket} onOpenFleet={(id) => goAsset({ tab: "fleet", fleetId: id })} canManage={mayManageSuppliers} onAskAI={aiAssistantEnabled(config) ? askAI : null} />}
          {activeTab === "settings" && <SettingsPanel {...p} />}
        </div>
      </div>
      <MobileBottomNav nav={nav} primaryIds={isAdminRole ? ["bi", "tickets", "tasks"] : ["bi", "tickets", "assets"]} />
      {aiAssistantEnabled(config) && <AIFab onClick={() => askAI(null)} />}
      {overlay?.type === "detail" && <Overlay onClose={() => setOverlay(null)}><TicketDetail {...p} ticket={tickets.find((x) => x.id === overlay.id)} onBack={() => setOverlay(null)} onOpenTicket={(id) => setOverlay({ type: "detail", id })} onRepeat={(pf) => setOverlay({ type: "new", prefill: pf })} onAskAI={aiAssistantEnabled(config) ? askAI : null} /></Overlay>}
      {overlay?.type === "new" && <Overlay persistent onClose={() => setOverlay(null)}><TicketForm {...p} prefill={overlay.prefill} onOpenTicket={(id) => setOverlay({ type: "detail", id })} onCancel={() => setOverlay(null)} onCreate={async (t) => { const ok = await saveTicket(t); if (ok !== false) setOverlay(null); return ok; }} /></Overlay>}
      {showNotif && <NotifPanel notif={notif} language={p.language} onClose={() => setShowNotif(false)} onOpen={(id) => { setShowNotif(false); setTab("tickets"); openTicket(id); }} onGo={(go, ev) => { setShowNotif(false); if (go === "pm") goAsset({ tab: "pm" }); else if (go === "fleet") goAsset({ tab: "fleet", fleetId: ev?.fleetId || null }); else if (go === "ppe") goPpe({ sub: ev?.ppeSub || "dash" }); else setTab(go === "cleaning" ? "cleaning" : go === "tasks" ? "tasks" : go === "team" ? "team" : "bi"); }} />}
      {showAI && <LazyAIPanel {...p} initialText={aiDraft?.text || ""} initialWorkflow={aiDraft?.workflow} openAiTicketDraft={(prefill) => { setShowAI(false); setAiDraft(null); setOverlay({ type: "new", prefill }); }} onClose={() => { setShowAI(false); setAiDraft(null); }} />}
      {notif.toast && <Toast t={notif.toast} onClose={notif.dismissToast} />}
    </div>
  );
}

/* ---------- Admin tickets ---------- */
function ReportView({ html, count, onClose }) {
  const ref = useRef(null);
  return (<Overlay onClose={onClose}><div className="rep-wrap"><div className="rep-head"><div className="rep-title">תצוגה מקדימה{count != null ? ` — ${count}` : ""}</div><div style={{ display: "flex", gap: 8 }}><button className="btn-ghost sm" onClick={() => { try { ref.current.contentWindow.focus(); ref.current.contentWindow.print(); } catch (e) {} }}><Printer size={14} /> הדפס</button><button className="icon-btn" aria-label="סגירה" onClick={onClose}><X size={20} /></button></div></div><iframe ref={ref} title="report" srcDoc={html} className="rep-frame" /></div></Overlay>);
}

const adminTicketsUi = () => ({
  CheckCircle2,
  Empty,
  FileSpreadsheet,
  ListChecks,
  PRIORITIES,
  Printer,
  ReportView,
  STATUSES,
  Search,
  SectionTitle,
  ShieldCheck,
  SlidersHorizontal,
  TicketCard,
  Truck,
  WEAR,
  Wrench,
  X,
  ballIn,
  catOf,
  countLabel,
  downloadXlsx,
  esc,
  fmtDate,
  fmtDur,
  isOpen,
  normalizedTicketLifecycleStages,
  prOf,
  rowsSafe,
  sortByImportance,
  stOf,
  ticketLifecycleMissedOperationalSla,
  ticketLifecycleSummary,
  ticketMatchesBIFocus,
  ticketNo,
  ticketWaitReasonLabel,
  unitDesc,
  unitTypeName,
  waitReasonLabel,
  waitReasonLifecycleMeta,
  XLSX
});

function AdminTickets(props) {
  return (
    <Suspense fallback={<div className="note">טוען רשימת קריאות…</div>}>
      <AdminTicketsLazy {...props} ui={adminTicketsUi()} />
    </Suspense>
  );
}

/* ============================================================ FLEET */

function Bar({ label, value, max, suffix, color, money, onClick }) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  const inner = (<><div className="bar-top"><span className="bar-lbl">{label}</span><span className="bar-val">{money ? ils(value) : value}{suffix || ""}</span></div><div className="bar-track"><div className="bar-fill" style={{ width: pct + "%", background: color || "var(--primary)" }} /></div></>);
  if (onClick) return <button className="bar-row bar-click" onClick={onClick}>{inner}<ChevronLeft size={14} className="bar-chev" /></button>;
  return <div className="bar-row">{inner}</div>;
}

// Аналитика по обращениям работников (нижний канал). dept=null → полная (админ); dept задан → срез по департаменту (менеджер, та же логика что в visibleTickets).
function WorkerReportsAnalytics({ tickets, dept = null, depts = null }) {
  const reports = useMemo(() => {
    let r = (tickets || []).filter(isWorkerReport);
    const ds = depts && depts.length ? depts : (dept != null ? [dept] : null);
    if (ds) r = r.filter((t) => ds.includes(t.reportedBy?.dept || ""));
    return r;
  }, [tickets, dept, depts]);
  const isTrans = (t) => t.track === "transport" || (!t.track && t.forkliftId);
  const total = reports.length;
  const pending = reports.filter((t) => t.status === "pending_manager").length;
  const rework = reports.filter((t) => t.status === "rework").length;
  const approved = reports.filter((t) => t.approvedAt);
  const rejected = reports.filter((t) => t.status === "cancelled" && t.rejectReason);
  const decided = approved.length + rejected.length;
  const approveRate = decided >= 3 ? Math.round((approved.length / decided) * 100) : null;
  const closed = approved.filter((t) => t.status === "done");
  const facCount = reports.filter((t) => !isTrans(t)).length;
  const transCount = reports.filter(isTrans).length;
  const byWorker = countBy(reports, (t) => t.reportedBy?.name);
  const workerArr = Object.entries(byWorker).sort((a, b) => b[1] - a[1]);
  const maxWorker = Math.max(1, ...workerArr.map(([, n]) => n));
  const reviewMs = [
    ...approved.map((t) => (t.approvedAt || t.updatedAt) - t.createdAt),
    ...rejected.map((t) => t.updatedAt - t.createdAt),
  ].filter((ms) => ms >= 0);
  const avgReview = reviewMs.length ? reviewMs.reduce((a, b) => a + b, 0) / reviewMs.length : 0;
  const byReason = countBy(rejected, (t) => t.rejectReason?.code);
  const reasonArr = Object.entries(byReason).sort((a, b) => b[1] - a[1]);
  const maxReason = Math.max(1, ...reasonArr.map(([, n]) => n));
  return (<>
    <SectionTitle><UserPlus size={15} color="#EA580C" /> דיווחי עובדים{dept ? ` · ${dept}` : ""}</SectionTitle>
    {total === 0 ? <div className="note">אין דיווחי עובדים{dept ? " במחלקה זו" : ""} עדיין.</div> : <>
      <div className="kpi-grid">
        <Kpi num={total} label="סה״כ דיווחים" color="#EA580C" small />
        <Kpi num={approved.length} label="אושרו" color="#16A34A" small />
        <Kpi num={rejected.length} label="נדחו" color="#DC2626" small />
        <Kpi num={approveRate !== null ? approveRate + "%" : "—"} label={approveRate !== null ? "שיעור אישור" : "שיעור אישור — אין מספיק נתונים"} color={approveRate === null ? "var(--muted)" : approveRate >= 60 ? "#16A34A" : "#EA580C"} small />
      </div>
      <div className="panel"><div className="row-stats">
        <div><div className="rs-num" style={{ color: "#CA8A04" }}>{pending}</div><div className="rs-lbl">ממתינים לבדיקה</div></div>
        <div><div className="rs-num" style={{ color: "#0891B2" }}>{rework}</div><div className="rs-lbl">הוחזרו לעובד</div></div>
        <div><div className="rs-num" style={{ color: "#16A34A" }}>{closed.length}</div><div className="rs-lbl">הגיעו לסגירה</div></div>
      </div></div>
      {avgReview > 0 && <div className="note" style={{ marginTop: 8 }}><Clock size={13} /> זמן בדיקה ממוצע אצל המנהל: <b>{fmtDur(avgReview)}</b></div>}
      <SectionTitle>פילוח לפי מסלול</SectionTitle>
      <div className="panel">
        <Bar label="מבנה" value={facCount} max={Math.max(facCount, transCount, 1)} color={TRACKS.facility.color} />
        <Bar label="שינוע" value={transCount} max={Math.max(facCount, transCount, 1)} color={TRACKS.transport.color} />
      </div>
      <SectionTitle>עובדים מדווחים מובילים</SectionTitle>
      {workerArr.length === 0 ? <div className="note">—</div> : <div className="panel">{workerArr.slice(0, 8).map(([n, v]) => <Bar key={n} label={n} value={v} max={maxWorker} color="var(--primary)" />)}</div>}
      {reasonArr.length > 0 && <><SectionTitle>סיבות דחייה</SectionTitle><div className="panel">{reasonArr.map(([code, n]) => <Bar key={code} label={rejectLabel(code)} value={n} max={maxReason} color="#DC2626" />)}</div></>}
    </>}
  </>);
}

/* ============================================================ SETTINGS */
function SuppliersPanel(props) {
  return <Suspense fallback={<div className="supplier-shell"><Empty text="טוען ספקים…" Icon={Building2} /></div>}>
    <SuppliersPanelLazy
      {...props}
      ui={{
        Empty, Overlay, SectionTitle, UserForm, catOf, countLabel, fmtDate, ils, isOpen, stOf,
        ticketNo, uid, unitDesc, unitNote
      }}
    />
  </Suspense>;
}

function settingsPanelUi() {
  return {
    AISettingsCard,
    AppIssuesSettings,
    ArchiveWorkerCard,
    BarChart3,
    Bell,
    BrandMark,
    Building2,
    CalendarClock,
    Check,
    Clock,
    ColorPaletteButton,
    ConfirmBtn,
    FileText,
    HardHat,
    Overlay,
    PackageCheck,
    PenLine,
    Plus,
    PpeExitSettlement,
    RefreshCw,
    Search,
    SectionTitle,
    ShieldAlert,
    ShieldCheck,
    Sparkles,
    Trash2,
    Truck,
    User,
    UserForm,
    UserPlus,
    Users,
    CATEGORIES,
    DRIVER_SHIFTS,
    DOWNTIME,
    HE_MONTHS,
    PRIORITIES,
    TRACKS,
    USER_PERMISSION_MODULES,
    WAIT_REASONS,
    DEFAULT_MANAGER_PERMS,
    ROLE_LABEL,
    analyzeBackupPayload,
    canFullSettings,
    canManageUsers,
    canManageWorkerAccess,
    canViewUsers,
    clampCleaningReminderMins,
    clampPmDailyCapacity,
    cleaningAreaName,
    countLabel,
    downloadBlob,
    findUserDuplicateGroups,
    fmtDate,
    fmtDateTimeShort,
    imageFileToSquareDataUrl,
    isActivationLinkRole,
    isPresenceOnline,
    isWorkerLike,
    normalizeAiSettings,
    presenceOf,
    productionAccessToken,
    shouldKeepWorkerFormOpenForActivationLink,
    userDepts,
    userHasLoginSecret,
    userPresenceStatusText,
    workerLoginStateText,
    workShiftsOf,
    zoneSort
  };
}

function SettingsPanel(props) {
  return (
    <Suspense fallback={<div className="note">טוען הגדרות…</div>}>
      <SettingsPanelLazy {...props} ui={settingsPanelUi()} />
    </Suspense>
  );
}

function UserForm({ user, config, users, zones, presence = [], session, canManageUsers: mayManageUsers = false, canDelete, lockRole, lockDept, canManageWorkerAccess: canWorkerAccess = false, onCancel, onSave, onDelete, onArchive }) {
  const scopedWorkerEditor = session?.role === "user" && !mayManageUsers && (lockRole === "worker" || user.role === "worker" || !user.role);
  const scopedDefaults = scopedWorkerEditor ? scopedWorkerDefaultsForActor(session) : {};
  const initialRole = scopedWorkerEditor ? "worker" : (user.role === "cleaner" ? "worker" : (user.role || lockRole || ""));
  const initialPerms = !user.id && initialRole === "user" && !user.perms ? { ...DEFAULT_MANAGER_PERMS } : normalizePerms(user);
  const initialDept = scopedWorkerEditor ? scopedDefaults.dept : (user.role === "cleaner" ? "ניקיון" : (user.dept || lockDept || ""));
  const [name, setName] = useState(user.name || ""), [position, setPosition] = useState(user.position || user.jobTitle || ""), [phone, setPhone] = useState(user.phone || ""), [role, setRole] = useState(initialRole), [pin, setPin] = useState(user.pin || ""), [workerNo, setWorkerNo] = useState(user.workerNo || ""), [email, setEmail] = useState(user.email || ""), [password, setPassword] = useState(user.password || ""), [dept, setDept] = useState(initialDept), [depts, setDepts] = useState(user.depts?.length ? user.depts : (initialDept ? [initialDept] : [])), [supplier, setSupplier] = useState(user.supplier || ""), [shiftStart, setShiftStart] = useState(user.shiftStart || config.defaultShiftStart || "07:30"), [shiftEnd, setShiftEnd] = useState(user.shiftEnd || config.defaultShiftEnd || "16:30"), [techGrace, setTechGrace] = useState(user.lateTolerance != null || user.earlyTolerance != null ? String(Math.max(Number(user.lateTolerance ?? 0) || 0, Number(user.earlyTolerance ?? 0) || 0)) : ""), [techScope, setTechScope] = useState(user.techScope || "transport"), [techCats, setTechCats] = useState(user.techCats || []), [perms, setPerms] = useState(initialPerms), [mgrZones, setMgrZones] = useState(user.mgrZones || []), [active, setActive] = useState(user.active !== false), [employmentType, setEmploymentType] = useState(user.employmentType || (user.role === "tech" ? "contractor" : "direct")), [contractorName, setContractorName] = useState(user.contractorName || ""), [err, setErr] = useState("");
  const [shift, setShift] = useState(scopedWorkerEditor ? (scopedDefaults.shift || "") : (user.shift || ""));
  const [loginResetRequested, setLoginResetRequested] = useState(false);
  const toggleMgrDept = (d) => setDepts((s) => s.includes(d) ? s.filter((x) => x !== d) : [...s, d]);
  const toggleMgrZone = (zoneName) => setMgrZones((s) => s.includes(zoneName) ? s.filter((x) => x !== zoneName) : [...s, zoneName]);
  const setPerm = (mod, level) => setPerms((s) => ({ ...s, [mod]: level }));
  const roleUsesLogin = isActivationLinkRole(role);
  const roleUsesPin = isPinActivationRole(role);
  const roleUsesPassword = isPasswordActivationRole(role);
  const validLoginEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim().toLowerCase());
  const loginConfigured = roleUsesLogin && !loginResetRequested && userHasLoginSecret({ ...user, role, pin, password });
  const canResetStoredLogin = loginConfigured && !user.authUserId;
  const activePermCount = USER_PERMISSION_MODULES.filter((m) => permRank(perms[m.mod] || "none") > 0).length;
  const permSummary = activePermCount ? `${countLabel(activePermCount, "תחום פעיל", "תחומים פעילים")}` : "אין הרשאות נוספות";
  const actorDeptOptions = scopedWorkerEditor ? userDepartments(session) : [];
  const workerDeptOptions = scopedWorkerEditor && actorDeptOptions.length ? actorDeptOptions : (config.departments || []);
  const workerShiftOptions = scopedWorkerEditor && userShift(session)
    ? [{ id: userShift(session), label: workShiftsOf(config).find((sh) => sh.id === userShift(session))?.label || userShift(session), Icon: Clock }]
    : [{ id: "", label: "ללא", Icon: Clock }, ...workShiftsOf(config).map((sh) => ({ id: sh.id, label: sh.label, Icon: Clock }))];
  const explicitCleaningAccess = hasCleaningAccess({ role: "worker", active: true, cleaningAccess: user.cleaningAccess });
  const [manualCleaningAccess, setManualCleaningAccess] = useState(explicitCleaningAccess);
  const cleaningDeptSelected = ["ניקיון", "נקיון", "cleaning"].includes(String(dept || "").trim().toLowerCase());
  const roleIcons = { admin: ShieldCheck, executive: BarChart3, tech: HardHat, user: User, worker: UserPlus };
  const permIcons = { fleetDocs: FileText, fleetTickets: ClipboardList, ppe: Shirt, workerAccess: KeyRound, users: Users, analytics: BarChart3, suppliers: Truck, settings: Settings, audit: Clock, aiMemoryPilot: Sparkles, aiConversationsPilot: MessageSquare };
  const permLevelLabels = { none: "אין", view: "צפייה", request: "בקשה", manage: "ניהול", full: "מלא" };
  const pickCard = (on, tone = "#1F4E8C") => ({ borderColor: on ? tone : undefined, background: on ? "var(--primary-soft)" : undefined, color: on ? "var(--primary)" : undefined });
  const changeRole = (nextRole) => {
    setRole(nextRole);
    if (!user.id && nextRole === "user" && Object.keys(cleanPerms(perms)).length === 0) setPerms({ ...DEFAULT_MANAGER_PERMS });
  };
  const ChoiceGrid = ({ options, value, onChange, columns = "auto", tone = "#1F4E8C" }) => (
    <div className={"uf-choice-grid cols-" + columns}>{options.map((opt) => {
      const Icon = opt.Icon;
      const on = value === opt.id;
      return <button key={opt.id} type="button" className={"uf-choice" + (on ? " on" : "")} onClick={() => onChange(opt.id)} style={pickCard(on, tone)}>{Icon && <Icon size={17} />}<span>{opt.label}</span>{opt.sub && <small>{opt.sub}</small>}</button>;
    })}</div>
  );
  const PermCard = ({ mod, label, hint, levels = ["none", "view", "request", "manage", "full"] }) => {
    const Icon = permIcons[mod] || ShieldCheck;
    const current = perms[mod] || "none";
    return <div className={"perm-card" + (permRank(current) > 0 ? " active" : "")}>
      <div className="perm-card-main"><span className="perm-ic"><Icon size={17} /></span><div><div className="perm-name">{label}</div>{hint && <div className="perm-hint">{hint}</div>}</div></div>
      <div className="perm-levels">{levels.map((l) => <button key={l} type="button" className={current === l ? "on" : ""} onClick={() => setPerm(mod, l)}>{permLevelLabels[l] || l}</button>)}</div>
    </div>;
  };
  const save = async () => {
    if (!name.trim()) return setErr("נא להזין שם");
    if (!role) return setErr("בחרו תפקיד");
    if (role === "tech") {
      if (!phone.trim()) return setErr("נא להזין טלפון (שם משתמש לכניסה)");
      if (techScope === "facility" && techCats.length === 0) return setErr("בחרו לפחות קטגוריה אחת לטכנאי מבנה");
    }
    else if (role === "worker") { if (!workerNo.trim()) return setErr("נא להזין מספר עובד"); }
    else { if (!email.trim()) return setErr("נא להזין דוא״ל (שם משתמש)"); if (roleUsesPassword && !validLoginEmail(email)) return setErr("נא להזין דוא״ל תקין, לדוגמה name@example.local"); if (role === "user" && depts.length === 0) return setErr("בחרו לפחות מחלקה אחת למנהל"); }
    const others = (users || []).filter((x) => x.id !== (user.id || ""));
    const phoneKey = String(phone || "").replace(/\D/g, "");
    if (roleUsesPassword && email.trim() && others.some((x) => (x.email || "").trim().toLowerCase() === email.trim().toLowerCase())) return setErr("דוא״ל זה כבר קיים במערכת");
    if (phoneKey && others.some((x) => String(x.phone || "").replace(/\D/g, "") === phoneKey)) return setErr("טלפון זה כבר קיים במערכת");
    if (role === "worker" && workerNo.trim() && others.some((x) => String(x.workerNo || "").trim() === workerNo.trim())) return setErr("מספר עובד זה כבר קיים במערכת");
    const nextPerms = role === "admin" ? {} : cleanPerms(perms);
    const nextNotificationPrefs = normalizeNotificationPrefs(user.notificationPrefs || user.notificationPreferences || user.notifyPrefs);
    const nextPin = roleUsesPin ? (canWorkerAccess ? pin.trim() : (user.pin || "")) : "";
    const nextPassword = roleUsesPassword ? (canWorkerAccess ? password : (user.password || "")) : "";
    const nextCleaningAccess = (role === "worker" && manualCleaningAccess && !cleaningDeptSelected)
      ? { enabled: true, canPerformRounds: true, canReceiveComplaints: true, canCloseComplaints: true, canManageCleaningZones: false, canViewCleaningReports: false }
      : undefined;
    const payload = { id: user.id || uid(), createdAt: user.createdAt || Date.now(), authUserId: user.authUserId || "", name: name.trim(), position: position.trim(), phone: phone.trim(), role,
      email: roleUsesPassword ? email.trim().toLowerCase() : "", password: nextPassword,
      pin: nextPin,
      workerNo: role === "worker" ? workerNo.trim() : "",
      dept: role === "user" ? (depts[0] || "") : dept, depts: role === "user" ? depts : (role === "worker" ? [dept] : []), supplier: role === "tech" ? supplier : "", shiftId: "", shiftStart: role === "tech" ? shiftStart : "", shiftEnd: role === "tech" ? shiftEnd : "",
      lateTolerance: role === "tech" && techGrace !== "" ? Math.max(0, Number(techGrace) || 0) : undefined,
      earlyTolerance: role === "tech" && techGrace !== "" ? Math.max(0, Number(techGrace) || 0) : undefined,
      techScope: role === "tech" ? techScope : undefined,
      techCats: (role === "tech" && techScope === "facility") ? techCats : [],
      mgrZones: role === "user" ? mgrZones : [], perms: Object.keys(nextPerms).length ? nextPerms : undefined,
      notificationPrefs: Object.keys(nextNotificationPrefs.enabled).length ? nextNotificationPrefs : undefined,
      shift: role !== "admin" && role !== "executive" && role !== "tech" ? shift : "",
      reportsTo: role === "user" ? (user.reportsTo || "") : "",
      active,
      activationToken: "",
      activationStatus: roleUsesLogin && !loginResetRequested && (nextPin || nextPassword || user.authUserId || user.loginConfigured || user.loginState === "active") ? "activated" : "",
      loginResetRequested: canWorkerAccess && roleUsesLogin && loginResetRequested,
      cleaningAccess: nextCleaningAccess,
      employmentType: role === "worker" ? employmentType : (role === "tech" ? "contractor" : ""),
      contractorName: (role === "worker" && employmentType === "contractor") ? contractorName.trim() : "" };
    const scoped = session ? normalizeScopedWorkerForActor(payload, session, { canManageUsers: mayManageUsers }) : { ok: true, user: payload };
    if (!scoped.ok) return setErr("אין הרשאה ליצור או לערוך עובד מחוץ למחלקה ולמשמרת שלך");
    const ok = await onSave(scoped.user);
    if (ok === false) setErr(SAVE_FAILED_MESSAGE);
  };
  const ActivationControls = () => {
    if (!roleUsesLogin) return null;
    if (!user.id) return null;
    const pendingText = loginConfigured
      ? userPresenceStatusText(presenceOf(presence, user.id))
      : loginSetupPrompt({ ...user, role });
    return <div className="field"><span>סטטוס כניסה</span><div className="hint" style={{ marginTop: 0 }}>{pendingText}</div>
      {canWorkerAccess ? <>
        {canResetStoredLogin && <button className="btn-ghost full" type="button" onClick={() => { setPassword(""); setPin(""); setLoginResetRequested(true); }}>איפוס כניסה בכניסה הבאה</button>}
        {loginResetRequested && <div className="note warn">האיפוס יישמר רק לאחר לחיצה על שמירת משתמש.</div>}
        {canResetStoredLogin && <div className="hint">האיפוס לא יוצר קישור. אחרי שמירה, המשתמש יזין דוא״ל או מספר עובד ויגדיר סיסמה/קוד חדש בעצמו.</div>}
      </> : <div className="hint">ניהול כניסה דורש הרשאת הפעלת כניסה. שמירת פרטי המשתמש לא תשנה את הגדרת הכניסה הקיימת.</div>}
    </div>;
  };
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" aria-label="סגירה" onClick={onCancel}><X size={22} /></button><div className="form-title">{user.id ? (lockRole === "worker" ? "עריכת עובד" : "עריכת משתמש") : (lockRole === "worker" ? "עובד חדש" : "משתמש חדש")}</div></div>
    <div className="body">
      <label className="field"><span>שם מלא *</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="field"><span>תפקיד בארגון</span><input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="לדוגמה: מנהל משמרת / אחראי מחסן" /><div className="hint">כותרת אנושית לזיהוי האדם. הרשאות המערכת נקבעות בשדה התפקיד ובהרשאות האישיות.</div></label>
      {role === "worker" && <label className="field"><span>מספר עובד (שם משתמש לכניסה) *</span><input className="ltr-input" dir="ltr" value={workerNo} onChange={(e) => setWorkerNo(e.target.value)} inputMode="numeric" placeholder="לדוגמה: 1042" /></label>}
      {roleUsesPassword && <label className="field"><span>דוא״ל (שם משתמש לכניסה) *</span><input className="ltr-input" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoCapitalize="off" placeholder="name@example.local" /></label>}
      <label className="field"><span>טלפון{role === "tech" ? " (שם משתמש לכניסה) *" : ""}</span><input className="ltr-input" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" placeholder="050-0000000" /><div className="hint">{role === "tech" ? "הטכנאי ייכנס עם מספר הטלפון ויגדיר קוד אישי בכניסה הראשונה." : "יכול לשמש גם כפרטי כניסה אם הוזן, ומוצג לאנשי טיפול כדי שיוכלו להתקשר בלחיצה."}</div></label>
      {!lockRole && <div className="field"><span>תפקיד</span><ChoiceGrid columns="role" value={role} onChange={changeRole} options={USER_FORM_ROLE_OPTIONS.map(([id, label]) => ({ id, label, Icon: roleIcons[id] || User }))} /></div>}
      {role && role !== "admin" && role !== "executive" && role !== "tech" && <div className="field"><span>משמרת</span><ChoiceGrid columns="shift" value={shift} onChange={(value) => !scopedWorkerEditor && setShift(value)} options={workerShiftOptions} />{scopedWorkerEditor && <div className="hint">המשמרת נקבעת לפי המנהל שפותח את העובד.</div>}</div>}
      {role === "user" && (lockDept
        ? <label className="field"><span>מחלקות</span><input value={depts.join(", ")} disabled readOnly /></label>
        : <details className="perm-fold manager-scope-fold">
          <summary><span>תחומי אחריות</span><span className="perm-summary">{countLabel(depts.length, "מחלקה", "מחלקות")} · {countLabel(mgrZones.filter((z) => (config.zones || []).includes(z)).length, "אזור", "אזורים")}</span></summary>
          <div className="field"><span>מחלקות אחריות (ניתן לבחור כמה)</span><div className="chk-grid">{config.departments.map((d) => <label key={d} className={"chk-pill" + (depts.includes(d) ? " on" : "")}><input type="checkbox" checked={depts.includes(d)} onChange={() => toggleMgrDept(d)} /> {d}</label>)}</div><div className="hint">המנהל יראה קריאות, טיפולים ועובדים של המחלקות שנבחרו בלבד.</div></div>
          <div className="field"><span>אזורי אחריות לאחזקה</span><div className="chk-grid">{(config.zones || []).map((z) => <label key={z} className={"chk-pill" + (mgrZones.includes(z) ? " on" : "")}><input type="checkbox" checked={mgrZones.includes(z)} onChange={() => toggleMgrZone(z)} /> {z}</label>)}</div><div className="hint">קריאות מבנה באזור שנבחר יהיו משותפות לכל המנהלים שאחראים לאותו אזור.</div></div>
        </details>)}
      {role === "worker" && (lockDept
        ? <label className="field"><span>מחלקה</span><input value={dept} disabled readOnly /></label>
        : <div className="field"><span>מחלקה (משויך אליה)</span><ChoiceGrid columns="dept" value={dept} onChange={(value) => { if (!scopedWorkerEditor || actorDeptOptions.includes(value)) setDept(value); }} tone="#0D9488" options={workerDeptOptions.map((d) => ({ id: d, label: d, Icon: d === "ניקיון" ? Sparkles : Building2 }))} /><div className="hint">{scopedWorkerEditor ? "מנהל יכול ליצור עובד רק במחלקות האחריות שלו." : "העובד מדווח תקלות, וההפניה עוברת למנהלי המחלקה הזו לאישור."}</div></div>)}
      {role === "worker" && (() => { const access = normalizeCleaningAccess({ ...user, role: "worker", dept, depts: [dept], active, cleaningAccess: cleaningDeptSelected ? false : manualCleaningAccess }); return access.enabled ? <div className="note uf-access-note" style={{ marginTop: -4, marginBottom: 10 }}><Sparkles size={15} /> גישה לניקיון פעילה{access.source === "department" ? " לפי מחלקת ניקיון" : ""}. העובד נשאר עובד רגיל ומקבל לשונית ניקיון לביצוע סבבים.</div> : null; })()}
      {role === "worker" && <div className="field"><span>שיוך תעסוקתי (לחישוב חיוב ציוד מגן)</span><div className="seg-tabs s2" style={{ maxWidth: 260 }}><button className={employmentType === "direct" ? "on" : ""} onClick={() => setEmploymentType("direct")}>ישיר (חברה)</button><button className={employmentType === "contractor" ? "on" : ""} onClick={() => setEmploymentType("contractor")}>דרך קבלן</button></div>{employmentType === "contractor" && <input style={{ marginTop: 8 }} value={contractorName} onChange={(e) => setContractorName(e.target.value)} placeholder="שם הקבלן (לא חובה)" />}<div className="hint">עובד דרך קבלן משלם מחיר מלא על ציוד; עובד ישיר — לפי מדיניות המחלקה.</div></div>}
      {role === "tech" ? (<>
        <ActivationControls />
        <div className="field"><span>פרופיל טכנאי</span><div className="pr-row">
          <button className={"pr-pick" + (techScope === "transport" ? " on" : "")} onClick={() => setTechScope("transport")} style={techScope === "transport" ? { background: "#16202E", color: "#fff", borderColor: "#16202E" } : {}}><Truck size={15} /> שינוע (כל הצי)</button>
          <button className={"pr-pick" + (techScope === "facility" ? " on" : "")} onClick={() => setTechScope("facility")} style={techScope === "facility" ? { background: "#16202E", color: "#fff", borderColor: "#16202E" } : {}}><Building2 size={15} /> מבנה</button>
        </div><div className="hint">תחום העבודה קובע אילו קריאות הטכנאי רואה. שיוך לספק קובע את צוות הקבלן שאליו הוא שייך.</div></div>
        {techScope === "facility" && <div className="field"><span>קטגוריות מבנה (בחרו לפחות אחת) *</span><div className="cat-grid">{(config.categories || CATEGORIES).map((c) => { const on = techCats.includes(c.id); const m = catMeta(c.id); return <button key={c.id} className={"cat-pick" + (on ? " on" : "")} onClick={() => setTechCats((s) => on ? s.filter((x) => x !== c.id) : [...s, c.id])} style={on ? { borderColor: m.color, background: m.color + "1f" } : {}}><m.Icon size={19} color={m.color} /><span>{c.label}</span></button>; })}</div></div>}
        <label className="field"><span>ספק / קבלן</span><select value={supplier} onChange={(e) => setSupplier(e.target.value)}><option value="">— פנימי / ללא ספק —</option>{(() => { const supplierOptions = config.suppliers.filter((s) => { const type = supplierTypeFromMeta(supMeta(config, s), config); return !type || type === "transport" || type === "facility"; }); return <>{supplierOptions.map((s) => <option key={s}>{s}</option>)}{supplier && !supplierOptions.includes(supplier) && <option value={supplier}>{supplier}</option>}</>; })()}</select><div className="hint">{techScope === "transport" ? "בקריאות שינוע, טכנאי של ספק יראה את כלי הספק שלו." : "בכרטיס הספק יוצג צוות הטכנאים המשויך אליו."}</div></label>
        <div className="field-row"><label className="field"><span>שעת תחילת משמרת</span><TimeInput value={shiftStart} onChange={setShiftStart} /></label><label className="field"><span>שעת סיום (יציאה אוטומטית)</span><TimeInput value={shiftEnd} onChange={setShiftEnd} /></label></div>
        <label className="field"><span>סבילות משמרת אישית (דקות)</span><input type="number" min="0" value={techGrace} onChange={(e) => setTechGrace(e.target.value)} placeholder={`ברירת מחדל: ${Math.max(Number(config.lateGraceMin ?? 10) || 0, Number(config.earlyGraceMin ?? 10) || 0)}`} /><div className="hint">השאירו ריק כדי להשתמש בברירת המחדל. ערך אישי משנה את בדיקת האיחור והיציאה המוקדמת של הטכנאי הזה בלבד.</div></label>
      </>) : role === "worker" ? (<>
        <ActivationControls />
      </>) : (<>
        <ActivationControls />
      </>)}
      <div className="uf-form-footer">
        {role === "worker" ? (
          <div className="hint">סטטוס עובד מנוהל דרך פעולת עזיבת עובד / החזרת ציוד, כדי לא להחזיק שתי הגדרות מקבילות.</div>
        ) : (
          <div className="uf-active-block">
            <label className="chk-line"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> משתמש פעיל</label>
            <div className="hint">בטל סימון כדי לחסום כניסה למשתמש מבלי למחוק אותו.</div>
          </div>
        )}
        {role && role !== "admin" && mayManageUsers && <details className="perm-fold"><summary><span>הרשאות אישיות / אחריות נוספת</span><span className="perm-summary">{permSummary}</span></summary>
        <div className="hint">התפקיד קובע את הגישה הבסיסית. אם אותו אדם מחזיק כמה תחומי אחריות, מוסיפים כאן הרשאות מודול לפי הצורך במקום ליצור תפקיד חדש.</div>
        {role === "worker" && (() => { const access = normalizeCleaningAccess({ ...user, role: "worker", dept, depts: [dept], active, cleaningAccess: cleaningDeptSelected ? false : manualCleaningAccess }); const byDept = access.source === "department"; return <div className={"perm-card cleaning-access-card" + (access.enabled ? " active" : "")}>
          <div className="perm-card-main"><span className="perm-ic"><Sparkles size={17} /></span><div><div className="perm-name">סבבי ניקיון</div><div className="perm-hint">{byDept ? "פעיל אוטומטית לפי מחלקת ניקיון." : "אישור חריג לעובד שאינו במחלקת ניקיון להשתתף בסבבים."}</div></div></div>
          <div className="perm-levels"><button type="button" className={!access.enabled ? "on" : ""} disabled={byDept} onClick={() => setManualCleaningAccess(false)}>אין</button><button type="button" className={access.enabled ? "on" : ""} disabled={byDept} onClick={() => setManualCleaningAccess(true)}>מבצע סבבים</button></div>
        </div>; })()}
        {role === "user" && zones && (zones.length === 0
          ? <div className="hint" style={{ margin: "0 14px 10px" }}>אין עדיין אזורי ניקיון להצמדה. הגדירו אזורים תחת «ניקיון».</div>
          : <div className="perm-card cleaning-zone-scope-card">
            <div className="perm-card-main"><span className="perm-ic"><Sparkles size={17} /></span><div><div className="perm-name">אזורי ניקיון לצפייה</div><div className="perm-hint">המנהל יראה את מצב הניקיון והדיווחים באזורים שנבחרו.</div></div></div>
            <div className="chk-grid">{zones.slice().sort(zoneSort).map((z) => <label key={z.id} className={"chk-pill" + (mgrZones.includes(z.id) ? " on" : "")}><input type="checkbox" checked={mgrZones.includes(z.id)} onChange={() => setMgrZones((s) => s.includes(z.id) ? s.filter((x) => x !== z.id) : [...s, z.id])} /> {z.name}{zoneLoc(z) ? " · " + zoneLoc(z) : ""}</label>)}</div>
          </div>)}
        <div className="perm-card-grid">{USER_PERMISSION_MODULES.map((m) => <PermCard key={m.mod} {...m} />)}</div>
        <div className="hint">הרשאות חדשות יתווספו כאן לפי מודולים, במקום להוסיף עוד תיבות סימון נפרדות.</div>
        </details>}
      </div>
      {err && <div className="err">{err}</div>}
      <button className="btn-primary full uf-save-btn" onClick={save}>{lockRole === "worker" ? "שמירת עובד" : "שמירת משתמש"}</button>
      {onArchive && user.id && (isWorkerLoginRole(role) || role === "tech") && <button className="btn-ghost full" style={{ marginTop: 10 }} onClick={() => onArchive(user)}><PackageCheck size={15} /> עזיבת עובד / החזרת ציוד</button>}
      {canDelete && !(onArchive && (isWorkerLoginRole(role) || role === "tech")) && <ConfirmBtn className="btn-danger full" style={{ marginTop: 10 }} label="מחיקה" onConfirm={onDelete} />}
      <div style={{ height: 24 }} />
    </div></div>);
}

/* ============================================================ TICKET FORM */
function TicketForm(p) {
  const { config, session, fleet, tickets, users, saveUser, saveTicket, onCreate, onCancel, onOpenTicket, prefill } = p;
  const isAdmin = session.role === "admin";
  const [track, setTrack] = useState(prefill?.track || null);
  const [subject, setSubject] = useState(prefill?.subject || "");
  const [category, setCategory] = useState(prefill?.category || "");
  const [priority, setPriority] = useState(prefill?.priority || "");
  const [zone, setZone] = useState(prefill?.zone || config.zones[0]);
  const [asset, setAsset] = useState(prefill?.asset || "");
  const [forkliftId, setForkliftId] = useState(prefill?.forkliftId || "");
  const [downtimeType, setDowntimeType] = useState(prefill?.downtimeType || "");
  const [incShift, setIncShift] = useState(prefill?.incidentShift || "");
  const [driverInv, setDriverInv] = useState(prefill?.driverInvolved || "");
  const [driverInvId, setDriverInvId] = useState(prefill?.driverInvolvedId || "");
  const [description, setDescription] = useState(prefill?.description || "");
  const [assignTo, setAssignTo] = useState("self");
  const [supplierAssign, setSupplierAssign] = useState("");
  const [inlineAiOpen, setInlineAiOpen] = useState(false);
  const [slaOn, setSlaOn] = useState(false), [slaH, setSlaH] = useState(8);
  const [retro, setRetro] = useState({ on: false, createdAt: "", updatedAt: "", dueAt: "", status: "done", waitingReason: "parts", closedAt: "", downtimeStart: "", downtimeEnd: "", costAmount: "", costSupplier: "", costNote: "", quality: "resolved" });
  const [dupeReview, setDupeReview] = useState(null), [pendingT, setPendingT] = useState(null);
  const [photo, setPhoto] = useState(null), [err, setErr] = useState(""), [busy, setBusy] = useState(false), [aiBusy, setAiBusy] = useState(false), [aiNote, setAiNote] = useState("");
  const busyRef = useRef(false), fileRef = useRef(null);
  const configuredMaintZones = (config.zones && config.zones.length) ? config.zones : ["כללי"];
  const managerMaintZones = session.role === "user" ? (session.mgrZones || []).filter((z) => configuredMaintZones.includes(z)) : [];
  const facilityZoneOptions = managerMaintZones.length ? managerMaintZones : configuredMaintZones;
  const facilityZone = facilityZoneOptions.includes(zone) ? zone : (facilityZoneOptions[0] || zone);
  const ticketFleet = useMemo(() => visibleFleetForSession(session, fleet), [session, fleet]);
  const inlineAiContext = useMemo(() => buildAIContextSnapshot(session, visibleTickets(session, tickets, fleet), p.pm, fleet, config, p.tasks, p.meetings, users, p.ppeItems, p.ppeReqs, p.zones), [session, tickets, fleet, p.pm, config, p.tasks, p.meetings, users, p.ppeItems, p.ppeReqs, p.zones]);
  const inlineAiExecuteAction = useMemo(() => createAiAgentActionExecutor({ ...p, saveTicket: saveTicket || onCreate, createMemoryFact: saveAIMemoryFact }, { makeId: uid, saveFailedMessage: SAVE_FAILED_MESSAGE }), [p, saveTicket, onCreate]);
  const readTicketById = async (id) => {
    if (!id) return null;
    if (NORMALIZED_TICKET_PROVIDER && typeof NORMALIZED_TICKET_PROVIDER.get === "function") {
      const record = await NORMALIZED_TICKET_PROVIDER.get(id);
      if (record?.ticket) return record.ticket;
      if (record?.id) return record;
    }
    return (tickets || []).find((ticket) => ticket.id === id) || null;
  };
  const applyAiTicketPrefill = (draft = {}) => {
    setSubject(draft.subject || "");
    setCategory(draft.category || "");
    setPriority(draft.priority || "");
    setZone(draft.zone || config.zones[0]);
    setAsset(draft.asset || "");
    setForkliftId(draft.forkliftId || "");
    setDowntimeType(draft.downtimeType || "");
    setIncShift(draft.incidentShift || "");
    setDriverInv(draft.driverInvolved || "");
    setDriverInvId(draft.driverInvolvedId || "");
    setDescription(draft.description || "");
    setInlineAiOpen(false);
    setTrack(draft.track || "facility");
  };
  useEffect(() => {
    if (track === "transport" && forkliftId && !ticketFleet.some((unit) => unit.id === forkliftId)) {
      setForkliftId("");
      setDriverInv("");
      setDriverInvId("");
    }
  }, [track, forkliftId, ticketFleet]);
  const handlePhoto = (file) => { if (!file) return; const r = new FileReader(); r.onload = (e) => { const img = new Image(); img.onload = () => { const max = 1000; let { width, height } = img; if (width > height && width > max) { height = height * max / width; width = max; } else if (height > max) { width = width * max / height; height = max; } const c = document.createElement("canvas"); c.width = width; c.height = height; c.getContext("2d").drawImage(img, 0, 0, width, height); setPhoto(c.toDataURL("image/jpeg", 0.6)); }; img.src = e.target.result; }; r.readAsDataURL(file); };
  const aiSuggest = async () => {
    const text = `${subject}\n${description}`.trim(); if (!text && !photo) { setErr("כתבו נושא/תיאור או צרפו תמונה"); return; }
    setAiBusy(true); setErr(""); const local = localSuggest(text || "");
    try {
      const sys = `אתה עוזר אחזקה במרכז לוגיסטי. נתח את התקלה (טקסט ותמונה אם צורפה) והחזר JSON בלבד, ללא טקסט נוסף וללא Markdown: {"category":"<id>","description":"<תיאור משופר וברור של התקלה בעברית>"}. קטגוריות אפשריות: ${(config.categories || CATEGORIES).map((c) => c.id + "=" + c.label).join(", ")}.`;
      const content = [];
      if (photo) { const m = /^data:(image\/[a-z]+);base64,(.+)$/i.exec(photo); if (m) content.push({ type: "image", source: { type: "base64", media_type: m[1], data: m[2] } }); }
      content.push({ type: "text", text: `נושא: ${subject || "(לא צויין)"}\nתיאור: ${description || "(ראה תמונה)"}` });
      const out = await callClaude([{ role: "user", content }], sys, 500);
      const match = (out || "").match(/\{[\s\S]*\}/);
      if (!match) throw new Error("no-json");
      const j = JSON.parse(match[0]);
      const cats = config.categories || CATEGORIES;
      if (cats.some((c) => c.id === j.category)) setCategory(j.category); else if (local.category && cats.some((c) => c.id === local.category)) setCategory(local.category);
      if (j.description && j.description.trim().length > description.length) setDescription(j.description.trim());
      setAiNote(photo ? "ה-AI ניתח את התמונה והתיאור ✨ — בדקו ואשרו" : "הצעת AI הוחלה ✨ — בדקו ואשרו");
    } catch (e) {
      const cats = config.categories || CATEGORIES;
      if (local.category && cats.some((c) => c.id === local.category)) setCategory(local.category);
      setAiNote("שירות ה-AI אינו זמין כעת — הוחלה הצעה לפי מילות מפתח. ניתן לערוך ידנית.");
    }
    finally { setAiBusy(false); setTimeout(() => setAiNote(""), 5000); }
  };
  const buildTicket = () => {
    const id = uid(); const now = Date.now();
    const retroOn = isAdmin && retro.on;
    const createdAt = retroOn ? datetimeValueToMs(retro.createdAt, now) : now;
    const status = retroOn ? (retro.status || "new") : "new";
    const closedAt = retroOn ? datetimeValueToMs(retro.closedAt, datetimeValueToMs(retro.updatedAt, now)) : null;
    const updatedAt = retroOn ? datetimeValueToMs(retro.updatedAt, closedAt || now) : now;
    const pr = priority;
    const hrs = (isAdmin && slaOn) ? (Number(slaH) || DEFAULT_SLA[pr]) : slaForTicket({ track, forkliftId, category, priority: pr }, config, ticketFleet);
    const dueAt = retroOn ? datetimeValueToMs(retro.dueAt, createdAt + hrs * 3600000) : createdAt + hrs * 3600000;
    const selectedFleet = track === "transport" ? ticketFleet.find((f) => f.id === forkliftId) : null;
    const routedSupplier = track === "transport" ? (selectedFleet?.supplier || "") : supplierAssign;
    let assignee = "", routedTech = track === "transport" || undefined, mgrExec = undefined, routeText;
    if (track === "transport") routeText = routedSupplier ? `הקריאה נפתחה והועברה לספק ${routedSupplier}` : "הקריאה נפתחה והועברה למאגר שינוע";
    else if (!isAdmin) routeText = "הקריאה נפתחה";
    else if (routedSupplier) { ({ assignee, routedTech, mgrExec } = facilityOwnerPatch({ track, status }, session, { supplier: routedSupplier, status })); routeText = `נפתחה ע״י מנהל — שויכה לספק ${routedSupplier}`; }
	    else if (assignTo.startsWith("mgr:")) { const u = (users || []).find((x) => x.id === assignTo.slice(4)); assignee = u?.name || ""; mgrExec = assignee ? true : undefined; routeText = assignee ? `נפתחה ע״י מנהל — שויכה למנהל ${assignee}` : "נפתחה ע״י מנהל"; }
	    else { ({ assignee, routedTech, mgrExec } = facilityOwnerPatch({ track, status }, session, { supplier: "", status })); routeText = "נפתחה ע״י מנהל — נשארת לטיפולך"; }
	    return {
      id, track, subject: subject.trim(), category: track === "transport" ? "transport" : category, categoryLabel: track === "transport" ? "" : ((config.categories || CATEGORIES).find((c) => c.id === category)?.label || ""), priority: pr, zone: track === "facility" ? facilityZone : zone,
      asset: track === "transport" ? (selectedFleet?.code || "") : asset.trim(),
      forkliftId: track === "transport" ? forkliftId : null, downtimeType: track === "transport" ? downtimeType : null,
      wearType: null, downtimeStart: track === "transport" ? (retroOn ? datetimeValueToMs(retro.downtimeStart, createdAt) : now) : null, downtimeEnd: track === "transport" && retroOn ? datetimeValueToMs(retro.downtimeEnd, status === "done" ? closedAt : null) : null, driverInvolved: track === "transport" ? driverInv.trim() : "", driverInvolvedId: track === "transport" ? driverInvId : "", incidentShift: track === "transport" ? incShift : "",
      description: description.trim(), status, waitingReason: status === "waiting" ? retro.waitingReason : null, waitBall: status === "waiting" ? reasonBall(config, retro.waitingReason) : null, assignee,
      routedTech, mgrExec, supplier: routedSupplier || "",
      byAdmin: isAdmin || undefined, slaHoursOverride: (isAdmin && slaOn) ? Number(slaH) : undefined,
      createdBy: { id: session.id, name: session.name, role: session.role, dept: session.dept, phone: session.phone || "", email: session.email || "" }, createdAt, updatedAt,
      dueAt, hasPhoto: !!photo, closure: status === "done" ? { costAmount: Number(retro.costAmount) || 0, costSupplier: retro.costSupplier || routedSupplier || "", costNote: retro.costNote.trim(), quality: retro.quality || "resolved", signedBy: session.name, signedAt: closedAt || updatedAt, recordedAt: now } : null,
      statusSince: status === "done" || status === "cancelled" ? updatedAt : createdAt,
      origin: retroOn ? "retro_manual" : undefined,
      log: [{ at: createdAt, by: session.name, byRole: session.role, text: retroOn ? `${routeText} · פתיחה רטרואקטיבית` : routeText, kind: retroOn ? "history" : undefined }],
    };
  };
  const finalize = async (t) => {
    const rec = photo ? { ...t, ...(await TICKET_PHOTOS.save(t.id, "before", photo)) } : t;
    return onCreate(rec);
  };
  const failSave = () => {
    setErr(SAVE_FAILED_MESSAGE);
    busyRef.current = false;
    setBusy(false);
  };
  const submit = async () => {
    if (busyRef.current) return;
    const missing = missingTicketCreateFields({ track, subject, description, category, priority, forkliftId, downtimeType });
    if (!subject.trim()) return setErr("נא להזין נושא");
    if (track === "facility" && !category) return setErr("נא לבחור קטגוריה");
    if (track === "transport" && !forkliftId) return setErr("נא לבחור כלי שינוע");
    if (track === "transport" && !downtimeType) return setErr("נא לבחור מצב הכלי");
    if (!priority) return setErr("נא לבחור עדיפות");
    if (!description.trim()) return setErr("נא לתאר את התקלה");
    if (missing.length) return setErr("נא להשלים את שדות החובה");
    setErr("");
    const t = buildTicket();
    const review = transportDuplicateReview(t, tickets || []);
    if (review.mode !== "none") { setPendingT(t); setDupeReview(review); return; }
    busyRef.current = true; setBusy(true);
    try { if (await finalize(t) === false) failSave(); } catch (e) { setErr("שגיאה בשמירה."); busyRef.current = false; setBusy(false); }
  };
  const proceedAnyway = async () => { const t = pendingT; setDupeReview(null); setPendingT(null); busyRef.current = true; setBusy(true); try { if (await finalize(t) === false) failSave(); } catch (e) { setErr("שגיאה בשמירה."); busyRef.current = false; setBusy(false); } };
  if (!track) return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" aria-label="סגירה" onClick={onCancel}><X size={22} /></button><div className="form-title">פתיחת קריאה</div></div>
    <div className="body"><div className="track-q">על מה הקריאה?</div>
      {Object.values(TRACKS).map((tr) => <button key={tr.id} className="track-pick" onClick={() => setTrack(tr.id)} style={{ borderColor: tr.color }}><span className="track-ic" style={{ background: tr.color + "22", color: tr.color }}><tr.Icon size={24} /></span><div><div className="track-name">{tr.label}</div><div className="track-desc">{tr.id === "transport" ? "מלגזות וכלי שינוע — מועבר לטכנאי" : "מבנה, חשמל, אינסטלציה, IT ועוד"}</div></div><ChevronLeft size={18} className="role-chev" /></button>)}
      <InlineAITicketCreate
        aiEnabled={aiAssistantEnabled(config)}
        expanded={inlineAiOpen}
        onToggle={() => setInlineAiOpen((open) => !open)}
        onClose={onCancel}
        session={session}
        context={inlineAiContext}
        callAssistant={callAIAssistant}
        executeAction={inlineAiExecuteAction}
        readTicket={readTicketById}
        onOpenTicket={(id) => {
          setInlineAiOpen(false);
          onCancel();
          onOpenTicket?.(id);
        }}
        onOpenDraft={applyAiTicketPrefill}
      />
    </div></div>);
  const trMeta = TRACKS[track];
  return (<div className="ovl-inner"><div className="form-head"><button className="icon-btn" onClick={() => prefill ? onCancel() : setTrack(null)} aria-label={prefill ? "ביטול פתיחת קריאה" : "חזרה לבחירת סוג קריאה"}><ChevronLeft size={24} style={{ transform: "scaleX(-1)" }} /></button><div className="form-title">קריאה · {trMeta.short}</div></div>
    <div className="body">
      <label className="field"><span>נושא *</span><input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={track === "transport" ? "לדוגמה: רעש חריג בהרמה" : "לדוגמה: תאורה לא עובדת ברציף 3"} /></label>
      {track === "transport" ? (<>
        <div className="field"><span>כלי שינוע *</span><UnitPicker fleet={ticketFleet} config={config} value={forkliftId} onChange={(id) => setForkliftId(id)} ui={unitPickerUi()} /></div>
        {forkliftId && (<>
        <div className="field"><span>משמרת האירוע</span><select value={incShift} onChange={(e) => setIncShift(e.target.value)}><option value="">— בחר —</option>{workShiftsOf(config).map((sh) => <option key={sh.id} value={sh.id}>{sh.label}</option>)}</select></div>
        <UserPicker users={users} config={config} saveUser={saveUser} session={session} canManageUsers={canManageUsers(session)} value={driverInvId} onChange={(u) => { setDriverInvId(u ? u.id : ""); setDriverInv(u ? u.name : ""); }} label="נהג מעורב (לדו״ח נזקים)" lockRole="worker" suggestName={(() => { const fk = ticketFleet.find((f) => f.id === forkliftId); return (incShift && fk && fk.drivers && fk.drivers[incShift] && fk.drivers[incShift].name) || ""; })()} hint="חפשו לפי שם או מספר. לא קיים? אפשר ליצור כאן." />
        </>)}
        <div className="field"><span>מצב הכלי *</span><div className="dt-list">{dtLevels(config).map((d) => <button key={d.id} className={"dt-pick" + (downtimeType === d.id ? " on" : "")} onClick={() => setDowntimeType(d.id)} style={downtimeType === d.id ? { borderColor: d.color, background: d.color + "14" } : {}}><span className="dt-dot" style={{ background: d.color }} /><div><div className="dt-name">{d.label}{d.oos ? " · מושבת" : ""}</div><div className="dt-desc">{d.desc}</div></div></button>)}</div></div>
      </>) : (<>
        <div className="field"><span>קטגוריה *</span><div className="cat-grid">{(config.categories || CATEGORIES).map((c) => { const m = catMeta(c.id); return <button key={c.id} className={"cat-pick" + (category === c.id ? " on" : "")} onClick={() => setCategory(c.id)} style={category === c.id ? { borderColor: m.color, background: m.color + "1f" } : {}}><m.Icon size={19} color={m.color} /><span>{c.label}</span></button>; })}</div></div>
        <label className="field"><span>אזור</span><select value={facilityZone} onChange={(e) => setZone(e.target.value)}>{facilityZoneOptions.map((z) => <option key={z}>{z}</option>)}</select>{managerMaintZones.length > 0 && <div className="hint">מוצגים רק אזורי האחריות שלך.</div>}</label>
        <label className="field"><span>ציוד (אופציונלי)</span><input value={asset} onChange={(e) => setAsset(e.target.value)} /></label>
      </>)}
      <div className="field"><span>עדיפות *</span><div className="pr-row">{PRIORITIES.map((x) => <button key={x.id} className={"pr-pick" + (priority === x.id ? " on" : "")} onClick={() => setPriority(x.id)} style={priority === x.id ? { background: x.color, color: "#fff", borderColor: x.color } : {}}>{x.label}</button>)}</div></div>
      <label className="field"><span>תיאור התקלה *</span><textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
      {track === "transport" && forkliftId && (() => { const fk = ticketFleet.find((f) => f.id === forkliftId); return eligibleTechs({ track: "transport", forkliftId, supplier: fk?.supplier || "" }, users, fleet).length === 0; })() && <div className="note" style={{ borderColor: "#FCA5A5", color: "#B91C1C", background: "#FEF2F2", marginTop: 0 }}><AlertTriangle size={13} /> אין כרגע טכנאי שינוע פעיל שיכול לקבל קריאה זו. אפשר להמשיך — הקריאה תסומן «ללא מטפל» ומנהל המערכת יקבל התראה לשיבוץ ידני.</div>}
      {isAdmin && <div className="admin-route">
        <div className="ar-title"><ShieldCheck size={14} /> פתיחה כמנהל</div>
        {track === "facility" && (() => {
          const managers = (users || []).filter((u) => u.role === "user" && u.active !== false);
          const supplierOptions = supplierCandidatesForTicket(config, { track: "facility", category }, fleet);
          return <div className="field"><span>מי מטפל?</span>
            <select className="ta" value={supplierAssign ? "supplier:" + supplierAssign : assignTo} onChange={(e) => { const v = e.target.value; if (v.startsWith("supplier:")) { setSupplierAssign(v.slice(9)); setAssignTo("self"); } else { setSupplierAssign(""); setAssignTo(v); } }}>
              <option value="self">— נשארת לטיפול/שיוך על ידי —</option>
              {supplierOptions.length > 0 && <optgroup label="ספק / קבלן">{supplierOptions.map((n) => <option key={n} value={"supplier:" + n}>{n}</option>)}</optgroup>}
              {managers.length > 0 && <optgroup label="מנהל מחלקה">{managers.map((u) => <option key={u.id} value={"mgr:" + u.id}>{u.name}{u.dept ? " · " + u.dept : ""}</option>)}</optgroup>}
            </select>
            <div className="hint">{!category ? "בחרו קטגוריה כדי לראות ספקים מתאימים." : "השיוך הוא לספק. הטכנאים המשויכים אליו יראו את הקריאה ויוכלו לקבל אותה לטיפול."}</div>
          </div>;
        })()}
        <label className="chk-line"><input type="checkbox" checked={slaOn} onChange={(e) => setSlaOn(e.target.checked)} /> הגדרת SLA ידני (שעות)</label>
        {slaOn && <label className="field"><input type="number" inputMode="numeric" value={slaH} onChange={(e) => setSlaH(e.target.value)} /></label>}
        <details className="perm-fold admin-manual-fold">
          <summary><span>פתיחה רטרואקטיבית</span><span className="perm-summary">{retro.on ? "פעיל" : "כבוי"}</span></summary>
          <label className="chk-line"><input type="checkbox" checked={retro.on} onChange={(e) => setRetro((s) => ({ ...s, on: e.target.checked }))} /> הזנת קריאה היסטורית ידנית</label>
          {retro.on && <>
            <div className="manual-grid">
              <label className="field"><span>נפתחה בפועל</span><input type="datetime-local" value={retro.createdAt} onChange={(e) => setRetro((s) => ({ ...s, createdAt: e.target.value }))} /></label>
              <label className="field"><span>עודכנה / נסגרה בפועל</span><input type="datetime-local" value={retro.updatedAt} onChange={(e) => setRetro((s) => ({ ...s, updatedAt: e.target.value }))} /></label>
              <label className="field"><span>יעד SLA</span><input type="datetime-local" value={retro.dueAt} onChange={(e) => setRetro((s) => ({ ...s, dueAt: e.target.value }))} /></label>
              <label className="field"><span>סטטוס סופי</span><select value={retro.status} onChange={(e) => setRetro((s) => ({ ...s, status: e.target.value }))}>{STATUSES.filter((st) => st.id !== "pending_manager" && st.id !== "rework").map((st) => <option key={st.id} value={st.id}>{st.label}</option>)}</select></label>
              {retro.status === "waiting" && <label className="field"><span>סיבת המתנה</span><select value={retro.waitingReason} onChange={(e) => setRetro((s) => ({ ...s, waitingReason: e.target.value }))}>{wReasons(config).map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></label>}
              {track === "transport" && <label className="field"><span>תחילת השבתה</span><input type="datetime-local" value={retro.downtimeStart} onChange={(e) => setRetro((s) => ({ ...s, downtimeStart: e.target.value }))} /></label>}
              {track === "transport" && <label className="field"><span>סיום השבתה</span><input type="datetime-local" value={retro.downtimeEnd} onChange={(e) => setRetro((s) => ({ ...s, downtimeEnd: e.target.value }))} /></label>}
              {retro.status === "done" && <label className="field"><span>מועד חתימה / סגירה</span><input type="datetime-local" value={retro.closedAt} onChange={(e) => setRetro((s) => ({ ...s, closedAt: e.target.value }))} /></label>}
              {retro.status === "done" && <label className="field"><span>עלות</span><input type="number" value={retro.costAmount} onChange={(e) => setRetro((s) => ({ ...s, costAmount: e.target.value }))} inputMode="decimal" /></label>}
              {retro.status === "done" && <label className="field"><span>ספק בעלות</span><select value={retro.costSupplier} onChange={(e) => setRetro((s) => ({ ...s, costSupplier: e.target.value }))}><option value="">— ללא —</option>{config.suppliers.map((s) => <option key={s}>{s}</option>)}</select></label>}
              {retro.status === "done" && <label className="field wide"><span>הערת סגירה</span><input value={retro.costNote} onChange={(e) => setRetro((s) => ({ ...s, costNote: e.target.value }))} /></label>}
            </div>
            <div className="hint">מיועד לייבוא ידני של קריאות ישנות. פירוק זמן לפי שלבי טיפול אפשר לדייק אחר כך מתוך כרטיס הקריאה.</div>
          </>}
        </details>
      </div>}
      <div className="field"><span>תמונה (אופציונלי)</span><input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handlePhoto(e.target.files?.[0])} />{photo ? <div className="photo-prev"><img src={photo} alt="" /><button className="photo-x" onClick={() => setPhoto(null)}><X size={16} /></button></div> : <button className="photo-add" onClick={() => fileRef.current?.click()}><Camera size={20} /> צירוף תמונה</button>}</div>
      {track === "facility" && BROWSER_AI_ENABLED && <><button className="ai-suggest" onClick={aiSuggest} disabled={aiBusy}>{aiBusy ? <><span className="spinner sm" /> מנתח…</> : <><Sparkles size={16} /> ניתוח חכם (AI) — לפי תיאור{photo ? " ותמונה" : ""}</>}</button>
      <div className="hint" style={{ margin: "2px 2px 10px" }}>ה-AI ינתח את התיאור והתמונה (אם צורפה) וישלים קטגוריה, עדיפות ותיאור משופר — ותוכלו לאשר או לערוך.</div>
      {aiNote && <div className="ai-note">{aiNote}</div>}</>}
      {err && <div className="err">{err}</div>}
      <button className="btn-primary full" onClick={submit} disabled={busy}>{busy ? <><span className="spinner sm" /> שולח…</> : <><Send size={16} /> שליחת הקריאה</>}</button>
      <div style={{ height: 24 }} />
    </div>
    {dupeReview && <div className="ovl-backdrop modal2" onClick={() => { setDupeReview(null); setPendingT(null); }}><div className="modal2-panel" onClick={(e) => e.stopPropagation()}>
      <div className="modal2-head"><div className="form-title"><AlertTriangle size={16} style={{ verticalAlign: "-2px", color: "#EA580C" }} /> {dupeReview.mode === "open" ? "קיימת קריאה פתוחה לכלי הזה" : "קריאות קודמות לכלי הזה"}</div><button className="icon-btn" onClick={() => { setDupeReview(null); setPendingT(null); }} aria-label="סגירת בדיקת קריאות דומות"><X size={20} /></button></div>
      <div className="modal2-body">
        <div className="note" style={{ marginTop: 0 }}>{dupeReview.mode === "open" ? "נמצאה קריאה פתוחה על אותו כלי שינוע. בדקו אם נכון להמשיך באותה קריאה לפני פתיחת חדשה." : "לא נמצאה קריאה פתוחה על הכלי. אלו הקריאות האחרונות שנסגרו על אותו כלי, לצורך בדיקת היסטוריה."}</div>
        <div className="timeline" style={{ marginTop: 12 }}>{dupeReview.tickets.slice(0, 6).map((t) => <div className={"tl-item" + (isOpen(t) ? " dup-open" : "")} key={t.id}><div className="tl-dot" style={{ background: isOpen(t) ? stOf(t.status).color : "#16A34A" }} /><div className="tl-body"><div className="tl-text">#{ticketNo(t)} · {t.subject}{isOpen(t) && <span className="dup-tag">עדיין פתוחה</span>}</div><div className="tl-meta">{stOf(t.status).label} · נפתחה {fmtDate(t.createdAt)} ע״י {t.createdBy?.name}{!isOpen(t) && t.closure ? ` · נסגרה ${fmtDate(t.closure.signedAt)}` : ""}</div>{onOpenTicket && <button className="repeat-link" onClick={() => { setDupeReview(null); setPendingT(null); onCancel(); onOpenTicket(t.id); }}>מעבר לקריאה</button>}</div></div>)}</div>
        <div className="row2" style={{ marginTop: 14 }}><button className="btn-ghost" onClick={() => { setDupeReview(null); setPendingT(null); }}>חזרה לעריכה</button><button className="btn-primary" onClick={proceedAnyway}>{dupeReview.mode === "open" ? "פתח קריאה חדשה בכל זאת" : "פתח קריאה חדשה"}</button></div>
      </div>
    </div></div>}
    </div>);
}

/* ============================================================ TICKET DETAIL */
function ticketDetailUi() {
  return {
    AlertTriangle,
    CalendarClock,
    Camera,
    CheckCircle2,
    ChevronLeft,
    Clock,
    ConfirmBtn,
    Copy,
    DollarSign,
    Gauge,
    HardHat,
    History,
    ListChecks,
    MapPin,
    Meta,
    Package,
    PenLine,
    Phone,
    RefreshCw,
    Search,
    SectionTitle,
    Send,
    ShieldCheck,
    SlaBar,
    Sparkles,
    TicketCard,
    Trash2,
    Truck,
    User,
    Wrench,
    X,
    CATEGORIES,
    PRIORITIES,
    REJECT_REASONS,
    STATUSES,
    WEAR,
    ADMIN_TICKET_DURATION_FIELDS,
    TICKET_PHOTOS,
    TRACKS,
    applyAdminTicketManualEdit,
    canConfirmTicketForSession,
    catMeta,
    catOf,
    computeRisk,
    countLabel,
    datetimeValueToMs,
    downtimeMs,
    dtLevels,
    dtOf,
    entryFor,
    facilityOwnerPatch,
    fleetDeptOf,
    fmtDate,
    fmtDur,
    fmtTime,
    ils,
    inputDateTime,
    isOpen,
    normalizeFacilitySupplierPatch,
    normalizedTicketLifecycleStages,
    ownsPendingUserTicket,
    pausePatch,
    prOf,
    reasonBall,
    reasonsForRole,
    rejectLabel,
    similarTickets,
    slaForTicket,
    stOf,
    statusMsToHours,
    supplierCandidatesForTicket,
    ticketAiPrompt,
    ticketMissedSla,
    ticketNo,
    ticketWaitReasonLabel,
    trackOf,
    unitLabel,
    waitReasonLabel,
    waitReasonLifecycleMeta,
    wReasons
  };
}

function TicketDetail(props) {
  return <Suspense fallback={<div className="ovl-inner"><div className="note">טוען קריאה…</div></div>}>
    <TicketDetailLazy {...props} ui={ticketDetailUi()} />
  </Suspense>;
}









function ProfileModal({ session, onSave, onClose }) {
  const [email, setEmail] = useState(session?.email || "");
  const [phone, setPhone] = useState(session?.phone || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);
  const canEditEmail = session?.role === "admin" || session?.role === "user" || session?.productionSession;
  const submit = async () => {
    setErr("");
    setSaved(false);
    if (canEditEmail && !email.trim()) return setErr("הזינו דוא״ל");
    if (canEditEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setErr("הזינו דוא״ל תקין");
    if (newPassword && newPassword.length < 6) return setErr("סיסמה חדשה חייבת לכלול לפחות 6 תווים");
    if (newPassword && newPassword !== confirm) return setErr("הסיסמאות אינן זהות");
    setBusy(true);
    const result = await onSave({ email: email.trim(), phone: phone.trim(), newPassword: newPassword || "" });
    setBusy(false);
    if (!result?.ok) {
      const map = {
        password_min_6: "סיסמה חדשה חייבת לכלול לפחות 6 תווים",
        email_invalid: "הזינו דוא״ל תקין",
        phone_too_long: "מספר הטלפון ארוך מדי",
        access_token_required: "נדרש להתחבר מחדש",
      };
      return setErr(map[result?.error] || "שמירת הפרופיל נכשלה. נסו שוב.");
    }
    setNewPassword("");
    setConfirm("");
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };
  return <div className="modal2-panel profile-modal">
    <div className="modal2-head"><div className="form-title"><User size={17} /> הפרופיל שלי</div><button className="icon-btn" aria-label="סגירה" onClick={onClose}><X size={20} /></button></div>
    <div className="modal2-body">
      <div className="profile-head">
        <div className="avatar big">{(session?.name || "?").charAt(0)}</div>
        <div><div className="profile-name">{session?.name || "—"}</div><div className="hint">{ROLE_LABEL[session?.role] || session?.role || ""}{session?.dept ? " · " + session.dept : ""}</div></div>
      </div>
      <label className="field"><span><Phone size={14} /> טלפון</span><input className="ltr-input" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" placeholder="050-0000000" /></label>
      {canEditEmail && <label className="field"><span><Mail size={14} /> דוא״ל</span><input className="ltr-input" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoCapitalize="off" autoComplete="email" /></label>}
      <div className="profile-password">
        <SectionTitle><KeyRound size={15} /> שינוי סיסמה</SectionTitle>
        <label className="field compact"><input className="ltr-input" dir="ltr" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" autoComplete="new-password" placeholder="סיסמה חדשה" /></label>
        <label className="field compact"><input className="ltr-input" dir="ltr" value={confirm} onChange={(e) => setConfirm(e.target.value)} type="password" autoComplete="new-password" placeholder="אישור סיסמה חדשה" /></label>
      </div>
      {err && <div className="err">{err}</div>}
      {saved && <div className="note ok">הפרופיל נשמר ✓</div>}
      <button className="btn-primary full" onClick={submit} disabled={busy}>{busy ? "שומר…" : "שמירת פרופיל"}</button>
    </div>
  </div>;
}

function AppIssueReportModal({ session, draft, onSave, onClose }) {
  const [description, setDescription] = useState("");
  const [screenshot, setScreenshot] = useState("");
  const [screenshotContext, setScreenshotContext] = useState({});
  const [captureStatus, setCaptureStatus] = useState("idle");
  const [captureError, setCaptureError] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!draft) return;
    setScreenshot(draft.screenshot || "");
    setScreenshotContext(draft.screenshotContext || {});
    setCaptureStatus(draft.captureStatus || "idle");
    setCaptureError(draft.captureError || "");
  }, [draft]);
  const pickScreenshot = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setErr("");
    try { setScreenshot(await imageFileToDataUrl(file)); setCaptureStatus("manual"); setCaptureError(""); }
    catch { setErr("לא ניתן לקרוא את התמונה. נסו קובץ PNG או JPG."); }
  };
  const submit = async () => {
    setErr("");
    setBusy(true);
    try {
      const location = typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "";
      const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
      const ok = await onSave(createAppIssue({ description, screenshot, screenshotContext, session, location, userAgent }));
      if (ok === false) throw new Error("save_failed");
    } catch (e) {
      setErr(e?.message === "description_required" ? "כתבו תיאור קצר של הבעיה" : e?.message === "description_too_long" ? "התיאור ארוך מדי" : "השמירה נכשלה. נסו שוב.");
    } finally { setBusy(false); }
  };
  return <div className="modal2-panel issue-modal">
    <div className="modal2-head"><div className="form-title"><Bug size={17} /> דיווח על בעיה במערכת</div><button className="icon-btn" aria-label="סגירה" onClick={onClose}><X size={20} /></button></div>
    <div className="modal2-body">
      <div className="hint" style={{ margin: "0 0 12px" }}>זה לא פותח קריאת אחזקה. זה נשמר ביומן פנימי כדי שנוכל לבדוק ולתקן את המערכת.</div>
      <label className="field"><span>מה קרה?</span><textarea rows={5} value={description} maxLength={1200} onChange={(e) => setDescription(e.target.value)} placeholder="לדוגמה: הכפתור לא מגיב / המסך קופץ / חסר שדה…" /></label>
      <div className="issue-capture-box">
        <div className="issue-capture-head"><Camera size={16} /><b>צילום מסך</b><span>{captureStatus === "capturing" ? "מצלם את המסך הנוכחי…" : screenshot ? "מצורף לדיווח" : "לא צורף"}</span></div>
        {captureError && !screenshot && <div className="hint">לא הצלחנו לצלם אוטומטית. אפשר לצרף תמונה ידנית.</div>}
        <label className="btn-ghost full" style={{ cursor: "pointer" }}><input type="file" accept="image/*" hidden onChange={pickScreenshot} /><Camera size={16} /> {screenshot ? "החלפת צילום" : "צירוף צילום ידני"}</label>
      </div>
      {screenshot && <div className="issue-shot"><img src={screenshot} alt="צילום מסך מצורף" /><button className="photo-x" onClick={() => { setScreenshot(""); setCaptureStatus("removed"); }}><X size={16} /></button></div>}
      {err && <div className="err">{err}</div>}
      <button className="btn-primary full" onClick={submit} disabled={busy}>{busy ? "שומר…" : "שליחת דיווח"}</button>
    </div>
  </div>;
}

/* ============================================================ SHARED UI */
const ROLE_PREVIEW_OPTIONS = [["admin", "מנהל", ShieldCheck], ["executive", "הנהלה", BarChart3], ["user", "ראש צוות", User], ["tech", "טכנאי", HardHat], ["worker", "עובד", UserPlus]];

function BrandMark({ logo, small = false }) {
  return <div className={"brand-mark" + (small ? " sm" : "") + (logo ? " has-logo" : "")}>
    {logo ? <img src={logo} alt="" /> : <><Hexagon className="brand-mark-hex" size={small ? 28 : 34} /><span className="brand-mark-core" /></>}
  </div>;
}

function RolePreviewBox({ rolePreview, language = DEFAULT_LANGUAGE, compact = false }) {
  const [open, setOpen] = useState(false);
  if (!rolePreview) return null;
  const active = ROLE_PREVIEW_OPTIONS.find(([role]) => role === rolePreview.active);
  const ActiveIcon = active?.[2] || ShieldCheck;
  const activeLabel = roleLabelFor(rolePreview.active, language);
  return <div className="role-preview">
    <button className={"rp-toggle" + (compact ? " compact" : "") + (open ? " on" : "")} type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={localizedUiLabel(language, "rolePreview.open", "פתיחת תצוגת תפקיד")}>
      <span className="rp-toggle-ic"><ActiveIcon size={17} /></span>
      <span className="rp-toggle-txt"><b>{compact ? "תפקיד" : localizedUiLabel(language, "rolePreview.title", "תצוגת תפקיד")}</b>{!compact && <small>{activeLabel} · {rolePreview.realName}</small>}</span>
      <ChevronLeft size={15} className="rp-toggle-chev" />
    </button>
    {open && <div className="rp-grid">{ROLE_PREVIEW_OPTIONS.map(([role, label, Icon]) => {
      const roleLabel = roleLabelFor(role, language) || label;
      const title = localizedUiLabel(language, "rolePreview.showAs", "הצג כ-{role}").replace("{role}", roleLabel);
      return <button key={role} className={"rp-btn" + (rolePreview.active === role ? " on" : "")} title={title} aria-label={title} onClick={() => { rolePreview.onChange(role); setOpen(false); }}><Icon size={15} /><span>{roleLabel}</span></button>;
    })}</div>}
  </div>;
}

function Sidebar({ session, config, onLogout, nav = [], primary, notif, onBell, rolePreview, theme, toggleTheme, onReportIssue, onProfile }) {
  return (<aside className="sidebar">
    <div className="side-brand"><BrandMark logo={config?.brandLogo} small /><div><div className="brand-title sm">{brandCompanyName(config)}</div>{brandSiteSubtitle(config) && <div className="brand-sub sm">{brandSiteSubtitle(config)}</div>}</div></div>
    {primary && <button className="side-newbtn" onClick={primary.onClick}><Plus size={18} /> {primary.label}</button>}
    <div className="side-nav">{nav.map((n) => <button key={n.id} className={"side-item" + (n.active ? " on" : "")} onClick={n.onClick}><n.Icon size={19} /><span>{n.label}</span></button>)}<button className="side-item" onClick={onBell}><Bell size={19} /><span>התראות</span>{notif?.unread > 0 && <span className="side-badge">{notif.unread}</span>}</button></div>
    <div className="side-foot">
      <button className="side-item" onClick={toggleTheme}>{theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}<span>{theme === "dark" ? "מצב בהיר" : "מצב כהה"}</span></button>
      {onProfile ? <button className="side-user side-user-btn" onClick={onProfile} aria-label="הפרופיל שלי"><div className="avatar">{(session.name || "?").charAt(0)}</div><div><div className="su-name">{session.name}</div><div className="su-role">{ROLE_LABEL[session.role]}{session.dept ? " · " + session.dept : ""}</div></div></button> : <div className="side-user"><div className="avatar">{(session.name || "?").charAt(0)}</div><div><div className="su-name">{session.name}</div><div className="su-role">{ROLE_LABEL[session.role]}{session.dept ? " · " + session.dept : ""}</div></div></div>}
      <button className="side-logout" onClick={onLogout}><LogOut size={18} /> יציאה</button>
      <RolePreviewBox rolePreview={rolePreview} />
      {onReportIssue && <button className="side-report" onClick={onReportIssue}><Bug size={14} /> דיווח על בעיה</button>}
      <div className="side-version" title={APP_BUILD_TIME ? `Build ${APP_BUILD_COMMIT} · ${APP_BUILD_TIME}` : `Build ${APP_BUILD_COMMIT}`}>CMMS CDSL · v{APP_VERSION} · {APP_BUILD_COMMIT}</div>
    </div>
  </aside>);
}
function TopBar({ title, subtitle, onLogout, notif, onBell, rolePreview, theme, toggleTheme, extra, demoActive, onProfile, onReportIssue }) {
  return (<header className="topbar"><div className="tb-left"><div><div className="tb-title">{title}{demoActive && <span className="demo-badge">נתוני דמו</span>}</div>{subtitle && <div className="tb-sub">{subtitle}</div>}</div>{extra}</div>
    <div className="tb-actions"><button className="bell" onClick={toggleTheme} aria-label={theme === "dark" ? "מצב בהיר" : "מצב כהה"}>{theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}</button><button className="bell" onClick={onBell} aria-label="התראות"><Bell size={20} />{notif?.unread > 0 && <span className="dot">{notif.unread > 9 ? "9+" : notif.unread}</span>}</button>{onReportIssue && <button className="bell" onClick={onReportIssue} aria-label="דיווח על בעיה במערכת" title="דיווח על בעיה במערכת"><Bug size={19} /></button>}{onProfile && <button className="bell" onClick={onProfile} aria-label="הפרופיל שלי"><User size={19} /></button>}{rolePreview && <div className="tb-role-preview"><RolePreviewBox rolePreview={rolePreview} compact /></div>}<button className="tb-logout" onClick={onLogout} aria-label="יציאה מהמערכת"><LogOut size={17} /><span>יציאה</span></button></div></header>);
}
function Overlay({ children, onClose, persistent, panelClassName = "" }) {
  const ref = useRef(null);
  useEffect(() => {
    const myDepth = (document.body._ovl = (document.body._ovl || 0) + 1);
    document.body.classList.add("modal-open");
    const prevFocus = document.activeElement;
    const root = ref.current;
    const sel = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusables = () => root ? Array.from(root.querySelectorAll(sel)).filter((el) => el.offsetParent !== null) : [];
    const t = setTimeout(() => { const f = focusables(); (f[0] || root)?.focus(); }, 0);
    const onKey = (e) => {
      if ((document.body._ovl || 1) !== myDepth) return; // только верхняя модалка реагирует
      if (e.key === "Escape" && !persistent) { e.preventDefault(); e.stopImmediatePropagation(); onClose && onClose(); return; }
      if (e.key === "Tab") { const f = focusables(); if (!f.length) return; const first = f[0], last = f[f.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } }
    };
    document.addEventListener("keydown", onKey, true);
    return () => { clearTimeout(t); document.removeEventListener("keydown", onKey, true); const left = (document.body._ovl = Math.max(0, (document.body._ovl || 1) - 1)); if (left === 0) document.body.classList.remove("modal-open"); try { prevFocus && prevFocus.focus && prevFocus.focus(); } catch {} };
  }, []);
  const node = <div className="ovl-backdrop" onClick={persistent ? undefined : onClose} role="presentation"><div ref={ref} className={"ovl-panel" + (panelClassName ? ` ${panelClassName}` : "")} role="dialog" aria-modal="true" tabIndex={-1} onClick={(e) => e.stopPropagation()}>{children}</div></div>;
  return typeof document === "undefined" ? node : createPortal(node, document.body);
}
function AIFab({ onClick }) { return <button className="ai-fab" aria-label="עוזר AI" title="עוזר AI" onClick={onClick}><Sparkles size={22} /></button>; }
function AIPanelFallback({ onClose }) {
  return <div className="ovl-backdrop ai-back" onClick={onClose}>
    <div className="ai-panel" onClick={(e) => e.stopPropagation()}>
      <div className="ai-head">
        <div className="ai-title"><span className="ai-orb"><Sparkles size={16} /></span> עוזר AI</div>
        <button className="icon-btn" aria-label="סגירה" onClick={onClose}><X size={20} /></button>
      </div>
      <div className="ai-msgs"><div className="ai-msg assistant"><span className="spinner sm dark" /> טוען…</div></div>
    </div>
  </div>;
}
function LazyAIPanel(props) {
  const executeAction = createAiAgentActionExecutor({ ...props, createMemoryFact: saveAIMemoryFact }, { makeId: uid, saveFailedMessage: SAVE_FAILED_MESSAGE });
  const editAction = props.openAiTicketDraft ? createAiAgentTicketDraftEditor({ openAiTicketDraft: props.openAiTicketDraft }) : null;
  return <Suspense fallback={<AIPanelFallback onClose={props.onClose} />}>
    <AIPanel {...props} visibleTickets={visibleTickets} buildContext={buildAIContextSnapshot} callModel={callClaude} callAssistant={callAIAssistant} executeAction={executeAction} editAction={editAction} loadConversationAccess={loadAIConversationAccess} loadConversations={loadAIConversations} createConversation={startAIConversation} openConversation={openAIConversation} archiveConversation={archiveAIConversation} loadMemoryFacts={loadAIMemoryFacts} updateMemoryFact={reviseAIMemoryFact} deactivateMemoryFact={forgetAIMemoryFact} />
  </Suspense>;
}
function NotifPanelFallback({ onClose }) {
  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") onClose && onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return <div className="ovl-backdrop notif-back" onClick={onClose}>
    <div className="notif-panel" role="dialog" aria-modal="true" aria-label="התראות" onClick={(e) => e.stopPropagation()}>
      <div className="notif-head">
        <div><div className="notif-title"><Bell size={18} /> התראות</div><div className="notif-count">טוען…</div></div>
        <button className="icon-btn" aria-label="סגירה" onClick={onClose}><X size={20} /></button>
      </div>
      <div className="notif-list"><div className="empty sm"><span className="spinner sm dark" /><div className="empty-t">טוען התראות…</div></div></div>
    </div>
  </div>;
}
function NotifPanel(props) {
  return <Suspense fallback={<NotifPanelFallback onClose={props.onClose} />}>
    <NotificationPanelLazy {...props} ui={{ timeAgo }} />
  </Suspense>;
}
function Toast({ t, onClose }) { return <div className="toast" onClick={onClose}><Bell size={18} style={{ flexShrink: 0, marginTop: 1 }} /><div><div className="toast-title">{t.title}</div><div className="toast-body">{t.body}</div></div></div>; }
const ticketTone = (tone) => statusTokenTone(tone);
const ticketToneForColor = (color, fallbackTone = "neutral") => {
  const value = String(color || "").toUpperCase();
  if (value.includes("DC2626") || value.includes("B91C1C") || value.includes("7F1D1D")) return ticketTone("danger");
  if (value.includes("EA580C") || value.includes("F59E0B") || value.includes("CA8A04") || value.includes("B45309") || value.includes("D97706")) return ticketTone("warning");
  if (value.includes("16A34A") || value.includes("0D9488") || value.includes("047857")) return ticketTone("success");
  if (value.includes("1D4ED8") || value.includes("2563EB") || value.includes("3B82F6") || value.includes("1F4E8C")) return ticketTone("info");
  return ticketTone(fallbackTone);
};
function SlaBar({ t, config, big }) {
  const total = Math.max(0, (t.dueAt ?? 0) - (t.createdAt ?? 0)), elapsed = ticketOperationalElapsed(t, config);
  const pct = Math.min(100, Math.max(0, total > 0 ? (elapsed / total) * 100 : 0));
  const done = t.status === "done" || t.status === "cancelled";
  const color = done ? "var(--muted)" : pct >= 100 ? ticketTone("danger").color : pct >= 75 ? ticketTone("process").color : pct >= 50 ? ticketTone("warning").color : ticketTone("success").color;
  const remain = ticketOperationalRemaining(t, config);
  const label = done ? (t.status === "done" ? "טופל" : "בוטל") : remain == null ? "ללא SLA" : remain > 0 ? `נותרו ${fmtDur(remain)}` : `חריגה ${fmtDur(-remain)}`;
  return (<div className={"sla" + (big ? " big" : "")}><div className="sla-track"><div className="sla-fill" style={{ width: (done ? 100 : pct) + "%", background: color }} /></div>{big && <div className="sla-lbl" style={{ color }}>{label}</div>}</div>);
}
function TicketCard({ t, admin, onClick, fleet, users, config }) {
  const c = catOf(t), pr = prOf(t.priority), s = stOf(t.status), tr = TRACKS[t.track];
  const risk = (isOpen(t) && admin && fleet && config) ? computeRisk(t, fleet, config) : null;
  const showRiskBadge = risk && (risk.level === "orange" || risk.level === "red");
  const showStatusBadge = !(t.status === "waiting" && t.waitingReason);
  const effectiveAssignee = transportTechnicianAssignee(t, fleet || []);
  const waitingForTechAcceptance = isOpen(t) && t.status === "new" && ballIn(t) === "tech" && !effectiveAssignee;
  const waitTone = ticketTone("warning");
  const dangerTone = ticketTone("danger");
  const adminTone = ticketTone("info");
  const statusBadge = waitingForTechAcceptance ? { label: "ממתין לקבלה", color: waitTone.color, bg: waitTone.bg } : s;
  const riskTone = showRiskBadge ? ticketToneForColor(risk.color, risk.level === "red" ? "danger" : "warning") : null;
  const downtimeTone = ticketToneForColor(dtOf(t.downtimeType, config).color, "warning");
  const missingHandler = users ? needsHandler(t, users, fleet || []) : false;
  const showSubAssignee = admin && t.assignee && !isOpen(t);
  const holder = isOpen(t) ? ballHolder(t, fleet || []) : null;
  const stateSince = t.updatedAt || t.createdAt;
  const holderTone = holder ? ticketToneForColor(holder.color, "info") : null;
  const unit = t.track === "transport" ? (fleet || []).find((f) => f.id === t.forkliftId || f.code === t.asset) : null;
  const assetLabel = t.track === "transport" ? [unitTypeName(unit, config), unit?.code || t.asset].filter(Boolean).join(" · ") : (t.zone || t.asset || tr?.short);
  const meta = [
    assetLabel ? <span key="asset" className="track-tag" style={{ color: tr?.color }}><tr.Icon size={11} /><span>{assetLabel}</span></span> : null,
    showSubAssignee ? <span key="assignee"><Wrench size={11} /> {t.assignee}</span> : null,
    timeAgo(t.createdAt),
    t.closure ? ils(t.closure.costAmount || 0) : null
  ].filter(Boolean);
  return (<button className="tcard" onClick={onClick} style={{ borderInlineStartColor: missingHandler ? dangerTone.color : pr.color }}>
    <div className="tcard-icon" style={{ background: ticketToneForColor(c.color, "accent").bg }}><c.Icon size={20} color={ticketToneForColor(c.color, "accent").color} /></div>
    <div className="tcard-main">
      <div className="tcard-row1"><span className="tcard-subj">{t.subject}</span><span className="tcard-no">#{ticketNo(t)}</span></div>
      <div className="tcard-sub">{meta.map((x, i) => <React.Fragment key={i}>{i > 0 && <span className="sep">·</span>}{x}</React.Fragment>)}</div>
      {holder
        ? <div className="tcard-state" style={{ color: holderTone.color }}><holder.Icon size={12} /> אצל: {holder.label} · {fmtDur(Date.now() - stateSince)}</div>
        : <div className="tcard-state" style={{ color: s.color }}>סטטוס: {s.label}</div>}
      {isOpen(t) && <SlaBar t={t} config={config} />}
      <div className="tcard-badges">
        {showStatusBadge && <span className="badge sm" style={{ color: statusBadge.color, background: statusBadge.bg }}>{statusBadge.label}</span>}
        {ticketBlocks(t, config) && <span className="badge sm" style={{ color: downtimeTone.color, background: downtimeTone.bg }}><ShieldAlert size={11} /> מושבת</span>}
        {missingHandler && <span className="badge sm" style={{ color: dangerTone.color, background: dangerTone.bg }}><AlertTriangle size={11} /> ללא מטפל פעיל</span>}
        {showRiskBadge && <span className="risk-badge" style={{ background: riskTone.bg, color: riskTone.color, borderColor: riskTone.border }}>{risk.label}</span>}
        {t.byAdmin && <span className="badge sm" style={{ color: adminTone.color, background: adminTone.bg }}><ShieldCheck size={11} /> מנהל</span>}
        {t.returned && isOpen(t) && <span className="badge sm" style={{ color: waitTone.color, background: waitTone.bg }}>⤺ הוחזר</span>}
        {ticketMissedSla(t, config) && <span className="badge sm ovd"><AlertTriangle size={11} /> SLA</span>}
        {t.status === "waiting" && t.waitingReason && <span className="badge sm" style={{ color: waitTone.color, background: waitTone.bg }}>{waitReasonLabel(t.waitingReason, config)}</span>}
      </div>
    </div>
  </button>);
}
function Kpi({ num, label, color, small }) { return <div className="kpi"><div className={"kpi-num" + (small ? " sm" : "")} style={{ color }}>{num}</div><div className="kpi-lbl">{label}</div></div>; }
function NavBtn({ active, onClick, Icon, label }) { return <button type="button" className={"navbtn" + (active ? " on" : "")} onClick={onClick}><Icon size={21} /><span>{label}</span></button>; }
function MobileBottomNav({ nav = [], primaryIds = [], label = "ניווט ראשי" }) {
  const [open, setOpen] = useState(false);
  const items = (nav || []).filter(Boolean);
  const preferred = primaryIds.length
    ? primaryIds.map((id) => items.find((n) => n.id === id)).filter(Boolean)
    : items;
  const primary = preferred.slice(0, 4);
  const primaryIdsSet = new Set(primary.map((n) => n.id));
  const overflow = items.filter((n) => !primaryIdsSet.has(n.id));
  const visible = overflow.length ? primary : items.slice(0, 5);
  const moreActive = overflow.some((n) => n.active);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  if (!items.length) return null;
  return (
    <nav className="bottom-nav" aria-label={label}>
      {visible.map((n) => <NavBtn key={n.id} active={n.active} onClick={() => { setOpen(false); n.onClick(); }} Icon={n.Icon} label={n.label} />)}
      {overflow.length > 0 && <>
        <button type="button" className={"navbtn nav-more-btn" + (moreActive || open ? " on" : "")} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <MoreHorizontal size={21} />
          <span>עוד</span>
        </button>
        {open && <div className="nav-more-menu" role="menu">
          {overflow.map((n) => {
            const Icon = n.Icon;
            return <button key={n.id} type="button" role="menuitem" className={"nav-more-item" + (n.active ? " on" : "")} onClick={() => { setOpen(false); n.onClick(); }}>
              <Icon size={18} />
              <span>{n.label}</span>
            </button>;
          })}
        </div>}
      </>}
    </nav>
  );
}
function SectionTitle({ children }) { return <div className="sect">{children}</div>; }
function Meta({ Icon, iconColor, label, value, action }) {
  return <div className="meta"><Icon size={15} color={iconColor || "var(--muted)"} /><div><div className="meta-lbl">{label}</div>{action ? <button type="button" className="meta-val meta-val-edit" onClick={action} title="עריכה מהירה" aria-label={`עריכה מהירה: ${label}`}>{value}</button> : <div className="meta-val">{value}</div>}</div></div>;
}
function Empty({ text, sub, Icon = CheckCircle2 }) { return <div className="empty"><Icon size={34} /><div className="empty-t">{text}</div>{sub && <div className="empty-s">{sub}</div>}</div>; }

function AppIssuesSettingsFallback() {
  return <>
    <SectionTitle><Bug size={15} /> דיווחי בעיות במערכת</SectionTitle>
    <div className="note">טוען יומן בעיות ושגיאות מערכת…</div>
  </>;
}

function AppIssuesSettings(props) {
  return <Suspense fallback={<AppIssuesSettingsFallback />}>
    <AppIssuesSettingsPanel
      {...props}
      ui={{
        Empty,
        Overlay,
        SectionTitle,
        fmtDate,
        fmtTime,
        roleLabel: (role) => ROLE_LABEL[role] || role || "—"
      }}
    />
  </Suspense>;
}

function ConfirmBtn({ onConfirm, label, className = "btn-danger full", style, icon = <Trash2 size={15} /> }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!armed) return; const id = setTimeout(() => setArmed(false), 3500); return () => clearTimeout(id); }, [armed]);
  return <button className={className} style={style} disabled={busy} onClick={async () => {
    if (!armed) return setArmed(true);
    setBusy(true);
    try {
      await onConfirm();
      setArmed(false);
    } finally {
      setBusy(false);
    }
  }}>{busy ? <><span className="spinner sm" /> מוחק…</> : armed ? "לחצו שוב לאישור" : <>{icon} {label}</>}</button>;
}

function ColorPaletteButton({ value, onChange, label = "בחירת צבע", palette = DT_PALETTE }) {
  const [open, setOpen] = useState(false);
  const activeColor = palette.includes(value) ? value : (value || palette[0]);
  return <div className="color-popover">
    <button
      type="button"
      className="color-trigger"
      aria-label={label}
      aria-expanded={open}
      title={label}
      onClick={() => setOpen((v) => !v)}
    >
      <span style={{ background: activeColor }} />
    </button>
    {open && <div className="color-menu" role="listbox" aria-label={label}>
      {palette.map((color) => <button
        key={color}
        type="button"
        className={"color-choice" + (value === color ? " on" : "")}
        style={{ background: color }}
        aria-label={color}
        aria-selected={value === color}
        title={color}
        onClick={() => { onChange(color); setOpen(false); }}
      />)}
    </div>}
  </div>;
}

/* ============================================================ STYLES */
function Style() {
  return (<style>{`
:root{--font-body:'Assistant','Rubik',system-ui,'Segoe UI',Arial,sans-serif;--font-head:'Rubik','Assistant',system-ui,sans-serif;
--brand-white:#FFFFFF;--brand-pearl:#E6E7E9;--brand-dark-pearl:#C9CDD1;--brand-icon:#A4A9B0;--brand-blue:#1F4E8C;--brand-blue-hover:#3E6DB0;--brand-beige:#EDEBE7;--brand-light:#F7F8FA;--brand-ink:#2E3138;--brand-muted:#6F7680;
--bg:var(--brand-white);--surface:var(--brand-white);--surface-2:var(--brand-light);--pearl:var(--brand-pearl);--warm-surface:var(--brand-beige);--warm-soft:#F5F4F1;--warm-line:#D7D5D0;--warning-surface:#F5F4F1;--critical-surface:#FFF1F0;--critical-line:#F5B8B2;--ink:var(--brand-ink);--muted:var(--brand-muted);--line:var(--brand-dark-pearl);--border:var(--line);--input:var(--brand-white);
--primary:var(--brand-blue);--primary-d:var(--brand-blue-hover);--primary-soft:rgba(31,78,140,.10);--primary-line:rgba(31,78,140,.32);--orange:var(--primary);--accent:var(--brand-beige);--slate:var(--brand-ink);--side:var(--brand-white);--side-ink:var(--brand-muted);--icon-muted:var(--brand-icon);
--ease-out:cubic-bezier(0.23,1,0.32,1);--ease-in-out:cubic-bezier(0.77,0,0.175,1);--ease-drawer:cubic-bezier(0.32,0.72,0,1);
--press:scale(.975);--lift-shadow:0 10px 26px rgba(46,49,56,.10);--control-shadow:0 1px 2px rgba(46,49,56,.04),0 0 0 1px rgba(46,49,56,.025);--surface-glow:linear-gradient(180deg,rgba(255,255,255,.96),rgba(247,248,250,.84));}
.app-dark{--bg:#111418;--surface:#1B2027;--surface-2:#15191F;--pearl:#252B33;--warm-surface:#27231D;--warm-line:#474033;--warning-surface:#2B2416;--critical-surface:#2A1717;--critical-line:#743535;--ink:#EEF2F7;--muted:#A4A9B0;--line:#343B45;--border:var(--line);--input:#20262E;--orange:var(--primary);--slate:#10141A;--side:#15191F;--side-ink:#A4A9B0;--control-shadow:0 0 0 1px rgba(255,255,255,.05);--surface-glow:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.02));}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
html{scrollbar-gutter:stable;}
body{margin:0;overflow-x:hidden;}
button{font-family:var(--font-body);cursor:pointer;border:none;background:none;color:inherit;touch-action:manipulation;}
:focus-visible{outline:2px solid var(--primary);outline-offset:2px;border-radius:6px;}
@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important;}}
button:disabled{opacity:.6;cursor:default;}
input,select,textarea{font-family:var(--font-body);font-size:16px;color:var(--ink);}
a{color:inherit;}
.boot{min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg);}
.spinner{width:32px;height:32px;border:3px solid #ffffff55;border-top-color:var(--primary);border-radius:50%;animation:sp .8s linear infinite;}
.spinner.sm{width:15px;height:15px;border-width:2px;display:inline-block;vertical-align:middle;border-color:#ffffff66;border-top-color:#fff;}
.spinner.sm.dark{border-color:var(--line);border-top-color:var(--primary);}
@keyframes sp{to{transform:rotate(360deg);}}
.desk-only{display:none!important;}
@keyframes rise{from{opacity:0;transform:translateY(10px) scale(.985);}to{opacity:1;transform:none;}}
@keyframes cmmsFade{from{opacity:0;}to{opacity:1;}}
@keyframes cmmsSurfaceIn{from{opacity:0;transform:translateY(10px) scale(.98);}to{opacity:1;transform:none;}}
@keyframes cmmsSheetIn{from{opacity:0;transform:translateY(3%);}to{opacity:1;transform:none;}}
@keyframes cmmsDrawerIn{from{opacity:0;transform:translateX(18px) scale(.992);}to{opacity:1;transform:none;}}
@keyframes cmmsToastIn{from{opacity:0;transform:translate(-50%,10px) scale(.98);}to{opacity:1;transform:translate(-50%,0) scale(1);}}
@keyframes cmmsMenuIn{from{opacity:0;transform:translateY(-4px) scale(.985);}to{opacity:1;transform:none;}}
@keyframes cmmsBottomMenuIn{from{opacity:0;transform:translate(-50%,8px) scale(.985);}to{opacity:1;transform:translate(-50%,0) scale(1);}}
.motion-press,
.btn-primary,.btn-ghost,.btn-danger,.btn-close,.icon-btn,.tb-logout,.bell,.role-btn,.login-alt,.install-btn,.install-x,
.chip,.wtoggle,.tcard,.supplier-card,.attn-row,.insight-row.clickable,.doc-line-click,.pm-card,.task-row,.ppe-request-row,
.track-pick,.inline-ai-collapse,.cat-pick,.pr-pick,.seg,.dt-pick,.wk-card,.wk-track,.navbtn,.nav-more-item,.notif-item.clk,.notif-markall,
.pub-zone,.pub-chip,.qchip,.side-item,.side-newbtn,.side-logout,.worker-action-btn,.unit-pick-btn,.unit-pick-row{
  transition-property:transform,box-shadow,border-color,background-color,color,opacity;
  transition-duration:160ms;
  transition-timing-function:var(--ease-out);
}
.btn-primary:active:not(:disabled),.btn-ghost:active:not(:disabled),.btn-danger:active:not(:disabled),.btn-close:active:not(:disabled),
.icon-btn:active:not(:disabled),.tb-logout:active:not(:disabled),.bell:active:not(:disabled),.role-btn:active:not(:disabled),
.chip:active:not(:disabled),.wtoggle:active:not(:disabled),.tcard:active:not(:disabled),.supplier-card:active:not(:disabled),.attn-row:active:not(:disabled),
.insight-row.clickable:active:not(:disabled),.doc-line-click:active:not(:disabled),.pm-card:active:not(:disabled),
.task-row:active:not(:disabled),.track-pick:active:not(:disabled),.inline-ai-collapse:active:not(:disabled),.cat-pick:active:not(:disabled),.pr-pick:active:not(:disabled),
.seg:active:not(:disabled),.dt-pick:active:not(:disabled),.wk-card:active:not(:disabled),.wk-track:active:not(:disabled),
.navbtn:active:not(:disabled),.nav-more-item:active:not(:disabled),.notif-item.clk:active:not(:disabled),.notif-markall:active:not(:disabled),
.pub-zone:active:not(:disabled),.pub-chip:active:not(:disabled),.qchip:active:not(:disabled),.side-item:active:not(:disabled),
.side-newbtn:active:not(:disabled),.side-logout:active:not(:disabled),.worker-action-btn:active:not(:disabled),
.unit-pick-btn:active:not(:disabled),.unit-pick-row:active:not(:disabled){transform:var(--press);}
@media (hover:hover) and (pointer:fine){
  .tcard:hover,.supplier-card:hover,.pm-card:hover,.task-row:hover,.ppe-request-row:hover,.wk-card:hover,.doc-line-click:hover,.attn-row:hover,.insight-row.clickable:hover{box-shadow:var(--lift-shadow);transform:translateY(-1px);}
  .btn-primary:hover:not(:disabled),.btn-ghost:hover:not(:disabled),.btn-danger:hover:not(:disabled),.btn-close:hover:not(:disabled),.icon-btn:hover:not(:disabled),.navbtn:hover:not(:disabled){transform:translateY(-1px);}
}
@supports (content-visibility:auto){
  .tcard,.supplier-card,.pm-card,.task-row,.ppe-request-row,.notif-item,.dept-worker-card,.manager-fleet-row{content-visibility:auto;contain-intrinsic-size:1px 84px;}
  .bi-panel{content-visibility:auto;contain-intrinsic-size:1px 260px;}
}

.login-bg{min-height:100vh;background:linear-gradient(160deg,#FFFFFF,#E6E7E9);display:flex;align-items:center;justify-content:center;padding:20px;position:relative;}
.login-card{background:var(--surface);color:var(--ink);border-radius:20px;padding:26px 22px;width:100%;max-width:390px;box-shadow:0 20px 50px rgba(0,0,0,.35);animation:cmmsSurfaceIn 260ms var(--ease-out) both;}
.login-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:22px;}
.login-theme{width:44px;height:44px;border-radius:11px;color:var(--muted);background:var(--surface-2);border:1.5px solid var(--line);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.login-theme:hover{border-color:var(--primary);color:var(--primary);}
.language-picker{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 14px;color:var(--muted);font-size:12px;font-weight:700;}
.language-picker select{min-height:44px;border:1.5px solid var(--line);border-radius:10px;background:var(--surface);color:var(--ink);padding:0 10px;font:inherit;font-weight:700;}
.language-picker.compact{margin:0;min-width:82px;}
.language-picker.compact select{min-height:44px;width:82px;background:var(--surface-2);color:var(--ink);border-color:var(--line);padding:0 7px;}
.language-picker.compact option{color:#111827;background:#fff;}
.brand{display:flex;align-items:center;gap:13px;min-width:0;}
.brand-mark{position:relative;width:54px;height:54px;border-radius:15px;background:var(--surface);color:var(--ink);display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 1px rgba(46,49,56,.08),0 8px 18px rgba(31,78,140,.10);flex-shrink:0;overflow:hidden;}
.brand-mark.sm{width:46px;height:46px;border-radius:13px;}
.brand-mark.has-logo{background:#fff;color:transparent;}
.brand-mark img{width:100%;height:100%;object-fit:contain;display:block;padding:5px;}
.brand-mark-hex{position:absolute;stroke-width:1.8;color:var(--ink);}
.brand-mark-core{position:absolute;width:13px;height:13px;border:2px solid var(--primary);border-radius:4px;transform:rotate(30deg);background:var(--surface);}
.brand-mark.sm .brand-mark-core{width:10px;height:10px;border-width:1.7px;border-radius:3px;}
.brand-title{font-family:var(--font-head);font-weight:700;font-size:24px;line-height:1;}
.brand-title.sm{font-size:18px;color:var(--ink);line-height:1.12;max-width:150px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.brand-sub{color:var(--muted);font-size:13px;margin-top:3px;}.brand-sub.sm{color:var(--side-ink);font-size:11.5px;max-width:160px;line-height:1.28;}
.login-q{font-family:var(--font-head);font-weight:600;font-size:16px;margin:8px 0 14px;}
.login-users{max-height:48vh;overflow-y:auto;}
.role-btn{display:flex;align-items:center;gap:12px;width:100%;text-align:right;background:var(--surface-2);border:1.5px solid var(--line);border-radius:14px;padding:13px;margin-bottom:10px;color:var(--ink);}
.role-btn:hover{border-color:var(--primary);}
.role-name{font-weight:600;font-size:15px;}.role-desc{color:var(--muted);font-size:12.5px;margin-top:2px;}
.role-chev{margin-inline-start:auto;color:var(--muted);}
.back-link{display:flex;align-items:center;gap:4px;color:var(--muted);font-size:14px;margin-bottom:10px;}
.login-alt{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;margin-top:12px;padding:11px;border:1.5px solid var(--line);border-radius:11px;background:var(--surface);color:var(--ink);font-weight:600;font-size:13.5px;}
.login-foot{display:flex;flex-direction:column;align-items:center;gap:2px;text-align:center;color:var(--muted);font-size:11.5px;margin-top:18px;line-height:1.45;}
.login-foot>span{display:block;}
.install-prompt{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;align-items:center;gap:9px;margin-top:12px;padding:10px 11px;border:1px solid var(--line);border-radius:12px;background:var(--surface-2);color:var(--ink);text-align:start;}
.install-ic{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:rgba(31,78,140,.09);color:var(--primary);flex-shrink:0;}
.install-copy{min-width:0;display:flex;flex-direction:column;gap:2px;line-height:1.35;}
.install-copy b{font-size:13px;font-weight:800;}
.install-copy span{font-size:12px;color:var(--muted);}
.install-btn{width:44px;height:44px;display:inline-flex;align-items:center;justify-content:center;border-radius:11px;background:var(--primary);color:#fff;padding:0;white-space:nowrap;}
.install-btn:hover{background:var(--primary-d);}
.install-x{width:44px;height:44px;border-radius:11px;color:var(--muted);display:flex;align-items:center;justify-content:center;}
.install-x:hover{background:var(--line);color:var(--ink);}
@media(max-width:430px){.install-prompt{grid-template-columns:auto minmax(0,1fr) auto auto;}.install-copy b{font-size:12.5px;}.install-copy span{font-size:11.5px;}.install-btn,.install-x{width:44px;height:44px;}.install-x{align-self:center;}}
@media (min-width:900px){.login-bg{padding:36px;}.login-card{max-width:500px;padding:30px 30px 28px;}.login-q{font-size:17px;}}

.field{display:block;margin-bottom:15px;}
.field>span{display:block;font-size:13.5px;font-weight:600;color:var(--ink);margin-bottom:6px;}
.field.compact{margin-bottom:10px;}
.field input,.field select,.field textarea,.ta{width:100%;border:1.5px solid var(--line);border-radius:11px;padding:12px 13px;background:var(--input);color:var(--ink);outline:none;transition:border-color 160ms var(--ease-out),box-shadow 160ms var(--ease-out),background-color 160ms var(--ease-out);}
.field input:focus,.field select:focus,.field textarea:focus,.ta:focus{border-color:var(--primary);box-shadow:0 0 0 3px rgba(31,78,140,.12);}
.field input.ltr-input,.ltr-input{direction:ltr;text-align:left;unicode-bidi:isolate;}
.field textarea,.ta{resize:vertical;line-height:1.5;}
input:not([type="checkbox"]):not([type="radio"]):not([type="color"]):not([type="file"]),select,textarea{min-height:44px;border:1px solid rgba(148,163,184,.38);border-radius:12px;background:var(--input);color:var(--ink);font:inherit;box-shadow:var(--control-shadow);outline:none;transition:border-color 160ms var(--ease-out),box-shadow 160ms var(--ease-out),background-color 160ms var(--ease-out);}
input:not([type="checkbox"]):not([type="radio"]):not([type="color"]):not([type="file"]):focus,select:focus,textarea:focus{border-color:rgba(31,78,140,.72);box-shadow:0 0 0 3px rgba(31,78,140,.13),var(--control-shadow);}
select{appearance:none;-webkit-appearance:none;padding:0 13px 0 38px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='%236f7680' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");background-position:left 13px center;background-size:18px 18px;background-repeat:no-repeat;font-weight:500;}
select:hover,input:not([type="checkbox"]):not([type="radio"]):not([type="color"]):not([type="file"]):hover,textarea:hover{border-color:rgba(100,116,139,.55);}
.chk-line{min-height:44px;display:flex;align-items:center;gap:9px;font-size:14px;margin-bottom:15px;cursor:pointer;}
.chk-line input{width:20px;height:20px;}
.notify-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px 12px;margin-bottom:12px;}
.notify-kind{margin:0;background:var(--surface-2);border:1px solid var(--line);border-radius:10px;padding:10px 12px;font-weight:700;}
.settings-policy-details{border:1px solid var(--line);border-radius:12px;background:var(--surface);padding:0;margin:14px 0 0;overflow:hidden;}
.settings-policy-details summary{display:flex;align-items:center;gap:8px;cursor:pointer;padding:12px 14px;font-weight:800;color:var(--ink);list-style:none;}
.settings-policy-details summary::-webkit-details-marker{display:none;}
.settings-policy-details summary::before{content:"▸";color:var(--muted);font-size:12px;transition:transform 160ms var(--ease-out);}
.settings-policy-details[open] summary::before{transform:rotate(90deg);}
.settings-policy-details[open]{padding-bottom:12px;}
.settings-policy-details[open] .hint,.settings-policy-details[open] .notify-grid{margin-inline:14px;}
.hint{font-size:12.5px;color:var(--muted);margin-top:6px;}
.err{background:#FEE2E2;color:#B91C1C;font-size:13.5px;font-weight:500;padding:10px 12px;border-radius:10px;margin-bottom:12px;}
.note.ok{border-color:#86EFAC;color:#166534;background:#DCFCE7;}
.tel-link{color:var(--primary);font-weight:700;text-decoration:none;direction:ltr;unicode-bidi:isolate;}
.modal2-panel.profile-modal{max-width:520px;}
.profile-head{display:flex;align-items:center;gap:10px;margin-bottom:12px;background:transparent;border:0;border-radius:0;padding:0;}
.profile-name{font-weight:800;color:var(--ink);line-height:1.2;}
.avatar.big{width:38px;height:38px;font-size:17px;}
.profile-password{border-top:1px solid var(--line);padding-top:10px;margin-top:6px;}
.btn-primary{min-height:44px;background:var(--primary);color:#fff;font-weight:650;font-size:15px;border-radius:12px;padding:13px 18px;display:inline-flex;align-items:center;justify-content:center;gap:7px;box-shadow:0 1px 0 rgba(255,255,255,.16) inset,0 10px 20px rgba(31,78,140,.16);transition:background-color 160ms var(--ease-out),border-color 160ms var(--ease-out),color 160ms var(--ease-out),box-shadow 160ms var(--ease-out),transform 160ms var(--ease-out);}
.btn-primary:hover:not(:disabled){background:var(--primary-d);box-shadow:0 1px 0 rgba(255,255,255,.16) inset,0 12px 24px rgba(31,78,140,.20);}.btn-primary.full{width:100%;}.btn-primary.sm{min-height:44px;padding:9px 14px;font-size:13.5px;}
.btn-danger{min-height:44px;background:var(--surface);color:#DC2626;border:1.5px solid #FCA5A5;font-weight:600;border-radius:11px;padding:12px 16px;display:inline-flex;align-items:center;justify-content:center;gap:7px;}
.btn-danger.full{width:100%;}.btn-danger:hover{background:#FEF2F2;}
.btn-ghost{min-height:44px;background:var(--surface-glow);color:var(--ink);border:1px solid rgba(201,205,209,.86);font-weight:650;border-radius:12px;padding:12px 16px;display:inline-flex;align-items:center;justify-content:center;gap:7px;box-shadow:var(--control-shadow);}
.btn-ghost.sm{min-height:44px;padding:8px 13px;font-size:13px;}.btn-ghost.full{width:100%;}.btn-ghost:hover{background:var(--surface);border-color:rgba(100,116,139,.48);box-shadow:var(--lift-shadow);}
.btn-primary:disabled,.btn-ghost:disabled,.btn-danger:disabled{opacity:.48;cursor:not-allowed;box-shadow:none;transform:none!important;}
.btn-close{min-height:44px;background:#065F46;color:#fff;font-weight:600;border-radius:11px;padding:13px 18px;display:inline-flex;align-items:center;justify-content:center;gap:7px;}
.btn-close.full{width:100%;}.btn-close:hover{background:#047857;}
.icon-btn{width:44px;min-width:44px;height:44px;min-height:44px;flex:0 0 auto;display:flex;align-items:center;justify-content:center;border-radius:11px;color:var(--ink);}
.icon-btn:hover{background:var(--pearl);color:var(--primary);}
.row2{display:flex;gap:8px;}.row2>*{flex:1;}

.app-root{min-height:100vh;background:linear-gradient(180deg,var(--brand-white),var(--brand-light));color:var(--ink);-webkit-font-smoothing:antialiased;}
.sidebar{display:none;}
.main-col{display:flex;flex-direction:column;min-height:100vh;}
.content{flex:1;padding:16px;max-width:640px;margin:0 auto;width:100%;}
.content.with-nav{padding-bottom:88px;}
.row-between{display:flex;align-items:center;justify-content:space-between;gap:12px;}
.banner{display:flex;align-items:center;gap:8px;background:var(--warm-soft);color:var(--ink);border:1px solid var(--warm-line);border-radius:11px;padding:11px 13px;font-size:13.5px;font-weight:600;margin-bottom:12px;}

.topbar{background:rgba(255,255,255,.94);color:var(--ink);padding:12px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px;position:sticky;top:0;z-index:20;box-shadow:0 1px 0 var(--line),0 10px 24px rgba(46,49,56,.08);backdrop-filter:saturate(160%) blur(14px);flex-wrap:wrap;}
.tb-left{display:flex;align-items:center;gap:12px;min-width:0;}
.tb-title{font-family:var(--font-head);font-weight:700;font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.tb-sub{font-size:12px;color:var(--muted);margin-top:2px;}
.tb-actions{display:flex;align-items:center;gap:2px;flex-shrink:0;}
.tb-logout,.bell{width:44px;min-width:44px;height:44px;min-height:44px;flex:0 0 auto;border-radius:11px;color:var(--muted);display:flex;align-items:center;justify-content:center;position:relative;}
.tb-logout{width:auto;min-width:44px;padding:0 11px;gap:5px;font-size:12px;font-weight:700;}
.tb-logout:hover,.bell:hover{background:var(--surface-2);color:var(--primary);}
.bell .dot{position:absolute;top:4px;inset-inline-start:4px;min-width:17px;height:17px;padding:0 4px;border-radius:999px;background:#EF4444;color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;line-height:1;}
.mob-tab{background:var(--surface-2);color:var(--ink);border:1px solid var(--line);border-radius:9px;padding:7px 9px;font-size:13px;max-width:140px;}
.mob-tab option{color:#16202E;}
.tb-role-preview{width:auto;margin-top:0;position:relative;}
.tb-role-preview .role-preview{margin-top:0;position:relative;}
.tb-role-preview .rp-toggle{min-height:44px;}
.tb-role-preview .rp-grid{padding-bottom:0;}

.stat-strip{display:flex;gap:9px;margin-bottom:14px;}
.stat-box{flex:1;background:var(--surface);border:1px solid var(--line);border-radius:13px;padding:12px 8px;text-align:center;}
.stat-num{font-family:var(--font-head);font-weight:700;font-size:24px;color:var(--primary);line-height:1;}
.stat-lbl{font-size:11.5px;color:var(--muted);margin-top:4px;}
.chips{display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;scrollbar-width:thin;scrollbar-color:var(--line) transparent;}.chips::-webkit-scrollbar{height:6px;}.chips::-webkit-scrollbar-thumb{background:var(--line);border-radius:999px;}
.chip{min-height:40px;flex-shrink:0;border:1.5px solid var(--line);background:var(--surface);color:var(--muted);border-radius:999px;padding:8px 14px;font-size:13.5px;font-weight:500;}
.chip.on{background:var(--primary);color:#fff;border-color:var(--primary);}
.kpi-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:6px;}
.kpi{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:15px;transition:border-color 180ms var(--ease-out),box-shadow 180ms var(--ease-out),transform 180ms var(--ease-out);}
.kpi-num{font-family:var(--font-head);font-weight:700;font-size:28px;line-height:1;}.kpi-num.sm{font-size:20px;}
.kpi-lbl{color:var(--muted);font-size:12.5px;margin-top:5px;}
.bi-shell{--bi-font:var(--font-body);--bi-weight:500;--bi-title:20px;--bi-section:14px;--bi-row:13px;--bi-body:12.5px;--bi-caption:11.5px;--bi-number:20px;display:flex;flex-direction:column;gap:14px;font-family:var(--bi-font);font-size:var(--bi-body);font-weight:400;letter-spacing:0;}
.bi-shell *{letter-spacing:0;}
.bi-hero{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:18px 20px;box-shadow:var(--control-shadow);}
.bi-hero h2{font-family:var(--bi-font);font-size:var(--bi-title);font-weight:var(--bi-weight);line-height:1.22;margin:4px 0 5px;}
.bi-hero p{margin:0;color:var(--muted);font-size:var(--bi-row);line-height:1.5;}
.bi-kicker{font-size:var(--bi-caption);font-weight:var(--bi-weight);color:var(--primary);}
.bi-period{flex:0 0 auto;border:1px solid var(--line);border-radius:999px;background:var(--surface-2);padding:8px 12px;font-size:var(--bi-caption);font-weight:var(--bi-weight);color:var(--muted);}
.bi-period-switch{flex:0 0 auto;display:flex;align-items:center;gap:4px;border:1px solid var(--line);border-radius:999px;background:var(--surface-2);padding:4px;box-shadow:inset 0 1px 2px rgba(15,23,42,.04);}
.bi-period-switch button{min-height:44px;border-radius:999px;padding:9px 12px;color:var(--muted);font-size:var(--bi-caption);font-weight:var(--bi-weight);white-space:nowrap;}
.bi-period-switch button:hover{color:var(--ink);background:rgba(255,255,255,.58);}
.bi-period-switch button.on{background:var(--surface);color:var(--primary);box-shadow:var(--control-shadow);}
.bi-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;}
.bi-kpis{grid-template-columns:repeat(5,minmax(0,1fr));}
.bi-kpis .kpi-num{font-family:var(--bi-font);font-size:var(--bi-number);font-weight:var(--bi-weight);line-height:1;}
.bi-kpis .kpi-lbl{font-size:var(--bi-caption);line-height:1.35;}
.bi-command-panel{grid-column:1/-1;}
.bi-heatmap-panel{grid-column:1/-1;overflow:hidden;}
.bi-heatmap-insight{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 8px;padding:8px 10px;border:1px solid rgba(31,78,140,.14);border-radius:11px;background:var(--surface-2);color:var(--muted);font-size:var(--bi-caption);}
.bi-heatmap-insight b{color:var(--ink);font-size:var(--bi-row);font-weight:var(--bi-weight);}
.bi-panel-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;}
.bi-heatmap{contain:paint;display:flex;flex-direction:column;gap:6px;max-width:100%;overflow-x:auto;padding-bottom:2px;overscroll-behavior-inline:contain;}
.bi-heatmap-head,.bi-heatmap-row{display:grid;grid-template-columns:minmax(150px,1.25fr) repeat(6,minmax(76px,1fr));gap:6px;min-width:720px;}
.bi-heatmap-head span{min-width:0;font-size:var(--bi-caption);font-weight:var(--bi-weight);color:var(--muted);padding:0 6px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.bi-heatmap-head span:first-child{text-align:start;}
.bi-heatmap-name,.bi-heatmap-cell{min-height:64px;border:1px solid var(--line);border-radius:12px;background:var(--surface-2);color:var(--ink);box-shadow:var(--control-shadow);transition:background-color 160ms var(--ease-out),border-color 160ms var(--ease-out),box-shadow 160ms var(--ease-out);}
.bi-heatmap-name{min-width:0;overflow:hidden;display:grid;grid-template-rows:minmax(0,1fr) auto auto;align-items:start;justify-items:start;gap:5px;text-align:start;padding:8px 10px;}
.bi-heatmap-name-main{width:100%;min-width:0;display:flex;align-items:flex-start;flex-direction:column;gap:2px;}
.bi-heatmap-name b{max-width:100%;font-size:var(--bi-row);line-height:1.25;white-space:normal;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;}
.bi-heatmap-name small{max-width:100%;overflow:hidden;text-overflow:ellipsis;color:var(--muted);font-size:var(--bi-caption);white-space:nowrap;}
.bi-heatmap-risk-tags{width:100%;max-width:100%;min-width:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:3px;justify-content:stretch;max-height:39px;overflow:hidden;}
.bi-heatmap-risk-tags i{display:block;min-width:0;max-width:none;box-sizing:border-box;overflow:hidden;text-overflow:ellipsis;font-style:normal;border-radius:999px;background:var(--surface);border:1px solid var(--line);color:var(--muted);padding:2px 6px;font-size:10.5px;line-height:1.2;white-space:nowrap;}
.bi-heatmap-ai{display:inline-flex;align-items:center;gap:3px;border-radius:999px;border:1px solid rgba(31,78,140,.18);background:rgba(31,78,140,.06);color:var(--primary);padding:2px 6px;font-size:10.5px;font-weight:600;white-space:nowrap;}
.bi-heatmap-ai:hover{background:rgba(31,78,140,.10);border-color:rgba(31,78,140,.28);}
.bi-heatmap-cell{position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:6px;background:var(--surface);}
.bi-heatmap-cell::before{content:"";position:absolute;inset:0;background:var(--primary);opacity:calc(.05 + var(--heat,0) * .18);pointer-events:none;}
.bi-heatmap-cell.hot{border-color:rgba(31,78,140,.28);}
.bi-heatmap-cell>*{position:relative;}
.bi-heatmap-cell:hover:not(:disabled),.bi-heatmap-name:hover{border-color:rgba(31,78,140,.34);box-shadow:0 8px 20px rgba(31,78,140,.08);}
.bi-heatmap-cell:disabled{cursor:default;color:var(--muted);background:var(--surface);opacity:.62;}
.bi-heatmap-cell b{font-size:var(--bi-number);line-height:1;font-variant-numeric:tabular-nums;}
.bi-heatmap-cell small{font-size:10.5px;color:var(--muted);line-height:1.2;white-space:nowrap;}
.bi-panel{min-width:0;}
.bi-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:12px;}
.bi-panel-head b{display:block;font-family:var(--bi-font);font-size:var(--bi-section);font-weight:var(--bi-weight);line-height:1.35;}
.bi-panel-head span{display:block;color:var(--muted);font-size:var(--bi-caption);line-height:1.4;margin-top:2px;}
.bi-shell b{font-family:var(--bi-font);font-weight:var(--bi-weight);}
.bi-command-stack{display:flex;flex-direction:column;gap:12px;}
.bi-command-domains{display:grid;grid-template-columns:repeat(auto-fit,minmax(168px,1fr));gap:9px;margin:-2px 0 0;}
.bi-command-domain{min-height:64px;display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;align-items:center;gap:10px;text-align:start;border:1px solid var(--line);background:var(--surface-2);border-radius:13px;padding:10px 12px;color:var(--ink);box-shadow:var(--control-shadow);transition:background-color 160ms var(--ease-out),border-color 160ms var(--ease-out),box-shadow 160ms var(--ease-out),transform 160ms var(--ease-out);}
.bi-command-domain:hover{border-color:rgba(31,78,140,.24);background:var(--surface);}
.bi-command-domain.on{border-color:rgba(31,78,140,.42);background:var(--surface);box-shadow:0 1px 0 rgba(255,255,255,.7) inset,0 10px 22px rgba(31,78,140,.08);}
.bi-command-domain-icon{width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(201,205,209,.8);background:var(--surface);border-radius:10px;}
.bi-command-domain-text{min-width:0;display:flex;flex-direction:column;gap:2px;}
.bi-command-domain-text span{font-size:var(--bi-row);font-weight:var(--bi-weight);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.bi-command-domain-text small{font-size:var(--bi-caption);line-height:1.35;color:var(--muted);}
.bi-command-domain-count{min-width:30px;height:28px;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;background:var(--primary-soft);color:var(--primary);font-size:var(--bi-row);font-weight:var(--bi-weight);font-variant-numeric:tabular-nums;}
.bi-command-domain-chev{color:var(--muted);transition:transform 160ms var(--ease-out);}
.bi-command-domain.on .bi-command-domain-chev{transform:rotate(-90deg);color:var(--primary);}
.bi-command-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:8px;}
.bi-attn-row{width:100%;min-height:54px;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:10px;text-align:start;border:1px solid var(--line);background:var(--surface-glow);border-radius:12px;padding:9px 10px;margin-bottom:8px;box-shadow:var(--control-shadow);}
.bi-attn-row:disabled{cursor:default;opacity:.72;}
.bi-command-list .bi-attn-row{margin-bottom:0;}
.bi-attn-row b,.bi-doc-row b{display:block;font-size:var(--bi-row);font-weight:var(--bi-weight);line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.bi-attn-row small,.bi-doc-row span{display:block;color:var(--muted);font-size:var(--bi-caption);line-height:1.4;margin-top:2px;}
.bi-command-meta{display:flex;align-items:center;gap:6px;margin-bottom:3px;}
.bi-command-meta small{margin:0;font-size:var(--bi-caption);color:var(--muted);}
.bi-command-next{color:var(--ink)!important;font-weight:var(--bi-weight);}
.bi-dot{width:10px;height:10px;border-radius:999px;}
.bi-mini-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;}
.bi-mini-stats span{border:1px solid var(--line);background:var(--surface-2);border-radius:12px;padding:10px;text-align:center;}
.bi-mini-stats b{display:block;font-family:var(--bi-font);font-size:var(--bi-number);font-weight:var(--bi-weight);line-height:1.05;color:var(--primary);}
.bi-mini-stats small{display:block;color:var(--muted);font-size:var(--bi-caption);line-height:1.35;margin-top:3px;}
.bi-finance-stats{margin:10px 0;}
.bi-doc-row{display:flex;align-items:center;justify-content:space-between;gap:10px;border-top:1px solid var(--line);padding-top:9px;margin-top:9px;}
.bi-doc-action{width:100%;text-align:start;background:transparent;color:var(--ink);}
.bi-doc-action:hover{color:var(--primary);}
.bi-risk-row{width:100%;min-height:48px;display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:10px;text-align:start;border:1px solid var(--line);background:var(--surface-glow);border-radius:12px;padding:8px 10px;margin-bottom:8px;box-shadow:var(--control-shadow);}
.bi-risk-row:disabled{cursor:default;opacity:.76;}
.bi-risk-row b{display:block;font-size:var(--bi-row);font-weight:var(--bi-weight);line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.bi-risk-row small{display:block;color:var(--muted);font-size:var(--bi-caption);line-height:1.35;margin-top:1px;}
.bi-risk-tags{display:flex;align-items:center;justify-content:flex-end;gap:5px;flex-wrap:wrap;}
.bi-risk-tags em{font-style:normal;border:1px solid rgba(201,205,209,.9);background:var(--surface-2);border-radius:999px;padding:2px 7px;color:var(--muted);font-size:var(--bi-caption);font-weight:var(--bi-weight);line-height:1.35;}
.bi-subtitle{margin:2px 0 6px;color:var(--muted);font-size:var(--bi-caption);font-weight:var(--bi-weight);line-height:1.35;}
.bi-subdivider{height:1px;background:var(--line);margin:10px 0;}
.bi-panel .big-stat{font-family:var(--bi-font);font-size:24px;font-weight:var(--bi-weight);line-height:1.1;}
.bi-filter-note{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;}
.bi-shell .bar-top{font-size:var(--bi-row);line-height:1.35;margin-bottom:5px;}
.bi-shell .bar-lbl,.bi-shell .bar-val{font-weight:var(--bi-weight);}
.bi-shell .bar-val{font-variant-numeric:tabular-nums;}
.bi-shell .note{font-size:var(--bi-body);line-height:1.55;}
.ppe-dash-flow{display:flex;flex-direction:column;gap:22px;}
.ppe-dash-section{min-width:0;}
.ppe-dashboard{display:flex;flex-direction:column;gap:22px;}
.ppe-kpi-grid{display:flex;flex-wrap:wrap;gap:12px;align-items:stretch;}
.ppe-kpi-grid>button{min-height:106px;}
.ppe-request-list{gap:10px;}
.big-stat{font-family:var(--font-head);font-weight:700;font-size:30px;color:#16A34A;}
.wtoggles{display:flex;flex-wrap:wrap;gap:8px;}
.wtoggle{min-height:40px;display:flex;align-items:center;gap:6px;border:1px solid rgba(201,205,209,.86);background:var(--surface-glow);border-radius:999px;padding:8px 13px;font-size:12.5px;font-weight:650;color:var(--muted);box-shadow:var(--control-shadow);}
.wtoggle.on{border-color:var(--primary);color:var(--primary);}

.cards{display:flex;flex-direction:column;gap:10px;}
.tcard{display:flex;gap:12px;width:100%;text-align:right;background:var(--surface-glow);border:1px solid rgba(148,163,184,.28);border-inline-start:4px solid var(--primary);border-radius:14px;padding:13px 14px;box-shadow:var(--control-shadow);}
.tcard:hover{box-shadow:var(--lift-shadow);transform:translateY(-1px);}
.tcard.inert:hover{box-shadow:none;transform:none;}
.tcard-icon{width:42px;height:42px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.tcard-main{flex:1;min-width:0;}
.tcard-row1{display:flex;align-items:baseline;justify-content:space-between;gap:8px;}
.tcard-subj{font-weight:650;font-size:14.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;letter-spacing:0;}
.tcard-no{font-size:11px;color:var(--muted);font-variant-numeric:tabular-nums;flex-shrink:0;}
.tcard-sub{display:flex;align-items:center;gap:4px;flex-wrap:nowrap;color:var(--muted);font-size:12.5px;margin:4px 0 7px;min-width:0;overflow:hidden;white-space:nowrap;}
.tcard-sub svg{flex-shrink:0;}
.tcard-sub .sep{color:var(--line);flex-shrink:0;}
.track-tag{display:inline-flex;align-items:center;gap:3px;font-weight:600;min-width:0;max-width:100%;}
.track-tag span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.tcard-state{display:flex;align-items:center;gap:4px;margin:3px 0 1px;font-size:12px;font-weight:700;}
.tcard-state svg{flex-shrink:0;}
.tcard-badges{display:flex;align-items:center;justify-content:flex-start;gap:6px;margin-top:7px;flex-wrap:wrap;min-width:0;direction:rtl;}
.tcard-badges .badge,.tcard-badges .risk-badge{border:1px solid rgba(201,205,209,.72);}
.tcard-time{margin-inline-start:auto;color:var(--muted);font-size:11.5px;}
.badge{display:inline-flex;align-items:center;gap:4px;font-size:12.5px;font-weight:600;padding:4px 10px;border-radius:999px;}
.badge.sm{font-size:11.5px;padding:3px 9px;}
.badge.ovd{color:#8F1D1D;background:#F7EAEA;border-color:#D8B7B7;}

.sla{margin-top:2px;}
.sla-track{height:5px;border-radius:999px;background:var(--surface-2);overflow:hidden;}
.app-dark .sla-track{background:#0c1119;}
.sla-fill{height:100%;border-radius:999px;transition:background-color 160ms var(--ease-out);}
.sla.big .sla-track{height:8px;}.sla.big{margin:10px 0 4px;}
.sla-lbl{font-size:12px;font-weight:600;margin-top:5px;}

.fab{position:fixed;bottom:calc(84px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);background:var(--primary);color:#fff;border-radius:999px;padding:14px 22px;display:flex;align-items:center;gap:8px;font-weight:600;font-size:15px;box-shadow:0 8px 22px rgba(31,78,140,.30);z-index:18;}
.fab:hover{background:var(--primary-d);}
.ai-fab{position:fixed;bottom:calc(82px + env(safe-area-inset-bottom));inset-inline-end:18px;width:54px;height:54px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 22px rgba(31,78,140,.30);z-index:19;}
.ai-fab:hover{transform:scale(1.05);}
.sect{font-family:var(--font-body);font-weight:600;font-size:14px;color:var(--ink);margin:18px 0 9px;display:flex;align-items:center;gap:7px;}
.sect svg{color:var(--muted);}
.search-wrap{min-height:50px;display:flex;align-items:center;gap:9px;background:var(--surface-glow);border:1px solid rgba(148,163,184,.32);border-radius:14px;padding:0 14px;margin-bottom:11px;color:var(--muted);box-shadow:var(--control-shadow);}
.search-wrap:focus-within{border-color:rgba(31,78,140,.68);box-shadow:0 0 0 3px rgba(31,78,140,.12),var(--control-shadow);}
.search-wrap input{flex:1;border:none!important;outline:none;padding:12px 0;background:none!important;box-shadow:none!important;min-height:44px;}
.filter-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-bottom:10px;}
.filter-row select{border:1.5px solid var(--line);border-radius:10px;padding:9px 6px;background:var(--input);font-size:12.5px;}
.count-line{font-size:12.5px;color:var(--muted);margin-bottom:10px;}
.settings-wrap{width:min(100%,1040px);margin:0 auto;display:flex;flex-direction:column;gap:12px;}
.settings-wrap input,.settings-wrap select,.settings-wrap button{font-weight:500;}
.settings-wrap .btn-primary,.settings-wrap .btn-ghost,.settings-wrap .btn-danger,.settings-wrap .sect{font-weight:600;}
.settings-wrap>.seg-tabs{margin-bottom:6px;}
.settings-wrap .sect{margin:18px 0 8px;padding-top:7px;border-top:1px solid rgba(201,205,209,.58);font-size:13.5px;}
.settings-wrap .sect:first-of-type{margin-top:4px;padding-top:0;border-top:0;}
.settings-wrap .field{margin-bottom:11px;}
.settings-wrap .hint{line-height:1.48;}
.settings-wrap .note{padding:11px 12px;line-height:1.52;}
.settings-table-card{background:var(--surface-glow);border:1px solid rgba(201,205,209,.74);border-radius:15px;padding:10px;box-shadow:var(--control-shadow);overflow-x:auto;}
.wait-reasons-card{display:grid;gap:7px;}
.wait-reason-head,.wait-reason-row{display:grid;grid-template-columns:minmax(210px,1.45fr) minmax(145px,1fr) minmax(145px,1fr) minmax(112px,.72fr) 44px;gap:8px;align-items:center;min-width:760px;}
.wait-reason-head{padding:4px 9px 3px;font-weight:700;color:var(--muted);}
.wait-reason-row{margin-bottom:0;background:var(--surface);border:1px solid rgba(201,205,209,.62);border-radius:12px;padding:7px;box-shadow:0 1px 1px rgba(46,49,56,.025);}
.wait-reason-row input,.wait-reason-row select{min-height:44px;}
.wait-reason-row .chk-line{min-height:44px;align-items:center;justify-content:center;background:var(--surface-2);border:1px solid rgba(201,205,209,.78);border-radius:11px;padding:0 10px;font-weight:600;}
.panel{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:15px;}
.note{font-size:12.5px;color:var(--muted);line-height:1.6;background:var(--surface-2);border:1px solid var(--line);border-radius:11px;padding:13px;margin-top:10px;}
.note.warm,.panel.warm{background:var(--warm-surface);border-color:var(--warm-line);}
.note.critical,.panel.critical{background:var(--critical-surface);border-color:var(--critical-line);color:#7F1D1D;}
.row-stats{display:flex;gap:20px;}.rs-num{font-family:var(--font-head);font-weight:700;font-size:22px;}.rs-lbl{font-size:12px;color:var(--muted);margin-top:3px;}
.seg-tabs{display:flex;gap:6px;margin-bottom:14px;background:rgba(148,163,184,.13);padding:5px;border:1px solid rgba(148,163,184,.2);border-radius:14px;box-shadow:inset 0 1px 2px rgba(15,23,42,.04);}
.seg-tabs button{flex:1;min-width:44px;min-height:44px;padding:10px 12px;border-radius:10px;font-weight:650;font-size:13.5px;color:var(--muted);position:relative;}
.seg-tabs button:hover{color:var(--ink);background:rgba(255,255,255,.35);}
.seg-tabs button.on{background:var(--surface);color:var(--ink);box-shadow:0 1px 2px rgba(15,23,42,.06),0 6px 16px rgba(15,23,42,.08);}

.ovl-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.5);display:flex;z-index:60;animation:cmmsFade 180ms var(--ease-out) both;}
.ovl-panel{background:var(--bg);width:100%;height:100%;display:flex;flex-direction:column;animation:cmmsSheetIn 240ms var(--ease-drawer) both;will-change:transform,opacity;}
.ovl-panel.user-picker-form-panel{height:min(92dvh,780px);max-height:92dvh;}
.ovl-panel.user-picker-form-panel .ovl-inner{height:100%;min-height:0;}
.ovl-inner{display:flex;flex-direction:column;height:100%;min-height:0;}
.body{flex:1;padding:16px;overflow-y:auto;}
.form-head{background:var(--primary);color:#fff;padding:12px;display:flex;align-items:center;gap:8px;position:sticky;top:0;z-index:5;box-shadow:0 2px 0 var(--accent);}
.form-head .icon-btn{color:#fff;}
.form-head-actions{margin-inline-start:auto;display:flex;align-items:center;gap:8px;}
.form-title{font-family:var(--font-body);font-weight:600;font-size:17px;}
.ovl-panel,.modal2-panel{font-family:var(--font-body);font-size:14px;font-weight:400;letter-spacing:0;}
.ovl-panel *,.modal2-panel *{letter-spacing:0;}
.ovl-panel .body,.modal2-panel .modal2-body{font-family:var(--font-body);font-weight:400;}
.ovl-panel .field>span,.modal2-panel .field>span{font-family:var(--font-body);font-size:13.5px;font-weight:500;color:var(--ink);}
.ovl-panel input,.ovl-panel select,.ovl-panel textarea,.modal2-panel input,.modal2-panel select,.modal2-panel textarea{font-family:var(--font-body);font-weight:500;}
.ovl-panel .hint,.modal2-panel .hint{font-family:var(--font-body);font-size:12.5px;font-weight:400;line-height:1.48;}
.ovl-panel .btn-primary,.ovl-panel .btn-ghost,.ovl-panel .btn-danger,.ovl-panel .btn-close,.modal2-panel .btn-primary,.modal2-panel .btn-ghost,.modal2-panel .btn-danger,.modal2-panel .btn-close{font-family:var(--font-body);font-weight:600;}
.ovl-panel .track-q,.modal2-panel .track-q{font-family:var(--font-body);font-weight:600;}
.track-q{font-family:var(--font-body);font-weight:600;font-size:16px;margin-bottom:14px;}
.track-pick{display:flex;align-items:center;gap:13px;width:100%;text-align:right;background:var(--surface);border:1.5px solid var(--line);border-radius:15px;padding:16px;margin-bottom:12px;color:var(--ink);}
.track-ic{width:48px;height:48px;border-radius:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.track-name{font-weight:600;font-size:16px;}.track-desc{color:var(--muted);font-size:12.5px;margin-top:3px;}
.inline-ai-ticket{margin-top:2px;}
.inline-ai-ticket.open .inline-ai-ticket-card{margin-bottom:0;border-color:var(--primary);border-bottom-left-radius:0;border-bottom-right-radius:0;background:var(--primary-soft);}
.inline-ai-ticket-ic{background:var(--primary)!important;color:#fff!important;}
.inline-ai-ticket-chev{transition:transform 160ms var(--ease-out);}
.inline-ai-ticket.open .inline-ai-ticket-chev{transform:rotate(-90deg);}
.inline-ai-chat{border:1.5px solid var(--primary);border-top:0;border-radius:0 0 15px 15px;background:var(--surface);padding:9px;display:flex;flex-direction:column;gap:7px;margin-bottom:12px;box-shadow:var(--shadow-sm);}
.inline-ai-msgs{height:126px;max-height:24dvh;overflow-y:auto;display:flex;flex-direction:column;gap:7px;padding:2px;overscroll-behavior:contain;}
.inline-ai-msg-wrap{display:flex;flex-direction:column;gap:7px;max-width:100%;}
.inline-ai-msg-wrap.assistant{align-items:flex-start;}.inline-ai-msg-wrap.user{align-items:flex-end;}
.inline-ai-msg{max-width:88%;padding:9px 11px;border-radius:12px;font-size:13px;line-height:1.48;unicode-bidi:plaintext;}
.inline-ai-msg.assistant{background:var(--surface-2);color:var(--ink);border-bottom-right-radius:4px;}
.inline-ai-msg.user{background:var(--primary);color:#fff;border-bottom-left-radius:4px;}
.inline-ai-msg[dir="rtl"]{text-align:right;}.inline-ai-msg[dir="ltr"]{text-align:left;}
.inline-ai-msg p{margin:0;}.inline-ai-msg p+p,.inline-ai-msg p+ul,.inline-ai-msg ul+p{margin-top:6px;}
.inline-ai-msg ul{margin:0;padding-inline-end:18px;padding-inline-start:0;display:flex;flex-direction:column;gap:4px;}
.inline-ai-choice-row{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}
.inline-ai-choice-chip{border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:999px;padding:6px 10px;font:inherit;font-size:12px;font-weight:750;cursor:pointer;line-height:1.2;min-height:32px;}
.inline-ai-choice-chip:hover{border-color:var(--primary);background:var(--primary-soft,#FFF4ED);}
.inline-ai-actions{width:min(100%,360px);display:flex;flex-direction:column;gap:7px;}
.inline-ai-input{display:grid;grid-template-columns:minmax(0,1fr) 44px;gap:8px;align-items:end;}
.inline-ai-input textarea{min-height:46px;max-height:86px;resize:vertical;border:1.5px solid var(--line);border-radius:11px;background:var(--input);padding:9px 10px;line-height:1.35;}
.inline-ai-input .btn-primary{width:44px;height:44px;padding:0;display:flex;align-items:center;justify-content:center;}
.inline-ai-error{font-size:12.5px;color:#B91C1C;background:#FEF2F2;border:1px solid #FCA5A5;border-radius:10px;padding:8px 10px;}
.inline-ai-collapse{min-height:30px;align-self:flex-start;display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:9px;background:var(--surface-2);color:var(--muted);padding:0 10px;font-size:12px;font-weight:700;}
.inline-ai-result{border:1.5px solid rgba(22,101,52,.25);border-radius:12px;background:rgba(22,101,52,.08);padding:10px;display:flex;flex-direction:column;gap:7px;}
.inline-ai-result-head{display:flex;align-items:center;gap:7px;color:#166534;font-weight:800;font-size:13px;}
.inline-ai-result-no{font-family:var(--font-head);font-size:18px;font-weight:800;color:var(--ink);}
.inline-ai-result-grid{display:grid;grid-template-columns:auto minmax(0,1fr);gap:5px 10px;font-size:12.5px;}
.inline-ai-result-grid span{color:var(--muted);}.inline-ai-result-grid b{min-width:0;font-weight:700;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.inline-ai-result-actions{display:flex;gap:8px;flex-wrap:wrap;}
.inline-ai-result-actions .btn-primary,.inline-ai-result-actions .btn-ghost{min-height:38px;padding:0 12px;}
.cat-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;}
.cat-pick{display:flex;flex-direction:column;align-items:center;gap:6px;border:1.5px solid var(--line);background:var(--surface);border-radius:11px;padding:11px 6px;font-size:12.5px;font-weight:500;color:var(--ink);}
.pr-row,.status-seg{display:flex;gap:7px;flex-wrap:wrap;}
.status-static{display:flex;align-items:center;min-height:32px;}
.pr-pick{flex:1;min-height:44px;border:1px solid rgba(201,205,209,.86);background:var(--surface-glow);border-radius:12px;padding:10px 10px;font-size:13px;font-weight:500;color:var(--muted);min-width:80px;box-shadow:var(--control-shadow);}
.pr-pick:hover{border-color:rgba(100,116,139,.5);color:var(--ink);}
.seg{border:1.5px solid var(--line);background:var(--surface);border-radius:9px;padding:9px 14px;font-size:13px;font-weight:600;color:var(--muted);}
.dt-list{display:flex;flex-direction:column;gap:9px;}
.dt-pick{display:flex;align-items:flex-start;gap:10px;text-align:right;border:1.5px solid var(--line);background:var(--surface);border-radius:12px;padding:13px;color:var(--ink);}
.dt-dot{width:11px;height:11px;border-radius:50%;flex-shrink:0;margin-top:4px;}
.dt-name{font-weight:600;font-size:14px;}.dt-desc{color:var(--muted);font-size:12px;margin-top:2px;}
.dt-banner{display:flex;align-items:center;gap:8px;border:1px solid;border-radius:11px;padding:10px 13px;font-size:13.5px;font-weight:600;margin:10px 0 4px;}
.dt-time{font-weight:500;opacity:.9;}
.photo-add{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;border:1.5px dashed var(--line);background:var(--surface-2);border-radius:12px;padding:16px;color:var(--muted);font-weight:500;}
.photo-prev{position:relative;border-radius:12px;overflow:hidden;}.photo-prev img{width:100%;display:block;}
.photo-x{position:absolute;top:8px;left:8px;background:#000000aa;color:#fff;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;}
.ai-suggest{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;background:var(--primary-soft);color:var(--primary);border:1.5px solid var(--primary-line);border-radius:11px;padding:13px;font-weight:600;font-size:14px;margin:14px 0 8px;}
.app-dark .ai-suggest{background:#1e2438;border-color:#3730a3;color:#a5b4fc;}
.ai-note{font-size:12.5px;color:var(--primary);margin:-6px 0 12px;font-weight:600;}

.detail-top{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;}
.detail-subj{font-family:var(--font-body);font-weight:600;font-size:21px;line-height:1.3;margin:0;}
.detail-caption{display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;margin-bottom:3px;}
.detail-subline{font-size:13px;color:var(--muted);margin-top:5px;}.detail-subline b{color:var(--ink);font-weight:600;}
.meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:15px;margin-top:8px;}
.meta{display:flex;gap:9px;align-items:flex-start;position:relative;min-width:0;}.meta svg{margin-top:2px;flex-shrink:0;}.meta>div{min-width:0;flex:1;}
.meta-lbl{font-size:11.5px;color:var(--muted);}.meta-val{font-size:13.5px;font-weight:500;margin-top:1px;}
.meta-val-edit{display:inline;max-width:100%;padding:0;border:0;background:transparent;color:var(--ink);font:inherit;font-size:13.5px;font-weight:500;line-height:inherit;text-align:inherit;cursor:pointer;text-decoration:underline;text-decoration-style:dotted;text-decoration-thickness:1px;text-underline-offset:3px;}
.meta-val-edit:hover{color:var(--primary);}
.meta-val-edit:focus-visible{outline:2px solid rgba(31,78,140,.35);outline-offset:3px;border-radius:4px;}
.admin-quick-edit{margin-top:10px;background:var(--surface-2);border:1px solid var(--line);border-radius:13px;padding:12px;box-shadow:var(--control-shadow);}
.admin-quick-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px;font-size:13.5px;font-weight:600;color:var(--ink);}
.icon-btn.tiny{width:30px;height:30px;min-width:30px;}
.desc-box{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:14px;font-size:14.5px;line-height:1.6;white-space:pre-wrap;}
.detail-photo{width:100%;border-radius:12px;border:1px solid var(--line);}
.note-row{display:flex;gap:8px;}
.note-row input{flex:1;border:1.5px solid var(--line);border-radius:11px;padding:11px 13px;outline:none;background:var(--input);}
.note-row input:focus{border-color:var(--primary);}
.close-box{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:14px;}
.cb-row{display:flex;justify-content:space-between;font-size:13.5px;padding:4px 0;color:var(--muted);}.cb-row b{color:var(--ink);}
.cb-sign{margin-top:8px;padding-top:10px;border-top:1px dashed var(--line);font-size:12.5px;color:#047857;display:flex;align-items:center;gap:6px;font-weight:600;}
.repeat-warn{display:flex;align-items:center;gap:7px;flex-wrap:wrap;background:#F7F8FA;color:#6F7680;border:1px solid #C9CDD1;border-radius:11px;padding:11px 13px;font-size:12.5px;font-weight:600;margin-top:12px;}
.app-dark .repeat-warn{background:#2a1d10;border-color:#7c2d12;color:#fdba74;}
.risk-badge{display:inline-flex;align-items:center;font-size:11px;font-weight:700;border-radius:6px;padding:2px 7px;border:1px solid transparent;}
.health-panel{background:var(--surface);border:1.5px solid var(--line);border-radius:14px;padding:14px;margin:14px 0;}
.health-top{display:flex;align-items:center;gap:14px;}
.health-score{font-size:30px;font-weight:800;line-height:1;}
.health-max{font-size:14px;font-weight:600;color:var(--muted);}
.health-info{flex:1;min-width:0;}
.health-label{font-size:14px;font-weight:700;margin-bottom:2px;}
.health-stats{font-size:12px;color:var(--muted);}
.health-rec{display:flex;align-items:flex-start;gap:6px;margin-top:10px;padding-top:10px;border-top:1px solid var(--line);font-size:12.5px;font-weight:600;color:var(--ink);}
.demo-badge{display:inline-block;font-size:10.5px;font-weight:700;color:#B45309;background:#FEF3C7;border-radius:6px;padding:2px 7px;margin-inline-start:8px;vertical-align:middle;}
.app-dark .demo-badge{background:#3a2e10;color:#fcd34d;}
.empty-demo{display:flex;align-items:center;justify-content:space-between;gap:14px;background:var(--warm-soft);border:1px solid var(--warm-line);border-radius:12px;padding:14px 16px;margin-bottom:16px;}
.empty-demo-main{min-width:0;}
.empty-demo-title{font-size:14px;font-weight:800;color:var(--primary);margin-bottom:3px;}
.empty-demo-text{font-size:12.5px;color:var(--muted);line-height:1.45;}
.app-dark .empty-demo{background:#0f1f35;border-color:#1d4ed8;}
.app-dark .empty-demo-title{color:#93C5FD;}
.app-dark .empty-demo-text{color:#BFDBFE;}
.budget-placeholder{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);background:var(--surface-2);border:1px dashed var(--line);border-radius:8px;padding:8px 12px;margin:8px 0;}
.equip-wait{background:#F7F8FA;border:1px solid #C9CDD1;border-radius:12px;padding:13px;margin-top:14px;}
.fu-box{background:var(--surface-2);border:1px solid var(--line);border-radius:12px;padding:4px 13px 13px;margin-top:10px;}
.btn-pm-toggle{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:13px;border-radius:12px;border:1.5px solid var(--line);background:var(--surface);color:var(--ink);font-weight:700;font-size:14.5px;transition:transform 160ms var(--ease-out),border-color 160ms var(--ease-out),background-color 160ms var(--ease-out);}
.btn-pm-toggle:hover{border-color:var(--ink);}
.btn-pm-missed{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:13px;border-radius:12px;border:1.5px solid #FCD34D;background:#FFFBEB;color:#92400E;font-weight:700;font-size:14.5px;margin-top:10px;transition:transform 160ms var(--ease-out),border-color 160ms var(--ease-out),background-color 160ms var(--ease-out);}
.btn-pm-missed:hover{background:#FEF3C7;}
.app-dark .btn-pm-missed{background:#2a1d10;border-color:#7c2d12;color:#fdba74;}
.app-dark .equip-wait{background:#2a1d10;border-color:#7c2d12;}
.equip-wait-msg{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:600;color:#9A3412;}
.app-dark .equip-wait-msg{color:#fdba74;}
.repeat-link{color:var(--primary);text-decoration:underline;font-weight:600;}
.pm-hist-item{width:100%;text-align:inherit;background:none;border:1px solid transparent;border-radius:10px;cursor:pointer;padding:6px;transition:background-color 160ms var(--ease-out),border-color 160ms var(--ease-out),transform 160ms var(--ease-out);}
.pm-hist-item:hover{background:var(--surface-2);border-color:var(--line);}
.pm-hist-item .tl-chev{align-self:center;color:var(--muted);flex-shrink:0;}
.timeline{position:relative;padding-inline-start:6px;}
.tl-item{display:flex;gap:11px;padding-bottom:13px;position:relative;}
.tl-body,.ni-body{flex:1;min-width:0;}
.tech-strip{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;}
.tech-chip{display:inline-flex;align-items:center;gap:7px;background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:6px 12px;font-size:12.5px;font-weight:600;color:var(--ink);}
.tech-chip-sup{color:var(--muted);font-weight:500;}
.tech-chip-stat{color:var(--muted);font-weight:500;font-size:11.5px;margin-inline-start:2px;}
.insight-row{display:flex;align-items:center;gap:10px;width:100%;text-align:inherit;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 14px;}
.insight-row.clickable{cursor:pointer;transition:border-color 160ms var(--ease-out),box-shadow 160ms var(--ease-out),transform 160ms var(--ease-out);}
.insight-row.clickable:hover{border-color:var(--primary);box-shadow:0 4px 14px rgba(15,23,42,.06);transform:translateY(-1px);}
.insight-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;}
.insight-text{flex:1;min-width:0;font-size:13.5px;font-weight:500;line-height:1.45;}
.insight-chev{color:var(--muted);flex-shrink:0;}
body.modal-open{overflow:hidden;}
body.modal-open .ai-fab,body.modal-open .fab{pointer-events:none;}
.dup-open{background:#FEF3C7;border:1px solid #FCD34D;border-radius:11px;padding:9px 11px;margin-bottom:8px;}
.dup-open .tl-dot{margin-top:3px;}
.dup-tag{display:inline-block;margin-inline-start:7px;font-size:10.5px;font-weight:700;color:#B45309;background:#fff;border:1px solid #FCD34D;border-radius:6px;padding:1px 6px;vertical-align:middle;}
.tl-item:not(:last-child)::before{content:"";position:absolute;inset-inline-start:4px;top:14px;bottom:0;width:2px;background:var(--line);}
.tl-dot{width:10px;height:10px;border-radius:50%;background:var(--primary);margin-top:4px;flex-shrink:0;z-index:1;}
.tl-text{font-size:13.5px;font-weight:500;}.tl-meta{font-size:11.5px;color:var(--muted);margin-top:2px;}

.mini-ticket{display:flex;align-items:center;gap:9px;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:9px 12px;}
.mt-subj{flex:1;font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.mt-date{font-size:11px;color:var(--muted);}

.modal2{align-items:center;justify-content:center;padding:18px;z-index:75;}
.modal2-panel{background:var(--surface);width:100%;max-width:420px;border-radius:16px;overflow:hidden;display:flex;flex-direction:column;max-height:90vh;box-shadow:0 24px 60px rgba(0,0,0,.4);animation:cmmsSurfaceIn 220ms var(--ease-out) both;will-change:transform,opacity;}
.modal2-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--line);}
.modal2-body{padding:16px;overflow-y:auto;}
.sign-note{font-size:13px;color:var(--muted);background:var(--surface-2);border-radius:10px;padding:12px;margin-bottom:14px;line-height:1.5;}
.sign-row{display:flex;justify-content:space-between;font-size:14px;margin-bottom:14px;}

.pm-card{display:flex;width:100%;text-align:right;background:var(--surface);border:1px solid var(--line);border-radius:13px;overflow:hidden;cursor:pointer;position:relative;}
.pm-card:hover{box-shadow:0 4px 14px rgba(0,0,0,.08);}.pm-card.off{opacity:.6;}
.pm-card.selected{border-color:rgba(31,78,140,.34);background:var(--primary-soft);box-shadow:0 0 0 1px rgba(31,78,140,.12);}
.pm-bar{width:5px;flex-shrink:0;}.pm-body{flex:1;min-width:0;padding:13px;}
.pm-select{display:flex;align-items:center;justify-content:center;width:38px;border-inline-end:1px solid var(--line);cursor:pointer;background:var(--surface);}
.pm-card.selected .pm-select{background:#E6E7E9;}
.pm-select input{width:16px;height:16px;accent-color:var(--primary);}
.pm-topbar{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin:10px 0 14px;}
.pm-topbar .section-title{margin:0;}
.pm-top-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;}
.pm-list-tools{display:grid;grid-template-columns:minmax(220px,1.7fr) repeat(3,minmax(130px,1fr));gap:10px;align-items:end;margin:12px 0 8px;}
.pm-list-search{margin:0;min-height:44px;}
.pm-list-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px;}
.pm-list-bulk{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap;}
.pm-type-limits{border:1px solid var(--line);border-radius:12px;background:var(--surface-2);padding:11px 12px;margin-top:12px;}
.pm-type-limit-grid{display:grid;grid-template-columns:repeat(2,minmax(160px,1fr));gap:8px;margin-top:8px;}
.pm-plan-preview{border:1px solid var(--line);border-radius:12px;background:var(--surface-2);padding:8px;margin-top:10px;display:flex;flex-direction:column;gap:6px;max-height:260px;overflow:auto;}
.pm-plan-day{display:grid;grid-template-columns:minmax(92px,.75fr) minmax(80px,.55fr) minmax(0,1.7fr);gap:8px;align-items:center;border:1px solid var(--line);border-radius:9px;background:var(--surface);padding:7px 9px;font-size:12.5px;}
.pm-plan-day b{font-weight:800;white-space:nowrap;}
.pm-plan-day span{font-weight:800;color:var(--primary);white-space:nowrap;}
.pm-plan-day em{font-style:normal;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.cal-pill.projected{border:1px dashed #818CF8;}
.pm-cal-pill{display:flex;flex-direction:column;align-items:flex-end;gap:1px;width:100%;min-height:32px;line-height:1.1;}
.pm-cal-type{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;font-weight:800;}
.pm-cal-code{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:900;font-variant-numeric:tabular-nums;}
.checklist{display:flex;flex-direction:column;gap:8px;}
.chk{display:flex;align-items:center;gap:10px;width:100%;text-align:right;background:var(--surface);border:1.5px solid var(--line);border-radius:11px;padding:12px;font-size:14px;color:var(--ink);}
.chk.on{border-color:#16A34A;background:#16a34a14;}
.chk-box{width:22px;height:22px;border-radius:6px;border:2px solid var(--line);display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0;}
.chk.on .chk-box{background:#16A34A;border-color:#16A34A;}
.pm-mini{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:6px 14px;}
.pm-mini-item{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--line);}
.pm-mini-item:last-child{border-bottom:none;}
.dot-lg{width:9px;height:9px;border-radius:50%;flex-shrink:0;}
.pm-mini-t{font-size:13px;font-weight:500;flex:1;}.pm-mini-d{font-size:12.5px;font-weight:600;}

.ftable{background:var(--surface);border:1px solid rgba(201,205,209,.72);border-radius:16px;overflow:hidden;box-shadow:var(--control-shadow);}
.fleet-topbar{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin:10px 0 14px;}
.fleet-topbar .section-title{margin:0;}
.fleet-actions{display:flex;align-items:center;justify-content:flex-end;gap:10px;flex-wrap:wrap;}
.fleet-actions .btn-ghost.sm{width:44px;min-width:44px;padding:0;font-size:0;overflow:hidden;}
.fleet-actions .btn-ghost.sm svg{width:17px;height:17px;margin:0;}
.fleet-search{margin:0 0 14px;}
.fleet-filters{display:grid;grid-template-columns:repeat(5,minmax(120px,1fr));gap:10px;margin-bottom:12px;}
.flt-field{display:flex;flex-direction:column;gap:5px;min-width:0;flex:1;}
.flt-lbl{font-size:10.5px;font-weight:650;color:var(--muted);text-transform:uppercase;letter-spacing:.45px;}
.flt-field select{width:100%;min-height:44px;border-radius:12px;border:1px solid rgba(201,205,209,.86);background-color:var(--surface);color:var(--ink);font-size:13px;}
.fleet-results-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:10px;font-size:13px;}
.fleet-count{color:var(--ink);font-weight:650;background:var(--surface);border:1px solid rgba(201,205,209,.72);border-radius:999px;padding:5px 11px;box-shadow:var(--control-shadow);}
.fleet-bulk-panel{background:var(--surface-glow);border:1px solid rgba(201,205,209,.72);border-radius:15px;padding:11px 13px;margin:0 0 10px;display:flex;flex-direction:column;gap:9px;box-shadow:var(--control-shadow);}
.fleet-bulk-top{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;}
.bulk-check{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:700;color:var(--ink);cursor:pointer;}
.bulk-check input,.ft-select input{width:16px;height:16px;accent-color:var(--primary);}
.fleet-bulk-count{font-size:12px;color:var(--muted);font-weight:700;}
.fleet-bulk-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;border-top:1px dashed var(--line);padding-top:9px;}
.bulk-action{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
.bulk-action select,.bulk-action input{min-height:40px;border:1px solid var(--line);border-radius:9px;background:var(--surface);color:var(--ink);font-size:12.5px;padding:0 9px;}
.btn-ghost.danger{border-color:#FCA5A5;color:#B91C1C;background:#FEF2F2;}
.bulk-msg{font-size:12px;font-weight:700;color:#15803D;}
.bulk-msg.err{color:#B91C1C;}
.group-seg{display:inline-flex;align-items:center;gap:4px;margin-inline-start:auto;}
.group-lbl{color:var(--muted);font-size:12px;margin-inline-end:2px;}
.dt-edit-row{border:1px solid rgba(201,205,209,.74);border-radius:14px;padding:10px 11px;margin-bottom:9px;background:var(--surface-glow);box-shadow:var(--control-shadow);}
.dt-edit-line{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.dt-edit-line + .dt-edit-line{margin-top:8px;}
.dt-edit-line select{font-weight:500;min-height:44px;}
.dt-edit-line .chk-line{font-weight:500;}
.dt-desc-in{flex:2;min-width:160px;color:var(--muted);}
.group-seg button{min-height:38px;background:var(--surface);border:1px solid rgba(201,205,209,.86);color:var(--muted);border-radius:999px;padding:6px 12px;font-size:12px;font-weight:650;cursor:pointer;box-shadow:var(--control-shadow);}
.group-seg button.on{background:var(--primary);border-color:var(--primary);color:#fff;}
.fleet-groups{display:flex;flex-direction:column;gap:10px;}
.fgroup-head{display:flex;align-items:center;gap:8px;width:100%;text-align:right;background:var(--surface-2);border:1px solid rgba(201,205,209,.72);border-radius:12px;padding:8px 12px;cursor:pointer;color:var(--ink);margin-bottom:5px;box-shadow:none;}
.fgroup-chev{color:var(--muted);transition:transform .15s;flex:none;}
.fgroup-name{font-weight:650;font-size:13px;}
.fgroup-count{background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:1px 9px;font-size:11.5px;font-weight:600;color:var(--muted);}
.fgroup-blk{display:inline-flex;align-items:center;gap:3px;margin-inline-start:auto;background:#FEE2E2;color:#B91C1C;border-radius:999px;padding:2px 9px;font-size:11px;font-weight:700;}
.task-list{display:flex;flex-direction:column;gap:6px;}
.task-row{display:flex;align-items:center;gap:9px;width:100%;text-align:right;background:var(--surface);border:1px solid var(--line);border-inline-start:4px solid var(--muted);border-radius:11px;padding:9px 11px;cursor:pointer;color:var(--ink);}
.task-row:hover{background:var(--surface-2);}
.task-row.selected{background:var(--primary-soft);border-color:rgba(31,78,140,.34);box-shadow:0 0 0 1px rgba(31,78,140,.12);}
.field.mini{margin-bottom:0;}
.field.mini span{font-size:11.5px;}
.field.mini input,.field.mini select{min-height:36px;padding:7px 9px;font-size:12px;}
.task-row.ovd{background:linear-gradient(90deg,rgba(220,38,38,0.05),transparent 60%);}
.task-row.selected.ovd{background:linear-gradient(90deg,rgba(220,38,38,0.05),var(--primary-soft) 60%);}
.task-row-check{display:inline-flex;align-items:center;justify-content:center;flex:none;width:26px;height:26px;border-radius:8px;background:var(--surface-2);border:1px solid var(--line);cursor:pointer;}
.task-row-check:hover{border-color:rgba(31,78,140,.34);background:var(--primary-soft);}
.task-row-check input{width:16px;height:16px;accent-color:var(--primary);}
.tr-pri{width:9px;height:9px;border-radius:50%;flex:none;}
.task-row-main{flex:1;min-width:0;}
.task-row-t{font-weight:600;font-size:13.5px;line-height:1.25;}
.task-row-desc{font-size:12px;color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;}
.mtask-groups{display:flex;flex-direction:column;gap:12px;}
.mtask-group{display:flex;flex-direction:column;gap:6px;}
.mtask-gh{font-size:12px;font-weight:700;color:var(--muted);padding:0 2px;}
.task-row-sub{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;font-size:11.5px;color:var(--muted);margin-top:3px;}
.tr-to{font-weight:600;color:var(--ink);}
.tr-src{display:inline-flex;align-items:center;gap:3px;max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:#ECFDF5;color:#047857;border-radius:6px;padding:1px 7px;font-weight:700;}
.tr-src svg{flex:none;}
.tr-mtg{display:inline-flex;align-items:center;gap:3px;background:var(--primary-soft);color:var(--primary);border-radius:6px;padding:1px 7px;font-weight:600;}
.tr-cat{background:var(--surface-2);border-radius:6px;padding:1px 7px;}
.tr-wait{color:#B45309;}
.task-row-side{display:flex;flex-direction:column;align-items:flex-start;gap:4px;flex:none;}
.task-due{font-size:11px;color:var(--muted);white-space:nowrap;}
.ppe-request-list{display:flex;flex-direction:column;gap:8px;}
.ppe-cat-card{cursor:pointer;transition:transform 160ms var(--ease-out),box-shadow 160ms var(--ease-out),border-color 160ms var(--ease-out),background-color 160ms var(--ease-out);}
.ppe-cat-card:hover{transform:translateY(-1px);box-shadow:var(--lift-shadow);border-color:rgba(31,78,140,.28);}
.ppe-cat-card:active{transform:var(--press);}
.ppe-policy-inline{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:13px;line-height:1.35;min-width:0;}
.ppe-policy-inline input{width:68px;min-height:40px;text-align:center;}
.ppe-request-row{display:grid;grid-template-columns:minmax(150px,1.05fr) minmax(220px,1.5fr) minmax(115px,.75fr) auto auto;align-items:center;gap:10px;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:9px 11px;color:var(--ink);box-shadow:0 1px 3px rgba(15,23,42,.04);}
.ppe-request-row:hover{background:var(--surface-2);}
.ppe-request-row.rejecting{align-items:start;}
.ppe-req-worker{display:flex;align-items:center;gap:9px;min-width:0;}
.ppe-req-ic{width:32px;height:32px;border-radius:9px;background:var(--primary-soft);color:var(--primary);display:inline-flex;align-items:center;justify-content:center;flex:none;}
.ppe-req-text,.ppe-req-main{min-width:0;}
.ppe-req-title{font-size:13px;font-weight:800;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.ppe-req-meta{display:flex;align-items:center;gap:4px;min-width:0;margin-top:3px;color:var(--muted);font-size:11.5px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.ppe-req-meta .sep{color:var(--line);margin:0 2px;}
.ppe-req-note{min-width:0;overflow:hidden;text-overflow:ellipsis;}
.ppe-req-by{display:flex;flex-direction:column;gap:2px;font-size:12px;color:var(--ink);min-width:0;}
.ppe-req-kicker,.ppe-req-date{font-size:11px;color:var(--muted);}
.ppe-req-status .badge{background:#FEF3C7;color:#92400E;white-space:nowrap;}
.ppe-req-status .badge.warn{background:#FEF9C3;color:#854D0E;}
.ppe-req-actions{display:flex;align-items:center;justify-content:flex-end;gap:5px;}
.ppe-req-actions .icon-btn.approve{color:#0F766E;background:#CCFBF1;}
.ppe-req-actions .icon-btn.approve:hover{background:#99F6E4;}
.ppe-req-reject{grid-column:1 / -1;display:flex;align-items:center;justify-content:flex-end;gap:6px;min-width:220px;}
.ppe-req-reject input{min-width:150px;flex:1;border:1.5px solid var(--line);border-radius:9px;padding:7px 10px;background:var(--input);outline:none;font-size:12.5px;}
.ppe-req-reject input:focus{border-color:#DC2626;}
.ppe-req-reject .fill{background:#DC2626;color:#fff;}
.tk-chips{display:flex;flex-wrap:wrap;gap:6px;}
.detail-desc{font-size:14px;line-height:1.55;color:var(--ink);white-space:pre-wrap;margin:4px 0 8px;}
.meta-cell{display:flex;flex-direction:column;}
.meta-l{font-size:11.5px;color:var(--muted);}
.meta-v{font-size:13.5px;font-weight:600;margin-top:1px;}
.cmt-box{display:flex;gap:8px;align-items:center;margin-top:10px;}
.cmt-box input{flex:1;}
.ppk-box{width:15px;height:15px;border-radius:4px;border:1.5px solid var(--line);display:inline-block;flex-shrink:0;}
.kpi-strip{display:flex;gap:8px;margin-bottom:14px;}
.kpi-mini{flex:1;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:11px 8px;text-align:center;}
.kpi-mini-v{display:block;font-family:var(--font-head);font-weight:700;font-size:22px;line-height:1;}
.kpi-mini-l{display:block;font-size:11px;color:var(--muted);margin-top:4px;}
.hdr-btns{display:flex;gap:6px;align-items:center;flex-wrap:wrap;}
.imp-map{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0;}
.imp-prev{display:flex;flex-direction:column;gap:6px;max-height:300px;overflow:auto;border:1px solid var(--line);border-radius:11px;padding:8px;background:var(--surface);}
.imp-row{padding:7px 9px;border-radius:8px;background:var(--surface-2);}
.imp-t{font-weight:600;font-size:13px;}
.imp-meta{font-size:11.5px;color:var(--muted);margin-top:2px;}
.dup-tag{display:inline-block;background:#FEE2E2;color:#B91C1C;border-radius:6px;padding:1px 6px;font-size:10.5px;font-weight:700;margin-inline-end:6px;}
.qchips{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 4px;}
.more-toggle{background:none;border:none;color:var(--primary);font-size:13px;font-weight:600;cursor:pointer;padding:6px 2px;margin:2px 0;}
.more-fields{border-top:1px dashed var(--line);margin-top:6px;padding-top:8px;}
.topic-edit{display:flex;gap:6px;align-items:center;margin-bottom:6px;}
.topic-edit input{flex:1;}
.topic-list{display:flex;flex-direction:column;gap:6px;}
.topic-row{display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--surface-2);border-radius:9px;padding:8px 11px;}
.topic-t{font-size:13px;font-weight:600;flex:1;min-width:0;}
.topic-seg{display:flex;gap:4px;flex:none;}
.topic-seg button{border:1px solid var(--line);background:var(--surface);border-radius:7px;padding:4px 11px;font-size:12px;font-weight:600;color:var(--muted);cursor:pointer;}
.topic-seg .tok.on{background:#16A34A;border-color:#16A34A;color:#fff;}
.topic-seg .tiss.on{background:#DC2626;border-color:#DC2626;color:#fff;}
.link-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px;}
.mlink.clk{cursor:pointer;}
.mlink.clk:hover{filter:brightness(0.96);text-decoration:underline;}
.mtask-item{display:flex;flex-wrap:wrap;align-items:stretch;gap:6px;}
.mtask-item .task-row{flex:1;min-width:0;}
.mt-done{flex:none;width:42px;border:1px solid var(--line);background:var(--surface);border-radius:10px;color:#16A34A;cursor:pointer;display:flex;align-items:center;justify-content:center;}
.mt-done:hover{background:#DCFCE7;border-color:#16A34A;}
.done-box{flex-basis:100%;display:flex;gap:6px;align-items:center;}
.done-box input{flex:1;}
.issue-box{background:#FEF2F2;border:1px solid #FCA5A5;border-radius:10px;padding:9px;margin-top:6px;display:flex;flex-direction:column;gap:7px;}
.issue-box input{width:100%;}
.topic-wrap{display:flex;flex-direction:column;}
.mlink{display:inline-flex;align-items:center;gap:5px;background:var(--primary-soft);color:var(--primary);border-radius:7px;padding:3px 9px;font-size:12px;font-weight:600;}
.mlink.src{background:var(--primary-soft);color:var(--primary);}
.mlink-x{background:none;border:none;color:inherit;font-size:15px;line-height:1;cursor:pointer;padding:0 0 0 2px;opacity:0.7;}
.mlink-x:hover{opacity:1;}
.link-panel{background:var(--surface-2);border:1px solid var(--line);border-radius:11px;padding:11px;margin-top:6px;display:flex;flex-direction:column;gap:8px;}
.mlink-tag{display:inline-block;background:var(--primary-soft);color:var(--primary);border-radius:6px;padding:1px 7px;font-size:10.5px;font-weight:700;margin-inline-end:6px;}
.seg-tabs.s2{display:grid;grid-template-columns:1fr 1fr;}
.act-tag{display:inline-block;border-radius:6px;padding:1px 7px;font-size:10.5px;font-weight:700;margin-inline-end:6px;}
.act-tag.new{background:#DCFCE7;color:#15803D;}
.act-tag.update{background:var(--primary-soft);color:var(--primary);}
.act-tag.nochange{background:var(--surface-2);color:var(--muted);}
.confirm-line{display:flex;align-items:flex-start;gap:8px;margin-top:9px;font-size:12.5px;font-weight:700;color:var(--ink);cursor:pointer;line-height:1.45;}
.confirm-line input{margin-top:2px;flex-shrink:0;}
.quick-cap{background:var(--surface-2);border:1px solid var(--line);border-radius:12px;padding:9px;margin-bottom:8px;display:flex;flex-direction:column;gap:7px;}
.qc-line{display:flex;gap:7px;align-items:center;}
.qc-loc{flex:0 0 38%;}
.qc-title{flex:1;}
.qc-pp{flex:1;min-width:0;}
.tr-loc{background:var(--primary-soft);color:var(--primary);border-radius:6px;padding:1px 7px;cursor:pointer;}
.tr-loc:hover{background:var(--pearl);}
.tag-bar{display:flex;align-items:center;gap:8px;background:var(--primary-soft);border:1px solid var(--primary-line);color:var(--primary);border-radius:9px;padding:7px 11px;font-size:12.5px;margin:6px 0;}
.tag-bar b{font-weight:700;}
.tag-bar button{margin-inline-start:auto;background:none;border:none;color:var(--primary);font-size:15px;cursor:pointer;line-height:1;}
.qchip{background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:5px 13px;font-size:12.5px;font-weight:600;color:var(--muted);cursor:pointer;}
.qchip.on{background:var(--primary);color:#fff;border-color:var(--primary);}
.qchip.danger.on{background:#DC2626;border-color:#DC2626;color:#fff;}
.more-wrap{position:relative;display:inline-block;}
.more-back{position:fixed;inset:0;z-index:30;}
.more-menu{position:absolute;top:calc(100% + 4px);inset-inline-end:0;z-index:31;background:var(--surface);border:1px solid var(--line);border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,0.16);padding:6px;min-width:190px;display:flex;flex-direction:column;gap:2px;animation:cmmsMenuIn 150ms var(--ease-out) both;transform-origin:top right;}
.more-menu button{display:flex;align-items:center;gap:8px;width:100%;text-align:right;background:none;border:none;padding:9px 11px;border-radius:8px;font-size:13px;color:var(--ink);cursor:pointer;}
.more-menu button:hover{background:var(--surface-2);}
.ftable-head{display:grid;grid-template-columns:34px 0.8fr 1.4fr 1fr 1.1fr;gap:6px;padding:11px 16px;background:linear-gradient(180deg,var(--surface-2),rgba(230,231,233,.65));font-size:11px;font-weight:650;color:var(--muted);text-transform:uppercase;letter-spacing:.35px;border-bottom:1px solid rgba(201,205,209,.72);}
.ftable-row{display:grid;grid-template-columns:34px 0.8fr 1.4fr 1fr 1.1fr;gap:6px;padding:12px 16px;width:100%;text-align:right;border-top:1px solid rgba(201,205,209,.52);align-items:center;color:var(--ink);font-size:12.5px;cursor:pointer;}
.fleet-unit-table .fleet-unit-row{grid-template-columns:minmax(90px,.62fr) minmax(190px,1.35fr) minmax(116px,.82fr) minmax(110px,.75fr) minmax(230px,1.45fr) 42px;gap:12px;text-align:right;align-items:center;}
.fleet-unit-table .ftable-head.fleet-unit-row{padding-block:9px;}
.fleet-unit-table .ftable-row.fleet-unit-row{padding-block:6px;min-height:58px;}
.fleet-unit-table .fleet-unit-row>span,.fleet-unit-table .fleet-unit-row>label{text-align:right;min-width:0;}
.fleet-unit-table .ft-code,.fleet-unit-table .ft-type,.fleet-unit-table .ft-model,.fleet-unit-table .ft-sup,.fleet-unit-table .ft-doc,.fleet-unit-table .ft-select{grid-row:1;}
.fleet-unit-table .ft-code{grid-column:1;direction:ltr;text-align:right;unicode-bidi:isolate;font-variant-numeric:tabular-nums;font-weight:650;font-size:14px;letter-spacing:0;color:var(--ink);}
.fleet-unit-table .ft-type{grid-column:2;}
.fleet-unit-table .ft-type b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.fleet-unit-table .ft-model{grid-column:3;direction:ltr;text-align:right;unicode-bidi:isolate;font-weight:650;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:var(--surface-2);border-radius:8px;padding:4px 8px;width:max-content;max-width:100%;}
.fleet-unit-table .ft-sup{grid-column:4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted);font-weight:600;}
.fleet-unit-table .ft-doc{grid-column:5;text-align:center;}
.fleet-unit-table .ft-select{grid-column:6;align-self:stretch;justify-self:center;}
.manager-fleet-page{width:min(100%,1280px);margin-left:auto;margin-right:auto;}
.manager-fleet-page>.seg-tabs{width:100%;max-width:none!important;margin-left:0;margin-right:0;}
.manager-fleet-table{width:100%;margin:0;}
.manager-fleet-table .manager-fleet-row{grid-template-columns:minmax(96px,126px) minmax(360px,1fr) minmax(116px,156px) minmax(96px,126px);gap:12px;}
.manager-fleet-table .manager-fleet-row>span{min-width:0;text-align:center;justify-content:center;}
.manager-fleet-table .ft-code{direction:ltr;unicode-bidi:isolate;white-space:nowrap;font-variant-numeric:tabular-nums;}
.manager-fleet-table .ft-model{line-height:1.3;}
.manager-fleet-table .ft-model b{display:block;white-space:normal;overflow-wrap:anywhere;}
.manager-fleet-table .ft-sup{overflow-wrap:anywhere;}
.manager-fleet-table .ft-doc{white-space:nowrap;}
.ftable-row:hover{background:rgba(31,78,140,.045);}
.ftable-row.selected{background:rgba(31,78,140,0.08);}
.ft-select{display:flex;align-items:center;justify-content:center;align-self:center;cursor:pointer;}
.ftable-row.blocked{border-inline-start:4px solid var(--muted);background:linear-gradient(90deg,rgba(220,38,38,0.07),transparent 60%);}
.doc-chip-stack{display:flex;flex-wrap:nowrap;gap:5px;align-items:center;justify-content:center;min-width:0;overflow:hidden;}
.doc-chip{display:grid;grid-template-columns:7px minmax(42px,1fr) minmax(26px,auto);align-items:center;gap:4px;line-height:1.12;font-size:10.5px;color:var(--muted);background:var(--surface-2);border:1px solid rgba(201,205,209,.72);border-radius:999px;padding:2px 6px;min-width:0;max-width:128px;}
.doc-chip-dot{width:7px;height:7px;border-radius:50%;display:inline-block;box-shadow:0 0 0 3px rgba(255,255,255,.72);}
.doc-chip-name{color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.doc-chip-days{font-weight:650;white-space:nowrap;text-align:left;}
.blk-chip{display:inline-flex;align-items:center;gap:3px;color:#fff;font-size:10px;font-weight:800;border-radius:999px;padding:2px 8px;margin-inline-start:6px;letter-spacing:.2px;vertical-align:middle;}
.blk-banner{display:flex;align-items:center;gap:11px;border:1.5px solid;border-radius:13px;padding:12px 14px;margin:10px 0 4px;}
.blk-banner .blk-b-txt{display:flex;flex-direction:column;line-height:1.35;}
.blk-banner .blk-b-txt b{font-size:14px;}.blk-banner .blk-b-txt span{font-size:11.5px;opacity:.85;}
.blk-return{margin-inline-start:auto;background:var(--surface);border:1.5px solid currentColor;color:inherit;font-weight:700;border-radius:10px;padding:8px 13px;font-size:12px;white-space:nowrap;}
.blk-set{color:#B91C1C;border-color:#FCA5A5;}
.blk-set-panel{margin-top:14px;border:1.5px solid #FCA5A5;background:#FEF2F2;border-radius:12px;padding:12px;}
.blk-set-h{display:flex;align-items:center;gap:6px;font-weight:700;color:#B91C1C;font-size:13.5px;margin-bottom:8px;}
.blk-set-panel textarea{width:100%;margin-bottom:8px;}
.drv-unit.blocked{box-shadow:inset 0 0 0 1.5px rgba(220,38,38,0.4);}
.color-popover{position:relative;display:inline-flex;align-items:center;justify-content:center;}
.color-trigger{width:44px;height:44px;border-radius:999px;border:1px solid var(--line);background:var(--surface);display:inline-flex;align-items:center;justify-content:center;padding:0;box-shadow:var(--control-shadow);}
.color-trigger span{width:26px;height:26px;border-radius:999px;border:2px solid var(--surface);box-shadow:0 0 0 1px rgba(46,49,56,.18);}
.color-menu{position:absolute;inset-inline-start:0;top:calc(100% + 8px);z-index:30;display:grid;grid-template-columns:repeat(5,28px);gap:8px;padding:10px;border:1px solid var(--line);border-radius:16px;background:var(--surface);box-shadow:0 16px 42px rgba(46,49,56,.16);}
.color-choice{width:28px;height:28px;border-radius:999px;border:2px solid var(--surface);padding:0;box-shadow:0 0 0 1px rgba(46,49,56,.14);cursor:pointer;}
.color-choice.on{box-shadow:0 0 0 2px var(--surface) inset,0 0 0 2px var(--ink);}
.ft-code{font-weight:700;}.ft-model{font-size:11.5px;color:var(--muted);display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0;}.ft-model b{color:var(--ink);font-size:12.5px;font-weight:600;}
.ft-sup{color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.ft-doc{display:flex;align-items:center;gap:6px;font-weight:600;}
.doc-edit{margin-bottom:12px;}
.doc-edit-lbl{font-size:13px;font-weight:600;margin-bottom:5px;}
.doc-edit-row{display:flex;gap:8px;}
.doc-edit-row input[type=date]{flex:0 0 42%;}.doc-edit-row input{border:1.5px solid var(--line);border-radius:10px;padding:10px;background:var(--input);min-width:0;}
.doc-view{display:flex;align-items:center;gap:9px;padding:9px 0;border-bottom:1px solid var(--line);}
.doc-view:last-child{border-bottom:none;}
.doc-name{flex:1;font-size:13.5px;font-weight:500;}.doc-date{font-size:12.5px;font-weight:600;}
.doc-link{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:var(--surface-2);color:var(--primary);}

.ins-ok,.ins-bad{width:44px;height:44px;border-radius:11px;border:1.5px solid var(--line);background:var(--surface);display:flex;align-items:center;justify-content:center;color:var(--muted);}
.ins-ok.on{background:#16A34A;border-color:#16A34A;color:#fff;}
.ins-bad.on{background:#DC2626;border-color:#DC2626;color:#fff;}

.sla-grid{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;}
.sla-cell{display:flex;flex-direction:column;gap:4px;font-size:12.5px;font-weight:600;}
.sla-cell input{width:100%;border:1.5px solid var(--line);border-radius:9px;padding:8px;background:var(--input);text-align:center;}
.avatar{width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--accent));color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;flex-shrink:0;}
.avatar.sm{width:36px;height:36px;font-size:14px;}

.bar-row{margin-bottom:13px;}.bar-row:last-child{margin-bottom:0;}
.bar-click{display:block;width:100%;min-height:44px;text-align:right;background:none;border:none;padding:7px 8px;margin:0 -8px 8px;border-radius:11px;color:inherit;cursor:pointer;position:relative;}
.bar-click:hover{background:var(--surface-2);}
.bar-click .bar-chev{position:absolute;inset-inline-start:6px;top:6px;color:var(--muted);opacity:.6;}
.kpi-unit-row.bar-click{display:flex;cursor:pointer;border-radius:9px;}
.focus-banner{display:flex;align-items:center;gap:8px;background:var(--primary-soft,rgba(37,99,235,0.1));border:1.5px solid var(--primary);color:var(--primary);border-radius:11px;padding:8px 12px;margin-bottom:10px;font-size:13px;}
.focus-banner span{flex:1;}
.focus-banner button{background:var(--surface);border:1px solid currentColor;color:inherit;border-radius:8px;min-height:30px;padding:0 10px;display:flex;align-items:center;justify-content:center;gap:5px;cursor:pointer;flex:none;font-size:12px;font-weight:700;white-space:nowrap;}
.bar-top{display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px;gap:10px;}
.bar-lbl{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}.bar-val{font-weight:700;flex-shrink:0;}
.bar-track{height:9px;border-radius:999px;background:var(--surface-2);overflow:hidden;}
.app-dark .bar-track{background:#0c1119;}
.bar-fill{height:100%;border-radius:999px;transition:background-color 160ms var(--ease-out);}

.supplier-shell{padding:2px;}
.supplier-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:2px 0 12px;}
.supplier-head .section-title{margin:0;}
.supplier-total{display:inline-flex;align-items:center;justify-content:center;min-height:32px;border:1px solid rgba(148,163,184,.26);border-radius:999px;background:var(--surface);color:var(--muted);font-size:12px;font-weight:500;padding:4px 11px;box-shadow:var(--control-shadow);}
.supplier-command{display:grid;grid-template-columns:minmax(240px,1.25fr) minmax(280px,.95fr);gap:10px;align-items:stretch;margin:0 0 14px;}
.supplier-search{margin:0;}
.supplier-add{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;background:var(--surface-glow);border:1px solid rgba(148,163,184,.28);border-radius:14px;padding:5px;box-shadow:var(--control-shadow);}
.supplier-add input{border:0!important;background:transparent!important;box-shadow:none!important;padding-inline:10px;}
.supplier-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;}
.supplier-card{min-height:130px;text-align:start;border:1px solid rgba(148,163,184,.26);border-radius:16px;padding:14px;background:var(--surface-glow);cursor:pointer;color:var(--ink);box-shadow:var(--control-shadow);display:flex;flex-direction:column;gap:10px;}
.supplier-card:hover{transform:translateY(-1px);box-shadow:var(--lift-shadow);border-color:rgba(31,78,140,.32);}
.supplier-card-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;}
.supplier-card-top svg{color:var(--muted);margin-top:2px;flex:none;}
.supplier-card-name{font-weight:500;font-size:15px;line-height:1.3;text-wrap:balance;}
.supplier-tags{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-height:24px;}
.supplier-tag{display:inline-flex;align-items:center;border-radius:999px;background:rgba(31,78,140,.09);color:var(--primary);border:1px solid rgba(31,78,140,.18);font-size:11.5px;font-weight:500;padding:3px 8px;}
.supplier-tag.muted{background:var(--surface-2);color:var(--muted);border-color:var(--line);}
.supplier-metrics{margin-top:auto;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;color:var(--muted);font-size:11px;font-weight:500;}
.supplier-metrics span{min-width:0;border-radius:8px;background:rgba(100,116,139,.08);padding:3px 5px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.supplier-detail-tags{margin:4px 0 10px;}
.supplier-tabs{display:flex;gap:4px;border-bottom:1px solid var(--border);margin-bottom:14px;flex-wrap:wrap;}
.supplier-tab{min-height:36px;padding:8px 10px;border-bottom:2px solid transparent;border-radius:0;color:var(--muted);font-size:13px;font-weight:500;}
.supplier-tab.on{border-bottom-color:var(--primary);color:var(--ink);}
.supplier-type-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;}
.supplier-type-card{min-height:48px;display:flex;align-items:center;justify-content:center;gap:8px;text-align:center;border:1px solid var(--line);border-radius:12px;background:var(--surface);color:var(--muted);font-size:13px;font-weight:500;padding:8px 10px;box-shadow:var(--control-shadow);}
.supplier-type-card.on{border-color:rgba(31,78,140,.45);background:var(--primary-soft);color:var(--primary);}
.supplier-type-card:disabled{cursor:default;opacity:.72;}
.supplier-scope-picker{border:1px solid var(--line);border-radius:12px;background:var(--surface);overflow:hidden;margin-top:6px;}
.supplier-scope-picker summary{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;cursor:pointer;font-weight:500;list-style:none;}
.supplier-scope-picker summary::-webkit-details-marker{display:none;}
.supplier-scope-picker summary span:last-child{font-size:12px;color:var(--muted);font-weight:500;}
.supplier-scope-body{display:grid;gap:12px;padding:0 12px 12px;}
.supplier-scope-block{border-top:1px solid var(--line);padding-top:12px;}
.supplier-scope-title{font-size:12px;color:var(--muted);font-weight:500;margin-bottom:8px;}
.supplier-linked-row .task-row-side{flex-direction:row;align-items:center;gap:8px;color:var(--muted);}
.supplier-linked-row:hover .task-row-side{color:var(--primary);}
.supplier-tech-row{width:100%;text-align:start;cursor:pointer;}
.supplier-tech-row .task-row-side{flex-direction:row;align-items:center;gap:8px;color:var(--muted);}
.supplier-tech-row:hover .task-row-side{color:var(--primary);}

.empty{text-align:center;padding:46px 20px;color:var(--muted);}.empty.sm{padding:32px;}
.empty svg{color:var(--line);}
.empty-t{font-weight:600;font-size:15px;margin-top:12px;color:var(--muted);}.empty-s{font-size:13px;margin-top:5px;}
.empty-setup{display:flex;flex-direction:column;align-items:center;text-align:center;padding:48px 24px;}
.empty-setup .empty-title{font-size:16px;font-weight:600;color:var(--ink);margin-bottom:6px;}
.empty-setup .empty-sub{font-size:13px;color:var(--muted);max-width:320px;}
.qr-overlay{position:fixed;inset:0;z-index:120;background:rgba(2,6,23,.96);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:22px;color:#fff;}
.qr-viewfinder{position:relative;width:min(82vw,360px);aspect-ratio:1;border-radius:18px;overflow:hidden;background:#111827;}
.qr-viewfinder video{width:100%;height:100%;object-fit:cover;}
.qr-frame{position:absolute;inset:28px;border:3px solid rgba(255,255,255,.9);border-radius:14px;box-shadow:0 0 0 999px rgba(0,0,0,.22);}
.qr-frame span{position:absolute;left:10px;right:10px;top:50%;height:2px;background:#22C55E;box-shadow:0 0 14px #22C55E;animation:qrscan 1.5s ease-in-out infinite;}
@keyframes qrscan{0%,100%{transform:translateY(-70px);}50%{transform:translateY(70px);}}
.qr-copy{text-align:center;margin:18px 0 12px;display:flex;flex-direction:column;gap:5px;}
.qr-copy b{font-size:18px;}.qr-copy span{font-size:13px;color:#CBD5E1;}
.qr-btns{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;width:min(82vw,360px);}
.scan-required,.manual-entry,.scan-public{display:flex;flex-direction:column;gap:10px;background:var(--surface-2);border:1px solid var(--line);border-radius:12px;padding:14px;margin-bottom:12px;text-align:center;}
.manual-entry{text-align:start;}
.done-hero{display:flex;align-items:center;gap:12px;background:#DCFCE7;color:#15803D;border:1px solid #86EFAC;border-radius:14px;padding:14px;margin-bottom:14px;font-weight:800;}

.bottom-nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:560px;background:var(--surface);border-top:1px solid var(--line);display:flex;justify-content:space-around;padding:7px 6px max(7px,env(safe-area-inset-bottom));z-index:30;box-shadow:0 -1px 0 var(--line),0 -8px 24px rgba(15,23,42,.08);}
.navbtn{flex:1 1 0;min-width:0;min-height:52px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;color:var(--muted);font-size:11px;font-weight:500;padding:6px 5px;border:0;background:transparent;cursor:pointer;border-radius:12px;}
.navbtn span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.navbtn.on{color:var(--primary);}
.nav-more-btn{position:relative;}
.nav-more-menu{position:fixed;left:50%;bottom:calc(58px + max(7px,env(safe-area-inset-bottom)));transform:translateX(-50%);width:min(420px,calc(100vw - 24px));background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:8px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;box-shadow:0 18px 42px rgba(15,23,42,.22);z-index:25;animation:cmmsBottomMenuIn 170ms var(--ease-out) both;transform-origin:bottom center;}
.nav-more-item{min-height:44px;display:flex;align-items:center;gap:8px;justify-content:flex-start;text-align:start;border:1px solid transparent;background:var(--surface-2);color:var(--ink);border-radius:10px;padding:8px 10px;font:inherit;font-size:12.5px;font-weight:650;cursor:pointer;}
.nav-more-item span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.nav-more-item.on{border-color:rgba(31,78,140,.34);background:var(--primary-soft);color:var(--primary);}
.app-dark .nav-more-item.on{background:rgba(31,78,140,.18);border-color:rgba(31,78,140,.45);}

.ovl-backdrop.notif-back{align-items:stretch;justify-content:flex-start;padding:18px;z-index:70;background:rgba(46,49,56,.28);backdrop-filter:none;}
.notif-panel{direction:rtl;background:var(--surface);width:min(430px,calc(100vw - 36px));height:calc(100dvh - 36px);max-height:none;border:1px solid var(--line);border-radius:18px;overflow:hidden;display:flex;flex-direction:column;box-shadow:-20px 0 54px rgba(46,49,56,.22);animation:cmmsDrawerIn 190ms var(--ease-out) both;will-change:transform,opacity;}
.app-dark .notif-panel{box-shadow:-20px 0 54px rgba(0,0,0,.42);}
.notif-head{display:flex;align-items:center;justify-content:space-between;padding:15px 16px;border-bottom:1px solid var(--line);background:var(--surface-glow);}
.notif-title{font-family:var(--font-head);font-weight:700;font-size:16px;display:flex;align-items:center;gap:8px;}
.notif-count{font-size:12px;color:var(--muted);margin-top:3px;}
.notif-perm{display:flex;align-items:center;justify-content:center;gap:7px;margin:12px 16px 0;background:#ECFDF5;color:#047857;border:1px solid #A7F3D0;border-radius:10px;padding:10px;font-size:13.5px;font-weight:600;cursor:pointer;}
button.notif-perm:hover{background:#D1FAE5;}
.notif-perm.warn{background:#FEF3C7;color:#92400E;border-color:#FCD34D;cursor:default;}
.notif-perm.ok{cursor:default;}
.notif-markall{display:flex;align-items:center;justify-content:center;gap:6px;width:calc(100% - 32px);margin:10px 16px 0;background:var(--surface-2);color:var(--ink);border:1px solid var(--line);border-radius:12px;padding:10px;font:inherit;font-size:13px;font-weight:600;cursor:pointer;}
.notif-markall:hover{border-color:var(--primary);color:var(--primary);}
.notif-markall:disabled{opacity:.65;cursor:default;border-color:var(--line);color:var(--muted);}
.notif-unread-summary{margin:12px 16px 0;border:1px solid #E2D3BA;background:#FBF7EF;border-radius:14px;padding:11px 12px;box-shadow:inset 0 1px 0 rgba(255,255,255,.72);}
.app-dark .notif-unread-summary{background:#2a2117;border-color:#5d4b32;box-shadow:none;}
.nus-title{font-size:12px;font-weight:650;color:var(--primary);margin-bottom:6px;}
.app-dark .nus-title{color:#FDBA74;}
.nus-row{display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:700;color:var(--ink);padding:3px 0;}
.nus-more{font-size:11.5px;color:var(--muted);margin-top:4px;}
/* cleaning track */
.icon-btn.light{color:#fff;}
.icon-btn.sm{width:36px;height:36px;}
.field-row{display:flex;gap:10px;}.field-row .field{flex:1;}
.cl-edit-block{border:1px solid var(--line);border-radius:12px;background:var(--surface);padding:7px;margin-bottom:8px;}
.cl-row{display:flex;align-items:center;gap:8px;margin-bottom:6px;}
.cl-row input[type=text],.cl-row > input{flex:1;}
.cl-row input{padding:8px 10px;border:1px solid var(--line);border-radius:9px;background:var(--surface);color:var(--ink);font:inherit;font-size:14px;}
.cl-translate-btn{flex:0 0 auto;min-height:34px;padding:7px 10px;font-size:12px;}
.cl-translations{border-top:1px dashed var(--line);padding-top:8px;margin-top:4px;display:grid;gap:8px;}
.cl-translation-head{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;font-weight:800;color:var(--muted);}
.cl-translation-field{margin:0;}
.win-tol{display:flex;align-items:center;gap:5px;font-size:13px;color:var(--muted);white-space:nowrap;}
.win-tol input{width:64px;}
.tcard-actions{display:flex;gap:4px;align-items:center;margin-inline-start:auto;}
.tcard.clk{cursor:pointer;text-align:start;}
.toast-ok{display:flex;align-items:center;justify-content:center;gap:7px;background:#ECFDF5;color:#047857;border:1px solid #A7F3D0;border-radius:10px;padding:10px;font-size:13.5px;font-weight:600;margin-bottom:12px;}
.ovl-panel.qr-label-panel{width:min(680px,calc(100vw - 56px));max-width:none;}
.qr-label-panel .qr-label-sheet{width:100%;max-width:none;}
.qr-label-sheet{max-width:520px;}
.qr-label-body{display:flex;flex-direction:column;align-items:center;gap:14px;}
.qr-label-actions{width:min(100%,340px);}
.zone-tag-page{break-after:page;page-break-after:always;width:100%;display:flex;justify-content:center;}
.zone-tag-page:last-child{break-after:auto;page-break-after:auto;}
.zone-tag{width:340px;min-height:416px;border:3px solid #16202E;border-radius:28px;padding:30px 22px 24px;text-align:center;background:#fff;color:#0b0b0b;margin:0 auto;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 10px 26px rgba(15,23,42,.10);}
.zt-name{font-size:28px;font-weight:900;line-height:1.05;text-wrap:balance;max-width:100%;}
.zt-loc{font-size:17px;color:#555;margin-top:8px;line-height:1.2;text-wrap:balance;max-width:100%;}
.zt-qr{width:230px;height:230px;margin:20px auto 10px;display:block;image-rendering:pixelated;}
.zt-qr-fallback{width:230px;height:230px;margin:20px auto 10px;display:flex;align-items:center;justify-content:center;border:2px dashed #bbb;border-radius:12px;color:#bbb;}
.zt-code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:31px;font-weight:900;letter-spacing:4px;line-height:1.05;}
.zt-hint{font-size:13px;color:#777;margin-top:14px;line-height:1.25;text-wrap:balance;}
@media print{
@page{size:62mm 90mm;margin:0;}
html,body,#root{width:62mm!important;min-height:90mm!important;background:#fff!important;margin:0!important;padding:0!important;overflow:visible!important;}
body>*:not(#root),.app-root>:not(.main-col),.main-col>:not(.content),.content.with-nav>:not(.ovl-backdrop){display:none!important;}
.ovl-backdrop{position:absolute!important;inset:0!important;display:block!important;width:62mm!important;min-height:90mm!important;margin:0!important;padding:0!important;background:#fff!important;z-index:9999!important;}
.ovl-panel{display:block!important;width:62mm!important;height:auto!important;max-width:none!important;max-height:none!important;margin:0!important;padding:0!important;background:#fff!important;border-radius:0!important;box-shadow:none!important;overflow:visible!important;}
.ovl-backdrop>*:not(.ovl-panel),.ovl-panel>*:not(.qr-label-sheet){display:none!important;}
body *{visibility:hidden!important;}
.qr-label-sheet,.qr-label-sheet *{visibility:visible!important;}
.qr-label-sheet{position:absolute!important;inset:0!important;width:62mm!important;max-width:none!important;margin:0!important;padding:0!important;background:#fff!important;color:#000!important;box-shadow:none!important;}
.qr-label-controls{display:none!important;}
.qr-label-body{display:block!important;width:62mm!important;margin:0!important;padding:0!important;background:#fff!important;}
.zone-tag-page{width:62mm!important;height:90mm!important;margin:0!important;padding:0!important;display:flex!important;align-items:center!important;justify-content:center!important;background:#fff!important;break-after:page;page-break-after:always;}
.zone-tag-page:last-child{break-after:auto;page-break-after:auto;}
.zone-tag{width:56mm!important;height:84mm!important;min-height:0!important;box-sizing:border-box!important;border:1.2mm solid #16202E!important;border-radius:5mm!important;padding:7mm 4mm 5mm!important;margin:0!important;box-shadow:none!important;color:#000!important;background:#fff!important;}
.zt-name{font-size:18pt!important;line-height:1.05!important;font-weight:900!important;}
.zt-loc{font-size:11pt!important;line-height:1.15!important;margin-top:2.5mm!important;color:#555!important;}
.zt-qr{width:40mm!important;height:40mm!important;margin:6mm auto 3mm!important;}
.zt-qr-fallback{width:40mm!important;height:40mm!important;margin:6mm auto 3mm!important;}
.zt-code{font-size:20pt!important;line-height:1!important;letter-spacing:2.2mm!important;}
.zt-hint{font-size:8.5pt!important;line-height:1.18!important;margin-top:4mm!important;color:#777!important;}
}
.round-zone{background:var(--surface-2);border-radius:12px;padding:12px 14px;margin-bottom:14px;}
.rz-name{font-weight:800;font-size:16px;}.rz-loc{font-size:13px;color:var(--muted);margin:2px 0 4px;}
.round-cl{display:flex;flex-direction:column;gap:7px;}
.round-item{display:flex;align-items:center;gap:10px;padding:11px 12px;border:1px solid var(--line);border-radius:11px;cursor:pointer;font-size:14.5px;font-weight:500;}
.round-item.on{border-color:var(--primary);background:var(--primary-soft);}
.round-item input{display:none;}
.ri-box{width:22px;height:22px;border-radius:7px;border:2px solid var(--line);display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0;}
.round-item.on .ri-box{background:var(--primary);border-color:var(--primary);}
.todo-card{border:1px solid #FCD34D;background:#FFFBEB;border-radius:14px;padding:12px;margin-bottom:16px;}
.app-dark .todo-card{background:#3a2e0e;border-color:#a87f1a;}
.clean-missed-note{display:flex;align-items:flex-start;gap:8px;border:1px solid #FCA5A5;background:#FEF2F2;color:#991B1B;border-radius:12px;padding:10px 12px;margin-bottom:14px;font-size:13px;font-weight:700;line-height:1.45;}
.app-dark .clean-missed-note{background:#3b1111;border-color:#7f1d1d;color:#fecaca;}
.todo-h{display:flex;align-items:center;gap:7px;font-weight:800;font-size:14px;color:#92400E;margin-bottom:8px;}
.app-dark .todo-h{color:#FCD34D;}
.todo-row{display:flex;align-items:center;gap:10px;width:100%;text-align:start;padding:9px;border-radius:10px;background:var(--surface);border:1px solid var(--line);margin-bottom:6px;cursor:pointer;color:var(--ink);}
.todo-row:last-child{margin-bottom:0;}
.todo-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;}
.todo-main{flex:1;}.todo-zone{font-weight:700;font-size:14px;}.todo-sub{font-size:12px;color:var(--muted);}
.clean-area-group{margin:0 0 16px;}
.clean-area-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 8px;padding:0 2px;}
.clean-area-title{display:flex;align-items:center;gap:7px;font-size:14px;font-weight:800;color:var(--ink);}
.clean-area-meta{font-size:12px;color:var(--muted);margin-top:2px;}
.clean-floor-group{margin:0 0 10px;}
.clean-floor-title{font-size:12px;font-weight:800;color:var(--muted);margin:0 0 6px;padding-inline-start:2px;}
.clean-area-group.compact{margin:8px 0 10px;}
.clean-area-group.compact .clean-area-head{margin-bottom:6px;}
.clean-tcard-head{align-items:flex-start;flex-wrap:wrap;}
.clean-tcard-head .tcard-subj{white-space:normal;overflow:visible;text-overflow:clip;line-height:1.3;min-width:110px;}
.clean-tcard-head .badge{flex-shrink:0;}
.clean-stat-row{display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin:6px 0 2px;}
.clean-stat-chip{min-height:36px;border:1px solid rgba(148,163,184,.3);background:var(--surface-glow);color:var(--muted);border-radius:999px;padding:7px 10px;font-size:11.5px;font-weight:850;line-height:1.2;cursor:pointer;box-shadow:var(--control-shadow);}
.clean-stat-chip.warn{background:#FEF3C7;color:#92400E;border-color:#FDE68A;}
.clean-stat-chip.bad{background:#FEE2E2;color:#B91C1C;border-color:#FCA5A5;}
.clean-stat-chip:hover{filter:brightness(.98);transform:translateY(-1px);}
.clean-map-switch{max-width:360px;margin:0 0 12px;}
.clean-map-card{align-items:flex-start;}
.clean-zone-meta{display:flex;flex-wrap:wrap;gap:4px 10px;color:var(--muted);font-size:12px;line-height:1.35;margin-top:2px;}
.clean-zone-meta span:not(:last-child)::after{content:"";display:inline-block;width:3px;height:3px;border-radius:50%;background:var(--line-strong,#CBD5E1);margin-inline-start:10px;vertical-align:middle;}
.clean-zone-windows{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px;}
.clean-window-chip{border:1px solid var(--line);background:var(--surface-2);color:var(--muted);border-radius:999px;padding:3px 8px;font-size:11px;line-height:1.2;}
.clean-window-chip.dup{background:#FEF3C7;color:#92400E;border-color:#FDE68A;}
.clean-window-chip.muted{opacity:.82;}
.clean-owner-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}
.clean-owner-card{border:1px solid var(--line);border-radius:14px;background:var(--surface);padding:12px;box-shadow:var(--soft-shadow);}
.clean-owner-card.unassigned{border-color:#FDE68A;background:linear-gradient(180deg,rgba(254,243,199,.38),var(--surface));}
.clean-owner-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:9px;}
.clean-owner-title{font-size:15px;font-weight:650;color:var(--ink);}
.clean-owner-meta{font-size:12px;color:var(--muted);margin-top:2px;}
.clean-owner-rows{display:grid;gap:6px;}
.clean-owner-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:8px;width:100%;text-align:start;border:1px solid var(--line);background:var(--surface-glow);border-radius:11px;padding:8px 9px;color:var(--ink);cursor:pointer;}
.clean-owner-row:hover{border-color:var(--primary);background:var(--primary-soft);}
.clean-owner-time{min-width:45px;text-align:center;border-radius:999px;background:var(--surface-2);color:var(--primary);padding:3px 7px;font-size:12px;font-weight:650;}
.clean-owner-time.muted{color:var(--muted);}
.clean-owner-main{min-width:0;display:grid;gap:1px;}
.clean-owner-zone{font-size:13px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.clean-owner-sub{font-size:11.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.clean-conflict-badge{border:1px solid #FDE68A;background:#FEF3C7;color:#92400E;border-radius:999px;padding:3px 8px;font-size:11px;line-height:1.2;white-space:nowrap;}
.clean-conflict-badge.soft{background:rgba(254,243,199,.55);}
.todo-card .clean-area-title{font-size:13px;color:#92400E;}
.app-dark .todo-card .clean-area-title{color:#FCD34D;}
.todo-card .clean-area-meta{display:none;}
.todo-card .clean-floor-title{font-size:11px;color:#92400E99;}
.app-dark .todo-card .clean-floor-title{color:#FCD34D99;}
.comp-card{border:1px solid var(--line);border-radius:14px;padding:16px;margin-bottom:8px;text-align:center;background:var(--surface);}
.comp-big{font-size:30px;font-weight:800;color:var(--primary);line-height:1;}
.comp-lbl{font-size:13px;color:var(--muted);margin:4px 0 10px;}
.comp-bar{height:8px;border-radius:99px;background:var(--surface-2);overflow:hidden;}
.comp-bar span{display:block;height:100%;background:var(--primary);border-radius:99px;}
.win-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px;}
.win-chip{font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px;}
.cmp-card{display:flex;gap:11px;border:1px solid var(--line);border-inline-start-width:4px;border-radius:12px;padding:11px;background:var(--surface);}
.cmp-photo{width:64px;height:64px;border-radius:10px;object-fit:cover;flex-shrink:0;cursor:zoom-in;}
.cmp-body{flex:1;min-width:0;}
.cmp-row1{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.cmp-zone{font-weight:700;font-size:14px;}
.cmp-meta{font-size:12px;color:var(--muted);margin-top:3px;}
.cmp-text{font-size:13px;margin-top:5px;}
.cmp-done{display:flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:#16A34A;margin-top:7px;}
.cmp-card .btn-ghost{margin-top:8px;}
.cmp-actions{display:flex;gap:8px;margin-top:8px;}
.day-h{font-size:12px;font-weight:800;color:var(--muted);margin:0 0 7px;padding-inline-start:2px;}
.day-toggle{background:none;border:none;color:var(--muted);font:inherit;font-size:13px;font-weight:700;cursor:pointer;padding:6px 2px;margin-top:6px;}
.day-toggle:hover{color:var(--ink);}
.kpi-row{display:flex;gap:10px;margin-bottom:6px;}.kpi-row .kpi{flex:1;border:1px solid var(--line);border-radius:12px;padding:12px;text-align:center;background:var(--surface);}
.ca-row{border:1px solid var(--line);border-radius:11px;padding:10px 12px;background:var(--surface);}
.ca-row1{display:flex;justify-content:space-between;align-items:baseline;gap:8px;}
.ca-name{font-weight:700;font-size:14px;}.ca-pct{font-weight:800;font-size:15px;}
.ca-bar{height:7px;border-radius:99px;background:var(--surface-2);overflow:hidden;margin:7px 0 4px;}
.ca-bar span{display:block;height:100%;border-radius:99px;}
.ca-sub{font-size:12px;color:var(--muted);}
.pub-entry{min-height:44px;display:flex;align-items:center;justify-content:center;gap:7px;width:100%;margin-top:12px;background:none;border:1px dashed var(--line);border-radius:10px;padding:10px 12px;color:var(--muted);font:inherit;font-size:13px;font-weight:600;cursor:pointer;}
.pub-entry:hover{border-color:var(--primary);color:var(--primary);}
.pub-wrap{position:fixed;inset:0;z-index:60;background:rgba(15,23,42,.55);display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:20px;}
.pub-card{position:relative;width:100%;max-width:420px;background:var(--surface);border-radius:18px;padding:22px;margin:auto;box-shadow:0 20px 60px rgba(0,0,0,.3);animation:cmmsSurfaceIn 220ms var(--ease-out) both;will-change:transform,opacity;}
.pub-x{position:absolute;inset-inline-end:12px;top:12px;}
.pub-logo{width:52px;height:52px;border-radius:14px;background:var(--primary-soft);color:var(--primary);display:flex;align-items:center;justify-content:center;margin-bottom:12px;}
.pub-title{font-size:20px;font-weight:800;}
.pub-sub{font-size:13px;color:var(--muted);margin:4px 0 16px;line-height:1.5;}
.pub-scan-btn{margin-bottom:10px;}
.pub-zones{display:flex;flex-direction:column;gap:8px;}
.pub-zone{text-align:start;background:var(--surface-2);border:1px solid var(--line);border-radius:12px;padding:13px 14px;cursor:pointer;color:var(--ink);}
.pub-zone:hover{border-color:var(--primary);}
.pub-zone-n{font-weight:700;font-size:15px;}.pub-zone-l{font-size:12px;color:var(--muted);margin-top:2px;}
.pub-chips{display:flex;flex-wrap:wrap;gap:7px;}
.pub-chip{background:var(--surface-2);border:1px solid var(--line);border-radius:99px;padding:8px 13px;font:inherit;font-size:13px;cursor:pointer;color:var(--ink);}
.pub-chip.on{background:var(--primary);color:#fff;border-color:var(--primary);}
.pub-foot{font-size:11px;color:var(--muted);text-align:center;margin-top:12px;line-height:1.5;}
.pub-done{text-align:center;padding:14px 0;}
.pub-done-t{font-size:19px;font-weight:800;margin:12px 0 4px;}
.pub-done-s{font-size:13px;color:var(--muted);margin-bottom:18px;}
.notif-list{overflow-y:auto;padding:8px 10px 12px;display:flex;flex-direction:column;gap:6px;}
.notif-more{border-top:1px solid var(--border);padding:11px 14px;background:var(--surface);font-weight:800;color:var(--primary);width:100%;}
.notif-more:hover{background:var(--surface-2);}
.notif-item{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:11px;width:100%;text-align:right;padding:12px 13px;border:1px solid transparent;border-radius:13px;color:var(--ink);background:transparent;}
.notif-item:hover{background:var(--surface-2);}
.notif-item.unread{background:#F7F8FA;border-color:#C9CDD1;box-shadow:inset 0 0 0 1px rgba(255,255,255,.55);}
.app-dark .notif-item.unread{background:#242A32;border-color:#3E4650;box-shadow:none;}
.ni-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;background:var(--muted);box-shadow:0 0 0 4px rgba(164,169,176,.12);}
.ni-dot.new{background:var(--primary);}.ni-dot.upd{background:var(--primary);}.ni-dot.ready{background:var(--primary-d);}.ni-dot.sla{background:#DC2626;}.ni-dot.pm{background:var(--primary);}.ni-dot.task{background:var(--primary);}.ni-dot.doc{background:#B45309;}.ni-dot.confirm{background:#0D9488;}.ni-dot.back{background:#DC2626;}.ni-dot.escalate{background:#B91C1C;}.ni-dot.driver{background:#0D9488;}.ni-dot.ppe{background:#64748B;}
.ni-dot.cleaning{background:var(--primary);}
.notif-item.clk{cursor:pointer;}.notif-item .ni-go{color:var(--muted);align-self:center;flex-shrink:0;opacity:.72;}
.icon-btn.on2{background:var(--primary-soft,#FFF4ED);color:var(--primary);}
.notif-push{border-bottom:1px solid var(--line);padding:10px 14px;background:var(--surface);}
.notif-push-main{display:flex;align-items:center;gap:9px;font-size:12.5px;color:var(--ink);}
.notif-push-main b{display:block;font-size:13px;}.notif-push-main span{display:block;color:var(--muted);line-height:1.35;margin-top:2px;}
.notif-push-actions{display:flex;gap:7px;margin-top:9px;}.notif-push-actions .btn-ghost{flex:1;justify-content:center;}
.notif-push-msg{font-size:12px;color:var(--muted);line-height:1.4;margin-top:7px;}
.notif-read-toggle{width:calc(100% - 32px);margin:10px 16px 0;border:1px solid var(--line);background:var(--surface);color:var(--muted);border-radius:12px;padding:9px 10px;font-size:12.5px;font-weight:600;}
.notif-read-toggle:hover{border-color:var(--primary-line);color:var(--primary);background:var(--surface-2);}
.notif-settings{border-bottom:1px solid var(--line);padding:10px 14px;background:var(--surface-2);}
.ns-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:5px 0;}
.ns-row.clk{cursor:pointer;}
.ns-lbl{font-size:13px;font-weight:600;}
.seg-tabs.mini{display:inline-flex;width:auto;}.seg-tabs.mini button{font-size:11.5px;padding:5px 10px;}
.ns-sub{font-size:11px;font-weight:700;color:var(--muted);margin:8px 0 5px;}
.ns-note{font-size:11.5px;color:var(--muted);line-height:1.4;margin-bottom:7px;}
.ns-kinds{display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;margin-bottom:8px;}
.ns-kind{display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;}
.ns-kind .ni-dot{position:static;flex-shrink:0;}
.ni-group{margin-bottom:6px;}
.ni-group-h{display:flex;align-items:center;gap:7px;font-size:11.5px;font-weight:800;color:var(--ink);padding:7px 14px 4px;}
.ni-group-h .ni-dot{position:static;}
.ni-group-n{font-size:10px;font-weight:600;color:var(--muted);background:var(--surface-2);border-radius:999px;padding:1px 7px;}
.ni-body{min-width:0;}
.ni-title{font-weight:650;font-size:13.5px;display:flex;align-items:center;gap:7px;flex-wrap:wrap;line-height:1.3;}
.ni-new{display:inline-flex;align-items:center;border-radius:999px;background:var(--primary);color:#fff;font-size:10px;font-weight:800;padding:2px 7px;line-height:1;}
.ni-text{font-size:12.5px;color:var(--muted);margin-top:2px;line-height:1.45;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}.ni-time{font-size:11px;color:var(--muted);margin-top:4px;}
.side-badge{margin-inline-start:auto;background:#EF4444;color:#fff;min-width:20px;height:20px;border-radius:999px;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 5px;}
.role-preview{margin-top:8px;}
.rp-toggle{display:flex;align-items:center;gap:7px;width:100%;min-height:44px;border:1px solid #ffffff1a;border-radius:999px;background:#ffffff08;color:#fff;padding:6px 9px;text-align:right;}
.rp-toggle:hover,.rp-toggle.on{background:#ffffff12;border-color:#ffffff28;}
.rp-toggle.compact{width:auto;min-height:44px;padding:6px 9px;}
.rp-toggle.compact .rp-toggle-txt{flex:0 0 auto;}
.rp-toggle.compact .rp-toggle-txt b{white-space:nowrap;}
.rp-toggle-ic{width:26px;height:26px;border-radius:999px;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;flex:none;}
.rp-toggle-txt{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1;}
.rp-toggle-txt b{font-size:11.5px;font-weight:800;line-height:1.15;}
.rp-toggle-txt small{font-size:10px;font-weight:500;color:var(--side-ink);line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.rp-toggle-chev{color:var(--side-ink);transition:transform 160ms var(--ease-out);flex:none;}
.rp-toggle.on .rp-toggle-chev{transform:rotate(-90deg);}
.rp-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:6px;padding:7px;border:1px solid #ffffff12;border-radius:12px;background:#ffffff06;}
.rp-btn{display:flex;align-items:center;justify-content:center;gap:5px;min-height:40px;min-width:0;border:1px solid #ffffff18;border-radius:10px;background:#ffffff08;color:var(--side-ink);font-size:11px;font-weight:700;line-height:1.15;text-align:center;}
.rp-btn span{min-width:0;overflow-wrap:anywhere;}
.rp-btn:hover{background:#ffffff14;color:#fff;}
.rp-btn.on{background:var(--primary);border-color:var(--primary);color:#fff;}
.side-report{min-height:44px;display:flex;align-items:center;justify-content:center;gap:6px;color:var(--side-ink);border:1px solid #ffffff14;border-radius:999px;padding:8px 12px;font-size:11.5px;font-weight:700;background:#ffffff08;}
.side-report:hover{background:#ffffff14;color:#fff;}
.side-user-btn{width:100%;text-align:right;border-radius:12px;transition:background-color 160ms var(--ease-out),transform 160ms var(--ease-out);}
.side-user-btn:hover,.side-user-btn:focus-visible{background:#ffffff12;}
.side-version{color:var(--side-ink);font-size:10.5px;text-align:center;padding:5px 4px 0;opacity:.82;}
.issue-capture-box{border:1px solid var(--line);border-radius:13px;background:var(--surface-2);padding:10px;margin-bottom:10px;display:grid;gap:8px;}
.issue-capture-head{display:flex;align-items:center;gap:7px;font-size:12.5px;color:var(--muted);}
.issue-capture-head b{color:var(--ink);font-size:13px;}
.issue-capture-head span{margin-inline-start:auto;font-weight:700;text-align:end;}
.issue-shot{position:relative;border:1px solid var(--line);border-radius:13px;overflow:hidden;margin-bottom:12px;background:var(--surface-2);}
.issue-shot img{display:block;width:100%;max-height:260px;object-fit:contain;}
.issue-list{display:grid;gap:10px;}
.issue-card{display:grid;grid-template-columns:1fr auto auto;align-items:center;gap:12px;background:var(--surface);border:1px solid var(--line);border-radius:13px;padding:12px;}
.issue-main{min-width:0;}
.issue-top{display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;}
.issue-status{display:inline-flex;align-items:center;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:800;background:#FEF3C7;color:#92400E;}
.issue-status.reviewing{background:var(--primary-soft);color:var(--primary);}
.issue-status.resolved{background:#DCFCE7;color:#15803D;}
.issue-date,.issue-meta{font-size:11.5px;color:var(--muted);}
.issue-desc{font-size:14px;font-weight:700;line-height:1.45;color:var(--ink);}
.issue-response{margin-top:7px;font-size:12.5px;color:var(--muted);background:var(--surface-2);border-radius:9px;padding:7px 9px;}
.system-error-samples{margin-top:7px;padding-top:7px;border-top:1px solid var(--line);display:grid;gap:3px;font-size:11.5px;}
.issue-thumb{width:74px;height:54px;border-radius:10px;overflow:hidden;border:1px solid var(--line);background:var(--surface-2);}
.issue-thumb img{width:100%;height:100%;object-fit:cover;display:block;}
.ovl-panel.profile-shell{align-items:center;justify-content:center;background:transparent;box-shadow:none;width:min(520px,calc(100% - 24px));height:auto;max-width:none;max-height:calc(100dvh - 24px);overflow:visible;padding:0;}
.ovl-panel.issue-report-shell{align-items:center;justify-content:center;background:transparent;box-shadow:none;width:min(420px,calc(100% - 24px));height:auto;max-width:none;max-height:calc(100dvh - 24px);overflow:visible;padding:0;}
.profile-shell .profile-modal,.issue-report-shell .issue-modal{width:100%;max-height:inherit;box-shadow:0 24px 60px rgba(0,0,0,.4);}
.brand-upload{display:grid;grid-template-columns:auto minmax(0,1fr);gap:15px;align-items:center;background:var(--surface-glow);border:1px solid rgba(201,205,209,.74);border-radius:15px;padding:14px 15px;margin-bottom:10px;box-shadow:var(--control-shadow);}
.brand-upload-main{min-width:0;flex:1;}
.brand-upload-title{font-size:14px;font-weight:750;color:var(--ink);margin-bottom:3px;}
.brand-upload-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:9px;}
.tab-badge{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:#EF4444;color:#fff;font-size:11px;font-weight:800;line-height:1;margin-inline-start:6px;}

.toast{position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:var(--slate);color:#fff;border-radius:13px;padding:13px 16px;display:flex;gap:11px;align-items:flex-start;max-width:90%;width:360px;box-shadow:0 12px 30px rgba(0,0,0,.35);z-index:80;animation:cmmsToastIn 260ms var(--ease-out) both;cursor:pointer;will-change:transform,opacity;}
.toast-title{font-weight:600;font-size:13.5px;}.toast-body{font-size:12.5px;color:#CBD5E1;margin-top:2px;line-height:1.4;}
.version-update-banner{position:fixed;inset-inline:16px;bottom:calc(86px + env(safe-area-inset-bottom));margin:0 auto;max-width:520px;z-index:9998;display:flex;flex-direction:column;align-items:stretch;gap:10px;background:#0F172A;color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:12px;box-shadow:0 14px 36px rgba(15,23,42,.28);}
.version-update-copy{display:flex;flex-direction:column;gap:3px;min-width:0;line-height:1.35;}.version-update-copy b{font-size:13.5px;}.version-update-copy span{font-size:12.5px;color:#CBD5E1;}
.version-update-actions{display:flex;align-items:center;gap:8px;flex-shrink:0;}.version-update-refresh{min-height:44px;flex:1;border:0;border-radius:10px;background:var(--orange);color:#fff;padding:9px 13px;font-weight:700;cursor:pointer;}.version-update-dismiss{border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.08);color:#fff;width:44px;height:44px;border-radius:11px;font-size:20px;line-height:1;cursor:pointer;}

.ai-back{align-items:flex-end;justify-content:center;z-index:72;}
.ai-panel{background:var(--surface);width:100%;max-width:540px;height:min(72dvh,640px);border-radius:18px 18px 0 0;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 -10px 50px rgba(0,0,0,.3);}
.ai-head{display:flex;align-items:center;justify-content:space-between;padding:13px 16px;border-bottom:1px solid var(--line);}
.ai-title{font-family:var(--font-head);font-weight:700;font-size:16px;display:flex;align-items:center;gap:9px;}
.ai-orb{width:30px;height:30px;border-radius:9px;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;}
.ai-conversation-bar{border-bottom:1px solid var(--line);padding:9px 16px;display:flex;flex-direction:column;gap:7px;background:var(--surface);}
.ai-conversation-actions{display:flex;align-items:center;gap:8px;}
.ai-conversation-new{min-height:34px;border:1.5px solid var(--line);border-radius:8px;background:var(--surface-2);color:var(--primary);display:inline-flex;align-items:center;gap:6px;padding:0 10px;font-size:12.5px;font-weight:750;cursor:pointer;}
.ai-conversation-new:disabled,.ai-conversation-archive:disabled,.ai-conversation-pill:disabled{opacity:.55;cursor:not-allowed;}
.ai-conversation-archive{width:34px;height:34px;}
.ai-conversation-list{display:flex;gap:6px;overflow-x:auto;padding-bottom:1px;}
.ai-conversation-pill{min-width:0;max-width:170px;height:30px;border:1px solid var(--line-soft);border-radius:8px;background:var(--surface-2);color:var(--muted);display:inline-flex;align-items:center;gap:5px;padding:0 8px;font-size:11.5px;font-weight:700;white-space:nowrap;cursor:pointer;}
.ai-conversation-pill span{min-width:0;overflow:hidden;text-overflow:ellipsis;}
.ai-conversation-pill.active{border-color:var(--primary);color:var(--primary);background:var(--primary-soft);}
.ai-conversation-error{font-size:11.5px;color:#B91C1C;}
.ai-msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;}
.ai-msg-wrap{display:flex;flex-direction:column;gap:8px;max-width:min(92%,430px);}
.ai-msg-wrap.assistant{align-self:flex-start;align-items:flex-start;}
.ai-msg-wrap.user{align-self:flex-end;align-items:flex-end;}
.ai-msg{max-width:84%;padding:12px 15px;border-radius:15px;font-size:15px;line-height:1.58;white-space:normal;unicode-bidi:plaintext;}
.ai-msg-wrap .ai-msg{max-width:100%;}
.ai-msg.assistant{align-self:flex-start;background:var(--surface-2);color:var(--ink);border-bottom-right-radius:5px;}
.ai-msg.user{align-self:flex-end;background:var(--primary);color:#fff;border-bottom-left-radius:5px;}
.ai-msg[dir="rtl"]{text-align:right;}
.ai-msg[dir="ltr"]{text-align:left;}
.ai-msg p{margin:0;}
.ai-msg p+p,.ai-msg p+ul,.ai-msg ul+p,.ai-msg ul+ul{margin-top:8px;}
.ai-msg ul{margin:0;padding:0;display:flex;flex-direction:column;gap:5px;}
.ai-msg[dir="rtl"] ul{padding-inline-start:0;padding-inline-end:18px;}
.ai-msg[dir="ltr"] ul{padding-inline-start:18px;padding-inline-end:0;}
.ai-msg li{padding-inline-start:2px;}
.ai-actions{display:flex;flex-direction:column;gap:8px;width:min(360px,100%);}
.ai-provider-plan{width:min(360px,100%);background:var(--surface);border:1.5px solid var(--line);border-inline-start:3px solid var(--accent);border-radius:14px;padding:10px 12px;box-shadow:var(--shadow-sm);font-size:13px;line-height:1.45;color:var(--ink);}
.ai-provider-plan-head{display:flex;align-items:center;justify-content:space-between;gap:10px;font-weight:750;margin-bottom:6px;}
.ai-provider-plan-head span:last-child{font-size:11.5px;font-weight:750;border-radius:999px;padding:3px 8px;background:rgba(31,78,140,.1);color:var(--primary);}
.ai-provider-plan-summary{color:var(--muted);font-size:12.5px;margin-bottom:8px;}
.ai-provider-plan-items{display:flex;flex-direction:column;gap:6px;}
.ai-provider-plan-item{border:1px solid var(--line-soft);border-radius:10px;background:var(--surface-2);padding:7px 9px;}
.ai-provider-plan-title{font-weight:750;color:var(--ink);}
.ai-provider-plan-reason,.ai-provider-plan-missing{margin-top:2px;color:var(--muted);font-size:12.5px;}
.ai-provider-plan-missing{color:#92400E;}
.ai-action-card{background:var(--surface);border:1.5px solid var(--line);border-inline-start:3px solid var(--primary);border-radius:14px;padding:10px 12px;box-shadow:var(--shadow-sm);font-size:13px;line-height:1.45;color:var(--ink);}
.ai-action-top{display:flex;align-items:center;justify-content:space-between;gap:10px;font-weight:700;margin-bottom:5px;}
.ai-action-state{font-size:11.5px;font-weight:700;border-radius:999px;padding:3px 8px;background:rgba(31,78,140,.1);color:var(--primary);}
.ai-action-state.wait{background:rgba(180,83,9,.12);color:#92400E;}
.ai-action-title{font-weight:700;color:var(--ink);margin-bottom:2px;}
.ai-action-meta,.ai-action-missing,.ai-action-ready{color:var(--muted);font-size:12.5px;}
.ai-action-diff{margin-top:7px;border-radius:9px;background:var(--surface-2);border:1px solid var(--line-soft);padding:7px 9px;color:var(--ink);font-size:12.5px;font-weight:650;}
.ai-action-diff-grid{display:flex;flex-direction:column;gap:5px;}
.ai-action-diff-row{display:grid;grid-template-columns:minmax(52px,.8fr) minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:6px;}
.ai-action-diff-label{color:var(--muted);font-weight:650;}
.ai-action-diff-before{min-width:0;color:var(--muted);font-weight:650;text-decoration:line-through;text-decoration-thickness:1px;text-decoration-color:var(--muted);}
.ai-action-diff-after{min-width:0;color:var(--primary);font-weight:750;}
.ai-action-diff-before,.ai-action-diff-after{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.ai-action-diff-arrow{color:var(--muted);font-weight:750;}
.ai-action-missing{margin-top:7px;color:#92400E;}
.ai-action-ready{margin-top:7px;color:var(--primary);}
.ai-action-confirm{margin-top:9px;width:100%;min-height:38px;border:1.5px solid var(--primary);border-radius:10px;background:var(--primary);color:#fff;font-weight:750;cursor:pointer;transition:background-color 160ms var(--ease-out),border-color 160ms var(--ease-out),opacity 160ms var(--ease-out);}
.ai-action-confirm:hover:not(:disabled){background:var(--primary-hover);border-color:var(--primary-hover);}
.ai-action-confirm:disabled{cursor:not-allowed;opacity:.58;background:var(--surface-2);border-color:var(--line);color:var(--muted);}
.ai-action-edit{margin-top:7px;width:100%;min-height:36px;border:1.5px solid var(--line);border-radius:10px;background:var(--surface);color:var(--primary);font-weight:750;cursor:pointer;transition:background-color 160ms var(--ease-out),border-color 160ms var(--ease-out),opacity 160ms var(--ease-out);}
.ai-action-edit:hover:not(:disabled){background:var(--primary-soft);border-color:var(--primary);}
.ai-action-edit:disabled{cursor:not-allowed;opacity:.55;color:var(--muted);}
.ai-action-result{margin-top:8px;font-size:12.5px;font-weight:650;line-height:1.4;}
.ai-action-result.ok{color:#166534;}
.ai-action-result.err{color:#B91C1C;}
.ai-memory-panel{border-bottom:1px solid var(--line);padding:10px 16px;display:flex;flex-direction:column;gap:7px;background:var(--surface-2);}
.ai-memory-head{display:flex;align-items:center;gap:6px;color:var(--primary);font-size:12px;font-weight:800;}
.ai-memory-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:8px;border:1px solid var(--line-soft);border-radius:8px;background:var(--surface);padding:7px 8px;}
.ai-memory-copy{min-width:0;}
.ai-memory-summary{font-size:12.5px;font-weight:700;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.ai-memory-meta,.ai-memory-error{font-size:11.5px;color:var(--muted);}
.ai-memory-edit{min-height:30px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--primary);font-size:11.5px;font-weight:750;padding:0 9px;}
.ai-memory-forget{width:30px;height:30px;}
.ai-memory-cites{display:flex;flex-direction:column;gap:6px;width:100%;}
.ai-memory-cite{display:flex;align-items:flex-start;gap:7px;border:1px solid var(--line-soft);border-radius:8px;background:var(--surface);padding:7px 9px;color:var(--ink);font-size:12px;line-height:1.35;}
.ai-memory-cite svg{color:var(--primary);flex:0 0 auto;margin-top:1px;}
.ai-memory-cite-summary{font-weight:750;}
.ai-quick{display:flex;flex-wrap:wrap;gap:8px;padding:0 16px 10px;}
.ai-quick button{border:1.5px solid var(--line);background:var(--surface);border-radius:999px;padding:8px 13px;font-size:12.5px;color:var(--muted);font-weight:500;}
.ai-input{display:flex;gap:8px;padding:12px 16px max(12px,env(safe-area-inset-bottom));border-top:1px solid var(--line);}
.ai-input input{flex:1;border:1.5px solid var(--line);border-radius:12px;padding:12px 14px;outline:none;background:var(--input);}
.ai-input .btn-primary{background:var(--primary);padding:0 16px;}

.alert-esc{display:flex;align-items:center;gap:9px;background:#FEF2F2;color:#B91C1C;border:1.5px solid #FCA5A5;border-radius:12px;padding:13px 15px;font-size:13.5px;margin-bottom:12px;cursor:pointer;font-weight:500;}
.alert-esc b{font-weight:700;}
.app-dark .alert-esc{background:#2a1212;border-color:#7f1d1d;color:#fca5a5;}
.export-bar{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;}
.export-bar .btn-ghost.sm{width:44px;min-width:44px;padding:0;font-size:0;overflow:hidden;}
.export-bar .btn-ghost.sm svg{width:17px;height:17px;margin:0;}
.export-bar .btn-ghost.sm:has(svg + *){gap:0;}
.parts-card{background:var(--surface);border:1px solid var(--line);border-inline-start:4px solid var(--primary);border-radius:13px;padding:13px 15px;margin:12px 0 4px;}
.parts-row{display:flex;align-items:center;gap:11px;}
.parts-icon{width:34px;height:34px;border-radius:10px;background:var(--primary-soft);color:var(--primary);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.app-dark .parts-icon{background:#2e2748;}
.parts-title{font-weight:600;font-size:14px;}
.parts-sub{font-size:12.5px;color:var(--muted);margin-top:2px;line-height:1.45;}

.cal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;}
.cal-title{font-family:var(--font-head);font-weight:700;font-size:16px;}
.cal-dows{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:6px;}
.cal-dow{text-align:center;font-size:12px;font-weight:700;color:var(--muted);}
.cal-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;}
.cal-cell{background:var(--surface);border:1px solid var(--line);border-radius:10px;min-height:86px;padding:5px 5px 6px;display:flex;flex-direction:column;gap:3px;}
.cal-cell.out{opacity:.4;}
.cal-cell.today{border-color:var(--primary);box-shadow:0 0 0 2px rgba(31,78,140,.18);}
.cal-daynum{font-size:12px;font-weight:600;color:var(--muted);}
.cal-pill{font-size:11px;font-weight:600;border-radius:7px;padding:3px 6px;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.cal-more{font-size:10.5px;color:var(--muted);font-weight:600;}

@media(max-width:760px){
  .bi-shell{--bi-title:19px;--bi-number:17px;}
  .bi-hero{align-items:flex-start;flex-direction:column;padding:14px 15px;gap:10px;}
  .bi-period{align-self:flex-start;}
  .bi-period-switch{align-self:stretch;overflow-x:auto;scrollbar-width:none;}
  .bi-period-switch::-webkit-scrollbar{display:none;}
  .bi-period-switch button{flex:1;min-width:max-content;padding-inline:10px;}
  .bi-grid{grid-template-columns:1fr;}
  .bi-heatmap{margin-inline:0;padding-inline:0;}
  .bi-heatmap-head,.bi-heatmap-row{grid-template-columns:128px repeat(6,56px);gap:5px;min-width:493px;}
  .bi-heatmap-insight{align-items:flex-start;flex-direction:column;gap:2px;}
  .bi-heatmap-head span{padding:0 4px;}
  .bi-heatmap-name,.bi-heatmap-cell{min-height:72px;border-radius:10px;}
  .bi-heatmap-name{height:104px;padding:7px 8px;}
  .bi-heatmap-risk-tags{max-height:35px;}
  .bi-heatmap-risk-tags i{padding:1px 4px;font-size:9.5px;}
  .bi-heatmap-ai{justify-self:start;padding:1px 5px;font-size:9.5px;}
  .bi-heatmap-cell b{font-size:17px;}
  .bi-heatmap-cell small{font-size:9.5px;}
  .bi-kpis{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}
  .bi-kpis .kpi{min-height:66px;padding:9px 8px;border-radius:12px;}
  .bi-kpis .kpi-num{font-size:18px;}
  .bi-kpis .kpi-lbl{font-size:10.8px;margin-top:4px;line-height:1.25;}
  .bi-mini-stats{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;}
  .bi-mini-stats span{padding:8px 6px;}
  .bi-panel-head{align-items:flex-start;}
  .bi-doc-row{align-items:flex-start;flex-direction:column;gap:2px;}
  .bi-risk-row{grid-template-columns:minmax(0,1fr) auto;gap:6px 8px;}
  .bi-risk-tags{grid-column:1 / -1;justify-content:flex-start;}
  .settings-wrap{width:100%;}
  .settings-wrap>.seg-tabs{margin-bottom:4px;}
  .settings-wrap .sect{margin:14px 0 7px;padding-top:6px;font-size:13px;}
  .settings-wrap .field{margin-bottom:10px;}
  .clean-owner-grid{grid-template-columns:1fr;}
  .clean-owner-row{grid-template-columns:auto minmax(0,1fr);align-items:flex-start;}
  .clean-owner-row .clean-conflict-badge{grid-column:1 / -1;justify-self:start;}
  .brand-upload{grid-template-columns:44px minmax(0,1fr);gap:11px;padding:12px;border-radius:14px;}
  .brand-upload .brand-mark{width:44px;height:44px;border-radius:12px;}
  .brand-upload-actions{gap:7px;}
  .brand-upload-actions .btn-ghost{flex:1;min-width:136px;}
  .settings-table-card{overflow-x:visible;padding:0;background:transparent;border:0;box-shadow:none;}
  .wait-reason-head{display:none;}
  .wait-reason-row{min-width:0;grid-template-columns:1fr;gap:9px;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:12px;box-shadow:var(--control-shadow);}
  .wait-reason-row .chk-line{justify-content:flex-start;}
  .wait-reason-row .reg-del{justify-self:flex-start;}
  .dt-edit-row{padding:10px;border-radius:13px;}
  .dt-edit-line{display:grid;grid-template-columns:minmax(0,1fr) 44px;gap:8px;}
  .dt-edit-line .dt-desc-in,.dt-edit-line select,.dt-edit-line .chk-line{grid-column:1 / -1;}
  .sla-grid{grid-template-columns:1fr!important;}
}

@media(max-width:760px){
  .pm-topbar{flex-direction:column;align-items:stretch;}
  .pm-top-actions{justify-content:stretch;}
  .pm-top-actions .btn-ghost,.pm-top-actions .btn-primary{flex:1;}
  .pm-list-tools{grid-template-columns:1fr;}
  .pm-list-bulk{justify-content:flex-start;}
  .cal-grid,.cal-dows{gap:4px;}
  .cal-cell{min-height:78px;padding:4px;}
  .pm-cal-type{font-size:9.5px;}
  .pm-cal-code{font-size:10.5px;}
}

.sec-toggle{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:13px 15px;margin:16px 0 8px;font-family:var(--font-head);font-weight:700;font-size:14.5px;color:var(--ink);}
.sec-toggle:hover{border-color:var(--primary);}
.sec-toggle > span{display:flex;align-items:center;gap:8px;text-align:start;}
.sec-toggle svg{flex-shrink:0;}
.doc-line{display:flex;align-items:center;gap:11px;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:11px 13px;}
.doc-line-click{width:100%;text-align:start;color:inherit;cursor:pointer;}
.doc-line-click:hover{border-color:var(--primary);}
.doc-line-main{flex:1;min-width:0;}
.doc-line-t{font-weight:600;font-size:13.5px;}
.doc-line-s{font-size:12px;margin-top:2px;}
.doc-line-action{width:36px;height:36px;border-radius:10px;background:var(--surface-2);color:var(--muted);display:flex;align-items:center;justify-content:center;flex:none;}
.doc-line-click:hover .doc-line-action{color:var(--primary);background:var(--primary-soft);}
.app-dark .doc-line-click:hover .doc-line-action{background:rgba(31,78,140,.18);}
.kpi-btn{display:block;width:100%;text-align:inherit;background:none;border:none;padding:0;}
.kpi-btn:hover .kpi{border-color:var(--primary);box-shadow:0 6px 18px rgba(15,23,42,.08);transform:translateY(-2px);}
.kpi-btn:active .kpi{transform:translateY(0);}
.kpi-grid .kpi-btn{animation:rise 260ms var(--ease-out) backwards;}
.kpi-grid .kpi-btn:nth-child(1){animation-delay:0ms;}
.kpi-grid .kpi-btn:nth-child(2){animation-delay:45ms;}
.kpi-grid .kpi-btn:nth-child(3){animation-delay:90ms;}
.kpi-grid .kpi-btn:nth-child(4){animation-delay:135ms;}
.presence-row{display:flex;align-items:center;gap:10px;padding:9px 2px;border-bottom:1px solid var(--line);}
.presence-row:last-child{border-bottom:none;}
.presence-dot{width:9px;height:9px;border-radius:50%;background:var(--muted);flex-shrink:0;opacity:.45;}
.presence-dot.on{background:#16A34A;opacity:1;box-shadow:0 0 0 3px #16A34A22;}
.presence-name{flex:1;font-weight:600;font-size:13.5px;}
.presence-sup{font-weight:400;color:var(--muted);font-size:12px;}
.presence-stat{font-size:12px;color:var(--muted);}
.chk-grid{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px;align-items:flex-start;}
.chk-pill{box-sizing:border-box;display:inline-flex;align-items:center;gap:8px;border:1.5px solid var(--line);border-radius:10px;padding:8px 12px;font-size:13px;line-height:1.2;cursor:pointer;background:var(--surface);white-space:normal;min-width:0;max-width:100%;min-height:38px;contain:layout paint;}
.chk-pill input{appearance:none;-webkit-appearance:none;box-sizing:border-box;width:16px;height:16px;flex:0 0 16px;margin:0;border:1.5px solid var(--line-strong,#CBD5E1);border-radius:4px;background:var(--surface);display:grid;place-items:center;color:#fff;}
.chk-pill input:checked{border-color:var(--primary);background:var(--primary);}
.chk-pill input:checked::after{content:"";width:8px;height:5px;border:solid currentColor;border-width:0 0 2px 2px;transform:rotate(-45deg) translateY(-1px);}
.chk-pill.on{border-color:var(--primary);background:var(--primary-soft,#FFF4ED);color:var(--primary);}
.manager-scope-fold{margin-top:12px;}
.manager-scope-fold > .field{margin:0 14px 12px;}
.manager-scope-fold > .field:first-of-type{margin-top:2px;}
.perm-fold{margin-top:12px;border:1px solid var(--line);border-radius:12px;background:var(--surface);padding:0;overflow:hidden;}
.perm-fold summary{list-style:none;display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:8px;padding:13px 15px;font-size:13.5px;font-weight:600;color:var(--ink);cursor:pointer;}
.perm-fold summary > span:first-child{min-width:0;}
.perm-fold summary::-webkit-details-marker{display:none;}
.perm-fold summary::after{content:"▾";color:var(--muted);font-size:12px;transition:transform 160ms var(--ease-out);}
.perm-fold[open] summary::after{transform:rotate(180deg);}
.perm-summary{color:var(--muted);font-size:12.5px;font-weight:500;white-space:nowrap;background:var(--surface-2);border:1px solid var(--line);border-radius:999px;padding:4px 9px;}
.perm-fold > .field,.perm-fold > .hint{margin:0 14px 10px;}
.perm-fold > .hint:first-of-type{margin-top:-2px;}
.uf-choice-grid{display:grid;gap:8px;}
.uf-choice-grid.cols-role{grid-template-columns:repeat(4,minmax(0,1fr));direction:ltr;}
.uf-choice-grid.cols-shift{grid-template-columns:repeat(auto-fit,minmax(112px,1fr));}
.uf-choice-grid.cols-dept{grid-template-columns:repeat(auto-fit,minmax(128px,1fr));}
.uf-choice{min-height:48px;border:1.5px solid var(--line);background:var(--surface);border-radius:12px;padding:9px 10px;display:flex;align-items:center;justify-content:center;gap:7px;color:var(--ink);font-size:13px;font-weight:750;cursor:pointer;text-align:center;line-height:1.15;direction:rtl;min-width:0;overflow-wrap:anywhere;}
.uf-choice small{display:block;font-size:11px;color:var(--muted);font-weight:600;}
.uf-choice:hover{border-color:var(--primary);}
.uf-choice.on{box-shadow:0 1px 6px rgba(15,23,42,.08);}
.uf-form-footer{display:grid;gap:12px;margin-top:18px;padding-top:14px;border-top:1px solid var(--line);}
.uf-active-block{display:grid;gap:6px;align-items:start;}
.uf-active-block .chk-line{margin:0;}
.uf-active-block .hint{margin:0;line-height:1.45;max-width:100%;overflow-wrap:anywhere;}
.uf-save-btn{margin-top:14px;}
.perm-card-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:10px;margin:0 14px 10px;}
.perm-card{border:1px solid var(--line);border-radius:12px;background:var(--surface-2);padding:12px;display:grid;gap:10px;align-items:start;}
.perm-card.active{border-color:rgba(31,78,140,.34);background:var(--primary-soft);}
.app-dark .perm-card.active{background:rgba(31,78,140,.18);}
.perm-card-main{display:flex;align-items:flex-start;gap:9px;min-width:0;}
.perm-ic{width:30px;height:30px;border-radius:9px;background:var(--surface);border:1px solid var(--line);color:var(--primary);display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;}
.perm-name{font-weight:600;font-size:14px;color:var(--ink);line-height:1.25;overflow-wrap:anywhere;}
.perm-hint{font-size:12.5px;color:var(--muted);line-height:1.4;margin-top:3px;}
.perm-levels{display:grid;grid-template-columns:repeat(auto-fit,minmax(62px,1fr));gap:5px;}
.perm-levels button{border:1px solid var(--line);border-radius:9px;background:var(--surface);color:var(--muted);min-height:34px;padding:6px 8px;font-size:12.5px;font-weight:500;cursor:pointer;line-height:1.15;}
.perm-levels button.on{background:var(--primary);border-color:var(--primary);color:#fff;}
.perm-levels button:disabled{opacity:.7;cursor:not-allowed;}
.cleaning-access-card{margin:0 14px 10px;}
.cleaning-zone-scope-card{margin:0 14px 10px;}
.uf-access-note{display:flex;align-items:center;gap:7px;line-height:1.45;}
@media(max-width:520px){.uf-choice-grid.cols-role{grid-template-columns:repeat(2,minmax(0,1fr));}.perm-card-grid{grid-template-columns:1fr;}.perm-fold summary{grid-template-columns:minmax(0,1fr) auto auto;}.perm-summary{font-size:11px;padding-inline:7px;}}
.shift-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:12px 15px;margin-bottom:14px;}
.shift-info{display:flex;align-items:center;gap:9px;}
.shift-stat{font-weight:700;font-size:14px;}
.shift-sub{font-size:12px;color:var(--muted);}
.reg-item{background:var(--surface-glow);border:1px solid rgba(201,205,209,.74);border-radius:13px;padding:10px 11px;margin-bottom:9px;box-shadow:var(--control-shadow);}
.reg-row{display:flex;align-items:center;gap:8px;margin-bottom:8px;}
.reg-row.wait-reason-row{display:grid;grid-template-columns:minmax(220px,1.5fr) minmax(150px,1fr) minmax(150px,1fr) minmax(112px,.72fr) 44px;gap:8px;align-items:center;margin-bottom:0;}
.reg-name{flex:1;border:1px solid rgba(148,163,184,.38);border-radius:10px;padding:8px 10px;background:var(--input);outline:none;font-size:14px;box-shadow:var(--control-shadow);}
.reg-label{flex:1;font-weight:600;font-size:14px;padding:8px 2px;display:flex;align-items:center;gap:8px;}
.reg-count{padding:2px 9px;border-radius:999px;background:var(--surface-2);color:var(--muted);font-size:11px;font-weight:600;letter-spacing:.2px;}
.reg-edit{flex-shrink:0;width:44px;height:44px;border-radius:11px;border:1px solid rgba(201,205,209,.86);background:var(--surface);color:var(--primary);display:flex;align-items:center;justify-content:center;box-shadow:var(--control-shadow);}
.reg-del{flex-shrink:0;width:44px;height:44px;border-radius:11px;border:1px solid rgba(201,205,209,.86);background:var(--surface);color:#B91C1C;display:flex;align-items:center;justify-content:center;box-shadow:var(--control-shadow);}
.color-swatch-input{width:44px!important;height:44px!important;min-height:44px!important;padding:4px!important;border:1px solid rgba(148,163,184,.34)!important;border-radius:12px!important;background:var(--surface)!important;box-shadow:var(--control-shadow)!important;cursor:pointer;}
.color-swatch-input::-webkit-color-swatch-wrapper{padding:0;}
.color-swatch-input::-webkit-color-swatch{border:0;border-radius:8px;}
.color-swatch-input::-moz-color-swatch{border:0;border-radius:8px;}
.reg-name:disabled{opacity:.55;cursor:not-allowed;}
.rule-row{border:1px solid var(--line);border-radius:10px;margin-bottom:8px;overflow:hidden;background:var(--surface);}
.rule-collapsed{display:flex;align-items:center;gap:10px;width:100%;padding:10px 14px;cursor:pointer;text-align:right;color:var(--ink);}
.rule-collapsed:hover{background:var(--surface-2);}
.rule-name{font-weight:600;flex:1;min-width:0;}
.rule-meta{font-size:12px;color:var(--muted);text-align:left;}
.rule-expanded{padding:14px;display:flex;flex-direction:column;gap:10px;background:var(--surface);}
.rule-actions{display:flex;gap:8px;margin-top:4px;flex-wrap:wrap;}
.save-flash{color:#059669;font-size:13px;font-weight:700;margin-bottom:6px;}
.pm-target-box{border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:var(--surface-2);margin:2px 0 10px;}
.reg-del:disabled{opacity:.35;cursor:not-allowed;}
@media(max-width:760px){
  .reg-row.wait-reason-row{grid-template-columns:1fr;min-width:0;gap:9px;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:12px;box-shadow:var(--control-shadow);}
  .reg-row.wait-reason-row .chk-line{justify-content:flex-start;}
  .reg-row.wait-reason-row .reg-del{justify-self:flex-start;}
}
.reg-use{flex-shrink:0;font-size:11px;font-weight:600;color:var(--muted);background:var(--surface-2);border:1px solid var(--line);border-radius:7px;padding:3px 8px;white-space:nowrap;}
.legacy-fold{margin-top:8px;border:1px dashed var(--line);border-radius:10px;background:var(--surface-2);padding:8px 10px;}
.legacy-fold summary{cursor:pointer;font-weight:700;font-size:12.5px;color:var(--muted);}
.target-tools{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 8px;}
.target-tools button{border:1px solid var(--line);background:var(--surface-2);color:var(--ink);border-radius:8px;padding:5px 9px;font-size:12px;font-weight:700;cursor:pointer;}
.target-tools button:hover{border-color:var(--primary);color:var(--primary);}
.dev-toggle{display:inline-flex;align-items:center;gap:6px;margin-top:16px;font-size:12.5px;font-weight:600;color:var(--muted);}
.dev-box{margin-top:10px;padding:14px;border:1px dashed var(--line);border-radius:12px;}
.rep-wrap{display:flex;flex-direction:column;height:78vh;max-height:78vh;}
.rep-head{display:flex;align-items:center;justify-content:space-between;padding:2px 2px 12px;}
.rep-title{font-weight:700;font-size:15px;}
.rep-frame{flex:1;width:100%;border:1px solid var(--line);border-radius:10px;background:#fff;}
.ins-h{display:flex;align-items:center;gap:6px;font-weight:700;font-size:13px;margin-bottom:8px;color:var(--ink);}
.audit-row{display:flex;gap:10px;align-items:center;padding:9px 11px;background:var(--surface);border:1px solid var(--line);border-radius:10px;}
.audit-row.clk{width:100%;text-align:inherit;cursor:pointer;font:inherit;color:inherit;transition:border-color 140ms var(--ease-out),background-color 140ms var(--ease-out),transform 140ms var(--ease-out);}
.audit-row.clk:hover{border-color:var(--primary);background:var(--primary-soft,#FFF4ED);}
.audit-day{font-size:12px;font-weight:700;color:var(--muted);margin:14px 2px 7px;letter-spacing:.3px;}
.ins-grid{display:flex;flex-wrap:wrap;gap:8px;margin:4px 0 10px;}
.ins-card{flex:1;min-width:92px;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:10px 8px;text-align:center;}
.ins-card.clk{cursor:pointer;font:inherit;color:inherit;transition:border-color 140ms var(--ease-out),box-shadow 140ms var(--ease-out),transform 140ms var(--ease-out);}
.ins-card.clk:hover{border-color:var(--primary);}
.ins-card.on{border-color:var(--primary);box-shadow:0 0 0 2px var(--primary-soft,#FFE4D6);}
.focus-bar{display:flex;align-items:center;justify-content:space-between;gap:8px;background:var(--primary-soft,#FFF4ED);border:1px solid var(--primary);border-radius:9px;padding:6px 11px;margin:2px 2px 8px;font-size:12.5px;font-weight:600;color:var(--primary);}
.focus-bar button{display:inline-flex;align-items:center;gap:3px;background:none;border:none;color:var(--primary);font:inherit;font-weight:700;cursor:pointer;}
.ins-n{font-size:22px;font-weight:800;line-height:1;}
.ins-l{font-size:11px;color:var(--muted);margin-top:4px;}
.req-row{display:flex;align-items:center;gap:10px;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:10px 11px;}
.req-main{flex:1;min-width:0;}
.req-t{font-size:13.5px;font-weight:600;}
.req-s{font-size:11.5px;color:var(--muted);margin-top:2px;}
.req-acts{display:flex;gap:6px;flex-shrink:0;}
.drv-unit{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:11px 12px;}
.drv-unit-head{display:flex;align-items:baseline;gap:8px;margin-bottom:8px;}
.drv-unit-code{font-weight:700;font-size:14px;}
.drv-unit-desc{font-size:12px;color:var(--muted);}
.drv-slots{display:flex;flex-direction:column;gap:7px;}
.drv-slot{display:flex;align-items:center;gap:9px;}
.drv-cat{font-size:11px;font-weight:700;padding:3px 9px;border-radius:8px;flex-shrink:0;min-width:52px;text-align:center;}
.drv-add{display:inline-flex;align-items:center;gap:5px;font-size:12.5px;color:var(--muted);background:none;border:1px dashed var(--line);border-radius:8px;padding:6px 10px;cursor:pointer;}
.drv-add:hover{border-color:var(--primary);color:var(--primary);}
.drv-chip{flex:1;display:flex;align-items:center;gap:8px;background:var(--surface-2);border-radius:9px;padding:6px 9px;min-width:0;flex-wrap:wrap;}
.drv-chip.pend{background:#FEF3C7;}
.drv-info{display:flex;align-items:center;gap:6px;min-width:0;}
.drv-name{font-size:13px;font-weight:600;}
.drv-no{font-size:11px;color:var(--muted);}
.drv-flag{font-size:10px;font-weight:700;color:#92400E;background:#FDE68A;border-radius:5px;padding:1px 5px;}
.drv-pend{font-size:11px;color:#92400E;font-weight:600;}
.drv-by{font-size:11px;color:var(--muted);}
.drv-acts{display:flex;gap:4px;margin-inline-start:auto;}
.icon-btn.sm{width:36px;height:36px;border-radius:9px;}
.icon-btn.sm.danger{color:#DC2626;}
.drv-ok,.drv-no2{width:36px;height:36px;border-radius:9px;border:none;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;}
.drv-ok{background:#16A34A;}.drv-no2{background:#DC2626;}
.drv-cross{font-size:10px;font-weight:700;color:#0D9488;background:#0D948822;border-radius:5px;padding:1px 5px;}
.drv-access{flex-basis:100%;display:flex;align-items:center;gap:4px;font-size:11px;color:var(--primary);background:var(--primary-soft);border-radius:6px;padding:3px 7px;margin-top:2px;}
.acc-row{display:flex;align-items:center;gap:9px;width:100%;background:var(--surface);border:1px solid var(--line);border-radius:9px;padding:8px 11px;cursor:pointer;}
.acc-row.on{border-color:var(--primary);background:var(--primary-soft,#FFF4ED);}
.acc-code{font-weight:700;font-size:13px;}
.acc-desc{font-size:12px;color:var(--muted);flex:1;min-width:0;}
.acc-dept{font-size:11px;color:var(--muted);background:var(--surface-2);border-radius:5px;padding:1px 6px;}
.advice-box{background:#ECFDF5;border:1px solid #A7F3D0;border-radius:11px;padding:10px 12px;margin:2px 2px 10px;}
.advice-h{display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;color:#047857;margin-bottom:6px;}
.advice-row{font-size:12.5px;color:#065F46;line-height:1.5;padding:3px 0;border-top:1px solid #D1FAE5;}
.advice-row:first-of-type{border-top:none;}
.advice-why{display:block;font-size:11px;color:#059669;opacity:.85;}
.prob-row{display:flex;align-items:center;gap:10px;width:100%;text-align:inherit;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:9px 11px;cursor:pointer;font:inherit;color:inherit;}
.prob-row:hover{border-color:var(--primary);}
.prob-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;}
.prob-main{flex:1;min-width:0;display:flex;flex-direction:column;}
.prob-code{font-size:13px;font-weight:600;}
.prob-reasons{font-size:11.5px;color:var(--muted);}
.prob-stat{font-size:11.5px;color:var(--muted);flex-shrink:0;text-align:end;}
.seg-tabs.s2 button{flex:1;}
.dept-group{margin-bottom:18px;}
.dept-head{display:flex;align-items:center;gap:10px;margin:6px 2px 10px;}
.dept-line{flex:1;height:1px;background:var(--line);}
.dept-name{font-size:13px;font-weight:800;color:var(--ink);white-space:nowrap;}
.dept-count{font-size:11px;font-weight:600;color:var(--muted);background:var(--surface-2);border-radius:999px;padding:2px 9px;white-space:nowrap;}
.dept-tree{display:grid;gap:12px;margin-top:4px;}
.dept-card{background:var(--surface);border:1px solid var(--line);border-radius:16px;overflow:hidden;box-shadow:var(--control-shadow);}
.dept-card[open]{border-color:rgba(31,78,140,.22);}
.dept-card-summary{list-style:none;display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:14px;padding:15px 16px;cursor:pointer;background:var(--surface);}
.dept-card-summary::-webkit-details-marker{display:none;}
.dept-card-summary:hover{background:var(--surface-2);}
.dept-card-main{min-width:0;display:grid;gap:4px;}
.dept-card-title{font-size:18px;font-weight:720;color:var(--ink);line-height:1.15;}
.dept-card-sub{font-size:12.5px;color:var(--muted);line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.dept-card-metrics{display:flex;align-items:stretch;gap:8px;}
.dept-card-metrics span{min-width:72px;border:1px solid var(--line);border-radius:12px;background:var(--surface-2);padding:7px 10px;text-align:center;}
.dept-card-metrics b{display:block;font-size:18px;line-height:1;color:var(--primary);font-weight:760;font-variant-numeric:tabular-nums;}
.dept-card-metrics small{display:block;margin-top:4px;font-size:10.5px;color:var(--muted);white-space:nowrap;}
.dept-add{white-space:nowrap;}
.dept-shift-board{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:14px;background:var(--brand-light);border-top:1px solid var(--line);}
.shift-lane{min-width:0;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:12px;display:grid;gap:10px;}
.shift-lane-wide{grid-column:1 / -1;}
.shift-lane-head{display:flex;align-items:center;gap:8px;color:var(--ink);}
.shift-lane-head b{font-size:13.5px;font-weight:720;}
.shift-lane-head span:last-child{margin-inline-start:auto;font-size:11px;font-weight:700;color:var(--muted);background:var(--surface-2);border-radius:999px;padding:2px 8px;}
.shift-color{width:9px;height:9px;border-radius:50%;flex-shrink:0;box-shadow:0 0 0 3px rgba(31,78,140,.08);}
.shift-color.muted{background:var(--icon-muted);}
.worker-card-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:9px;}
.worker-card{position:relative;width:100%;display:flex;align-items:center;gap:11px;text-align:start;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:11px 12px;color:var(--ink);cursor:pointer;box-shadow:0 1px 0 rgba(46,49,56,.03);transition:border-color 150ms var(--ease-out),box-shadow 150ms var(--ease-out),transform 150ms var(--ease-out);}
.worker-card:hover{border-color:rgba(31,78,140,.34);box-shadow:0 8px 20px rgba(46,49,56,.08);transform:translateY(-1px);}
.worker-card.inert{cursor:default;}
.worker-avatar{width:46px;height:46px;border-radius:16px;background:linear-gradient(145deg,#E6E7E9,#FFFFFF);border:1px solid var(--line);color:var(--primary);display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;}
.worker-card-main{min-width:0;display:grid;gap:2px;}
.worker-card-head{min-width:0;display:flex;align-items:center;gap:8px;}
.worker-name{font-size:14.5px;font-weight:720;line-height:1.2;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.team-user-badge{display:inline-flex;align-items:center;max-width:46%;min-width:0;border-radius:999px;background:var(--surface-2);color:var(--muted);padding:3px 9px;font-size:11.5px;font-weight:700;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.team-user-card .worker-card-main{gap:3px;}
.team-user-card .worker-name{flex:1;min-width:0;}
.worker-meta{font-size:12.5px;color:var(--muted);line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.worker-seen{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);line-height:1.25;margin-top:2px;}
.worker-seen.online{color:#047857;font-weight:700;}
.worker-seen.pending{color:#92400E;font-weight:700;}
.worker-seen.seen{color:#991B1B;font-weight:700;}
.worker-state{width:9px;height:9px;border-radius:50%;background:var(--icon-muted);box-shadow:0 0 0 3px rgba(164,169,176,.16);flex:0 0 auto;}
.worker-state.online{background:#16A34A;box-shadow:0 0 0 3px #16A34A24;}
.worker-state.pending{background:#D97706;box-shadow:0 0 0 3px #D9770624;}
.worker-state.seen{background:#DC2626;box-shadow:0 0 0 3px #DC262624;}
.shift-empty,.dept-empty{border:1px dashed var(--line);border-radius:12px;padding:14px;text-align:center;color:var(--muted);font-size:12.5px;background:var(--surface-2);}
.dept-empty{margin:14px;}
@media(max-width:760px){
  .dept-card-summary{grid-template-columns:1fr;align-items:start;}
  .dept-card-metrics{width:100%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));}
  .dept-card-metrics span{min-width:0;}
  .dept-add{justify-self:start;}
  .dept-shift-board{grid-template-columns:1fr;padding:10px;}
  .worker-card-grid{grid-template-columns:1fr;}
  .worker-card-head{align-items:flex-start;}
  .team-user-badge{max-width:42%;}
}
.unit-pick-btn{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:10px 12px;font:inherit;color:inherit;cursor:pointer;text-align:start;}
.unit-pick-btn:hover{border-color:var(--primary);}
.muted-txt{color:var(--muted);}
.unit-pick{margin-top:6px;border:1px solid var(--line);border-radius:11px;background:var(--surface);overflow:hidden;}
.search-wrap.sm{padding:6px 9px;}
.unit-pick-list{max-height:42vh;overflow-y:auto;}
.unit-pick-grp{position:sticky;top:0;background:var(--surface-2);font-size:11.5px;font-weight:800;color:var(--ink);padding:6px 12px;display:flex;align-items:center;gap:7px;border-top:1px solid var(--line);}
.upg-count{font-size:10px;font-weight:600;color:var(--muted);background:var(--surface);border-radius:999px;padding:1px 7px;}
.unit-pick-row{display:flex;align-items:baseline;gap:8px;width:100%;text-align:start;background:none;border:none;border-bottom:1px solid var(--line);padding:9px 14px;font:inherit;color:inherit;cursor:pointer;}
.unit-pick-row:hover{background:var(--primary-soft,#FFF4ED);}
.unit-pick-row.on{background:var(--primary-soft,#FFF4ED);box-shadow:inset 3px 0 0 var(--primary);}
.upr-desc{font-size:12px;color:var(--muted);}
.ymx-grp th.ymx-grp-h{text-align:start;background:var(--surface-2);font-size:12px;font-weight:800;color:var(--ink);padding:7px 12px;position:sticky;inset-inline-start:0;}
.ymx-grp-n{font-size:10px;font-weight:600;color:var(--muted);background:var(--surface);border-radius:999px;padding:1px 7px;margin-inline-start:6px;}
.dup-warn{display:flex;align-items:flex-start;gap:7px;font-size:12px;line-height:1.45;color:#92400E;background:#FEF3C7;border:1px solid #FCD34D;border-radius:9px;padding:8px 10px;margin:2px 0 4px;}
.dup-block{display:flex;align-items:flex-start;gap:7px;font-size:12px;line-height:1.45;color:#991B1B;background:#FEE2E2;border:1px solid #FCA5A5;border-radius:9px;padding:8px 10px;margin:2px 0 4px;}
.btn-primary:disabled{opacity:.45;cursor:not-allowed;}
.choice-btn{display:block;width:100%;text-align:start;background:var(--surface);border:1px solid var(--line);border-radius:11px;padding:12px 14px;margin-bottom:10px;cursor:pointer;font:inherit;color:inherit;transition:border-color 140ms var(--ease-out),background-color 140ms var(--ease-out),transform 140ms var(--ease-out);}
.choice-btn:hover{border-color:var(--primary);background:var(--primary-soft,#FFF4ED);}
.choice-t{font-size:14px;font-weight:700;}
.choice-s{font-size:12px;color:var(--muted);margin-top:3px;line-height:1.4;}
.audit-kdot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
.audit-kind{font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:999px;white-space:nowrap;flex-shrink:0;}
.audit-time{font-size:11px;color:var(--muted);white-space:nowrap;flex-shrink:0;min-width:84px;}
.audit-main{flex:1;min-width:0;}
.audit-text{font-size:13px;color:var(--ink);line-height:1.4;}
.audit-meta{font-size:11px;color:var(--muted);margin-top:2px;}
.ins-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 0;border-top:1px solid var(--line);}
.ins-row:first-of-type{border-top:0;}
.ins-name{font-size:13px;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.ins-val{font-size:13px;font-weight:700;flex-shrink:0;}
.u-filters{display:flex;gap:8px;margin-bottom:12px;}
.u-search{flex:1;border:1.5px solid var(--line);border-radius:10px;padding:10px 12px;background:var(--input);outline:none;font-size:14px;color:var(--ink);}
.u-filters select{border:1.5px solid var(--line);border-radius:10px;padding:10px 12px;background:var(--surface);font-size:14px;color:var(--ink);}
.attn-row{min-height:48px;display:flex;align-items:center;gap:10px;width:100%;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 14px;}
.attn-row:hover{border-color:var(--primary);}
.attn-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;}
.attn-main{flex:1;min-width:0;text-align:start;}
.attn-subj{display:block;font-weight:600;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.attn-meta{display:block;font-size:12px;color:var(--muted);}
.attn-tag{font-size:11.5px;font-weight:700;border-radius:7px;padding:3px 8px;flex-shrink:0;}

.queue-row{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0 4px;}
.queue-chip{display:flex;flex-direction:column;align-items:center;gap:2px;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:11px 6px;}
.queue-chip:hover{border-color:var(--primary);}
.q-num{font-family:var(--font-head);font-weight:700;font-size:21px;line-height:1;}
.q-lbl{font-size:11px;color:var(--muted);text-align:center;line-height:1.2;}
.stage-watch{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin:8px 0 4px;}
.stage-watch-title{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:800;color:var(--muted);margin-bottom:8px;}
.stage-watch-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;}
.stage-chip{min-height:48px;display:flex;flex-direction:column;align-items:flex-start;gap:3px;text-align:start;background:var(--surface-2);border:1px solid var(--line);border-radius:10px;padding:9px 11px;min-width:0;}
.stage-chip:hover{border-color:var(--primary);}
.stage-chip-name{font-size:12px;font-weight:800;color:var(--ink);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.stage-chip-meta{font-size:11px;color:var(--muted);white-space:nowrap;}
.admin-route{background:var(--surface-2);border:1px solid var(--line);border-radius:13px;padding:13px;margin-bottom:15px;}
.ar-title{display:flex;align-items:center;gap:6px;font-weight:700;font-size:13px;color:var(--primary);margin-bottom:10px;}
.admin-manual-fold{margin-top:12px;}
.admin-ticket-manual-shell{margin-top:18px;padding-top:14px;border-top:1px solid var(--line);}
.admin-ticket-manual-shell::before{content:"ניהול חריג של מנהל מערכת";display:block;margin:0 2px 8px;color:var(--muted);font-size:12px;font-weight:600;}
.admin-ticket-manual{margin-top:0;background:var(--surface-2);}
.manual-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 12px;margin:10px 14px;}
.manual-grid .field{margin:0;}
.manual-grid .wide{grid-column:1/-1;}
.manual-duration-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:10px 14px;}
.manual-duration-grid .field{margin:0;}
.admin-manual-section{border-top:1px solid var(--line);padding-top:12px;margin-top:12px;}
.admin-ticket-manual .chk-line,.admin-manual-fold .chk-line{margin:10px 14px;}
.admin-ticket-manual .hint,.admin-manual-fold .hint{margin:0 14px 10px;}
@media(max-width:720px){.manual-grid,.manual-duration-grid{grid-template-columns:1fr;}.manual-grid .wide{grid-column:auto;}}

@media(min-width:980px){
  .desk-only{display:inline-flex!important;}.desk-hide{display:none;}
  .app-root{display:flex;}
  .main-col{flex:1;min-width:0;}
  .sidebar{display:flex;flex-direction:column;width:304px;background:var(--side);color:var(--ink);padding:22px 18px;position:sticky;top:0;height:100vh;height:100dvh;flex-shrink:0;overflow:hidden;border-inline-start:1px solid var(--line);box-shadow:-8px 0 24px rgba(46,49,56,.04);}
  .side-brand{display:flex;align-items:center;gap:14px;margin-bottom:22px;padding:0 4px;min-width:0;}
  .side-brand .brand-mark.sm{width:60px;height:60px;border-radius:17px;}
  .side-brand .brand-mark.sm .brand-mark-hex{width:38px;height:38px;}
  .side-brand .brand-mark.sm .brand-mark-core{width:12px;height:12px;border-width:2px;border-radius:4px;}
  .side-brand>div{min-width:0;display:flex;flex-direction:column;justify-content:center;}
  .side-brand .brand-title.sm{font-size:19px;line-height:1.05;max-width:190px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .side-brand .brand-sub.sm{font-size:12px;line-height:1.25;max-width:190px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:5px;}
  .side-newbtn{min-height:44px;display:flex;align-items:center;justify-content:center;gap:8px;background:var(--primary);color:#fff;font-weight:650;font-size:14.5px;border-radius:11px;padding:12px;margin-bottom:16px;box-shadow:0 10px 20px rgba(31,78,140,.16);}
  .side-nav{display:flex;flex-direction:column;gap:3px;flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding-bottom:8px;scrollbar-width:thin;scrollbar-color:#C9CDD1 transparent;}
  .side-nav::-webkit-scrollbar{width:6px;height:6px;}.side-nav::-webkit-scrollbar-thumb{background:#C9CDD1;border-radius:999px;}
  .side-item{min-height:44px;display:flex;align-items:center;gap:11px;padding:11px 13px;border-radius:11px;color:var(--side-ink);font-weight:500;font-size:14px;text-align:right;width:100%;}
  .side-item:hover{background:var(--surface-2);color:var(--primary);}.side-item.on{background:#E6E7E9;color:var(--primary);box-shadow:inset -3px 0 0 var(--primary);}
  .side-foot{flex:0 0 auto;display:flex;flex-direction:column;gap:4px;padding-top:14px;border-top:1px solid var(--line);}
  .side-user{display:flex;align-items:center;gap:10px;padding:8px 6px;}
  .su-name{font-size:13.5px;font-weight:650;color:var(--ink);}.su-role{font-size:11.5px;color:var(--side-ink);}
  .side-logout{min-height:44px;display:flex;align-items:center;gap:9px;color:var(--side-ink);padding:10px 13px;border-radius:11px;font-size:14px;}
  .side-logout:hover{background:var(--surface-2);color:var(--primary);}
  .topbar,.bottom-nav,.fab{display:none;}
  .content,.content.with-nav{max-width:1600px;padding:28px 44px 44px;margin:0 auto;}
  .settings-wrap{width:min(100%,1040px);}
  .kpi-grid{grid-template-columns:repeat(4,1fr);gap:14px;}
  .cards{display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:start;}
  .meta-grid{grid-template-columns:repeat(3,1fr);}
  .ovl-backdrop{align-items:center;justify-content:center;padding:28px;}
  .ovl-panel{width:100%;max-width:680px;height:auto;max-height:92vh;border-radius:18px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.45);}
  .ovl-panel.user-picker-form-panel{width:min(680px,calc(100vw - 56px));height:min(92dvh,780px);max-width:680px;max-height:calc(100dvh - 56px);}
  .ovl-panel.user-picker-form-panel .ovl-inner>.body{min-height:0;flex:1;overflow-y:auto;}
  .ovl-panel.profile-shell{max-width:520px;background:transparent;box-shadow:none;overflow:visible;}
  .ovl-panel.issue-report-shell{max-width:420px;background:transparent;box-shadow:none;overflow:visible;}
  .ymx-wrap{overflow:visible;}
  .ai-back{align-items:center;}.ai-panel{max-width:580px;height:min(68dvh,620px);border-radius:18px;}
  .ovl-backdrop.notif-back{inset:0 322px 0 0;direction:ltr;justify-content:flex-end;padding:22px 0 22px 22px;background:transparent;}
  .notif-panel{direction:rtl;width:min(408px,calc(100vw - 366px));height:calc(100dvh - 44px);border-inline-end:0;border-radius:18px 0 0 18px;box-shadow:-18px 0 44px rgba(46,49,56,.14);animation:cmmsDrawerIn 170ms var(--ease-out) both;}
  .app-dark .ovl-backdrop.notif-back{background:transparent;}
  .app-dark .notif-panel{box-shadow:-18px 0 44px rgba(0,0,0,.34);}
  .ai-fab{inset-inline-end:28px;bottom:28px;}.toast{bottom:24px;width:380px;}.version-update-banner{bottom:24px;flex-direction:row;align-items:center;justify-content:space-between;}.version-update-refresh{flex:0 0 auto;}
  .cat-grid{grid-template-columns:repeat(3,1fr);}
}
@media(max-width:640px){
  .ovl-backdrop{align-items:stretch;justify-content:stretch;padding:0;}
  .ovl-panel{height:100dvh;max-height:100dvh;overflow:hidden;}
  .ovl-backdrop.notif-back{inset:0;padding:0;align-items:stretch;justify-content:stretch;direction:rtl;}
  .notif-panel{width:100vw;height:100dvh;max-width:none;border:0;border-radius:0;box-shadow:none;animation:cmmsSheetIn 170ms var(--ease-out) both;}
  .notif-head{padding-top:calc(13px + env(safe-area-inset-top));}
  .notif-list{padding-bottom:calc(16px + env(safe-area-inset-bottom));}
  .ovl-inner{height:100dvh;min-height:0;}
  .ovl-inner>.form-head{position:relative;top:auto;flex:0 0 auto;padding-top:calc(12px + env(safe-area-inset-top));}
  .ovl-inner>.body{min-height:0;flex:1;overflow-y:auto;padding-bottom:calc(24px + env(safe-area-inset-bottom));}
}
@media(min-width:1300px){.cards{grid-template-columns:1fr 1fr 1fr;}.ftable-head,.ftable-row{grid-template-columns:34px 0.7fr 1.4fr 1fr 1fr;}.manager-fleet-table .manager-fleet-row{grid-template-columns:minmax(96px,126px) minmax(360px,1fr) minmax(116px,156px) minmax(96px,126px);}}
@media(max-width:1100px){
  .fleet-filters{grid-template-columns:repeat(2,minmax(0,1fr));}
  .supplier-command{grid-template-columns:1fr;}
}
.ymx-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;flex-wrap:wrap;}
.ymx-nav{display:flex;align-items:center;gap:6px;}
.ymx-year{font-family:var(--font-head);font-weight:700;font-size:18px;min-width:54px;text-align:center;}
.ymx-summary{display:flex;gap:16px;flex-wrap:wrap;align-items:center;font-size:13.5px;color:var(--muted);margin-bottom:10px;}
.ymx-summary b{font-size:17px;}
.ymx-rate{margin-inline-start:auto;}
.ymx-legend{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:14px;font-size:12.5px;color:var(--muted);}
.ymx-lg{display:inline-flex;align-items:center;gap:6px;}
.ymx-lg i{width:13px;height:13px;border-radius:4px;display:inline-block;opacity:.6;border:1px solid;}
.ymx-wrap{overflow-x:auto;background:var(--surface);}
.ymx{border-collapse:separate;border-spacing:0;width:100%;font-size:13px;}
.ymx th,.ymx td{padding:0;text-align:center;}
.ymx thead th{background:var(--surface-2);color:var(--muted);font-weight:700;font-size:12.5px;padding:11px 4px;border-bottom:2px solid var(--line);}
.ymx-corner{text-align:center;padding-inline:6px;min-width:92px;border-inline-end:2px solid var(--line);}
.ymx tbody tr:nth-child(even){background:var(--surface-2);}
.ymx-unit{text-align:center;padding:10px 6px;white-space:nowrap;cursor:pointer;font-weight:700;font-size:14px;color:var(--ink);min-width:92px;border-bottom:1px solid var(--line);border-inline-end:2px solid var(--line);}
.ymx-unit:hover{color:var(--primary);}
.ymx-type{display:block;font-weight:400;font-size:11.5px;color:var(--muted);margin-top:2px;}
.ymx-c{border-bottom:1px solid var(--line);padding:6px;min-width:54px;height:44px;cursor:pointer;}
.ymx-chip{display:inline-flex;align-items:center;justify-content:center;width:40px;height:26px;border-radius:7px;border:1.5px solid;}
.ymx-dot{width:8px;height:8px;border-radius:50%;background:currentColor;}
.worker-shell{min-height:100vh;background:var(--bg);width:100%;max-width:560px;margin:0 auto;display:flex;flex-direction:column;overflow-x:hidden;}
.worker-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:18px 18px 12px;background:var(--primary);color:#fff;}
.worker-top > div:first-child{min-width:0;flex:1;padding-top:2px;}
.worker-top-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex:0 0 auto;max-width:100%;flex-wrap:wrap;}
.worker-top .icon-btn{color:#fff;}.worker-top .icon-btn:hover{background:rgba(255,255,255,.14);}
.worker-action-btn{min-height:38px;border:1px solid #ffffff1a;border-radius:999px;background:#ffffff10;color:#fff;padding:0 12px;display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:800;cursor:pointer;}
.worker-action-btn:hover{background:#ffffff1c;}
.worker-preview{background:var(--primary);padding:0 16px 12px;}
.worker-preview .role-preview{margin-top:0;}
.wk-title{font-family:var(--font-head);font-weight:700;font-size:20px;line-height:1.16;overflow-wrap:anywhere;}
.wk-sub{color:#94A3B8;font-size:13px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;}
.wk-tabs{display:flex;gap:8px;padding:12px 16px 0;background:var(--primary);}
.wk-tabs button{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:11px;border:none;border-radius:12px 12px 0 0;background:transparent;color:#94A3B8;font-weight:600;font-size:14px;cursor:pointer;}
.wk-tabs button.on{background:var(--bg);color:var(--ink);}
.worker-body{padding:18px 16px 40px;flex:1;}
.embedded-cleaning-shell{min-height:0;max-width:none;background:transparent;margin:0;}
.embedded-cleaning-shell .content{padding:0;max-width:none;}
.wk-hint{color:var(--muted);font-size:14px;margin-bottom:14px;}
.wk-track-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.wk-track{display:flex;flex-direction:column;align-items:center;gap:8px;padding:20px 10px;border:2px solid var(--line);border-radius:16px;background:var(--surface);color:var(--ink);font-weight:600;font-size:15px;cursor:pointer;}
.wk-track.on{border-color:var(--primary);background:var(--primary-soft);color:var(--primary-d);}
.wk-card{display:block;width:100%;text-align:start;padding:14px;border:1px solid var(--line);border-radius:14px;background:var(--surface);cursor:pointer;}
.wk-card-top{display:flex;align-items:center;justify-content:space-between;gap:10px;}
.wk-card-subj{font-weight:600;color:var(--ink);font-size:15px;}
.wk-card-sub{display:flex;align-items:center;gap:5px;color:var(--muted);font-size:12.5px;margin-top:6px;}
.wk-view{max-width:520px;}
.wk-view-head{display:flex;align-items:center;gap:10px;margin-bottom:8px;}
.wk-view-track{display:flex;align-items:center;gap:5px;color:var(--muted);font-size:13px;}
.wk-view-subj{font-family:var(--font-head);font-size:19px;margin:0 0 8px;color:var(--ink);}
.wk-view-desc{color:var(--ink);font-size:15px;line-height:1.5;white-space:pre-wrap;}
.badge.sm{font-size:11px;padding:3px 9px;}
.spinner.sm{width:14px;height:14px;border-width:2px;display:inline-block;vertical-align:-2px;}
@media(max-width:720px){
  .fleet-filters{grid-template-columns:1fr;}
  .supplier-head{align-items:flex-start;}
  .supplier-grid{grid-template-columns:1fr;}
  .supplier-add{grid-template-columns:1fr;}
  .supplier-type-grid{grid-template-columns:1fr;}
  .topbar{padding:8px 12px;gap:6px;align-items:center;}
  .topbar .tb-left{display:none;}
  .tb-actions{width:100%;justify-content:flex-start;gap:4px;}
  .tb-logout,.bell{width:44px;height:44px;border-radius:11px;}
  .tb-logout{width:auto;min-width:44px;padding:0 9px;}
  .tb-role-preview{width:auto;max-width:100%;margin-top:0;}
  .tb-role-preview .role-preview{width:auto;max-width:100%;}
  .tb-role-preview .rp-toggle{width:auto;min-height:44px;border-radius:11px;padding:6px 8px;}
  .tb-role-preview .rp-toggle-ic{width:24px;height:24px;}
  .tb-role-preview .rp-toggle-txt b{font-size:11px;}
  .tb-role-preview .rp-toggle-txt small{font-size:9.5px;}
  .tb-role-preview .rp-grid{position:absolute;top:calc(100% + 7px);inset-inline-end:0;width:min(292px,calc(100vw - 24px));grid-template-columns:repeat(2,minmax(0,1fr));padding:7px;gap:6px;background:var(--slate);box-shadow:0 18px 42px rgba(0,0,0,.32);z-index:42;}
  .tb-role-preview .rp-btn{min-height:44px;font-size:12px;}
  .modal2-body{padding:14px;}
  .profile-head{margin-bottom:10px;}
  .avatar.big{width:34px;height:34px;font-size:16px;}
  .worker-top{display:grid;grid-template-columns:1fr;gap:8px;padding:calc(14px + env(safe-area-inset-top)) 10px 8px;}
  .worker-top-actions{justify-content:center;width:100%;gap:4px;flex-wrap:nowrap;}
  .worker-top .icon-btn{width:44px;height:44px;flex:0 0 44px;}
  .worker-action-btn{width:44px;min-height:44px;padding:0;flex:0 0 44px;justify-content:center;}
  .worker-action-btn span{display:none;}
  .language-picker.compact{min-width:0;flex:0 0 82px;}
  .language-picker.compact select{width:100%;min-height:44px;font-size:12px;padding-inline:6px;}
  .wk-title{font-size:18px;}
  .worker-preview{padding:0 12px 10px;}
  .wk-tabs{display:flex;gap:4px;padding:8px 6px 0;align-items:stretch;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:thin;scrollbar-color:var(--line) transparent;}
  .wk-tabs::-webkit-scrollbar{height:6px;}.wk-tabs::-webkit-scrollbar-thumb{background:var(--line);border-radius:999px;}
  .wk-tabs button{min-width:70px;flex:0 0 70px;min-height:58px;flex-direction:column;gap:3px;padding:7px 3px;font-size:11px;line-height:1.1;text-align:center;white-space:normal;overflow-wrap:anywhere;}
  .wk-tabs button svg{width:14px;height:14px;flex-shrink:0;}
  .worker-body{padding:16px 12px 40px;}
  .absence-date-row{display:grid;grid-template-columns:1fr;gap:10px;}
  .absence-date-row .field{min-width:0;}
  .absence-date-row input{width:100%;min-height:48px;color:var(--ink);background:var(--input);}
  .ppe-request-row{grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"worker actions" "main main" "by status";align-items:start;gap:8px;padding:10px;}
  .ppe-request-row.rejecting{grid-template-areas:"worker status" "main main" "by by" "reject reject";}
  .ppe-req-worker{grid-area:worker;}
  .ppe-req-main{grid-area:main;}
  .ppe-req-by{grid-area:by;flex-direction:row;align-items:center;flex-wrap:wrap;gap:4px;}
  .ppe-req-status{grid-area:status;justify-self:end;}
  .ppe-req-actions{grid-area:actions;}
  .ppe-req-reject{grid-area:reject;grid-column:auto;min-width:0;width:100%;margin-top:2px;}
  .ppe-req-reject input{min-width:0;}
  .ppe-req-title,.ppe-req-meta{white-space:normal;overflow:visible;text-overflow:clip;}
  .manager-fleet-table .ftable-head{display:none;}
  .manager-fleet-table .ftable-row{grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"code drivers" "model supplier";gap:5px 12px;align-items:start;padding:12px 14px;text-align:start;}
  .manager-fleet-table .ft-code{grid-area:code;min-width:0;direction:ltr;unicode-bidi:isolate;text-align:start;font-size:13px;line-height:1.25;overflow-wrap:anywhere;}
  .manager-fleet-table .ft-model{grid-area:model;min-width:0;display:block;line-height:1.3;}
  .manager-fleet-table .ft-model b{display:block;font-size:13px;line-height:1.3;white-space:normal;overflow-wrap:anywhere;}
  .manager-fleet-table .ft-sup{grid-area:supplier;max-width:96px;text-align:end;white-space:normal;overflow-wrap:anywhere;font-size:12px;line-height:1.3;}
  .manager-fleet-table .ft-doc{grid-area:drivers;justify-content:flex-end;white-space:nowrap;font-size:12px;line-height:1.3;}
  .fleet-unit-table{display:flex;flex-direction:column;gap:10px;background:transparent;border:0;overflow:visible;}
  .fleet-unit-table .ftable-head{display:none;}
  .fleet-unit-table .fleet-unit-row{grid-template-columns:minmax(0,1fr) 34px;grid-template-areas:"code select" "type select" "model select" "supplier select" "docs docs";gap:5px 10px;align-items:start;padding:12px 14px;border:1px solid var(--line);border-radius:14px;background:var(--surface);box-shadow:0 1px 2px rgba(15,23,42,.03);text-align:start;}
  .fleet-unit-table .fleet-unit-row+.fleet-unit-row{border-top:1px solid var(--line);}
  .fleet-unit-table .ft-select{grid-area:select;align-self:start;justify-self:end;}
  .fleet-unit-table .ft-code{grid-area:code;font-size:16px;line-height:1.2;text-align:start;}
  .fleet-unit-table .ft-type{grid-area:type;min-width:0;}
  .fleet-unit-table .ft-type b{font-size:14px;line-height:1.25;white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:anywhere;}
  .fleet-unit-table .ft-model{grid-area:model;text-align:start;font-size:13px;line-height:1.25;white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:anywhere;}
  .fleet-unit-table .ft-sup{grid-area:supplier;text-align:start;font-size:12.5px;line-height:1.3;white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:anywhere;}
.fleet-unit-table .ft-doc{grid-area:docs;margin-top:5px;width:100%;}
.fleet-unit-table .doc-chip-stack{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;width:100%;justify-content:stretch;overflow:visible;}
.fleet-unit-table .doc-chip{max-width:none;min-height:28px;grid-template-columns:7px minmax(0,1fr) auto;padding:4px 8px;}
.fleet-unit-table .doc-chip-days{text-align:end;}
}
@media(max-width:390px){
  .worker-top{padding-inline:8px;}
  .worker-top-actions{gap:3px;}
  .wk-tabs{gap:3px;padding-inline:5px;}
  .wk-tabs button{min-width:64px;flex-basis:64px;min-height:56px;padding:6px 2px;font-size:10.5px;}
  .worker-top .icon-btn,.worker-action-btn{width:44px;height:44px;flex-basis:44px;}
  .language-picker.compact{flex-basis:76px;}
}
`}</style>);
}
