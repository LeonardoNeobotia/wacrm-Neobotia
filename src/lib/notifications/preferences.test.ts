import { describe, expect, it } from 'vitest';
import {
	DEFAULT_NOTIFICATION_PREFERENCES,
	parseNotificationPreferences,
} from './preferences';

describe('Notification Preferences', () => {
	it('returns defaults when input is undefined or null', () => {
		expect(parseNotificationPreferences(undefined)).toEqual(
			DEFAULT_NOTIFICATION_PREFERENCES,
		);
		expect(parseNotificationPreferences(null)).toEqual(
			DEFAULT_NOTIFICATION_PREFERENCES,
		);
		expect(parseNotificationPreferences('invalid')).toEqual(
			DEFAULT_NOTIFICATION_PREFERENCES,
		);
	});

	it('returns defaults for missing keys', () => {
		const result = parseNotificationPreferences({});
		expect(result).toEqual({
			email_chat_invite: true,
			email_new_contact: true,
			email_web_lead: true,
			email_task_assigned: true,
		});
	});

	it('preserves false values correctly when disabled', () => {
		const result = parseNotificationPreferences({
			email_chat_invite: false,
			email_new_contact: false,
			email_web_lead: false,
			email_task_assigned: false,
		});
		expect(result).toEqual({
			email_chat_invite: false,
			email_new_contact: false,
			email_web_lead: false,
			email_task_assigned: false,
		});
	});

	it('merges partial overrides with defaults', () => {
		const result = parseNotificationPreferences({
			email_new_contact: false,
		});
		expect(result).toEqual({
			email_chat_invite: true,
			email_new_contact: false,
			email_web_lead: true,
			email_task_assigned: true,
		});
	});

	it('ignores non-boolean values and falls back to default', () => {
		const result = parseNotificationPreferences({
			email_chat_invite: 'false' as unknown as boolean,
			email_new_contact: 0 as unknown as boolean,
			email_web_lead: null as unknown as boolean,
		});
		expect(result).toEqual({
			email_chat_invite: true,
			email_new_contact: true,
			email_web_lead: true,
			email_task_assigned: true,
		});
	});
});

