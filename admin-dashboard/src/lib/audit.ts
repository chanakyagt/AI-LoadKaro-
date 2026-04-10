import { createServiceRoleClient, hasServiceRoleKey } from "@/lib/supabase/service-role";

export type AuditAction =
  | "update_record"
  | "delete_record"
  | "verify_user"
  | "reject_user"
  | "verify_truck"
  | "reject_truck"
  | "mark_alert_handled"
  | "close_record"
  | "create_moderator"
  | "review_verification";

type AuditEntry = {
  actorId: string | null;
  actorRole: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown>;
};

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  if (!hasServiceRoleKey()) return;
  try {
    const supabase = createServiceRoleClient();
    await supabase.from("audit_log").insert({
      actor_id: entry.actorId,
      actor_role: entry.actorRole,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      details: entry.details ?? {},
    });
  } catch (e) {
    console.warn("[audit] failed to write log:", e);
  }
}
