export const NOTIFICATION_KIND_IDS = [
  "new",
  "confirm",
  "back",
  "ready",
  "escalate",
  "sla",
  "task",
  "doc",
  "pm",
  "upd",
  "driver",
  "ppe",
  "cleaning",
  "waiting",
];

export const DEFAULT_NOTIFY_CONFIG = NOTIFICATION_KIND_IDS.reduce(
  (config, kind) => ({ ...config, [kind]: true }),
  {}
);

export function notificationConfigHasAllKinds(config, kinds = NOTIFICATION_KIND_IDS) {
  return kinds.every((kind) => Object.prototype.hasOwnProperty.call(config || {}, kind));
}
