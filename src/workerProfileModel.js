import { canPerformCleaning } from "./cleaningAccessModel.js";

export const WORKER_VIEWS = Object.freeze({
  newReport: "new",
  myReports: "mine",
  ppe: "ppe",
  cleaning: "cleaning",
  activity: "activity"
});

export function defaultWorkerView(session = {}) {
  if (canPerformCleaning(session)) return WORKER_VIEWS.cleaning;
  return WORKER_VIEWS.newReport;
}
