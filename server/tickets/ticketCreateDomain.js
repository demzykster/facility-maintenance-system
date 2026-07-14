import { createHash } from "node:crypto";
import { normalizeTicketRecord } from "../../src/ticketRecordModel.js";
import { missingTicketCreateFields } from "../../src/ticketCreateContract.js";

const cleanText = (value, limit = 4000) => String(value || "")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, limit);

const cleanObject = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};

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

export function ticketCreateIdempotencyKey(ticket = {}, actor = {}, explicitKey = "") {
  const cleanExplicit = cleanText(explicitKey, 200);
  if (cleanExplicit) return cleanExplicit;
  const actorPart = cleanText(actor.id || actor.authUserId || actor.workerNo || "anonymous", 120);
  return `ticket:${actorPart}:${cleanText(ticket.id, 160)}`;
}

export async function createTicketRecord({ driver, ticket, actor, idempotencyKey } = {}) {
  if (!driver || typeof driver.create !== "function") throw new Error("tickets_create_not_configured");
  const normalized = normalizeTicketRecord({ ...ticket, num: null });
  const missingFields = missingTicketCreateFields(normalized.legacyPayload);
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

export function mergeTicketUpdateWithExisting(ticket = {}, existing = {}) {
  const existingClean = cleanObject(existing);
  return {
    ...ticket,
    id: existingClean.id || ticket.id,
    num: existingClean.num ?? ticket.num
  };
}
