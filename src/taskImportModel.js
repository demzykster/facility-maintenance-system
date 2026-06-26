export const taskImportTitleKey = (title) =>
  String(title || "").toLowerCase().replace(/\s+/g, " ").trim();

export const taskImportStatusGroup = (status) =>
  status === "done" || status === "cancelled" ? "closed" : "open";

export function taskImportSameMeeting(task, meetingId) {
  if (!meetingId) return true;
  return task?.meetingId === meetingId || (task?.linkedMeetingIds || []).includes(meetingId);
}

export function findTaskImportMatch(existing = [], { title, status, meetingId } = {}) {
  const titleKey = taskImportTitleKey(title);
  if (!titleKey) return null;
  const statusGroup = taskImportStatusGroup(status);

  return (existing || []).find((task) =>
    taskImportTitleKey(task?.title) === titleKey &&
    taskImportStatusGroup(task?.status) === statusGroup &&
    taskImportSameMeeting(task, meetingId)
  ) || null;
}
