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
  initialText = "",
  initialWorkflow = AI_ASSIST_WORKFLOWS.general
} = {}) {
  const scopedTickets = useMemo(() => visibleTickets(session, tickets, fleet), [session, tickets, fleet, visibleTickets]);
  const contextPreview = useMemo(
    () => buildContext(session, scopedTickets, pm, fleet, config, tasks, meetings, users, ppeItems, ppeReqs, zones),
    [session, scopedTickets, pm, fleet, config, tasks, meetings, users, ppeItems, ppeReqs, zones, buildContext]
  );
  const [state, setState] = useState(() => createAiAgentInitialState({ session, initialText, initialWorkflow }));
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
    } catch (error) {
      setAgentState(failAiAgentAction(stateRef.current, key, error));
    }
  }, [executeAction, setAgentState]);

  return {
    ...state,
    contextPreview,
    setInput: (input) => setAgentState({ ...stateRef.current, input }),
    setInputWorkflow: (inputWorkflow) => setAgentState({ ...stateRef.current, inputWorkflow }),
    send,
    runAction
  };
}
