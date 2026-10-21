import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getCurrentAccount, toErrorResponse } from "@/lib/auth/account";

function getAdminClient() {
	return createSupabaseClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.SUPABASE_SERVICE_ROLE_KEY!
	);
}

interface RouteParams {
	params: Promise<{ id: string; messageId: string }>;
}

// DELETE /api/internal-chat/[id]/messages/[messageId] — Eliminar un mensaje
export async function DELETE(request: Request, { params }: RouteParams) {
	try {
		const { id: chatId, messageId } = await params;
		const ctx = await getCurrentAccount();
		const adminClient = getAdminClient();

		// Verificar que el usuario pertenezca al chat
		const { data: member } = await adminClient
			.from("internal_chat_members")
			.select("role, status")
			.eq("chat_id", chatId)
			.eq("user_id", ctx.userId)
			.single();

		if (!member || member.status !== "accepted") {
			return NextResponse.json({ error: "No tienes acceso a este chat" }, { status: 403 });
		}

		// Obtener mensaje
		const { data: message } = await adminClient
			.from("internal_messages")
			.select("id, sender_id")
			.eq("id", messageId)
			.eq("chat_id", chatId)
			.single();

		if (!message) {
			return NextResponse.json({ error: "Mensaje no encontrado" }, { status: 404 });
		}

		// El usuario puede eliminar sus propios mensajes o si es admin del grupo
		const isMyMessage = message.sender_id === ctx.userId;
		const isAdmin = member.role === "admin";

		if (!isMyMessage && !isAdmin) {
			return NextResponse.json(
				{ error: "No tienes permiso para eliminar este mensaje" },
				{ status: 403 }
			);
		}

		const { error: delErr } = await adminClient
			.from("internal_messages")
			.delete()
			.eq("id", messageId);

		if (delErr) {
			console.error("[DELETE message] error:", delErr);
			return NextResponse.json({ error: "Error al eliminar mensaje" }, { status: 500 });
		}

		return NextResponse.json({ success: true, message_id: messageId });
	} catch (err) {
		return toErrorResponse(err);
	}
}
