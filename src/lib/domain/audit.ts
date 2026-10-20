import type { DB } from "@/lib/db";
import { newId, nowIso } from "@/lib/db";
import type { AuditEntry } from "./types";

export interface Actor {
  id: string;
  name: string;
}

export interface AuditInput {
  actor: Actor | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  merchantId?: string | null;
  summary: string;
  reason?: string | null;
  before?: unknown;
  after?: unknown;
  createdAt?: string;
}

export function writeAudit(db: DB, input: AuditInput) {
  db.prepare(
    `INSERT INTO audit_log (id, actor_id, actor_name, action, entity_type, entity_id, merchant_id, summary, reason, before_json, after_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    newId("au"),
    input.actor?.id ?? null,
    input.actor?.name ?? null,
    input.action,
    input.entityType,
    input.entityId ?? null,
    input.merchantId ?? null,
    input.summary,
    input.reason ?? null,
    input.before === undefined ? null : JSON.stringify(input.before),
    input.after === undefined ? null : JSON.stringify(input.after),
    input.createdAt ?? nowIso(),
  );
}

type AuditRow = {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  merchant_id: string | null;
  summary: string;
  reason: string | null;
  before_json: string | null;
  after_json: string | null;
  created_at: string;
};

function mapAudit(row: AuditRow): AuditEntry {
  return {
    id: row.id,
    actorId: row.actor_id,
    actorName: row.actor_name,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    merchantId: row.merchant_id,
    summary: row.summary,
    reason: row.reason,
    before: row.before_json ? JSON.parse(row.before_json) : null,
    after: row.after_json ? JSON.parse(row.after_json) : null,
    createdAt: row.created_at,
  };
}

export function listAudit(db: DB, filter: { merchantId?: string; entityType?: string; limit?: number } = {}) {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter.merchantId) {
    clauses.push("merchant_id = ?");
    params.push(filter.merchantId);
  }
  if (filter.entityType) {
    clauses.push("entity_type = ?");
    params.push(filter.entityType);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db
    .prepare(`SELECT * FROM audit_log ${where} ORDER BY created_at DESC, rowid DESC LIMIT ?`)
    .all(...params, filter.limit ?? 200) as AuditRow[];
  return rows.map(mapAudit);
}
