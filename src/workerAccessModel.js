export const isWorkerLoginRole = (role) => role === "worker" || role === "cleaner";
export const isPinActivationRole = (role) => role === "worker" || role === "cleaner" || role === "tech";
export const isPasswordActivationRole = (role) => role === "admin" || role === "user";
export const isActivationLinkRole = (role) => isPinActivationRole(role) || isPasswordActivationRole(role);

export function workerLoginStateText(user) {
  if (!user || !isActivationLinkRole(user.role)) return "";
  if (user.activationToken && user.activationStatus === "pending") return "ממתין להפעלה";
  if (user.activationStatus === "activated") return "הופעל";
  if (isPinActivationRole(user.role) && user.pin) return "קוד זמני";
  if (isPasswordActivationRole(user.role) && user.password) return "סיסמה זמנית";
  return "אין כניסה";
}

export function canCopyActivationLink(user, activationToken, canManageWorkerAccess) {
  return !!user?.id && !!activationToken && activationToken === user.activationToken && !!canManageWorkerAccess;
}

export function workerActivationCopyHint(user, activationToken, canManageWorkerAccess) {
  if (!canManageWorkerAccess || !activationToken) return "";
  if (canCopyActivationLink(user, activationToken, canManageWorkerAccess)) return "הקישור שמור וזמין להעתקה.";
  if (!user?.id) return "שמרו את המשתמש. מיד אחרי השמירה הקישור יופיע כאן להעתקה.";
  return "שמרו את קישור ההפעלה/האיפוס החדש. אחרי השמירה הוא יופיע כאן להעתקה.";
}

export function shouldKeepWorkerFormOpenForActivationLink(user, canManageWorkerAccess) {
  return !!canManageWorkerAccess
    && !!user?.id
    && isActivationLinkRole(user.role)
    && !!user.activationToken
    && user.activationStatus === "pending";
}

export function shouldSeedWorkerActivation(user, role, canManageWorkerAccess) {
  return !!canManageWorkerAccess
    && !user?.id
    && isActivationLinkRole(role)
    && !user?.pin
    && !user?.password
    && !user?.activationToken
    && !user?.activationStatus;
}

export function activationTokenForSave({ user = {}, role, activationToken = "", canManageWorkerAccess, createToken } = {}) {
  if (!canManageWorkerAccess || !isActivationLinkRole(role)) return user.activationToken || "";
  if (activationToken) return activationToken;
  if (user.activationStatus === "activated") return "";
  if (isPinActivationRole(role) && user.pin) return "";
  if (isPasswordActivationRole(role) && user.password) return "";
  return typeof createToken === "function" ? createToken() : "";
}
