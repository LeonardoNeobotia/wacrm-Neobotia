import { Resend } from 'resend';

export interface SendEmailResult {
	success: boolean;
	messageId?: string;
	error?: string;
}

/**
 * Sanitiza cualquier valor de texto para prevenir inyecciones HTML y vulnerabilidades XSS en clientes de correo.
 */
export function escapeHtml(str: unknown): string {
	if (str === null || str === undefined) return '';
	return String(str)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/**
 * Sanitiza asuntos de correos eliminando saltos de linea y caracteres de control (prevencion de SMTP Header / CRLF Injection).
 */
export function sanitizeSubject(subject: string): string {
	return String(subject || '')
		.replace(/[\r\n\t]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 255);
}

/**
 * Sanitiza y valida una lista de correos electronicos, descartando entradas maliciosas o con formato invalido.
 */
export function sanitizeRecipients(to: string | string[]): string[] {
	const list = Array.isArray(to) ? to : [to];
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
	const clean = list
		.map((e) => String(e || '').trim())
		.filter((e) => e.length > 3 && e.length <= 254 && emailRegex.test(e));
	return Array.from(new Set(clean));
}

/**
 * Valida URLs de accion asegurando que solo usen rutas relativas seguras o protocolos http/https (bloquea javascript: y data:).
 */
export function sanitizeActionUrl(url?: string): string | undefined {
	if (!url) return undefined;
	const trimmed = url.trim();
	if (
		trimmed.startsWith('/') ||
		trimmed.startsWith('http://') ||
		trimmed.startsWith('https://')
	) {
		return trimmed;
	}
	return undefined;
}

/**
 * Obtiene la instancia del cliente de Resend de forma segura.
 */
function getResendClient(): Resend | null {
	const apiKey = process.env.RESEND_API_KEY;
	if (!apiKey) {
		return null;
	}
	return new Resend(apiKey);
}

/**
 * Obtiene el remitente por defecto configurado.
 * Neowapp CRM con fallback a onboarding@resend.dev para pruebas.
 */
export function getResendSender(): string {
	const name = process.env.RESEND_SENDER_NAME || 'Neowapp CRM';
	const email = process.env.RESEND_SENDER_EMAIL || 'onboarding@resend.dev';
	return `${name} <${email}>`;
}

/**
 * Plantilla base HTML minimalista y profesional con la identidad grafica de Neowapp CRM.
 * Colores: Cyan electrico (#00c2ff), Azul pizarra oscuro (#0b0f19 / #0f172a), Fondo blanco/slate (#f8fafc).
 */
export function renderBaseEmailTemplate({
	title,
	subtitle,
	bodyHtml,
	actionUrl,
	actionText,
	footerHint,
}: {
	title: string;
	subtitle?: string;
	bodyHtml: string;
	actionUrl?: string;
	actionText?: string;
	footerHint?: string;
}): string {
	const rawAppUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://neowapp.neobotia.cl').trim();
	// Si todavía apunta al host temporal de pruebas de Easypanel, priorizar el dominio oficial
	const cleanAppUrl = rawAppUrl.includes('ibzjvi.easypanel.host')
		? 'https://neowapp.neobotia.cl'
		: rawAppUrl.replace(/\/+$/, '');

	const safeActionUrl = sanitizeActionUrl(actionUrl);
	let resolvedActionUrl: string | undefined = undefined;

	if (safeActionUrl) {
		if (safeActionUrl.startsWith('http://') || safeActionUrl.startsWith('https://')) {
			resolvedActionUrl = safeActionUrl;
		} else {
			const cleanPath = safeActionUrl.startsWith('/') ? safeActionUrl : `/${safeActionUrl}`;
			resolvedActionUrl = `${cleanAppUrl}${cleanPath}`;
		}
	}

	const safeTitle = escapeHtml(title);
	const safeSubtitle = subtitle ? escapeHtml(subtitle) : undefined;
	const safeActionText = actionText ? escapeHtml(actionText) : undefined;
	const safeFooterHint = footerHint ? escapeHtml(footerHint) : undefined;

	return `<!DOCTYPE html>
<html lang="es">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${safeTitle}</title>
	<style>
		body {
			margin: 0;
			padding: 0;
			background-color: #f8fafc;
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
			color: #1e293b;
			-webkit-font-smoothing: antialiased;
		}
		.wrapper {
			width: 100%;
			table-layout: fixed;
			background-color: #f8fafc;
			padding: 40px 12px;
		}
		.container {
			max-width: 580px;
			margin: 0 auto;
			background: #ffffff;
			border-radius: 12px;
			overflow: hidden;
			border: 1px solid #e2e8f0;
			box-shadow: 0 4px 16px -2px rgba(15, 23, 42, 0.05);
		}
		.header {
			background-color: #0b0f19;
			padding: 26px 32px;
			text-align: center;
		}
		.logo-title {
			margin: 0;
			color: #ffffff;
			font-size: 22px;
			font-weight: 800;
			letter-spacing: -0.5px;
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		}
		.logo-accent {
			color: #00c2ff;
		}
		.logo-sub {
			font-size: 11px;
			letter-spacing: 2px;
			color: #94a3b8;
			font-weight: 700;
			margin-left: 4px;
			vertical-align: middle;
		}
		.tagline {
			font-size: 9px;
			letter-spacing: 3px;
			color: #38bdf8;
			margin-top: 6px;
			font-weight: 700;
			text-transform: uppercase;
		}
		.content {
			padding: 32px 32px 28px 32px;
		}
		.content h2 {
			margin: 0 0 8px 0;
			color: #0f172a;
			font-size: 20px;
			font-weight: 700;
			letter-spacing: -0.01em;
		}
		.content .subtitle {
			margin: 0 0 20px 0;
			font-size: 14px;
			color: #64748b;
		}
		.content p {
			margin: 0 0 16px 0;
			font-size: 15px;
			line-height: 24px;
			color: #334155;
		}
		.info-box {
			background: #f8fafc;
			border: 1px solid #e2e8f0;
			border-left: 4px solid #00c2ff;
			border-radius: 8px;
			padding: 16px 20px;
			margin: 20px 0;
		}
		.info-table {
			width: 100%;
			border-collapse: collapse;
		}
		.info-label {
			padding: 6px 0;
			font-weight: 600;
			color: #64748b;
			font-size: 13px;
			width: 120px;
			vertical-align: top;
		}
		.info-value {
			padding: 6px 0;
			color: #0f172a;
			font-size: 14px;
			font-weight: 500;
		}
		.btn-container {
			margin: 28px 0 12px 0;
			text-align: left;
		}
		.btn {
			display: inline-block;
			background-color: #00c2ff;
			color: #ffffff !important;
			text-decoration: none;
			padding: 12px 26px;
			border-radius: 8px;
			font-weight: 600;
			font-size: 14px;
			letter-spacing: 0.2px;
		}
		.footer {
			padding: 20px 32px;
			background: #f8fafc;
			border-top: 1px solid #f1f5f9;
			font-size: 12px;
			color: #94a3b8;
			text-align: center;
		}
		.footer p {
			margin: 0 0 4px 0;
			font-size: 12px;
			color: #94a3b8;
		}
	</style>
</head>
<body>
	<div class="wrapper">
		<div class="container">
			<div class="header">
				<div class="logo-title">
					NEO<span class="logo-accent">WAPP</span> <span class="logo-sub">CRM</span>
				</div>
				<div class="tagline">&raquo; CONECTA &bull; CONVERSA &bull; CONVIERTE</div>
			</div>
			<div class="content">
				<h2>${safeTitle}</h2>
				${safeSubtitle ? `<div class="subtitle">${safeSubtitle}</div>` : ''}
				${bodyHtml}
				${resolvedActionUrl && safeActionText ? `
				<div class="btn-container">
					<a href="${resolvedActionUrl}" class="btn" target="_blank" rel="noopener noreferrer">${safeActionText}</a>
				</div>
				` : ''}
			</div>
			<div class="footer">
				${safeFooterHint ? `<p>${safeFooterHint}</p>` : ''}
				<p>Neowapp CRM &bull; Conecta. Conversa. Convierte.</p>
				<p style="font-size: 11px; color: #cbd5e1; margin-top: 6px;">Este es un correo automatico generado por el sistema.</p>
			</div>
		</div>
	</div>
</body>
</html>`;
}

/**
 * Envia un correo general a traves de la API de Resend con validacion estricta y sanitizacion.
 */
export async function sendEmail({
	to,
	subject,
	html,
	tags,
}: {
	to: string | string[];
	subject: string;
	html: string;
	tags?: { name: string; value: string }[];
}): Promise<SendEmailResult> {
	const resend = getResendClient();

	if (!resend) {
		console.warn('[resend] RESEND_API_KEY no configurada. Notificacion omitida:', sanitizeSubject(subject));
		return {
			success: false,
			error: 'RESEND_API_KEY no configurada en las variables de entorno',
		};
	}

	const from = getResendSender();
	let recipients = sanitizeRecipients(to);

	if (recipients.length === 0) {
		console.warn('[resend] Lista de destinatarios vacia o con formato invalido. Envio omitido.');
		return {
			success: false,
			error: 'No se encontraron destinatarios de correo electronico validos',
		};
	}

	// En entorno de desarrollo (localhost), si esta configurado RESEND_DEV_OVERRIDE_TO,
	// redirige los envios a dicho correo para permitir probar sin el bloqueo 403 de la sandbox de Resend.
	const devOverride = process.env.RESEND_DEV_OVERRIDE_TO;
	if (devOverride && process.env.NODE_ENV !== 'production') {
		console.info(`[resend] [MODO PRUEBAS DEV] Redirigiendo envio de [${recipients.join(', ')}] a ${devOverride}`);
		recipients = [devOverride];
	}

	const cleanSubject = sanitizeSubject(subject);

	try {
		const { data, error } = await resend.emails.send({
			from,
			to: recipients,
			subject: cleanSubject,
			html,
			tags,
		});

		if (error) {
			console.error('[resend] Error al enviar correo:', error);
			return {
				success: false,
				error: error.message,
			};
		}

		return {
			success: true,
			messageId: data?.id,
		};
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : 'Error al conectar con el servicio Resend';
		console.error('[resend] Excepcion:', message);
		return {
			success: false,
			error: message,
		};
	}
}

/**
 * Notificacion consolidada de Nuevo Lead desde Formulario Web.
 * Sanitiza todas las entradas de usuario y previene XSS / HTML injection.
 */
export async function sendWebLeadEmail({
	toEmail,
	formName,
	contactName,
	contactEmail,
	contactPhone,
	company,
	dealTitle,
	customFields,
	contactId,
	conversationId,
}: {
	toEmail: string | string[];
	formName: string;
	contactName: string;
	contactEmail?: string;
	contactPhone?: string;
	company?: string;
	dealTitle?: string;
	customFields?: Array<{ label: string; value: string }>;
	contactId?: string;
	conversationId?: string;
}): Promise<SendEmailResult> {
	const title = 'Nuevo lead recibido';
	const subtitle = `Formulario: ${escapeHtml(formName)}`;

	const safeContactName = escapeHtml(contactName);
	const safeEmail = contactEmail ? escapeHtml(contactEmail) : undefined;
	const safePhone = contactPhone ? escapeHtml(contactPhone) : undefined;
	const safeCompany = company ? escapeHtml(company) : undefined;
	const safeDealTitle = dealTitle ? escapeHtml(dealTitle) : undefined;

	const customFieldsRows = (customFields || [])
		.map(
			(f) => `
			<tr>
				<td class="info-label">${escapeHtml(f.label)}:</td>
				<td class="info-value">${escapeHtml(f.value)}</td>
			</tr>
		`
		)
		.join('');

	const bodyHtml = `
		<p>Has recibido una nueva respuesta a traves de tu formulario web. A continuacion los detalles del prospecto:</p>
		<div class="info-box">
			<table class="info-table">
				<tr>
					<td class="info-label">Contacto:</td>
					<td class="info-value" style="font-weight: 700; color: #0f172a;">${safeContactName}</td>
				</tr>
				${safeEmail ? `
				<tr>
					<td class="info-label">Correo:</td>
					<td class="info-value"><a href="mailto:${safeEmail}" style="color: #00c2ff; text-decoration: none;">${safeEmail}</a></td>
				</tr>
				` : ''}
				${safePhone ? `
				<tr>
					<td class="info-label">Telefono:</td>
					<td class="info-value"><a href="tel:${safePhone}" style="color: #00c2ff; text-decoration: none;">${safePhone}</a></td>
				</tr>
				` : ''}
				${safeCompany ? `
				<tr>
					<td class="info-label">Empresa:</td>
					<td class="info-value">${safeCompany}</td>
				</tr>
				` : ''}
				${safeDealTitle ? `
				<tr>
					<td class="info-label">Negocio creado:</td>
					<td class="info-value" style="font-weight: 600; color: #0284c7;">${safeDealTitle}</td>
				</tr>
				` : ''}
				${customFieldsRows}
			</table>
		</div>
		<p>Puedes gestionar el contacto y continuar la conversacion desde la bandeja del CRM.</p>
	`;

	const deepLinkId = conversationId || contactId;
	const actionUrl = deepLinkId ? `/inbox?c=${encodeURIComponent(deepLinkId)}` : '/inbox';

	return sendEmail({
		to: toEmail,
		subject: `Nuevo lead: ${safeContactName} - ${escapeHtml(formName)}`,
		html: renderBaseEmailTemplate({
			title,
			subtitle,
			bodyHtml,
			actionUrl,
			actionText: 'Ver en Neowapp CRM',
			footerHint: 'Notificacion unificada de captacion web.',
		}),
		tags: [{ name: 'type', value: 'web-lead' }],
	});
}

/**
 * Notificacion cuando un nuevo contacto entra por primera vez a la bandeja de entrada (inbox).
 * Sanitiza todas las entradas del contacto y mensaje de WhatsApp.
 */
export async function sendNewInboxContactEmail({
	toEmail,
	contactName,
	contactPhone,
	messagePreview,
	conversationId,
}: {
	toEmail: string | string[];
	contactName: string;
	contactPhone: string;
	messagePreview?: string;
	conversationId?: string;
}): Promise<SendEmailResult> {
	const title = 'Nuevo contacto en bandeja de entrada';
	const subtitle = 'Un nuevo usuario ha iniciado conversacion';

	const safeName = escapeHtml(contactName);
	const safePhone = escapeHtml(contactPhone);
	const safePreview = messagePreview ? escapeHtml(messagePreview) : undefined;

	const bodyHtml = `
		<p>Un contacto no registrado previamente se ha comunicado a traves de WhatsApp y esta esperando respuesta:</p>
		<div class="info-box">
			<table class="info-table">
				<tr>
					<td class="info-label">Contacto:</td>
					<td class="info-value" style="font-weight: 700;">${safeName}</td>
				</tr>
				<tr>
					<td class="info-label">Telefono:</td>
					<td class="info-value">${safePhone}</td>
				</tr>
				${safePreview ? `
				<tr>
					<td class="info-label">Primer mensaje:</td>
					<td class="info-value" style="font-style: italic; color: #475569;">"${safePreview}"</td>
				</tr>
				` : ''}
			</table>
		</div>
		<p>Responde a este contacto desde la bandeja de entrada para no perder la oportunidad de venta o soporte.</p>
	`;

	const actionUrl = conversationId ? `/inbox?c=${encodeURIComponent(conversationId)}` : '/inbox';

	return sendEmail({
		to: toEmail,
		subject: `Nuevo contacto en bandeja: ${safeName}`,
		html: renderBaseEmailTemplate({
			title,
			subtitle,
			bodyHtml,
			actionUrl,
			actionText: 'Abrir conversacion',
			footerHint: 'Notificacion de recepcion de nuevos clientes.',
		}),
		tags: [{ name: 'type', value: 'new-inbox-contact' }],
	});
}

/**
 * Notificacion cuando se invita a un usuario a un chat interno (directo o grupo).
 * Sanitiza nombres de usuario y grupos para evitar inyeccion HTML.
 */
export async function sendInternalChatInviteEmail({
	toEmail,
	recipientName,
	inviterName,
	chatName,
	isGroup,
	chatId,
}: {
	toEmail: string | string[];
	recipientName?: string;
	inviterName: string;
	chatName: string;
	isGroup: boolean;
	chatId?: string;
}): Promise<SendEmailResult> {
	const safeRecipient = recipientName ? escapeHtml(recipientName) : undefined;
	const safeInviter = escapeHtml(inviterName);
	const safeChat = escapeHtml(chatName);

	const greeting = safeRecipient ? `Hola ${safeRecipient},` : 'Hola,';
	const title = isGroup ? 'Invitacion a grupo de trabajo' : 'Nueva conversacion directa';
	const subtitle = isGroup ? `Chat grupal: ${safeChat}` : `Mensaje de ${safeInviter}`;

	const bodyHtml = `
		<p>${greeting}</p>
		<p><strong>${safeInviter}</strong> te ha invitado a unirte a un ${isGroup ? 'grupo de trabajo' : 'chat directo'} en Neowapp:</p>
		<div class="info-box">
			<table class="info-table">
				<tr>
					<td class="info-label">Tipo:</td>
					<td class="info-value">${isGroup ? 'Grupo de trabajo' : 'Chat directo'}</td>
				</tr>
				<tr>
					<td class="info-label">${isGroup ? 'Nombre grupo:' : 'Contacto:'}</td>
					<td class="info-value" style="font-weight: 700;">${safeChat}</td>
				</tr>
				<tr>
					<td class="info-label">Invitado por:</td>
					<td class="info-value">${safeInviter}</td>
				</tr>
			</table>
		</div>
		<p>Accede al chat interno para responder y coordinar con tu equipo en tiempo real.</p>
	`;

	const actionUrl = chatId ? `/internal-chat?chat=${encodeURIComponent(chatId)}` : '/internal-chat';

	return sendEmail({
		to: toEmail,
		subject: isGroup
			? `${safeInviter} te invito al grupo "${safeChat}"`
			: `${safeInviter} quiere chatear contigo en Neowapp`,
		html: renderBaseEmailTemplate({
			title,
			subtitle,
			bodyHtml,
			actionUrl,
			actionText: 'Ir al Chat Interno',
			footerHint: 'Comunicacion interna de Neowapp CRM.',
		}),
		tags: [{ name: 'type', value: 'chat-invite' }],
	});
}

/**
 * Notificacion cuando se asigna una tarea a un colaborador en el chat interno.
 * Sanitiza titulo de tarea, prioridad y nombres.
 */
export async function sendTaskAssignedEmail({
	toEmail,
	assigneeName,
	assignedByName,
	taskTitle,
	taskPriority,
	dueDate,
	chatName,
}: {
	toEmail: string | string[];
	assigneeName?: string;
	assignedByName?: string;
	taskTitle: string;
	taskPriority?: 'low' | 'medium' | 'high' | 'urgent';
	dueDate?: string | null;
	chatName?: string;
}): Promise<SendEmailResult> {
	const safeAssignee = assigneeName ? escapeHtml(assigneeName) : undefined;
	const safeAssignedBy = assignedByName ? escapeHtml(assignedByName) : undefined;
	const safeTitle = escapeHtml(taskTitle);
	const safeChat = chatName ? escapeHtml(chatName) : undefined;
	const safeDueDate = dueDate ? escapeHtml(dueDate) : undefined;

	const greeting = safeAssignee ? `Hola ${safeAssignee},` : 'Hola,';
	const title = 'Nueva tarea asignada';
	const assigner = safeAssignedBy ? `${safeAssignedBy} te ha asignado` : 'Se te ha asignado';

	const priorityLabels: Record<string, string> = {
		low: 'Baja',
		medium: 'Media',
		high: 'Alta',
		urgent: 'Urgente',
	};
	const priorityLabel = taskPriority ? (priorityLabels[taskPriority] || taskPriority) : 'Media';

	const bodyHtml = `
		<p>${greeting}</p>
		<p>${assigner} una nueva tarea en el chat interno del CRM:</p>
		<div class="info-box">
			<table class="info-table">
				<tr>
					<td class="info-label">Tarea:</td>
					<td class="info-value" style="font-weight: 700; color: #0f172a;">${safeTitle}</td>
				</tr>
				<tr>
					<td class="info-label">Prioridad:</td>
					<td class="info-value"><span style="color: ${taskPriority === 'urgent' ? '#ef4444' : taskPriority === 'high' ? '#f59e0b' : '#0284c7'}; font-weight: 600;">${priorityLabel}</span></td>
				</tr>
				${safeChat ? `
				<tr>
					<td class="info-label">Canal / Chat:</td>
					<td class="info-value">${safeChat}</td>
				</tr>
				` : ''}
				${safeDueDate ? `
				<tr>
					<td class="info-label">Fecha limite:</td>
					<td class="info-value">${safeDueDate}</td>
				</tr>
				` : ''}
			</table>
		</div>
		<p>Puedes revisar el estado y marcar como completada la tarea en la seccion de chat interno.</p>
	`;

	return sendEmail({
		to: toEmail,
		subject: `Nueva tarea asignada: ${safeTitle}`,
		html: renderBaseEmailTemplate({
			title,
			subtitle: 'Asignacion de tareas en equipo',
			bodyHtml,
			actionUrl: '/internal-chat',
			actionText: 'Ver tareas en Chat Interno',
			footerHint: 'Notificacion de tareas del equipo.',
		}),
		tags: [{ name: 'type', value: 'task-assigned' }],
	});
}

/**
 * Notificacion cuando se asigna un lead o contacto a un agente.
 */
export async function sendLeadAssignedEmail({
	toEmail,
	agentName,
	contactName,
	contactPhone,
	conversationId,
	source,
}: {
	toEmail: string | string[];
	agentName?: string;
	contactName: string;
	contactPhone: string;
	conversationId?: string;
	source?: string;
}): Promise<SendEmailResult> {
	const safeAgent = agentName ? escapeHtml(agentName) : undefined;
	const safeContact = escapeHtml(contactName);
	const safePhone = escapeHtml(contactPhone);
	const safeSource = source ? escapeHtml(source) : undefined;

	const greeting = safeAgent ? `Hola ${safeAgent},` : 'Hola,';
	const title = 'Nuevo lead asignado';

	const bodyHtml = `
		<p>${greeting}</p>
		<p>Se te ha asignado un nuevo contacto en el sistema:</p>
		<div class="info-box">
			<table class="info-table">
				<tr>
					<td class="info-label">Contacto:</td>
					<td class="info-value" style="font-weight: 700;">${safeContact}</td>
				</tr>
				<tr>
					<td class="info-label">Telefono:</td>
					<td class="info-value">${safePhone}</td>
				</tr>
				${safeSource ? `
				<tr>
					<td class="info-label">Origen:</td>
					<td class="info-value">${safeSource}</td>
				</tr>
				` : ''}
			</table>
		</div>
		<p>Haz clic en el boton a continuacion para abrir la conversacion directamente en la bandeja de entrada.</p>
	`;

	const actionUrl = conversationId ? `/inbox?c=${encodeURIComponent(conversationId)}` : '/inbox';

	return sendEmail({
		to: toEmail,
		subject: `Nuevo lead asignado: ${safeContact}`,
		html: renderBaseEmailTemplate({
			title,
			bodyHtml,
			actionUrl,
			actionText: 'Abrir conversacion en Bandeja',
			footerHint: 'Notificacion automatica de asignacion de contactos.',
		}),
		tags: [{ name: 'type', value: 'lead-assigned' }],
	});
}
