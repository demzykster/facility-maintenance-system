import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { canExecuteAiAssistAction } from "./aiAssistActionExecutionModel.js";
import { AI_ASSIST_WORKFLOWS } from "./aiAssistWorkflowModel.js";
import {
  beginAiAgentAction,
  beginAiAgentSend,
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
  const stateRef = useRef(state);

  const setAgentState = useCallback((next) => {
    stateRef.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

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

  const send = useCallback(async (text, workflow = AI_ASSIST_WORKFLOWS.general) => {
    const { state: sendingState, request } = beginAiAgentSend(stateRef.current, { text, workflow, context: contextPreview });
    if (!request) return;
    setAgentState(sendingState);
    try {
      const out = callAssistant
        ? await callAssistant(request)
        : await callModel(request.messages, request.system, 900);
      setAgentState(completeAiAgentSend(stateRef.current, out));
    } catch (error) {
      setAgentState(failAiAgentSend(stateRef.current, error));
    }
  }, [callAssistant, callModel, contextPreview, setAgentState]);

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
    memoryFacts,
    memoryError,
    setInput: (input) => setAgentState({ ...stateRef.current, input }),
    setInputWorkflow: (inputWorkflow) => setAgentState({ ...stateRef.current, inputWorkflow }),
    send,
    runAction,
    editMemoryFact,
    forgetMemoryFact,
    refreshMemory
  };
}
