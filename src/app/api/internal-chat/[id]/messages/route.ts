import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getCurrentAccount, toErrorResponse } from "@/lib/auth/account";
import type { InternalMessage } from "@/types";

function getAdminClient() {
	return createSupabaseClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.SUPABASE_SERVICE_ROLE_KEY!
	);
}

interface RouteParams {
	params: Promise<{ id: string }>;
}

// GET /api/internal-chat/[id]/messages — Obtener historial de mensajes del chat
export async function GET(request: Request, { params }: RouteParams) {
	try {
		const { id: chatId } = await params;
		const ctx = await getCurrentAccount();
		const adminClient = getAdminClient();

		// Verificar que el usuario pertenezca al chat
		const { data: member, error: memErr } = await adminClient
			.from("internal_chat_members")
			.select("status")
			.eq("chat_id", chatId)
			.eq("user_id", ctx.userId)
			.single();

		if (memErr || !member) {
			return NextResponse.json({ error: "No tienes acceso a este chat" }, { status: 403 });
		}

		// Cargar mensajes
		const { data: rawMessages, error: msgErr } = await adminClient
			.from("internal_messages")
			.select("*")
			.eq("chat_id", chatId)
			.order("created_at", { ascending: true });

		if (msgErr) {
			console.error("[GET /api/internal-chat/[id]/messages] error:", msgErr);
			return NextResponse.json({ error: "Error al cargar mensajes" }, { status: 500 });
		}

		// Cargar perfiles de remitentes
		const senderIds = Array.from(
			new Set((rawMessages || []).map((m: any) => m.sender_id).filter(Boolean))
		);

		const { data: profiles } = senderIds.length > 0
			? await adminClient
				.from("profiles")
				.select("user_id, full_name, avatar_url")
				.in("user_id", senderIds)
			: { data: [] };

		const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

		const messages: InternalMessage[] = (rawMessages || []).map((m: any) => ({
			...m,
			sender_profile: m.sender_id ? profileMap.get(m.sender_id) || null : null,
		}));

		return NextResponse.json({ messages });
	} catch (err) {
		return toErrorResponse(err);
	}
}

// POST /api/internal-chat/[id]/messages — Enviar un mensaje al chat
export async function POST(request: Request, { params }: RouteParams) {
	try {
		const { id: chatId } = await params;
		const ctx = await getCurrentAccount();
		const body = await request.json();
		const { text, message_type = "text", file_url, file_name, file_size } = body;

		if (!text?.trim() && !file_url) {
			return NextResponse.json({ error: "El mensaje no puede estar vacio" }, { status: 400 });
		}

		const adminClient = getAdminClient();

		// Solo miembros aceptados pueden enviar mensajes
		const { data: member, error: memErr } = await adminClient
			.from("internal_chat_members")
			.select("id, status")
			.eq("chat_id", chatId)
			.eq("user_id", ctx.userId)
			.single();

		if (memErr || !member || member.status !== "accepted") {
			return NextResponse.json(
				{ error: "Debes aceptar la invitacion antes de enviar mensajes" },
				{ status: 403 }
			);
		}

		// 1. Insertar mensaje
		const { data: insertedMsg, error: insertErr } = await adminClient
			.from("internal_messages")
			.insert({
				chat_id: chatId,
				sender_id: ctx.userId,
				text: text?.trim() || "",
				message_type,
				file_url: file_url || null,
				file_name: file_name || null,
				file_size: file_size || null,
			})
			.select("*")
			.single();

		if (insertErr || !insertedMsg) {
			console.error("[POST /api/internal-chat/[id]/messages] error:", insertErr);
			return NextResponse.json({ error: "Error al enviar mensaje" }, { status: 500 });
		}

		// Cargar perfil del remitente
		const { data: senderProf } = await adminClient
			.from("profiles")
			.select("user_id, full_name, avatar_url")
			.eq("user_id", ctx.userId)
			.single();

		const messageWithProfile: InternalMessage = {
			...insertedMsg,
			sender_profile: senderProf || null,
		};

		const now = new Date().toISOString();

		// 2. Actualizar updated_at del chat
		await adminClient
			.from("internal_chats")
			.update({ updated_at: now })
			.eq("id", chatId);

		// 3. Marcar last_read_at del remitente como actualizado
		await adminClient
			.from("internal_chat_members")
			.update({ last_read_at: now })
			.eq("id", member.id);

		return NextResponse.json({ message: messageWithProfile });
	} catch (err) {
		return toErrorResponse(err);
	}
}
