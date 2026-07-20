import { randomUUID } from "node:crypto";
import { createTicketRecord } from "../../tickets/ticketCreateDomain.js";
import { CAPABILITY_RISK, createAiCapabilityRegistry } from "./registry.js";
import { AI_CAPABILITY_EXECUTION_STATUS, normalizeAiCapabilityResponse } from "../../../src/aiCapabilityResponseModel.js";
import { aiAutonomousTicketCreatePermitted } from "../../../src/aiAutonomousCapabilityFlagModel.js";
import {
  SYSTEM_DOWNTIME_NEEDS_TRIAGE,
  ticketCreateContractSummary
} from "../../../src/ticketCreateContract.js";
import {
  buildInlineTicketIntakePlan,
  createdInlineTicketAnswer,
  normalizeInlineTicketIntakeSession
} from "../../../src/inlineAiTicketIntakeOrchestrator.js";

const HOUR = 3600000;

const cleanText = (value, limit = 1000) => String(value || "")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, limit);

const cleanArray = (value) => Array.isArray(value) ? value : [];
const cleanObject = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};

const CREATE_INTENT_RE = /(заявк|тикет|создай|создать|открой|открыть|פתח|תפתח|צור|קריאה|create|open|ticket|request|report)/iu;
const PROBLEM_RE = /(не\s+работ|сломал|полом|проблем|בעיה|תקלה|לא\s+עובד|שבור|שבורה|שבורים|שבר|broken|not\s+working|fault|problem)/iu;
const RECURRENCE_RE = /(снова|опять|та\s+же|уже\s+открывал|כבר|שוב|again|same\s+issue|already\s+opened)/iu;
const DANGEROUS_RE = /(тормоз|дым|искра|искрен|не\s+едет|утеч|подъ[её]м|בלמ|עשן|ניצו|לא\s+נוסע|דליפ|הרמה|brake|smoke(?!\s+test)|spark|won'?t\s+move|leak|\blift\b)/iu;

function wordsForDisplay(text = "") {
  return cleanText(text, 120)
    .replace(/^(создай|создать|открой|открыть|заявк[ау]?|тикет|פתח|צור|create|open|ticket|request)\s+/iu, "")
    .replace(/\s+(на|у|по|для|ב|על|for)\s+(машин[еуы]?|מלגזה|כלי|vehicle|machine)?\s*#?\d+.*$/iu, "")
    .trim();
}

function identifierCandidates(text = "") {
  const raw = cleanText(text, 1000);
  return [...raw.matchAll(/(?:^|[^\p{L}\p{N}])#?(\d{2,})(?=$|[^\p{L}\p{N}])/giu)]
    .map((match) => match[1])
    .filter(Boolean);
}

function normalizeIdentifier(value = "") {
  return cleanText(value, 160).toLowerCase();
}

function unitIdentifiers(unit = {}) {
  return [
    unit.id,
    unit.code,
    unit.num,
    unit.number,
    unit.asset,
    unit.unitCode,
    unit.workerNo,
    unit.workerNumber,
    unit.vehicleNo,
    unit.vehicleNumber,
    unit.registration,
    unit.registrationNumber,
    unit.licensePlate,
    unit.displayNumber,
    unit.displayNo,
    ...(Array.isArray(unit.aliases) ? unit.aliases : [])
  ]
    .map((value) => cleanText(value, 160))
    .filter(Boolean);
}

function unitMatchesIdentifier(unit = {}, identifier = "") {
  const cleanIdentifier = normalizeIdentifier(identifier);
  return unitIdentifiers(unit).some((value) => normalizeIdentifier(value) === cleanIdentifier);
}

function unitAvailableForTicketCreate(unit = {}) {
  const status = normalizeIdentifier(unit.status || unit.state);
  return !["archived", "inactive", "disabled", "deleted", "decommissioned"].includes(status);
}

function visibleFleet(context = {}, fullVisibleFleet = null) {
  const source = Array.isArray(fullVisibleFleet) && fullVisibleFleet.length ? fullVisibleFleet : context.fleet;
  return cleanArray(source)
    .filter((unit) => unit && unit.id)
    .filter(unitAvailableForTicketCreate);
}

function currentEntityLooksLikeAsset(current = {}) {
  return current.type === "fleet"
    || current.type === "asset"
    || current.kind === "fleet"
    || current.id
    || current.code
    || current.num
    || current.number
    || current.asset
    || current.unitCode
    || current.workerNo
    || current.vehicleNumber
    || current.licensePlate
    || current.displayNumber;
}

function findVisibleCurrentAsset({ fleet = [], currentEntity = {} } = {}) {
  const current = cleanObject(currentEntity);
  if (!currentEntityLooksLikeAsset(current)) return null;
  const id = cleanText(current.id, 160);
  const code = cleanText(current.code || current.num || current.number || current.asset || current.unitCode || current.workerNo || current.vehicleNumber || current.licensePlate || current.displayNumber, 160);
  if (!id && !code) return null;

  if (id) {
    const match = fleet.find((unit) => cleanText(unit.id, 160).toLowerCase() === id.toLowerCase());
    if (match) return { status: "matched", asset: match, identifiers: [id, code].filter(Boolean), source: "current_entity" };
    return { status: "not_found", identifiers: [id, code].filter(Boolean), source: "current_entity" };
  }

  const matches = fleet.filter((unit) => unitMatchesIdentifier(unit, code));
  const unique = [...new Map(matches.map((unit) => [unit.id, unit])).values()];
  if (unique.length === 1) return { status: "matched", asset: unique[0], identifiers: [code], source: "current_entity" };
  if (unique.length > 1) return { status: "ambiguous", matches: unique, identifiers: [code], source: "current_entity" };
  return { status: "not_found", identifiers: [code], source: "current_entity" };
}

function findVisibleAsset({ text = "", context = {}, currentEntity = null, fullVisibleFleet = null } = {}) {
  const fleet = visibleFleet(context, fullVisibleFleet);
  const currentMatch = findVisibleCurrentAsset({ fleet, currentEntity });
  if (currentMatch) return currentMatch;
  const identifiers = identifierCandidates(text);
  if (!identifiers.length) return { status: "missing_identifier", identifiers: [] };
  const matches = [];
  for (const identifier of identifiers) {
    fleet.filter((unit) => unitMatchesIdentifier(unit, identifier)).forEach((unit) => matches.push(unit));
  }
  const unique = [...new Map(matches.map((unit) => [unit.id, unit])).values()];
  if (unique.length === 1) return { status: "matched", asset: unique[0], identifiers };
  if (unique.length > 1) return { status: "ambiguous", matches: unique, identifiers };
  return { status: "not_found", identifiers };
}

function isTicketIntakeContext(context = {}) {
  const rawContext = cleanObject(context.rawContext);
  const taskSession = cleanObject(rawContext.taskSession);
  return rawContext.intent === "create_ticket"
    || rawContext.uiSurface === "inline_ticket_create"
    || taskSession.type === "ticket_intake"
    || cleanText(context.workflow, 80) === "ticket_intake";
}

function shouldAutonomousCreate(text = "", context = {}) {
  const raw = cleanText(text, 1000);
  const previousIntake = normalizeInlineTicketIntakeSession(context.intake || cleanObject(context.rawContext).taskSession?.intake);
  if (previousIntake?.pendingField && raw.length > 0) return true;
  return CREATE_INTENT_RE.test(raw) || PROBLEM_RE.test(raw) || DANGEROUS_RE.test(raw);
}

function createBlockingResponse({ answer, question, facts = [], unknowns = [], toolResults = [], status = AI_CAPABILITY_EXECUTION_STATUS.blocked, intake = null } = {}) {
  return normalizeAiCapabilityResponse({
    answer: answer || question,
    facts,
    unknowns,
    toolResults,
    intake,
    blockingQuestion: question,
    requiresConfirmation: false,
    executionStatus: status
  });
}

function createTicketPayload({ text = "", user = {}, asset = {}, now = Date.now() } = {}) {
  const subject = wordsForDisplay(text) || cleanText(text, 80) || "תקלה בכלי שינוע";
  const actor = {
    id: cleanText(user.id || user.authUserId || user.workerNo, 160),
    name: cleanText(user.name, 120),
    role: cleanText(user.role, 40),
    dept: cleanText(user.dept || user.department, 120),
    phone: "",
    email: ""
  };
  return {
    id: `ticket-${randomUUID()}`,
    track: "transport",
    subject,
    category: "transport",
    categoryLabel: "",
    priority: SYSTEM_DOWNTIME_NEEDS_TRIAGE.prio,
    zone: "",
    asset: cleanText(asset.code || asset.num || asset.number || asset.asset || asset.unitCode || asset.workerNo || asset.vehicleNumber || asset.licensePlate || asset.displayNumber || asset.id, 160),
    forkliftId: cleanText(asset.id, 160),
    downtimeType: SYSTEM_DOWNTIME_NEEDS_TRIAGE.id,
    description: cleanText(text, 1200),
    status: "new",
    assignee: "",
    routedTech: true,
    supplier: cleanText(asset.supplier, 160),
    department: cleanText(asset.department || asset.dept || user.dept || user.department, 120),
    downtimeStart: now,
    downtimeEnd: null,
    hasPhoto: false,
    closure: null,
    reportedBy: actor,
    createdBy: actor,
    createdAt: now,
    updatedAt: now,
    dueAt: now + 24 * HOUR,
    ai: {
      source: "ai_capability",
      autonomous: true,
      capability: "create_ticket"
    },
    log: [{
      at: now,
      by: cleanText(user.name, 120) || "AI",
      byRole: cleanText(user.role, 40),
      text: "נפתחה אוטומטית על ידי AI לפי דיווח משתמש",
      kind: "ai_capability_create"
    }]
  };
}

const readOutputSchema = {
  type: "object",
  required: ["ok", "result"],
  properties: {
    ok: { type: "boolean" },
    result: { type: "object" }
  }
};

export function createTicketReadCapabilities() {
  return [
    {
      name: "get_current_user_context",
      purpose: "Return the verified current CMMS user context already established by the server session.",
      inputSchema: { type: "object", properties: {} },
      outputSchema: readOutputSchema,
      requiredPermission: "session:read:self",
      riskClass: CAPABILITY_RISK.read,
      confirmationPolicy: "none",
      idempotencyPolicy: "not_required_read",
      auditBehavior: "covered_by_ai_assist_request",
      authoritativeResult: "verified_server_session_user",
      allowedErrors: [],
      retrySemantics: "safe",
      async execute(_args = {}, context = {}) {
        const user = cleanObject(context.user);
        return {
          ok: true,
          result: {
            role: cleanText(user.role, 40),
            departments: cleanArray(user.departments || user.depts || user.department || user.dept)
          }
        };
      }
    },
    {
      name: "find_asset_by_visible_identifier",
      purpose: "Find one visible fleet/asset record by a user-visible identifier or current route entity.",
      inputSchema: {
        type: "object",
        required: ["text"],
        properties: {
          text: { type: "string" }
        }
      },
      outputSchema: readOutputSchema,
      requiredPermission: "fleet:visible_to_actor",
      riskClass: CAPABILITY_RISK.read,
      confirmationPolicy: "none",
      idempotencyPolicy: "not_required_read",
      auditBehavior: "covered_by_ai_assist_request",
      authoritativeResult: "role_filtered_ai_context_asset",
      allowedErrors: ["missing_identifier", "not_found", "ambiguous"],
      retrySemantics: "safe",
      async execute(args = {}, context = {}) {
        const result = findVisibleAsset({
          text: args.text,
          context: cleanObject(context.context),
          fullVisibleFleet: cleanArray(context.fullVisibleFleet || context.serverVisibleFleet),
          currentEntity: cleanObject(context.rawContext).currentEntity
            || cleanObject(context.rawContext).routeEntity
            || cleanObject(context.rawContext).currentAsset
        });
        return { ok: result.status === "matched", result };
      }
    },
    {
      name: "get_asset_summary",
      purpose: "Return safe visible asset fields when lookup did not already include enough information.",
      inputSchema: {
        type: "object",
        required: ["asset"],
        properties: {
          asset: { type: "object" }
        }
      },
      outputSchema: readOutputSchema,
      requiredPermission: "fleet:visible_to_actor",
      riskClass: CAPABILITY_RISK.read,
      confirmationPolicy: "none",
      idempotencyPolicy: "not_required_read",
      auditBehavior: "covered_by_ai_assist_request",
      authoritativeResult: "role_filtered_ai_context_asset_summary",
      allowedErrors: [],
      retrySemantics: "safe",
      async execute(args = {}) {
        const asset = cleanObject(args.asset);
        return {
          ok: true,
          result: {
            id: cleanText(asset.id, 160),
            code: cleanText(asset.code || asset.num || asset.number || asset.asset || asset.unitCode || asset.workerNo || asset.vehicleNumber || asset.licensePlate || asset.displayNumber, 160),
            department: cleanText(asset.department || asset.dept, 160),
            supplier: cleanText(asset.supplier, 160),
            status: cleanText(asset.status, 80)
          }
        };
      }
    },
    {
      name: "get_ticket_create_contract",
      purpose: "Return the ticket create contract and reserved system downtime options.",
      inputSchema: { type: "object", properties: {} },
      outputSchema: readOutputSchema,
      requiredPermission: "tickets:create:contract",
      riskClass: CAPABILITY_RISK.read,
      confirmationPolicy: "none",
      idempotencyPolicy: "not_required_read",
      auditBehavior: "covered_by_ai_assist_request",
      authoritativeResult: "repo_ticket_create_contract",
      allowedErrors: [],
      retrySemantics: "safe",
      async execute() {
        return { ok: true, result: ticketCreateContractSummary({}, []) };
      }
    },
    {
      name: "get_open_tickets_for_asset",
      purpose: "Return visible open tickets for the resolved asset only when duplicate policy requires it.",
      inputSchema: {
        type: "object",
        required: ["assetId"],
        properties: {
          assetId: { type: "string" }
        }
      },
      outputSchema: readOutputSchema,
      requiredPermission: "tickets:view:visible",
      riskClass: CAPABILITY_RISK.read,
      confirmationPolicy: "none",
      idempotencyPolicy: "not_required_read",
      auditBehavior: "covered_by_ai_assist_request",
      authoritativeResult: "role_filtered_ai_context_open_tickets",
      allowedErrors: [],
      retrySemantics: "safe",
      async execute(args = {}, context = {}) {
        const openTickets = cleanArray(cleanObject(context.context).tickets)
          .filter((ticket) => ticket.forkliftId === args.assetId && !["done", "cancelled"].includes(ticket.status));
        return {
          ok: true,
          result: {
            count: openTickets.length,
            tickets: openTickets.slice(0, 5).map((ticket) => ({ id: cleanText(ticket.id, 160), subject: cleanText(ticket.subject, 240) }))
          }
        };
      }
    }
  ];
}

export function createTicketCreateCapability({ driver = null } = {}) {
  return {
    name: "create_ticket",
    purpose: "Create one low-risk inline ticket-intake request from deterministic transport or facility facts.",
    inputSchema: {
      type: "object",
      required: ["text"],
      properties: {
        text: { type: "string" },
        idempotencyKey: { type: "string" }
      }
    },
    outputSchema: {
      type: "object",
      required: ["answer", "executionStatus"],
      properties: {
        answer: { type: "string" },
        actionResult: { type: "object" },
        blockingQuestion: { type: "string" },
        executionStatus: { type: "string" }
      }
    },
    requiredPermission: "tickets:create",
    riskClass: CAPABILITY_RISK.lowWrite,
    confirmationPolicy: "no_confirmation_for_low_risk_unambiguous_create",
    idempotencyPolicy: "operation_actor_key_request_hash",
    auditBehavior: "normal_ticket_create_audit_plus_ai_metadata",
    authoritativeResult: "server_persisted_ticket_id_num_ticketNo",
    allowedErrors: ["blocked", "permission_denied", "idempotency_conflict", "create_failed"],
    retrySemantics: "safe_with_same_idempotency_key_and_same_request_hash",
    async execute(args = {}, executionContext = {}) {
      const user = cleanObject(executionContext.user);
      const context = cleanObject(executionContext.context);
      const text = cleanText(args.text || executionContext.text, 1200);
      const module = cleanText(executionContext.module, 80).toLowerCase();
      const now = Number.isFinite(Number(executionContext.now)) ? Number(executionContext.now) : Date.now();
      const rawContext = cleanObject(executionContext.rawContext);
      const previousIntake = normalizeInlineTicketIntakeSession(executionContext.intake || cleanObject(rawContext.taskSession).intake);
      const reads = createAiCapabilityRegistry(createTicketReadCapabilities());
      const toolResults = [];
      const executeRead = async (capability, readArgs = {}) => {
        const response = await reads.execute(capability, readArgs, executionContext);
        toolResults.push({ capability, ok: response.ok === true, result: response.result });
        return response.result;
      };
      await executeRead("get_current_user_context");

      if (!isTicketIntakeContext(executionContext)) {
        return normalizeAiCapabilityResponse({
          answer: "",
          unknowns: ["workflow"],
          toolResults,
          executionStatus: AI_CAPABILITY_EXECUTION_STATUS.featureDisabled
        });
      }

      if (!shouldAutonomousCreate(text, executionContext)) {
        return normalizeAiCapabilityResponse({
          answer: "",
          unknowns: ["intent"],
          toolResults,
          executionStatus: AI_CAPABILITY_EXECUTION_STATUS.featureDisabled
        });
      }

      if (module && !["transport", "facility", "unknown"].includes(module)) {
        return normalizeAiCapabilityResponse({
          answer: "",
          unknowns: ["module"],
          toolResults,
          executionStatus: AI_CAPABILITY_EXECUTION_STATUS.featureDisabled
        });
      }

      if (!aiAutonomousTicketCreatePermitted(user)) {
        return createBlockingResponse({
          answer: "אין לך הרשאה לפתוח קריאה אוטונומית דרך AI.",
          question: "",
          unknowns: ["autonomy_permission"],
          toolResults,
          status: AI_CAPABILITY_EXECUTION_STATUS.permissionDenied
        });
      }

      await executeRead("get_ticket_create_contract");
      const plan = buildInlineTicketIntakePlan({
        text,
        latestText: executionContext.latestText || text,
        previousIntake,
        context,
        fullVisibleFleet: cleanArray(executionContext.fullVisibleFleet || executionContext.serverVisibleFleet),
        currentEntity: rawContext.currentEntity || rawContext.routeEntity || rawContext.currentAsset,
        config: cleanObject(executionContext.config),
        user,
        now,
        ticketId: `ticket-${randomUUID()}`
      });
      toolResults.push({
        capability: "resolve_inline_ticket_intake",
        ok: plan.status === "ready",
        result: {
          workflow: plan.workflow,
          domain: plan.domain,
          status: plan.status,
          pendingField: plan.pendingField,
          missingFields: plan.missingFields,
          facts: plan.facts
        }
      });
      if (plan.domain === "transport" && plan.ticket?.forkliftId && RECURRENCE_RE.test(text)) {
        await executeRead("get_open_tickets_for_asset", { assetId: plan.ticket.forkliftId });
      }

      if (!plan.ticket) {
        return createBlockingResponse({
          question: plan.question,
          facts: plan.facts,
          unknowns: plan.unknowns,
          toolResults,
          intake: {
            intakeId: "create_ticket",
            workflow: plan.workflow,
            domain: plan.domain,
            status: plan.status,
            pendingField: plan.pendingField,
            originalMessage: plan.originalMessage,
            draft: plan.draft
          }
        });
      }

      if (plan.domain === "transport" && DANGEROUS_RE.test(text)) {
        return createBlockingResponse({
          question: "זה נשמע כמו תקלה שעלולה להשפיע על בטיחות או השבתה. האם הכלי מושבת ואין להשתמש בו?",
          facts: plan.facts,
          unknowns: ["safe_downtime_state"],
          toolResults,
          intake: {
            intakeId: "create_ticket",
            workflow: plan.workflow,
            domain: plan.domain,
            status: plan.status,
            pendingField: "",
            originalMessage: plan.originalMessage,
            draft: plan.draft
          }
        });
      }

      if (!driver) {
        return createBlockingResponse({
          answer: "יצירת הקריאה אינה זמינה כרגע.",
          question: "",
          unknowns: ["tickets_backend"],
          toolResults,
          status: AI_CAPABILITY_EXECUTION_STATUS.failed
        });
      }

      const ticket = plan.ticket;
      const idempotencyKey = cleanText(args.idempotencyKey || executionContext.idempotencyKey, 200);
      const guardError = typeof executionContext.inlineTicketCreateGuard?.check === "function"
        ? cleanText(executionContext.inlineTicketCreateGuard.check({ domain: plan.domain, idempotencyKey }), 120)
        : "";
      if (guardError) {
        return createBlockingResponse({
          answer: "נוצרה קריאה ממש עכשיו. המתינו רגע לפני פתיחת קריאה נוספת.",
          question: "",
          facts: plan.facts,
          unknowns: [guardError],
          toolResults,
          status: AI_CAPABILITY_EXECUTION_STATUS.blocked,
          intake: {
            intakeId: "create_ticket",
            workflow: plan.workflow,
            domain: plan.domain,
            status: plan.status,
            pendingField: "",
            originalMessage: plan.originalMessage,
            draft: plan.draft
          }
        });
      }
      try {
        const created = await createTicketRecord({
          driver,
          ticket,
          actor: user,
          idempotencyKey
        });
        if (typeof executionContext.inlineTicketCreateGuard?.record === "function"
          && ["created", "replayed"].includes(cleanText(created.result?.idempotencyStatus, 40))) {
          executionContext.inlineTicketCreateGuard.record({ domain: plan.domain, idempotencyKey });
        }
        const ticketNo = cleanText(created.result.ticketNumber || created.result.ticketNo, 60);
        const answer = created.result.idempotencyStatus === "replayed"
          ? `כבר נוצרה קריאה ${ticketNo}`
          : createdInlineTicketAnswer(ticket, created.result);
        return normalizeAiCapabilityResponse({
          answer,
          facts: plan.facts,
          unknowns: [],
          toolResults,
          actionResult: {
            ...created.result,
            track: ticket.track,
            subject: ticket.subject,
            description: ticket.description,
            asset: ticket.asset,
            forkliftId: ticket.forkliftId,
            zone: ticket.zone,
            category: ticket.category,
            categoryLabel: ticket.categoryLabel,
            domain: plan.domain
          },
          intake: {
            intakeId: "create_ticket",
            workflow: plan.workflow,
            domain: plan.domain,
            status: AI_CAPABILITY_EXECUTION_STATUS.created,
            pendingField: "",
            originalMessage: plan.originalMessage,
            draft: plan.draft
          },
          blockingQuestion: "",
          requiresConfirmation: false,
          executionStatus: created.result.idempotencyStatus === "replayed"
            ? AI_CAPABILITY_EXECUTION_STATUS.replayed
            : AI_CAPABILITY_EXECUTION_STATUS.created
        });
      } catch (error) {
        if (error?.message === "idempotency_conflict") {
          return createBlockingResponse({
            answer: "הבקשה לא בוצעה כי אותו מפתח פעולה שימש לפרטים אחרים.",
            question: "",
            unknowns: ["idempotency_conflict"],
            toolResults,
            status: AI_CAPABILITY_EXECUTION_STATUS.failed
          });
        }
        return createBlockingResponse({
          answer: "לא הצלחתי ליצור את הקריאה. נסו שוב או פתחו קריאה ידנית.",
          question: "",
          unknowns: ["create_failed"],
          toolResults,
          status: AI_CAPABILITY_EXECUTION_STATUS.failed
        });
      }
    }
  };
}
