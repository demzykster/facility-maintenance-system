import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { canExecuteAiAssistAction } from "./aiAssistActionExecutionModel.js";
import { AI_ASSIST_WORKFLOWS } from "./aiAssistWorkflowModel.js";
import {
  beginAiAgentAction,
  beginAiAgentSend,
  aiConversationMessagesToPanelMessages,
  completeAiAgentAction,
  completeAiAgentSend,
  createAiAgentInitialState,
  failAiAgentAction,
  failAiAgentSend
} from "./aiAgentSessionController.js";

export function useAIAgentSession({
  session,
  tickets,
  pm,
  fleet,
  users = [],
  tasks = [],
  meetings = [],
  ppeItems = [],
  ppeReqs = [],
  zones = [],
  config,
  visibleTickets,
  buildContext,
  callModel,
  callAssistant,
  executeAction,
  loadConversationAccess,
  loadConversations,
  createConversation,
  openConversation,
  archiveConversation,
  loadMemoryFacts,
  updateMemoryFact,
  deactivateMemoryFact,
  initialText = "",
  initialWorkflow = AI_ASSIST_WORKFLOWS.general
} = {}) {
  const scopedTickets = useMemo(() => visibleTickets(session, tickets, fleet), [session, tickets, fleet, visibleTickets]);
  const contextPreview = useMemo(
    () => buildContext(session, scopedTickets, pm, fleet, config, tasks, meetings, users, ppeItems, ppeReqs, zones),
    [session, scopedTickets, pm, fleet, config, tasks, meetings, users, ppeItems, ppeReqs, zones, buildContext]
  );
  const [state, setState] = useState(() => createAiAgentInitialState({ session, initialText, initialWorkflow }));
  const [memoryFacts, setMemoryFacts] = useState([]);
  const [memoryError, setMemoryError] = useState("");
  const [conversations, setConversations] = useState([]);
  const [conversationAccess, setConversationAccess] = useState(() => (typeof loadConversationAccess === "function" ? false : true));
  const [conversationId, setConversationId] = useState("");
  const [conversationError, setConversationError] = useState("");
  const [conversationLoading, setConversationLoading] = useState(false);
  const stateRef = useRef(state);
  const conversationIdRef = useRef("");
  const didAutoOpenConversationRef = useRef(false);

  const setAgentState = useCallback((next) => {
    stateRef.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    if (!initialText) return;
    setAgentState({
      ...stateRef.current,
      input: initialText,
      inputWorkflow: initialWorkflow || AI_ASSIST_WORKFLOWS.general
    });
  }, [initialText, initialWorkflow, setAgentState]);

  const refreshMemory = useCallback(async () => {
    if (typeof loadMemoryFacts !== "function") return;
    try {
      const facts = await loadMemoryFacts();
      setMemoryFacts(Array.isArray(facts) ? facts : []);
      setMemoryError("");
    } catch (error) {
      setMemoryError(error?.message || "memory_unavailable");
    }
  }, [loadMemoryFacts]);

  useEffect(() => {
    refreshMemory();
  }, [refreshMemory]);

  const refreshConversationAccess = useCallback(async () => {
    if (typeof loadConversationAccess !== "function") return true;
    try {
      const access = await loadConversationAccess();
      const effective = access?.effectiveAccess === true;
      setConversationAccess(effective);
      if (!effective) {
        setConversations([]);
        setConversationId("");
      }
      return effective;
    } catch {
      setConversationAccess(false);
      setConversations([]);
      setConversationId("");
      return false;
    }
  }, [loadConversationAccess]);

  const loadConversationById = useCallback(async (id) => {
    if (!conversationAccess || typeof openConversation !== "function" || !id) return null;
    setConversationLoading(true);
    try {
      const result = await openConversation(id);
      if (!result?.conversation?.id) return null;
      setConversationId(result.conversation.id);
      setAgentState({
        ...stateRef.current,
        msgs: aiConversationMessagesToPanelMessages(result.messages, { session }),
        busy: false
      });
      setConversationError("");
      return result;
    } catch (error) {
      setConversationError(error?.message || "conversation_unavailable");
      return null;
    } finally {
      setConversationLoading(false);
    }
  }, [conversationAccess, openConversation, session, setAgentState]);

  const refreshConversations = useCallback(async () => {
    if (!conversationAccess || typeof loadConversations !== "function") return [];
    try {
      const list = await loadConversations();
      const safeList = Array.isArray(list) ? list : [];
      setConversations(safeList);
      setConversationError("");
      return safeList;
    } catch (error) {
      setConversationError(error?.message || "conversation_unavailable");
      return [];
    }
  }, [conversationAccess, loadConversations]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const access = await refreshConversationAccess();
      if (!access) return;
      const list = await refreshConversations();
      if (cancelled || didAutoOpenConversationRef.current || !list.length) return;
      didAutoOpenConversationRef.current = true;
      await loadConversationById(list[0].id);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshConversationAccess, refreshConversations, loadConversationById]);

  const startNewConversation = useCallback(async () => {
    if (!conversationAccess || typeof createConversation !== "function") {
      setConversationId("");
      setAgentState(createAiAgentInitialState({ session }));
      return null;
    }
    setConversationLoading(true);
    try {
      const conversation = await createConversation({ title: "AI conversation" });
      setConversationId(conversation?.id || "");
      setAgentState(createAiAgentInitialState({ session }));
      if (conversation?.id) setConversations((items) => [conversation, ...items.filter((item) => item.id !== conversation.id)]);
      setConversationError("");
      return conversation || null;
    } catch (error) {
      setConversationError(error?.message || "conversation_unavailable");
      return null;
    } finally {
      setConversationLoading(false);
    }
  }, [conversationAccess, createConversation, session, setAgentState]);

  const ensureConversationForSend = useCallback(async (text) => {
    if (conversationIdRef.current) return conversationIdRef.current;
    if (!conversationAccess || typeof createConversation !== "function") return "";
    const conversation = await createConversation({ title: text || "AI conversation" });
    if (!conversation?.id) return "";
    setConversationId(conversation.id);
    setConversations((items) => [conversation, ...items.filter((item) => item.id !== conversation.id)]);
    return conversation.id;
  }, [conversationAccess, createConversation]);

  const archiveCurrentConversation = useCallback(async () => {
    const id = conversationIdRef.current;
    if (!conversationAccess || !id || typeof archiveConversation !== "function") return;
    setConversationLoading(true);
    try {
      await archiveConversation(id);
      setConversationId("");
      setAgentState(createAiAgentInitialState({ session }));
      await refreshConversations();
      setConversationError("");
    } catch (error) {
      setConversationError(error?.message || "conversation_unavailable");
    } finally {
      setConversationLoading(false);
    }
  }, [archiveConversation, conversationAccess, refreshConversations, session, setAgentState]);

  const send = useCallback(async (text, workflow = AI_ASSIST_WORKFLOWS.general) => {
    let effectiveConversationId = "";
    try {
      effectiveConversationId = await ensureConversationForSend(text ?? stateRef.current?.input);
    } catch (error) {
      setConversationError(error?.message || "conversation_unavailable");
      return;
    }
    const { state: sendingState, request } = beginAiAgentSend(stateRef.current, { text, workflow, context: contextPreview, conversationId: effectiveConversationId });
    if (!request) return;
    setAgentState(sendingState);
    try {
      const out = callAssistant
        ? await callAssistant(request)
        : await callModel(request.messages, request.system, 900);
      setAgentState(completeAiAgentSend(stateRef.current, out));
      if (out?.conversation?.id) {
        setConversationId(out.conversation.id);
        refreshConversations();
      }
    } catch (error) {
      setAgentState(failAiAgentSend(stateRef.current, error));
    }
  }, [callAssistant, callModel, contextPreview, ensureConversationForSend, refreshConversations, setAgentState]);

  const runAction = useCallback(async (action) => {
    if (!executeAction || !canExecuteAiAssistAction(action)) return;
    const { state: actionState, key } = beginAiAgentAction(stateRef.current, action);
    if (!key) return;
    setAgentState(actionState);
    try {
      const result = await executeAction(action);
      setAgentState(completeAiAgentAction(stateRef.current, key, result));
      if (action?.type === "memory.fact.create") await refreshMemory();
    } catch (error) {
      setAgentState(failAiAgentAction(stateRef.current, key, error));
    }
  }, [executeAction, refreshMemory, setAgentState]);

  const editMemoryFact = useCallback(async (fact, summary) => {
    if (typeof updateMemoryFact !== "function" || !fact?.id) return;
    const updated = await updateMemoryFact(fact.id, { ...fact, summary });
    setMemoryFacts((items) => items.map((item) => item.id === fact.id ? updated : item).filter(Boolean));
  }, [updateMemoryFact]);

  const forgetMemoryFact = useCallback(async (fact) => {
    if (typeof deactivateMemoryFact !== "function" || !fact?.id) return;
    await deactivateMemoryFact(fact.id);
    setMemoryFacts((items) => items.filter((item) => item.id !== fact.id));
  }, [deactivateMemoryFact]);

  return {
    ...state,
    contextPreview,
    conversations,
    conversationAccess,
    conversationId,
    conversationError,
    conversationLoading,
    memoryFacts,
    memoryError,
    setInput: (input) => setAgentState({ ...stateRef.current, input }),
    setInputWorkflow: (inputWorkflow) => setAgentState({ ...stateRef.current, inputWorkflow }),
    startNewConversation,
    openConversation: loadConversationById,
    archiveConversation: archiveCurrentConversation,
    refreshConversations,
    send,
    runAction,
    editMemoryFact,
    forgetMemoryFact,
    refreshMemory
  };
}
