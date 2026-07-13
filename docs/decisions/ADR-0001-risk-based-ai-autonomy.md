# ADR-0001: Risk-Based AI Autonomy

- Status: Accepted
- Date: 2026-07-14

## Context

The current AI implementation produces deterministic proposals, asks for human confirmation, and then executes through normal save paths. Older docs can be read as requiring confirmation for every AI write forever, but the owner clarified that this is current implementation state, not the target product policy.

## Decision

AI action autonomy is risk-based:

- read actions may execute immediately within the user's permissions;
- ordinary low-risk creates and reversible single-record updates may execute immediately only after the domain command has validation, authorization, audit, idempotency, and an authoritative result;
- ambiguity triggers one blocking question;
- sensitive, mass, irreversible, delete, permission-expanding, or hidden-scope actions require explicit confirmation;
- prohibited actions do not execute;
- AI never receives arbitrary SQL or direct service-role access.

## Consequences

- Current human-confirmed proposals remain valid implementation.
- Future AI slices must state the risk class before changing confirmation behavior.
- Provider-native tools may help with planning/extraction, but business mutation still goes through CMMS commands.

## Superseded Decisions

- Any reading of "all AI write actions always require confirmation" as permanent product policy.

## Open Questions

- Which first domain command is safe enough for immediate low-risk AI execution.
- How to present authoritative action results across roles and devices.

