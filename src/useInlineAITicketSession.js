import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { canExecuteAiAssistAction } from "./aiAssistActionExecutionModel.js";
import { createAiAssistIdempotencyKey } from "./aiAgentApiClient.js";
import {
  beginInlineAiTicketSend,
  completeInlineAiTicketSend,
  createInlineAiTicketInitialState,
  failInlineAiTicketSend,
  inlineAiTicketActionMode
} from "./inlineAiTicketCreateModel.js";

const cleanText = (value, limit = 240) => String(value || "")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, limit);

function ticketSummary(ticket = {}) {
  if (!ticket || typeof ticket !== "object") return null;
  return {
    id: cleanText(ticket.id, 160),
    ticketNo: cleanText(ticket.ticketNo || ticket.ticketNumber || ticket.number || (ticket.num ? `${ticket.track === "transport" ? "T" : "F"}-${String(ticket.num).padStart(3, "0")}` : ""), 80),
    num: ticket.num,
    track: cleanText(ticket.track, 40),
    asset: cleanText(ticket.asset || ticket.forkliftCode || ticket.forkliftId || ticket.zone, 160),
    zone: cleanText(ticket.zone, 160),
    category: cleanText(ticket.category, 80),
    categoryLabel: cleanText(ticket.categoryLabel, 120),
    subject: cleanText(ticket.subject || ticket.title, 160),
    description: cleanText(ticket.description || ticket.summary, 500),
    source: ticket.source || "server"
  };
}

export function useInlineAITicketSession({
  context,
  callAssistant,
  executeAction,
  readTicket,
  onOpenDraft,
  makeIdempotencyKey = createAiAssistIdempotencyKey,
  requestTimeoutMs = 25000
} = {}) {
  const [state, setState] = useState(() => createInlineAiTicketInitialState());
  const stateRef = useRef(state);
  const idempotencyKeyRef = useRef("");
  const abortRef = useRef(null);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const reset = useCallback(() => {
    requestSeqRef.current += 1;
    abortRef.current?.abort?.();
    abortRef.current = null;
    idempotencyKeyRef.current = "";
    setState(createInlineAiTicketInitialState());
  }, []);

  const ensureIdempotencyKey = useCallback(() => {
    if (!idempotencyKeyRef.current) idempotencyKeyRef.current = makeIdempotencyKey();
    return idempotencyKeyRef.current;
  }, [makeIdempotencyKey]);

  const setInput = useCallback((input) => {
    setState((current) => ({ ...current, input }));
  }, []);

  const hydrateCreatedTicket = useCallback(async (ticket) => {
    const summary = ticketSummary(ticket);
    if (!summary?.id) return null;
    let verified = summary;
    if (typeof readTicket === "function") {
      try {
        const fetched = await readTicket(summary.id);
        verified = ticketSummary(fetched?.ticket || fetched) || summary;
      } catch {
        verified = summary;
      }
    }
    setState((current) => ({ ...current, createdTicket: verified }));
    return verified;
  }, [readTicket]);

  const send = useCallback(async (text, options = {}) => {
    const { state: sendingState, request } = beginInlineAiTicketSend(stateRef.current, {
      text,
      context,
      idempotencyKey: ensureIdempotencyKey(),
      choiceToken: cleanText(options.choiceToken, 80)
    });
    if (!request) return null;
    stateRef.current = sendingState;
    setState(sendingState);
    const requestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = requestSeq;
    abortRef.current?.abort?.();
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    let timeout = null;
    abortRef.current = controller;
    if (controller && Number(requestTimeoutMs) > 0) {
      timeout = setTimeout(() => controller.abort(), Number(requestTimeoutMs));
    }
    try {
      const output = await callAssistant({ ...request, signal: controller?.signal || null, timeoutMs: requestTimeoutMs });
      if (requestSeqRef.current !== requestSeq) return null;
      const completed = completeInlineAiTicketSend(stateRef.current, output);
      stateRef.current = completed;
      setState(completed);
      if (completed.createdTicket?.id) await hydrateCreatedTicket(completed.createdTicket);
      return output;
    } catch (error) {
      if (requestSeqRef.current !== requestSeq) return null;
      const failed = failInlineAiTicketSend(stateRef.current, error);
      stateRef.current = failed;
      setState(failed);
      return null;
    } finally {
      if (timeout) clearTimeout(timeout);
      if (requestSeqRef.current === requestSeq) abortRef.current = null;
    }
  }, [callAssistant, context, ensureIdempotencyKey, hydrateCreatedTicket, requestTimeoutMs]);

  const choose = useCallback((choice = {}) => {
    const label = cleanText(choice.label || choice.value, 160);
    if (!label) return null;
    return send(label, { choiceToken: cleanText(choice.token, 80) });
  }, [send]);

  const runAction = useCallback(async (action) => {
    const mode = inlineAiTicketActionMode(action);
    if (mode === "form") {
      onOpenDraft?.(action);
      reset();
      return null;
    }
    if (!executeAction || !canExecuteAiAssistAction(action) || stateRef.current.actionBusy || stateRef.current.createdTicket) return null;
    const key = cleanText(action.id || action.type, 120);
    if (!key) return null;
    const actionState = {
      ...stateRef.current,
      actionBusy: key,
      actionResults: { ...(stateRef.current.actionResults || {}), [key]: null }
    };
    stateRef.current = actionState;
    setState(actionState);
    try {
      const result = await executeAction(action);
      const completed = {
        ...stateRef.current,
        actionBusy: "",
        actionResults: { ...(stateRef.current.actionResults || {}), [key]: { ok: true, message: result?.message || "הפעולה בוצעה." } }
      };
      stateRef.current = completed;
      setState(completed);
      if (result?.ticketId) await hydrateCreatedTicket({ id: result.ticketId, subject: action?.payload?.subject, track: action?.payload?.track, asset: action?.payload?.asset, description: action?.payload?.description });
      return result;
    } catch (error) {
      const failed = {
        ...stateRef.current,
        actionBusy: "",
        actionResults: { ...(stateRef.current.actionResults || {}), [key]: { ok: false, message: error?.message || "הפעולה לא הושלמה." } }
      };
      stateRef.current = failed;
      setState(failed);
      return null;
    }
  }, [executeAction, hydrateCreatedTicket, onOpenDraft, reset]);

  return useMemo(() => ({
    ...state,
    setInput,
    send,
    choose,
    runAction,
    reset
  }), [choose, reset, runAction, send, setInput, state]);
}
