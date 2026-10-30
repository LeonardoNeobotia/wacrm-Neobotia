// ============================================================
// /api/account/notifications
//
//   GET   — Obtener las preferencias de notificaciones del usuario actual.
//   PATCH — Actualizar las preferencias de notificaciones por correo.
// ============================================================

import { NextResponse } from 'next/server';
import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';
import {
	DEFAULT_NOTIFICATION_PREFERENCES,
	parseNotificationPreferences,
} from '@/lib/notifications/preferences';
import type { NotificationPreferences } from '@/types';

export async function GET() {
	try {
		const ctx = await getCurrentAccount();

		const { data, error } = await ctx.supabase
			.from('profiles')
			.select('notification_preferences')
			.eq('user_id', ctx.userId)
			.maybeSingle();

		if (error) {
			// Si la columna aun no ha sido creada via migracion, respondemos con los valores por defecto
			console.warn('[notifications] Error al consultar notification_preferences:', error.message);
			return NextResponse.json({
				preferences: DEFAULT_NOTIFICATION_PREFERENCES,
			});
		}

		const preferences = parseNotificationPreferences(data?.notification_preferences);

		return NextResponse.json({ preferences });
	} catch (err) {
		return toErrorResponse(err);
	}
}

export async function PATCH(request: Request) {
	try {
		const ctx = await getCurrentAccount();

		const body = (await request.json().catch(() => null)) as
			| Partial<NotificationPreferences>
			| null;

		if (!body || typeof body !== 'object') {
			return NextResponse.json(
				{ error: 'El cuerpo de la solicitud debe ser un objeto JSON válido' },
				{ status: 400 },
			);
		}

		// Obtener estado actual para realizar un merge seguro
		const { data: currentProfile } = await ctx.supabase
			.from('profiles')
			.select('notification_preferences')
			.eq('user_id', ctx.userId)
			.maybeSingle();

		const currentPrefs = parseNotificationPreferences(
			currentProfile?.notification_preferences,
		);

		const updatedPrefs: NotificationPreferences = {
			email_chat_invite:
				typeof body.email_chat_invite === 'boolean'
					? body.email_chat_invite
					: currentPrefs.email_chat_invite,
			email_new_contact:
				typeof body.email_new_contact === 'boolean'
					? body.email_new_contact
					: currentPrefs.email_new_contact,
			email_web_lead:
				typeof body.email_web_lead === 'boolean'
					? body.email_web_lead
					: currentPrefs.email_web_lead,
			email_task_assigned:
				typeof body.email_task_assigned === 'boolean'
					? body.email_task_assigned
					: currentPrefs.email_task_assigned,
			sound_internal_chat:
				typeof body.sound_internal_chat === 'boolean'
					? body.sound_internal_chat
					: currentPrefs.sound_internal_chat,
			sound_inbox:
				typeof body.sound_inbox === 'boolean'
					? body.sound_inbox
					: currentPrefs.sound_inbox,
		};

		const { error: updateError } = await ctx.supabase
			.from('profiles')
			.update({ notification_preferences: updatedPrefs })
			.eq('user_id', ctx.userId);

		if (updateError) {
			console.error('[notifications] Error al guardar notification_preferences:', updateError);
			return NextResponse.json(
				{ error: 'No se pudieron actualizar las preferencias de notificación en la base de datos' },
				{ status: 500 },
			);
		}

		return NextResponse.json({
			success: true,
			preferences: updatedPrefs,
		});
	} catch (err) {
		return toErrorResponse(err);
	}
}

