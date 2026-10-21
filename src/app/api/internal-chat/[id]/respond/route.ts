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
	params: Promise<{ id: string }>;
}

// POST /api/internal-chat/[id]/respond — Aceptar o rechazar invitacion a un chat
export async function POST(request: Request, { params }: RouteParams) {
	try {
		const { id: chatId } = await params;
		const ctx = await getCurrentAccount();
		const body = await request.json();
		const { action } = body;

		if (action !== "accept" && action !== "decline") {
			return NextResponse.json({ error: "Accion invalida" }, { status: 400 });
		}

		const adminClient = getAdminClient();

		// Verificar que el usuario tenga una invitacion pendiente
		const { data: member, error: memErr } = await adminClient
			.from("internal_chat_members")
			.select("id, status")
			.eq("chat_id", chatId)
			.eq("user_id", ctx.userId)
			.single();

		if (memErr || !member) {
			return NextResponse.json({ error: "No tienes una invitacion para este chat" }, { status: 404 });
		}

		const newStatus = action === "accept" ? "accepted" : "declined";

		const { error: updateErr } = await adminClient
			.from("internal_chat_members")
			.update({
				status: newStatus,
				joined_at: action === "accept" ? new Date().toISOString() : null,
				last_read_at: new Date().toISOString(),
			})
			.eq("id", member.id);

		if (updateErr) {
			console.error("[POST /api/internal-chat/[id]/respond] error:", updateErr);
			return NextResponse.json({ error: "Error al responder invitacion" }, { status: 500 });
		}

		// Si acepto, insertar mensaje del sistema informando que se unio
		if (action === "accept") {
			const { data: profile } = await adminClient
				.from("profiles")
				.select("full_name, email")
				.eq("user_id", ctx.userId)
				.single();

			const userName = profile?.full_name || profile?.email || "Un miembro";

			await adminClient.from("internal_messages").insert({
				chat_id: chatId,
				sender_id: null,
				text: `${userName} acepto la invitacion y se unio al chat`,
				message_type: "system",
			});
		}

		return NextResponse.json({ success: true, status: newStatus });
	} catch (err) {
		return toErrorResponse(err);
	}
}
