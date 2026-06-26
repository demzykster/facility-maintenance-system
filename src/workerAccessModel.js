export const isWorkerLoginRole = (role) => role === "worker" || role === "cleaner";

export function workerLoginStateText(user) {
  if (!user || !isWorkerLoginRole(user.role)) return "";
  if (user.activationToken && user.activationStatus === "pending") return "ממתין להפעלה";
  if (user.activationStatus === "activated") return "הופעל";
  if (user.pin) return "קוד זמני";
  return "אין כניסה";
}

export function canCopyActivationLink(user, activationToken, canManageWorkerAccess) {
  return !!user?.id && !!activationToken && activationToken === user.activationToken && !!canManageWorkerAccess;
}

export function shouldKeepWorkerFormOpenForActivationLink(user, canManageWorkerAccess) {
  return !!canManageWorkerAccess
    && !!user?.id
    && isWorkerLoginRole(user.role)
    && !!user.activationToken
    && user.activationStatus === "pending";
}

export function shouldSeedWorkerActivation(user, role, canManageWorkerAccess) {
  return !!canManageWorkerAccess
    && !user?.id
    && isWorkerLoginRole(role)
    && !user?.pin
    && !user?.activationToken
    && !user?.activationStatus;
}
