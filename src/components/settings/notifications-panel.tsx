'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
	Bell,
	FileText,
	Loader2,
	Lock,
	Mail,
	MessageCircle,
	MessageSquare,
	Play,
	ShieldCheck,
	UserPlus,
	Volume2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SettingsPanelHead } from './settings-panel-head';
import {
	DEFAULT_NOTIFICATION_PREFERENCES,
	parseNotificationPreferences,
} from '@/lib/notifications/preferences';
import {
	playInternalChatSound,
	playInboxSound,
	setInternalChatSoundEnabled,
	setInboxSoundEnabled,
} from '@/lib/sound/notification';
import type { NotificationPreferences } from '@/types';

export function NotificationsPanel() {
	const t = useTranslations('Settings.notifications');
	const [loading, setLoading] = useState(true);
	const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
	const [updatingKey, setUpdatingKey] = useState<keyof NotificationPreferences | null>(null);

	// Cargar preferencias iniciales del usuario
	useEffect(() => {
		let isMounted = true;

		async function loadPreferences() {
			try {
				setLoading(true);
				const res = await fetch('/api/account/notifications');
				if (!res.ok) {
					throw new Error('Failed to load notification preferences');
				}
				const data = await res.json();
				if (isMounted && data.preferences) {
					const parsed = parseNotificationPreferences(data.preferences);
					setPrefs(parsed);
					if (typeof parsed.sound_internal_chat === 'boolean') {
						setInternalChatSoundEnabled(parsed.sound_internal_chat);
					}
					if (typeof parsed.sound_inbox === 'boolean') {
						setInboxSoundEnabled(parsed.sound_inbox);
					}
				}
			} catch (err) {
				console.error('[NotificationsPanel] Error al cargar preferencias:', err);
				toast.error(t('loadError'));
			} finally {
				if (isMounted) {
					setLoading(false);
				}
			}
		}

		loadPreferences();

		return () => {
			isMounted = false;
		};
	}, [t]);

	// Manejar alternancia de switches con actualización optimista y sincronización de audio
	async function handleToggle(key: keyof NotificationPreferences, value: boolean) {
		const previousValue = prefs[key];
		// Actualización optimista inmediata en la UI y sincronización síncrona de audio
		setPrefs((prev) => ({ ...prev, [key]: value }));
		setUpdatingKey(key);

		if (key === 'sound_internal_chat') {
			setInternalChatSoundEnabled(value);
		} else if (key === 'sound_inbox') {
			setInboxSoundEnabled(value);
		}

		try {
			const res = await fetch('/api/account/notifications', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ [key]: value }),
			});

			const data = await res.json();
			if (!res.ok) {
				throw new Error(data?.error || t('saveError'));
			}

			if (data.preferences) {
				const parsed = parseNotificationPreferences(data.preferences);
				setPrefs(parsed);
				if (typeof parsed.sound_internal_chat === 'boolean') {
					setInternalChatSoundEnabled(parsed.sound_internal_chat);
				}
				if (typeof parsed.sound_inbox === 'boolean') {
					setInboxSoundEnabled(parsed.sound_inbox);
				}
			}
			toast.success(t('saveSuccess'));
		} catch (err) {
			console.error('[NotificationsPanel] Error al guardar preferencia:', err);
			// Rollback del valor previo en caso de fallo
			setPrefs((prev) => ({ ...prev, [key]: previousValue }));
			if (key === 'sound_internal_chat' && typeof previousValue === 'boolean') {
				setInternalChatSoundEnabled(previousValue);
			} else if (key === 'sound_inbox' && typeof previousValue === 'boolean') {
				setInboxSoundEnabled(previousValue);
			}
			toast.error(err instanceof Error ? err.message : t('saveError'));
		} finally {
			setUpdatingKey(null);
		}
	}

	if (loading) {
		return (
			<section className="max-w-3xl animate-in fade-in-50 duration-200">
				<SettingsPanelHead
					title={t('title')}
					description={t('description')}
				/>
				<div className="flex items-center justify-center py-16">
					<Loader2 className="size-6 animate-spin text-primary" />
				</div>
			</section>
		);
	}

	return (
		<section className="max-w-3xl animate-in fade-in-50 space-y-6 duration-200">
			<SettingsPanelHead
				title={t('title')}
				description={t('description')}
			/>

			{/* Grupo 1: Sonido de notificaciones */}
			<Card className="border-border bg-card">
				<CardHeader className="pb-4">
					<div className="flex items-center gap-2">
						<Volume2 className="size-4 text-primary" />
						<CardTitle className="text-base font-semibold text-foreground">
							{t('soundSectionTitle')}
						</CardTitle>
					</div>
					<CardDescription className="text-xs text-muted-foreground">
						{t('soundSectionDesc')}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4 divide-y divide-border/60 pt-0">
					{/* 1. Sonido para Chat interno */}
					<div className="flex items-start justify-between gap-4 pt-4 first:pt-0">
						<div className="flex items-start gap-3">
							<div className="mt-0.5 rounded-md bg-emerald-500/10 p-2 text-emerald-500">
								<MessageSquare className="size-4" />
							</div>
							<div className="space-y-1">
								<div className="text-sm font-medium text-foreground">
									{t('soundInternalChatTitle')}
								</div>
								<p className="text-xs text-muted-foreground leading-relaxed">
									{t('soundInternalChatDesc')}
								</p>
							</div>
						</div>
						<div className="flex items-center gap-2 pt-1">
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => playInternalChatSound()}
								className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
								title={t('soundPreview')}
							>
								<Play className="size-3 mr-1.5 fill-current" />
								<span>{t('soundPreview')}</span>
							</Button>
							{updatingKey === 'sound_internal_chat' && (
								<Loader2 className="size-3.5 animate-spin text-muted-foreground" />
							)}
							<Switch
								checked={prefs.sound_internal_chat ?? true}
								onCheckedChange={(checked) => handleToggle('sound_internal_chat', checked)}
								disabled={updatingKey === 'sound_internal_chat'}
								aria-label={t('soundInternalChatTitle')}
							/>
						</div>
					</div>

					{/* 2. Sonido para Bandeja de entrada (WhatsApp) */}
					<div className="flex items-start justify-between gap-4 pt-4">
						<div className="flex items-start gap-3">
							<div className="mt-0.5 rounded-md bg-green-500/10 p-2 text-green-500">
								<MessageCircle className="size-4" />
							</div>
							<div className="space-y-1">
								<div className="text-sm font-medium text-foreground">
									{t('soundInboxTitle')}
								</div>
								<p className="text-xs text-muted-foreground leading-relaxed">
									{t('soundInboxDesc')}
								</p>
							</div>
						</div>
						<div className="flex items-center gap-2 pt-1">
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => playInboxSound()}
								className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
								title={t('soundPreview')}
							>
								<Play className="size-3 mr-1.5 fill-current" />
								<span>{t('soundPreview')}</span>
							</Button>
							{updatingKey === 'sound_inbox' && (
								<Loader2 className="size-3.5 animate-spin text-muted-foreground" />
							)}
							<Switch
								checked={prefs.sound_inbox ?? true}
								onCheckedChange={(checked) => handleToggle('sound_inbox', checked)}
								disabled={updatingKey === 'sound_inbox'}
								aria-label={t('soundInboxTitle')}
							/>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Grupo 2: Notificaciones de flujo de trabajo por correo */}
			<Card className="border-border bg-card">
				<CardHeader className="pb-4">
					<div className="flex items-center gap-2">
						<Mail className="size-4 text-primary" />
						<CardTitle className="text-base font-semibold text-foreground">
							{t('emailSectionTitle')}
						</CardTitle>
					</div>
					<CardDescription className="text-xs text-muted-foreground">
						{t('emailSectionDesc')}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4 divide-y divide-border/60 pt-0">
					{/* 1. Invitación a chat interno */}
					<div className="flex items-start justify-between gap-4 pt-4 first:pt-0">
						<div className="flex items-start gap-3">
							<div className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary">
								<MessageSquare className="size-4" />
							</div>
							<div className="space-y-1">
								<div className="text-sm font-medium text-foreground">
									{t('chatInviteTitle')}
								</div>
								<p className="text-xs text-muted-foreground leading-relaxed">
									{t('chatInviteDesc')}
								</p>
							</div>
						</div>
						<div className="flex items-center gap-2 pt-1">
							{updatingKey === 'email_chat_invite' && (
								<Loader2 className="size-3.5 animate-spin text-muted-foreground" />
							)}
							<Switch
								checked={prefs.email_chat_invite}
								onCheckedChange={(checked) => handleToggle('email_chat_invite', checked)}
								disabled={updatingKey === 'email_chat_invite'}
								aria-label={t('chatInviteTitle')}
							/>
						</div>
					</div>

					{/* 2. Contacto nuevo en bandeja de entrada */}
					<div className="flex items-start justify-between gap-4 pt-4">
						<div className="flex items-start gap-3">
							<div className="mt-0.5 rounded-md bg-blue-500/10 p-2 text-blue-500">
								<UserPlus className="size-4" />
							</div>
							<div className="space-y-1">
								<div className="text-sm font-medium text-foreground">
									{t('newContactTitle')}
								</div>
								<p className="text-xs text-muted-foreground leading-relaxed">
									{t('newContactDesc')}
								</p>
							</div>
						</div>
						<div className="flex items-center gap-2 pt-1">
							{updatingKey === 'email_new_contact' && (
								<Loader2 className="size-3.5 animate-spin text-muted-foreground" />
							)}
							<Switch
								checked={prefs.email_new_contact}
								onCheckedChange={(checked) => handleToggle('email_new_contact', checked)}
								disabled={updatingKey === 'email_new_contact'}
								aria-label={t('newContactTitle')}
							/>
						</div>
					</div>

					{/* 3. Formulario rellenado (crea negocio y contacto) */}
					<div className="flex items-start justify-between gap-4 pt-4">
						<div className="flex items-start gap-3">
							<div className="mt-0.5 rounded-md bg-purple-500/10 p-2 text-purple-400">
								<FileText className="size-4" />
							</div>
							<div className="space-y-1">
								<div className="text-sm font-medium text-foreground">
									{t('webLeadTitle')}
								</div>
								<p className="text-xs text-muted-foreground leading-relaxed">
									{t('webLeadDesc')}
								</p>
							</div>
						</div>
						<div className="flex items-center gap-2 pt-1">
							{updatingKey === 'email_web_lead' && (
								<Loader2 className="size-3.5 animate-spin text-muted-foreground" />
							)}
							<Switch
								checked={prefs.email_web_lead}
								onCheckedChange={(checked) => handleToggle('email_web_lead', checked)}
								disabled={updatingKey === 'email_web_lead'}
								aria-label={t('webLeadTitle')}
							/>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Grupo 2: Notificaciones obligatorias de seguridad */}
			<Card className="border-border bg-card">
				<CardHeader className="pb-4">
					<div className="flex items-center gap-2">
						<ShieldCheck className="size-4 text-emerald-500" />
						<CardTitle className="text-base font-semibold text-foreground">
							{t('securitySectionTitle')}
						</CardTitle>
					</div>
					<CardDescription className="text-xs text-muted-foreground">
						{t('securitySectionDesc')}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4 pt-0">
					<div className="flex items-start justify-between gap-4">
						<div className="flex items-start gap-3">
							<div className="mt-0.5 rounded-md bg-emerald-500/10 p-2 text-emerald-500">
								<Lock className="size-4" />
							</div>
							<div className="space-y-1">
								<div className="flex items-center gap-2">
									<span className="text-sm font-medium text-foreground">
										{t('authEmailsTitle')}
									</span>
									<Badge variant="outline" className="text-[10px] font-semibold tracking-wide text-emerald-500 border-emerald-500/30 bg-emerald-500/10">
										{t('mandatoryBadge')}
									</Badge>
								</div>
								<p className="text-xs text-muted-foreground leading-relaxed">
									{t('authEmailsDesc')}
								</p>
							</div>
						</div>
						<div className="pt-1">
							<Switch
								checked={true}
								disabled={true}
								aria-label={t('authEmailsTitle')}
								className="opacity-75 cursor-not-allowed"
							/>
						</div>
					</div>
				</CardContent>
			</Card>
		</section>
	);
}

