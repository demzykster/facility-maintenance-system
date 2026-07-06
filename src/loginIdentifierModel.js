const norm = (value) => String(value || "").trim();
const normEmail = (value) => norm(value).toLowerCase();
export const normPhone = (value) => String(value || "").replace(/\D/g, "");

const activeState = (user) => (user?.active === false || user?.status === "archived") ? "archived" : "active";

const authForRole = (role, identifierType = "") => {
  if (role === "tech") return identifierType === "techCode" ? "none" : "pin";
  if (role === "worker" || role === "cleaner") return "pin";
  return "password";
};

const candidate = (user, identifierType, source = "users") => ({
  status: activeState(user),
  identifierType,
  auth: authForRole(user?.role, identifierType),
  user,
  source
});

export function resolveIdentifier(input, users = [], builtins = []) {
  const value = norm(input);
  if (!value) return { status: "empty", identifierType: "", auth: "", user: null, source: "" };

  const email = normEmail(value);
  const storedEmail = users.find((u) => normEmail(u.email) === email);
  if (storedEmail) return candidate(storedEmail, "email");

  const builtinEmail = builtins.find((u) => normEmail(u.email) === email);
  if (builtinEmail) return candidate(builtinEmail, "email", "builtin");

  const storedWorker = users.find((u) => (u.role === "worker" || u.role === "cleaner") && norm(u.workerNo) === value);
  if (storedWorker) return candidate(storedWorker, "workerNo");

  const builtinWorker = builtins.find((u) => (u.role === "worker" || u.role === "cleaner") && norm(u.workerNo) === value);
  if (builtinWorker) return candidate(builtinWorker, "workerNo", "builtin");

  const phone = normPhone(value);
  if (phone) {
    const storedPhone = users.find((u) => normPhone(u.phone) === phone);
    if (storedPhone) return candidate(storedPhone, "phone");

    const builtinPhone = builtins.find((u) => normPhone(u.phone) === phone);
    if (builtinPhone) return candidate(builtinPhone, "phone", "builtin");
  }

  const storedTech = users.find((u) => u.role === "tech" && norm(u.pin) === value);
  if (storedTech) return candidate(storedTech, "techCode");

  const builtinTech = builtins.find((u) => u.role === "tech" && norm(u.pin) === value);
  if (builtinTech) return candidate(builtinTech, "techCode", "builtin");

  return { status: "not_found", identifierType: "", auth: "", user: null, source: "" };
}
