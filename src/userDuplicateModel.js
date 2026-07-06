const phoneKey = (value) => String(value || "").replace(/\D/g, "");

export function userIdentityKey(user) {
  if (!user || user.status === "archived") return "";
  const role = user.role || "";
  const email = String(user.email || "").trim().toLowerCase();
  const workerNo = String(user.workerNo || "").trim();
  const pin = String(user.pin || "").trim();
  const phone = phoneKey(user.phone);
  if (phone) return `phone:${phone}`;
  if ((role === "admin" || role === "user") && email) return `email:${email}`;
  if ((role === "worker" || role === "cleaner") && workerNo) return `worker:${workerNo}`;
  if (role === "tech" && pin) return `tech:${pin}`;
  return "";
}

export function userIdentityKeys(user) {
  if (!user || user.status === "archived") return [];
  const role = user.role || "";
  const email = String(user.email || "").trim().toLowerCase();
  const workerNo = String(user.workerNo || "").trim();
  const pin = String(user.pin || "").trim();
  const phone = phoneKey(user.phone);
  return [
    phone ? `phone:${phone}` : "",
    (role === "admin" || role === "user") && email ? `email:${email}` : "",
    (role === "worker" || role === "cleaner") && workerNo ? `worker:${workerNo}` : "",
    role === "tech" && pin ? `tech:${pin}` : ""
  ].filter(Boolean);
}

export function findUserDuplicateGroups(users = []) {
  const groups = new Map();
  users.forEach((user) => {
    for (const key of userIdentityKeys(user)) {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(user);
    }
  });
  return [...groups.values()].filter((group) => group.length > 1);
}
