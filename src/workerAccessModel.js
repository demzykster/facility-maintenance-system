export const isWorkerLoginRole = (role) => role === "worker" || role === "cleaner";
export const isPinActivationRole = (role) => role === "worker" || role === "cleaner" || role === "tech";
export const isPasswordActivationRole = (role) => role === "admin" || role === "user";
export const isActivationLinkRole = (role) => isPinActivationRole(role) || isPasswordActivationRole(role);

export function loginSecretKindForRole(role) {
  if (isPasswordActivationRole(role)) return "password";
  if (isPinActivationRole(role)) return "pin";
  return "";
}

export function userHasLoginSecret(user) {
  if (!user || !isActivationLinkRole(user.role)) return false;
  if (isPasswordActivationRole(user.role)) return !!String(user.password || user.authUserId || "").trim();
  return !!String(user.pin || "").trim();
}

export function userNeedsInitialLoginSetup(user) {
  return !!user && isActivationLinkRole(user.role) && user.active !== false && !userHasLoginSecret(user);
}

export function workerLoginStateText(user) {
  if (!user || !isActivationLinkRole(user.role)) return "";
  if (userHasLoginSecret(user)) return "כניסה מוגדרת";
  return "טרם הוגדרה כניסה";
}

export function loginSetupPrompt(user) {
  return isPasswordActivationRole(user?.role)
    ? "המשתמש יגדיר סיסמה אישית בכניסה הראשונה עם הדוא״ל."
    : user?.role === "tech"
    ? "הטכנאי יגדיר קוד אישי בכניסה הראשונה עם מספר הטלפון."
    : "המשתמש יגדיר קוד אישי בכניסה הראשונה עם מספר העובד.";
}

export function shouldKeepWorkerFormOpenForActivationLink() {
  return false;
}
