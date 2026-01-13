import db from '@/lib/db';
import { auditLogs, AuditEventType } from '@/lib/db/schema';

export interface AuditLogParams {
  eventType: AuditEventType;
  userId?: string | null;
  targetUserId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  details?: Record<string, unknown>;
}

/**
 * Log an audit event to the database.
 * This is fire-and-forget - failures are logged but don't throw.
 */
export async function logAuditEvent(params: AuditLogParams): Promise<void> {
  try {
    db.insert(auditLogs)
      .values({
        eventType: params.eventType,
        userId: params.userId || null,
        targetUserId: params.targetUserId || null,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
        details: params.details || null,
        createdAt: new Date().toISOString(),
      })
      .run();
  } catch (error) {
    // Don't throw - audit logging should never break the main flow
    console.error('[Audit] Failed to log event:', params.eventType, error);
  }
}

/**
 * Helper to extract request metadata for audit logging.
 */
export function getAuditMetadata(headers: Headers): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  const forwarded = headers.get('x-forwarded-for');
  const ipAddress = forwarded
    ? forwarded.split(',')[0].trim()
    : headers.get('x-real-ip');

  return {
    ipAddress,
    userAgent: headers.get('user-agent'),
  };
}

// Convenience functions for common events

export function logLoginSuccess(
  userId: string,
  email: string,
  headers: Headers,
): void {
  const meta = getAuditMetadata(headers);
  logAuditEvent({
    eventType: 'login_success',
    userId,
    ...meta,
    details: { email },
  });
}

export function logLoginFailure(
  email: string,
  reason: string,
  headers: Headers,
): void {
  const meta = getAuditMetadata(headers);
  logAuditEvent({
    eventType: 'login_failure',
    ...meta,
    details: { email, reason },
  });
}

export function logLogout(userId: string, headers: Headers): void {
  const meta = getAuditMetadata(headers);
  logAuditEvent({
    eventType: 'logout',
    userId,
    ...meta,
  });
}

export function logRegistration(
  userId: string,
  email: string,
  role: string,
  headers: Headers,
): void {
  const meta = getAuditMetadata(headers);
  logAuditEvent({
    eventType: 'register',
    userId,
    ...meta,
    details: { email, role },
  });
}

export function logRoleChange(
  adminUserId: string,
  targetUserId: string,
  oldRole: string,
  newRole: string,
  headers: Headers,
): void {
  const meta = getAuditMetadata(headers);
  logAuditEvent({
    eventType: 'role_change',
    userId: adminUserId,
    targetUserId,
    ...meta,
    details: { oldRole, newRole },
  });
}

export function logUserDelete(
  adminUserId: string,
  targetUserId: string,
  targetEmail: string,
  headers: Headers,
): void {
  const meta = getAuditMetadata(headers);
  logAuditEvent({
    eventType: 'user_delete',
    userId: adminUserId,
    targetUserId,
    ...meta,
    details: { targetEmail },
  });
}
