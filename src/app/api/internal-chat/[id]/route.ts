import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getCurrentAccount, toErrorResponse } from "@/lib/auth/account";
import { broadcastChatUpdated } from "@/lib/internal-chat/server-realtime";

export const dynamic = "force-dynamic";

function getAdminClient() {
	return createSupabaseClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.SUPABASE_SERVICE_ROLE_KEY!
	);
}

interface RouteParams {
	params: Promise<{ id: string }>;
}

// GET /api/internal-chat/[id] — Obtener informacion detallada de un chat
export async function GET(request: Request, { params }: RouteParams) {
	try {
		const { id: chatId } = await params;
		const ctx = await getCurrentAccount();
		const adminClient = getAdminClient();

		// Verificar membresia
		const { data: member } = await adminClient
			.from("internal_chat_members")
			.select("role, status")
			.eq("chat_id", chatId)
			.eq("user_id", ctx.userId)
			.single();

		if (!member) {
			return NextResponse.json({ error: "No tienes acceso a este chat" }, { status: 403 });
		}

		const { data: chat, error: chatErr } = await adminClient
			.from("internal_chats")
			.select("*")
			.eq("id", chatId)
			.single();

		if (chatErr || !chat) {
			return NextResponse.json({ error: "Chat no encontrado" }, { status: 404 });
		}

		return NextResponse.json(
			{ chat },
			{
				headers: {
					"Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
					Pragma: "no-cache",
				},
			}
		);
	} catch (err) {
		return toErrorResponse(err);
	}
}

// PATCH /api/internal-chat/[id] — Actualizar informacion del grupo (nombre, descripcion, color)
export async function PATCH(request: Request, { params }: RouteParams) {
	try {
		const { id: chatId } = await params;
		const ctx = await getCurrentAccount();
		const body = await request.json();
		const { name, description, color } = body;

		const adminClient = getAdminClient();

		// Verificar que el usuario pertenezca y sea admin o creador
		const { data: callerMember } = await adminClient
			.from("internal_chat_members")
			.select("role, status")
			.eq("chat_id", chatId)
			.eq("user_id", ctx.userId)
			.single();

		if (!callerMember || callerMember.status !== "accepted") {
			return NextResponse.json({ error: "No tienes acceso a este chat" }, { status: 403 });
		}

		const { data: chat } = await adminClient
			.from("internal_chats")
			.select("type, created_by, name")
			.eq("id", chatId)
			.single();

		if (!chat) {
			return NextResponse.json({ error: "Chat no encontrado" }, { status: 404 });
		}

		if (chat.type === "group" && callerMember.role !== "admin" && chat.created_by !== ctx.userId) {
			return NextResponse.json(
				{ error: "Solo los administradores pueden editar este grupo" },
				{ status: 403 }
			);
		}

		const updates: Record<string, any> = {
			updated_at: new Date().toISOString(),
		};

		if (name !== undefined) updates.name = name?.trim() || null;
		if (description !== undefined) updates.description = description?.trim() || null;
		if (color !== undefined) updates.color = color;

		const { data: updatedChat, error: updateErr } = await adminClient
			.from("internal_chats")
			.update(updates)
			.eq("id", chatId)
			.select()
			.single();

		if (updateErr) {
			console.error("[PATCH /api/internal-chat/[id]] error:", updateErr);
			return NextResponse.json({ error: "Error al actualizar chat" }, { status: 500 });
		}

		// Insertar mensaje del sistema si cambio el nombre
		if (name && name.trim() !== chat.name) {
			const { data: profile } = await adminClient
				.from("profiles")
				.select("full_name, email")
				.eq("user_id", ctx.userId)
				.single();

			const editorName = profile?.full_name || profile?.email || "Un administrador";

			await adminClient.from("internal_messages").insert({
				chat_id: chatId,
				sender_id: null,
				text: `${editorName} cambió el nombre del grupo a "${name.trim()}"`,
				message_type: "system",
			});
		}

		// Notificar actualizacion en tiempo real a la cuenta
		if (ctx.accountId) {
			await broadcastChatUpdated(ctx.accountId, chatId);
		}

		return NextResponse.json({ success: true, chat: updatedChat });
	} catch (err) {
		return toErrorResponse(err);
	}
}

// DELETE /api/internal-chat/[id] — Eliminar chat o salir de grupo
export async function DELETE(request: Request, { params }: RouteParams) {
	try {
		const { id: chatId } = await params;
		const ctx = await getCurrentAccount();
		const url = new URL(request.url);
		const action = url.searchParams.get("action") || "delete";

		const adminClient = getAdminClient();

		// Verificar membresia del usuario
		const { data: member } = await adminClient
			.from("internal_chat_members")
			.select("role, status")
			.eq("chat_id", chatId)
			.eq("user_id", ctx.userId)
			.single();

		if (!member) {
			return NextResponse.json({ error: "No tienes acceso a este chat" }, { status: 403 });
		}

		const { data: chat } = await adminClient
			.from("internal_chats")
			.select("type, created_by, name")
			.eq("id", chatId)
			.single();

		if (!chat) {
			return NextResponse.json({ error: "Chat no encontrado" }, { status: 404 });
		}

		// Salir del grupo
		if (action === "leave") {
			if (chat.type !== "group") {
				return NextResponse.json(
					{ error: "Solo puedes abandonar grupos, los chats directos deben eliminarse" },
					{ status: 400 }
				);
			}

			// Remover membresia
			await adminClient
				.from("internal_chat_members")
				.delete()
				.eq("chat_id", chatId)
				.eq("user_id", ctx.userId);

			// Notificar en el chat que el usuario salio
			const { data: profile } = await adminClient
				.from("profiles")
				.select("full_name, email")
				.eq("user_id", ctx.userId)
				.single();

			const leaverName = profile?.full_name || profile?.email || "Un integrante";

			await adminClient.from("internal_messages").insert({
				chat_id: chatId,
				sender_id: null,
				text: `${leaverName} salió del grupo`,
				message_type: "system",
			});

			if (ctx.accountId) {
				await broadcastChatUpdated(ctx.accountId, chatId);
			}

			return NextResponse.json({ success: true, action: "left" });
		}

		// Eliminar chat por completo
		// En grupos, solo el admin o creador puede eliminar para todos
		if (chat.type === "group" && member.role !== "admin" && chat.created_by !== ctx.userId) {
			return NextResponse.json(
				{ error: "Solo los administradores pueden eliminar el grupo por completo" },
				{ status: 403 }
			);
		}

		// En chats directos, cualquiera de los dos puede eliminarlo
		const { error: delErr } = await adminClient
			.from("internal_chats")
			.delete()
			.eq("id", chatId);

		if (delErr) {
			console.error("[DELETE /api/internal-chat/[id]] error:", delErr);
			return NextResponse.json({ error: "Error al eliminar chat" }, { status: 500 });
		}

		if (ctx.accountId) {
			await broadcastChatUpdated(ctx.accountId, chatId);
		}

		return NextResponse.json({ success: true, action: "deleted" });
	} catch (err) {
		return toErrorResponse(err);
	}
}
