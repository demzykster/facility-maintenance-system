const toMinutes = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  const minutes = Number(value);
  return Number.isFinite(minutes) && minutes >= 0 ? minutes : undefined;
};

const firstMinutes = (...values) => {
  for (const value of values) {
    const minutes = toMinutes(value);
    if (minutes !== undefined) return minutes;
  }
  return 0;
};

export const resolveTechnicianTolerances = (user, config) => ({
  lateTolerance: firstMinutes(user?.lateTolerance, config?.lateTolerance),
  earlyTolerance: firstMinutes(user?.earlyTolerance, config?.earlyTolerance)
});
