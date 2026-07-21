import { createHash } from "node:crypto";
import { normalizeTicketRecord } from "../../src/ticketRecordModel.js";
import { missingTicketCreateFields } from "../../src/ticketCreateContract.js";

const cleanText = (value, limit = 4000) => String(value || "")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, limit);

const cleanObject = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};

const SYSTEM_CREATE_FIELDS = [
  "num",
  "ticketNo",
  "ticketNumber",
  "status",
  "createdAt",
  "created_at",
  "updatedAt",
  "updated_at",
  "closedAt",
  "closed_at",
  "sourceKvKey",
  "source_kv_key",
  "actor_id",
  "actorId",
  "createdBy",
  "createdById",
  "reportedBy",
  "reportedById",
  "reported_by_id",
  "reportedByName",
  "reported_by_name",
  "audit",
  "auditMetadata",
  "idempotencyResult"
];

const WORKER_CREATE_FIELDS = [
  "assignee",
  "assigneeId",
  "assigneeName",
  "supplier",
  "routedTech",
  "mgrExec",
  "waitingReason",
  "waitBall",
  "waitingSupplier",
  "waitingUser",
  "waitingUntil",
  "dueAt",
  "due_at",
  "slaDueAt",
  "approvedAt",
  "approved_at"
];

const actorTicketPayload = (actor = {}) => ({
  id: cleanText(actor.id || actor.authUserId || actor.workerNo, 160),
  name: cleanText(actor.name, 160),
  role: cleanText(actor.role, 40)
});

const actorDepartment = (actor = {}) => cleanText(
  actor.dept || actor.department || (Array.isArray(actor.depts) ? actor.depts[0] : "") || (Array.isArray(actor.departments) ? actor.departments[0] : ""),
  160
);

export function sanitizeTicketCreatePayload(ticket = {}, actor = {}) {
  const safe = { ...cleanObject(ticket) };
  for (const field of SYSTEM_CREATE_FIELDS) delete safe[field];
  if (cleanText(actor.role, 40) === "worker") {
    for (const field of WORKER_CREATE_FIELDS) delete safe[field];
  }
  const actorPayload = actorTicketPayload(actor);
  safe.num = null;
  safe.status = cleanText(actor.role, 40) === "worker" ? "pending_manager" : "new";
  safe.createdBy = actorPayload;
  safe.reportedBy = actorPayload;
  const department = actorDepartment(actor);
  if (department) safe.department = department;
  return safe;
}

function missingWorkerTicketCreateFields(input = {}) {
  const ticket = input && typeof input === "object" ? input : {};
  const missing = [];
  if (!cleanText(ticket.subject || ticket.title, 240)) missing.push("subject");
  if (!cleanText(ticket.description || ticket.desc, 1600)) missing.push("description");
  if (!cleanText(ticket.priority, 40)) missing.push("priority");
  if (cleanText(ticket.track, 40) === "transport" && !cleanText(ticket.forkliftId || ticket.forklift_id, 160)) missing.push("forkliftId");
  return [...new Set(missing)];
}

function missingTicketCreateFieldsForActor(input = {}, actor = {}) {
  return cleanText(actor.role, 40) === "worker"
    ? missingWorkerTicketCreateFields(input)
    : missingTicketCreateFields(input);
}

export function canonicalTicketCreateHashPayload(ticket = {}, actor = {}) {
  return {
    operation: "create_ticket",
    actorId: cleanText(actor.id || actor.authUserId || actor.workerNo, 160),
    actorRole: cleanText(actor.role, 40),
    track: cleanText(ticket.track, 40),
    asset: cleanText(ticket.asset, 160),
    forkliftId: cleanText(ticket.forkliftId, 160),
    subject: cleanText(ticket.subject || ticket.title, 240),
    description: cleanText(ticket.description || ticket.desc, 1600),
    downtimeType: cleanText(ticket.downtimeType, 80),
    category: cleanText(ticket.category || ticket.cat, 120),
    priority: cleanText(ticket.priority, 40),
    status: cleanText(ticket.status, 40) || "new",
    zone: cleanText(ticket.zone || ticket.location, 160)
  };
}

export function canonicalTicketCreateHash(ticket = {}, actor = {}) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalTicketCreateHashPayload(ticket, actor)))
    .digest("hex");
}

const existingTicketPayload = (ticket = {}) => {
  const record = cleanObject(ticket);
  if (record.legacy_payload && typeof record.legacy_payload === "object" && !Array.isArray(record.legacy_payload)) return record.legacy_payload;
  if (record.legacyPayload && typeof record.legacyPayload === "object" && !Array.isArray(record.legacyPayload)) return record.legacyPayload;
  return record;
};

export function ticketCreateIdempotencyKey(ticket = {}, actor = {}, explicitKey = "") {
  const cleanExplicit = cleanText(explicitKey, 200);
  if (cleanExplicit) return cleanExplicit;
  const actorPart = cleanText(actor.id || actor.authUserId || actor.workerNo || "anonymous", 120);
  return `ticket:${actorPart}:${cleanText(ticket.id, 160)}`;
}

export async function createTicketRecord({ driver, ticket, actor, idempotencyKey } = {}) {
  if (!driver || typeof driver.create !== "function") throw new Error("tickets_create_not_configured");
  const normalized = normalizeTicketRecord(sanitizeTicketCreatePayload(ticket, actor));
  const missingFields = missingTicketCreateFieldsForActor(normalized.legacyPayload, actor);
  if (missingFields.length) throw new Error(`ticket_create_fields_required:${missingFields.join(",")}`);
  const key = ticketCreateIdempotencyKey(normalized.legacyPayload, actor, idempotencyKey);
  const requestHash = canonicalTicketCreateHash(normalized.legacyPayload, actor);
  const result = await driver.create(normalized.legacyPayload, {
    idempotencyKey: key,
    requestHash,
    actorId: cleanText(actor?.id || actor?.authUserId || actor?.workerNo, 160)
  });
  const num = Number(result?.num);
  const ticketId = cleanText(result?.ticketId || result?.id, 160);
  const ticketNo = cleanText(result?.ticketNumber || result?.ticketNo, 40);
  if (!ticketId) throw new Error("authoritative_ticket_id_required");
  if (!Number.isFinite(num)) throw new Error("authoritative_ticket_num_required");
  if (!ticketNo) throw new Error("authoritative_ticket_number_required");
  const legacyPayload = {
    ...normalized.legacyPayload,
    id: ticketId,
    num,
    ticketNo,
    sourceKvKey: `ticket:${ticketId}`
  };
  return {
    ticket: legacyPayload,
    result: {
      type: "ticket.create",
      ticketId,
      num,
      ticketNumber: ticketNo,
      ticketNo,
      status: cleanText(result?.status || normalized.status, 40),
      idempotencyStatus: cleanText(result?.idempotencyStatus || "created", 40)
    }
  };
}

export function createTicketReplayResult({ ticket, existing, actor } = {}) {
  const requested = normalizeTicketRecord(sanitizeTicketCreatePayload(ticket, actor)).legacyPayload;
  const stored = normalizeTicketRecord(existingTicketPayload(existing)).legacyPayload;
  const storedForHash = normalizeTicketRecord(sanitizeTicketCreatePayload(stored, actor)).legacyPayload;
  const requestedHash = canonicalTicketCreateHash(requested, actor);
  const storedHash = canonicalTicketCreateHash(storedForHash, actor);
  if (requestedHash !== storedHash) {
    return {
      replay: false,
      requestHash: requestedHash,
      existingHash: storedHash
    };
  }

  const normalized = normalizeTicketRecord(stored);
  const ticketNo = cleanText(stored.ticketNo || stored.ticketNumber, 40);
  return {
    replay: true,
    ticket: stored,
    result: {
      type: "ticket.create",
      ticketId: normalized.id,
      num: normalized.num,
      ticketNumber: ticketNo,
      ticketNo,
      status: normalized.status,
      idempotencyStatus: "replayed"
    }
  };
}

export function mergeTicketUpdateWithExisting(ticket = {}, existing = {}) {
  const existingClean = cleanObject(existing);
  return {
    ...ticket,
    id: existingClean.id || ticket.id,
    num: existingClean.num ?? ticket.num
  };
}
