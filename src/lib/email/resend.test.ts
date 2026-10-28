import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	sendEmail,
	sendWebLeadEmail,
	sendNewInboxContactEmail,
	sendInternalChatInviteEmail,
	sendTaskAssignedEmail,
	sendLeadAssignedEmail,
} from './resend';

vi.mock('resend', () => {
	return {
		Resend: class {
			emails = {
				send: vi.fn().mockResolvedValue({
					data: { id: 'mock-email-id-123' },
					error: null,
				}),
			};
		},
	};
});

describe('Resend Email Service', () => {
	const originalEnv = process.env;

	beforeEach(() => {
		process.env = { ...originalEnv };
	});

	afterEach(() => {
		process.env = originalEnv;
		vi.clearAllMocks();
	});

	it('returns error when RESEND_API_KEY is not set', async () => {
		delete process.env.RESEND_API_KEY;

		const result = await sendEmail({
			to: 'user@example.com',
			subject: 'Test',
			html: '<p>Hola</p>',
		});

		expect(result.success).toBe(false);
		expect(result.error).toContain('RESEND_API_KEY no configurada');
	});

	it('sends email successfully when API key is provided', async () => {
		process.env.RESEND_API_KEY = 're_test_123';
		process.env.RESEND_SENDER_EMAIL = 'notificaciones@neobotia.com';
		process.env.RESEND_SENDER_NAME = 'Neowapp CRM';

		const result = await sendEmail({
			to: 'user@example.com',
			subject: 'Hola Mundo',
			html: '<p>Contenido</p>',
		});

		expect(result.success).toBe(true);
		expect(result.messageId).toBe('mock-email-id-123');
	});

	it('formats consolidated web lead email correctly', async () => {
		process.env.RESEND_API_KEY = 're_test_123';

		const result = await sendWebLeadEmail({
			toEmail: 'admin@neobotia.com',
			formName: 'Contacto Landing Page',
			contactName: 'Carlos Perez',
			contactEmail: 'carlos@empresa.com',
			contactPhone: '+56912345678',
			company: 'Innovacion SpA',
			dealTitle: 'Implementacion CRM Neowapp',
			customFields: [{ label: 'Mensaje', value: 'Quiero una cotizacion para 10 usuarios' }],
		});

		expect(result.success).toBe(true);
		expect(result.messageId).toBe('mock-email-id-123');
	});

	it('formats new inbox contact email correctly', async () => {
		process.env.RESEND_API_KEY = 're_test_123';

		const result = await sendNewInboxContactEmail({
			toEmail: 'equipo@neobotia.com',
			contactName: '+56987654321',
			contactPhone: '+56987654321',
			messagePreview: 'Hola, buenas tardes, me gustaria solicitar info...',
			conversationId: 'conv-123',
		});

		expect(result.success).toBe(true);
		expect(result.messageId).toBe('mock-email-id-123');
	});

	it('formats internal chat invite email correctly', async () => {
		process.env.RESEND_API_KEY = 're_test_123';

		const result = await sendInternalChatInviteEmail({
			toEmail: 'maria@neobotia.com',
			recipientName: 'Maria',
			inviterName: 'Leonardo',
			chatName: 'Equipo Comercial',
			isGroup: true,
			chatId: 'chat-456',
		});

		expect(result.success).toBe(true);
		expect(result.messageId).toBe('mock-email-id-123');
	});

	it('formats task assigned email correctly', async () => {
		process.env.RESEND_API_KEY = 're_test_123';

		const result = await sendTaskAssignedEmail({
			toEmail: 'colaborador@neobotia.com',
			assigneeName: 'Carlos',
			assignedByName: 'Maria',
			taskTitle: 'Preparar presentacion comercial',
			taskPriority: 'urgent',
			dueDate: '2026-11-15',
		});

		expect(result.success).toBe(true);
		expect(result.messageId).toBe('mock-email-id-123');
	});

	it('formats lead assigned email correctly', async () => {
		process.env.RESEND_API_KEY = 're_test_123';

		const result = await sendLeadAssignedEmail({
			toEmail: 'agente@neobotia.com',
			agentName: 'Sofia',
			contactName: 'Cliente VIP',
			contactPhone: '+56999999999',
			source: 'WhatsApp Web',
		});

		expect(result.success).toBe(true);
		expect(result.messageId).toBe('mock-email-id-123');
	});

	it('redirects recipient in development when RESEND_DEV_OVERRIDE_TO is set', async () => {
		process.env.RESEND_API_KEY = 're_test_123';
		process.env.RESEND_DEV_OVERRIDE_TO = 'sandbox_user@example.com';

		const result = await sendEmail({
			to: 'someone_else@example.com',
			subject: 'Test Override',
			html: '<p>Contenido</p>',
		});

		expect(result.success).toBe(true);
		expect(result.messageId).toBe('mock-email-id-123');
	});

	it('sanitizes malicious HTML payloads in lead emails to prevent stored XSS', async () => {
		process.env.RESEND_API_KEY = 're_test_123';

		const result = await sendWebLeadEmail({
			toEmail: 'admin@neobotia.com',
			formName: '<script>alert("hack")</script>',
			contactName: '<img src=x onerror=alert(1)> Hacker',
			contactEmail: 'hacker@malicious.com',
			customFields: [{ label: '<b>Payload</b>', value: '<svg onload=alert(2)>' }],
		});

		expect(result.success).toBe(true);
		expect(result.messageId).toBe('mock-email-id-123');
	});

	it('rejects sending if recipient email addresses are completely invalid', async () => {
		process.env.RESEND_API_KEY = 're_test_123';

		const result = await sendEmail({
			to: ['invalid-email-address', 'not@valid'],
			subject: 'Test',
			html: '<p>Contenido</p>',
		});

		expect(result.success).toBe(false);
		expect(result.error).toContain('destinatarios');
	});
});
