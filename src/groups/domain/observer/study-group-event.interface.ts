/**
 * Event types for study group notifications.
 * Used in the Observer pattern to notify users of group-related events.
 */
export type StudyGroupEventType =
  | 'JOIN_REQUEST'
  | 'MEMBER_ACCEPTED'
  | 'MEMBER_REJECTED'
  | 'ADMIN_TRANSFER_REQUESTED'
  | 'ADMIN_TRANSFER_ACCEPTED';

/**
 * Study group event structure for Observer pattern.
 * Contains event type, payload, target user, and timestamp.
 */
export interface StudyGroupEvent {
  /**
   * Type of event that occurred
   */
  type: StudyGroupEventType;

  /**
   * Event-specific payload data
   */
  payload: Record<string, unknown>;

  /**
   * ID of the user who should receive this notification
   */
  targetUserId: number;

  /**
   * Timestamp when the event was created
   */
  timestamp: Date;
}
