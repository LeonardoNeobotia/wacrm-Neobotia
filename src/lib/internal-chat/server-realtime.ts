import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function getAdminClient() {
	return createSupabaseClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.SUPABASE_SERVICE_ROLE_KEY!
	);
}

// Envia un evento broadcast por Supabase Realtime con suscripcion garantizada y timeout de seguridad
async function sendBroadcast(channelName: string, event: string, payload: any): Promise<void> {
	const adminClient = getAdminClient();
	const channel = adminClient.channel(channelName);

	return new Promise<void>((resolve) => {
		let completed = false;

		const finish = () => {
			if (completed) return;
			completed = true;
			try {
				adminClient.removeChannel(channel);
			} catch {}
			resolve();
		};

		const timer = setTimeout(finish, 1500);

		channel.subscribe(async (status) => {
			if (status === "SUBSCRIBED") {
				try {
					await channel.send({
						type: "broadcast",
						event,
						payload,
					});
				} catch (err) {
					console.warn(`[Realtime Broadcast Error: ${channelName} - ${event}]`, err);
				} finally {
					clearTimeout(timer);
					finish();
				}
			} else if (status === "TIMED_OUT" || status === "CHANNEL_ERROR" || status === "CLOSED") {
				clearTimeout(timer);
				finish();
			}
		});
	});
}

// Notifica nuevo mensaje tanto al hilo del chat como a la cuenta general
export async function broadcastNewMessage(chatId: string, accountId: string | null, message: any): Promise<void> {
	await Promise.allSettled([
		sendBroadcast(`internal-chat-thread:${chatId}`, "new_message", message),
		accountId
			? sendBroadcast(`internal-chats-account:${accountId}`, "chat_updated", { chatId, lastMessage: message })
			: Promise.resolve(),
	]);
}

// Notifica eliminacion de mensaje en tiempo real
export async function broadcastDeleteMessage(chatId: string, accountId: string | null, messageId: string): Promise<void> {
	await Promise.allSettled([
		sendBroadcast(`internal-chat-thread:${chatId}`, "delete_message", { messageId }),
		accountId
			? sendBroadcast(`internal-chats-account:${accountId}`, "chat_updated", { chatId })
			: Promise.resolve(),
	]);
}

// Notifica creacion de nuevo chat a todos los miembros de la cuenta
export async function broadcastChatCreated(accountId: string, chatId: string, createdBy: string): Promise<void> {
	await sendBroadcast(`internal-chats-account:${accountId}`, "chat_created", { chat_id: chatId, created_by: createdBy });
}

// Notifica actualizacion general del chat (cambio de nombre, imagen, miembros)
export async function broadcastChatUpdated(accountId: string, chatId: string): Promise<void> {
	await sendBroadcast(`internal-chats-account:${accountId}`, "chat_updated", { chatId });
}
