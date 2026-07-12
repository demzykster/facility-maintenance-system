const clean = (value) => String(value || "").trim();

export function userDepartments(user = {}) {
  const values = Array.isArray(user.depts) && user.depts.length
    ? user.depts
    : [user.dept || user.department];
  return [...new Set(values.map(clean).filter(Boolean))];
}

export function userShift(user = {}) {
  return clean(user.shift || user.shiftId);
}

export function hasUserManagementScope(session = {}) {
  if (session.role === "admin") return true;
  const perms = session.perms || session.permissions || {};
  return perms.users === "manage" || perms.users === "full";
}

export function canUseScopedWorkerWrite(actor = {}, user = {}) {
  if (hasUserManagementScope(actor)) return true;
  if (actor.role !== "user") return false;
  if (clean(user.role) !== "worker") return false;

  const actorDepts = userDepartments(actor);
  const targetDepts = userDepartments(user);
  if (!actorDepts.length || !targetDepts.length) return false;
  if (targetDepts.some((dept) => !actorDepts.includes(dept))) return false;

  const actorShift = userShift(actor);
  if (actorShift && userShift(user) !== actorShift) return false;
  return true;
}

export function scopedWorkerDefaultsForActor(actor = {}) {
  const depts = userDepartments(actor);
  const dept = depts[0] || "";
  return {
    role: "worker",
    dept,
    depts: dept ? [dept] : [],
    shift: userShift(actor)
  };
}

export function normalizeScopedWorkerForActor(user = {}, actor = {}, { canManageUsers = false } = {}) {
  if (canManageUsers || hasUserManagementScope(actor)) return { ok: true, user };
  if (actor.role !== "user") return { ok: false, error: "permission_required:users:manage" };

  const defaults = scopedWorkerDefaultsForActor(actor);
  if (!defaults.dept) return { ok: false, error: "manager_department_required" };
  const actorDepts = userDepartments(actor);
  const requestedDept = userDepartments(user).find((dept) => actorDepts.includes(dept)) || defaults.dept;
  const next = {
    ...user,
    role: "worker",
    dept: requestedDept,
    depts: [requestedDept],
    shift: defaults.shift || userShift(user),
    perms: undefined
  };
  if (defaults.shift && userShift(next) !== defaults.shift) next.shift = defaults.shift;
  return { ok: true, user: next };
}

export function scopedUsersForActor(users = [], actor = {}, { role = "", canManageUsers = false, sameShift = true } = {}) {
  const list = Array.isArray(users) ? users : [];
  const wantedRole = clean(role);
  if (canManageUsers || hasUserManagementScope(actor)) {
    return wantedRole ? list.filter((u) => clean(u.role) === wantedRole) : list;
  }
  if (actor.role !== "user") return wantedRole ? list.filter((u) => clean(u.role) === wantedRole) : list;
  const actorDepts = userDepartments(actor);
  const actorShift = userShift(actor);
  return list.filter((u) => {
    if (wantedRole && clean(u.role) !== wantedRole) return false;
    if (u.active === false || u.status === "archived") return false;
    const targetDepts = userDepartments(u);
    if (!targetDepts.some((dept) => actorDepts.includes(dept))) return false;
    if (sameShift && actorShift && userShift(u) !== actorShift) return false;
    return true;
  });
}
