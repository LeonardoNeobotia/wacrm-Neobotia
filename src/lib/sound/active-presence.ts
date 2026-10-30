/**
 * Almacenamiento en memoria para sincronización de presencia y foco entre componentes y hooks.
 * Permite a los hooks globales de notificaciones verificar de forma síncrona si el usuario
 * está viendo actualmente una conversación o chat interno, sin contaminar el objeto global window.
 */

let activeInboxConversationId: string | null = null;
let activeInternalChatId: string | null = null;

export function setActiveInboxConversationId(id: string | null): void {
	activeInboxConversationId = id;
}

export function getActiveInboxConversationId(): string | null {
	return activeInboxConversationId;
}

export function setActiveInternalChatId(id: string | null): void {
	activeInternalChatId = id;
}

export function getActiveInternalChatId(): string | null {
	return activeInternalChatId;
}

