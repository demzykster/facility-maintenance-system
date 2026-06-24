export const isWorkerLoginRole = (role) => role === "worker" || role === "cleaner";

export function workerLoginStateText(user) {
  if (!user || !isWorkerLoginRole(user.role)) return "";
  if (user.activationToken && user.activationStatus === "pending") return "ממתין להפעלה";
  if (user.activationStatus === "activated") return "הופעל";
  if (user.pin) return "קוד זמני";
  return "אין כניסה";
}

export function canCopyActivationLink(user, activationToken, canManageWorkerAccess) {
  return !!user?.id && !!activationToken && !!canManageWorkerAccess;
}

export function shouldSeedWorkerActivation(user, role, canManageWorkerAccess) {
  return !!canManageWorkerAccess
    && !user?.id
    && isWorkerLoginRole(role)
    && !user?.pin
    && !user?.activationToken
    && !user?.activationStatus;
}
