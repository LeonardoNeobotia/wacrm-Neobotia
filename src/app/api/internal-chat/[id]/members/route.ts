import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getCurrentAccount, toErrorResponse } from "@/lib/auth/account";
import { sendInternalChatInviteEmail } from "@/lib/email/resend";

function getAdminClient() {
	return createSupabaseClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.SUPABASE_SERVICE_ROLE_KEY!
	);
}

interface RouteParams {
	params: Promise<{ id: string }>;
}

// POST /api/internal-chat/[id]/members — Invitar miembros adicionales a un grupo
export async function POST(request: Request, { params }: RouteParams) {
	try {
		const { id: chatId } = await params;
		const ctx = await getCurrentAccount();
		const body = await request.json();
		const { member_user_ids } = body;

		if (!Array.isArray(member_user_ids) || member_user_ids.length === 0) {
			return NextResponse.json({ error: "Debes seleccionar al menos un miembro" }, { status: 400 });
		}

		const adminClient = getAdminClient();

		// Verificar que el usuario sea admin del chat o creador
		const { data: callerMember } = await adminClient
			.from("internal_chat_members")
			.select("role, status")
			.eq("chat_id", chatId)
			.eq("user_id", ctx.userId)
			.single();

		if (!callerMember || callerMember.status !== "accepted") {
			return NextResponse.json({ error: "No tienes permisos para invitar en este chat" }, { status: 403 });
		}

		// Obtener datos del chat
		const { data: chat } = await adminClient
			.from("internal_chats")
			.select("name, type")
			.eq("id", chatId)
			.single();

		if (!chat) {
			return NextResponse.json({ error: "Chat no encontrado" }, { status: 404 });
		}

		// Filtrar miembros que ya estén en el chat
		const { data: existingMembers } = await adminClient
			.from("internal_chat_members")
			.select("user_id")
			.eq("chat_id", chatId);

		const existingIds = new Set((existingMembers || []).map((m: any) => m.user_id));
		const toAdd = member_user_ids.filter((uid: string) => !existingIds.has(uid));

		if (toAdd.length === 0) {
			return NextResponse.json({ message: "Los miembros seleccionados ya forman parte del chat" });
		}

		const newMembers = toAdd.map((uid: string) => ({
			chat_id: chatId,
			user_id: uid,
			role: "member",
			status: "pending",
			invited_by: ctx.userId,
		}));

		await adminClient.from("internal_chat_members").insert(newMembers);

		// Obtener nombre del invitador
		const { data: inviterProfile } = await adminClient
			.from("profiles")
			.select("full_name, email")
			.eq("user_id", ctx.userId)
			.single();

		const inviterName = inviterProfile?.full_name || inviterProfile?.email || "Un miembro";

		// Notificaciones
		const notifications = toAdd.map((uid: string) => ({
			account_id: ctx.accountId,
			user_id: uid,
			type: "chat_invitation",
			chat_id: chatId,
			actor_user_id: ctx.userId,
			title: `Invitacion a grupo: ${chat.name || "Chat Interno"}`,
			body: `${inviterName} te invito a unirte a "${chat.name || "este chat"}".`,
		}));

		await adminClient.from("notifications").insert(notifications);

		// Enviar notificaciones por correo a los miembros agregados
		try {
			const { data: addedProfiles } = await adminClient
				.from("profiles")
				.select("email, full_name")
				.in("user_id", toAdd);

			if (addedProfiles && addedProfiles.length > 0) {
				for (const prof of addedProfiles) {
					if (prof.email) {
						sendInternalChatInviteEmail({
							toEmail: prof.email,
							recipientName: prof.full_name || undefined,
							inviterName,
							chatName: chat.name || "Chat Grupal",
							isGroup: true,
							chatId,
						}).catch((e) => console.warn("[members] Error al enviar email de invitacion:", e));
					}
				}
			}
		} catch (emailErr) {
			console.warn("[members] Error en despacho de correos de invitacion:", emailErr);
		}

		return NextResponse.json({ success: true, added_count: toAdd.length });
	} catch (err) {
		return toErrorResponse(err);
	}
}

// DELETE /api/internal-chat/[id]/members — Expulsar a un miembro del grupo
export async function DELETE(request: Request, { params }: RouteParams) {
	try {
		const { id: chatId } = await params;
		const ctx = await getCurrentAccount();
		const body = await request.json();
		const { user_id: targetUserId } = body;

		if (!targetUserId) {
			return NextResponse.json({ error: "user_id es requerido" }, { status: 400 });
		}

		if (targetUserId === ctx.userId) {
			return NextResponse.json(
				{ error: "No puedes expulsarte a ti mismo, utiliza la opción salir del grupo" },
				{ status: 400 }
			);
		}

		const adminClient = getAdminClient();

		// Verificar que el llamador sea admin del grupo
		const { data: callerMember } = await adminClient
			.from("internal_chat_members")
			.select("role, status")
			.eq("chat_id", chatId)
			.eq("user_id", ctx.userId)
			.single();

		if (!callerMember || callerMember.role !== "admin" || callerMember.status !== "accepted") {
			return NextResponse.json(
				{ error: "Solo los administradores pueden expulsar miembros" },
				{ status: 403 }
			);
		}

		// Verificar datos del chat
		const { data: chat } = await adminClient
			.from("internal_chats")
			.select("created_by, type")
			.eq("id", chatId)
			.single();

		if (!chat || chat.type !== "group") {
			return NextResponse.json({ error: "Operación solo válida en grupos" }, { status: 400 });
		}

		// No se puede expulsar al creador del grupo
		if (targetUserId === chat.created_by) {
			return NextResponse.json(
				{ error: "No es posible expulsar al creador original del grupo" },
				{ status: 403 }
			);
		}

		// Obtener nombres para mensaje del sistema
		const { data: profiles } = await adminClient
			.from("profiles")
			.select("user_id, full_name, email")
			.in("user_id", [ctx.userId, targetUserId]);

		const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
		const callerName = profileMap.get(ctx.userId)?.full_name || "Un administrador";
		const targetName = profileMap.get(targetUserId)?.full_name || profileMap.get(targetUserId)?.email || "Un miembro";

		// Eliminar miembro
		const { error: delErr } = await adminClient
			.from("internal_chat_members")
			.delete()
			.eq("chat_id", chatId)
			.eq("user_id", targetUserId);

		if (delErr) {
			console.error("[DELETE member] error:", delErr);
			return NextResponse.json({ error: "Error al remover miembro" }, { status: 500 });
		}

		// Mensaje del sistema
		await adminClient.from("internal_messages").insert({
			chat_id: chatId,
			sender_id: null,
			text: `${callerName} eliminó a ${targetName} del grupo`,
			message_type: "system",
		});

		return NextResponse.json({ success: true, removed_user_id: targetUserId });
	} catch (err) {
		return toErrorResponse(err);
	}
}

// PATCH /api/internal-chat/[id]/members — Cambiar rol de un miembro (admin / member)
export async function PATCH(request: Request, { params }: RouteParams) {
	try {
		const { id: chatId } = await params;
		const ctx = await getCurrentAccount();
		const body = await request.json();
		const { user_id: targetUserId, role } = body;

		if (!targetUserId || (role !== "admin" && role !== "member")) {
			return NextResponse.json({ error: "Datos de rol o user_id inválidos" }, { status: 400 });
		}

		const adminClient = getAdminClient();

		// Verificar que el llamador sea admin del grupo
		const { data: callerMember } = await adminClient
			.from("internal_chat_members")
			.select("role, status")
			.eq("chat_id", chatId)
			.eq("user_id", ctx.userId)
			.single();

		if (!callerMember || callerMember.role !== "admin" || callerMember.status !== "accepted") {
			return NextResponse.json(
				{ error: "Solo los administradores pueden cambiar roles" },
				{ status: 403 }
			);
		}

		// Actualizar rol
		const { error: updateErr } = await adminClient
			.from("internal_chat_members")
			.update({ role })
			.eq("chat_id", chatId)
			.eq("user_id", targetUserId);

		if (updateErr) {
			console.error("[PATCH member role] error:", updateErr);
			return NextResponse.json({ error: "Error al actualizar rol" }, { status: 500 });
		}

		return NextResponse.json({ success: true, user_id: targetUserId, new_role: role });
	} catch (err) {
		return toErrorResponse(err);
	}
}
