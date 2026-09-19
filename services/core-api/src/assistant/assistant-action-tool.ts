/**
 * Phase 9 — a real NEXORA business action, callable through the
 * propose -> approve -> execute state machine in AssistantActionsService.
 * `requiredPermission` is the enforcement point for this repo's own
 * design constraint (see README): whoever proposes, approves, or executes
 * a call to this tool must hold this exact permission on their own JWT —
 * the same permission the equivalent direct endpoint already requires.
 * No AI decides to invoke this automatically yet (no real reasoning model
 * exists to make that call) — every stage is a separate, explicit, human-
 * authenticated request, same reasoning as SAPOK AI's own action registry.
 */
export interface AssistantActionTool {
  name: string;
  description: string;
  requiredPermission: string;
  execute(organisationId: string, actorId: string, args: Record<string, unknown>): Promise<unknown>;
}
