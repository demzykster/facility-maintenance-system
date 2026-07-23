export const FIRST_RUN_INSTALL_STATES = Object.freeze({
  new: "new",
  ready: "ready",
  blocked: "blocked",
  adminRecoveryRequired: "admin_recovery_required",
  unknown: "unknown"
});

export function normalizeFirstRunInstallState(input = {}) {
  const state = String(input?.state || FIRST_RUN_INSTALL_STATES.unknown).trim() || FIRST_RUN_INSTALL_STATES.unknown;
  const reason = String(input?.reason || "").trim();
  return {
    ok: input?.ok !== false,
    state,
    reason
  };
}

export function shouldRedirectLoginToInstall(input = {}) {
  return normalizeFirstRunInstallState(input).state === FIRST_RUN_INSTALL_STATES.new;
}

export function canShowFirstRunInstallForm(input = {}) {
  return normalizeFirstRunInstallState(input).state === FIRST_RUN_INSTALL_STATES.new;
}

export function firstRunInstallStateKind(input = {}) {
  const normalized = normalizeFirstRunInstallState(input);
  if (!normalized.ok) return "state_check_failed";
  if (normalized.state === FIRST_RUN_INSTALL_STATES.ready) return "ready";
  if (normalized.state === FIRST_RUN_INSTALL_STATES.adminRecoveryRequired) return "admin_recovery_required";
  if (normalized.state === FIRST_RUN_INSTALL_STATES.blocked) return "install_in_progress";
  if (normalized.state === FIRST_RUN_INSTALL_STATES.new) return "new";
  return "checking";
}
