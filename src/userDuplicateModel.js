export function userIdentityKey(user) {
  if (!user || user.status === "archived") return "";
  const role = user.role || "";
  const email = String(user.email || "").trim().toLowerCase();
  const workerNo = String(user.workerNo || "").trim();
  const pin = String(user.pin || "").trim();
  if ((role === "admin" || role === "user") && email) return `email:${email}`;
  if ((role === "worker" || role === "cleaner") && workerNo) return `worker:${workerNo}`;
  if (role === "tech" && pin) return `tech:${pin}`;
  return "";
}

export function findUserDuplicateGroups(users = []) {
  const groups = new Map();
  users.forEach((user) => {
    const key = userIdentityKey(user);
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(user);
  });
  return [...groups.values()].filter((group) => group.length > 1);
}
