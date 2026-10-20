export type DomainErrorCode =
  | "not_found"
  | "forbidden"
  | "unauthenticated"
  | "invalid_amount"
  | "invalid_input"
  | "reason_required"
  | "insufficient_points"
  | "insufficient_pending"
  | "invalid_refund"
  | "idempotency_conflict"
  | "reward_unavailable"
  | "out_of_stock"
  | "tier_locked"
  | "limit_reached"
  | "invalid_transition"
  | "duplicate";

/** An expected business-rule failure whose message is safe to show to users. */
export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; code: DomainErrorCode | "unexpected"; error: string; fieldErrors?: Record<string, string> };

export function toActionError(error: unknown): Extract<ActionResult, { ok: false }> {
  if (error instanceof DomainError) return { ok: false, code: error.code, error: error.message };
  console.error(error);
  return { ok: false, code: "unexpected", error: "Something went wrong on our side. Please try again." };
}
