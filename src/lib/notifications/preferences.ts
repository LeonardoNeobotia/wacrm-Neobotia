/**
 * Utilidades y valores por defecto para las preferencias de notificaciones por correo.
 */

import type { NotificationPreferences } from '@/types';

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
	email_chat_invite: true,
	email_new_contact: true,
	email_web_lead: true,
	email_task_assigned: true,
};

/**
 * Normaliza y combina un objeto crudo de preferencias asegurando valores booleanos y valores por defecto.
 */
export function parseNotificationPreferences(
	raw?: unknown,
): NotificationPreferences {
	if (!raw || typeof raw !== 'object') {
		return { ...DEFAULT_NOTIFICATION_PREFERENCES };
	}

	const obj = raw as Record<string, unknown>;

	return {
		email_chat_invite:
			typeof obj.email_chat_invite === 'boolean'
				? obj.email_chat_invite
				: DEFAULT_NOTIFICATION_PREFERENCES.email_chat_invite,
		email_new_contact:
			typeof obj.email_new_contact === 'boolean'
				? obj.email_new_contact
				: DEFAULT_NOTIFICATION_PREFERENCES.email_new_contact,
		email_web_lead:
			typeof obj.email_web_lead === 'boolean'
				? obj.email_web_lead
				: DEFAULT_NOTIFICATION_PREFERENCES.email_web_lead,
		email_task_assigned:
			typeof obj.email_task_assigned === 'boolean'
				? obj.email_task_assigned
				: DEFAULT_NOTIFICATION_PREFERENCES.email_task_assigned,
	};
}

