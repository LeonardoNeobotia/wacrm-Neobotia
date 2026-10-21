import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getCurrentAccount, toErrorResponse } from "@/lib/auth/account";
import type { InternalChat, InternalChatMember, InternalMessage } from "@/types";

function getAdminClient() {
	return createSupabaseClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.SUPABASE_SERVICE_ROLE_KEY!
	);
}

// GET /api/internal-chat — Listar los chats donde participa el usuario actual
export async function GET() {
	try {
		const ctx = await getCurrentAccount();
		const adminClient = getAdminClient();

		// 1. Obtener membresias del usuario actual
		const { data: myMemberships, error: memErr } = await adminClient
			.from("internal_chat_members")
			.select("*, chat:internal_chats(*)")
			.eq("user_id", ctx.userId)
			.in("status", ["accepted", "pending"]);

		if (memErr) {
			console.error("[GET /api/internal-chat] memberships error:", memErr);
			return NextResponse.json({ error: "Error al cargar chats" }, { status: 500 });
		}

		if (!myMemberships || myMemberships.length === 0) {
			return NextResponse.json({ chats: [] });
		}

		const chatIds = myMemberships.map((m) => m.chat_id);

		// 2. Cargar todos los miembros de estos chats
		const { data: allMembers, error: allMemErr } = await adminClient
			.from("internal_chat_members")
			.select("*")
			.in("chat_id", chatIds);

		if (allMemErr) {
			console.error("[GET /api/internal-chat] allMembers error:", allMemErr);
		}

		// 3. Cargar los mensajes recientes de cada chat
		const { data: recentMessages, error: msgErr } = await adminClient
			.from("internal_messages")
			.select("*")
			.in("chat_id", chatIds)
			.order("created_at", { ascending: false });

		if (msgErr) {
			console.error("[GET /api/internal-chat] messages error:", msgErr);
		}

		// 4. Obtener perfiles de usuarios involucrados para evitar errores de join en PostgREST
		const memberUserIds = (allMembers || []).map((m: any) => m.user_id);
		const senderUserIds = (recentMessages || []).map((msg: any) => msg.sender_id).filter(Boolean);
		const uniqueUserIds = Array.from(new Set([...memberUserIds, ...senderUserIds]));

		const { data: profiles } = uniqueUserIds.length > 0
			? await adminClient
				.from("profiles")
				.select("user_id, full_name, email, avatar_url, account_role")
				.in("user_id", uniqueUserIds)
			: { data: [] };

		const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

		// Agrupar miembros por chat
		const membersByChat: Record<string, InternalChatMember[]> = {};
		(allMembers || []).forEach((m: any) => {
			if (!membersByChat[m.chat_id]) membersByChat[m.chat_id] = [];
			membersByChat[m.chat_id].push({
				...m,
				profile: profileMap.get(m.user_id) || null,
			});
		});

		const lastMessageByChat: Record<string, InternalMessage> = {};
		const unreadCountByChat: Record<string, number> = {};

		// Inicializar contadores
		chatIds.forEach((cid) => {
			unreadCountByChat[cid] = 0;
		});

		(recentMessages || []).forEach((msg: any) => {
			if (!lastMessageByChat[msg.chat_id]) {
				lastMessageByChat[msg.chat_id] = {
					...msg,
					sender_profile: msg.sender_id ? profileMap.get(msg.sender_id) || null : null,
				};
			}
			// Calcular no leidos comparando con last_read_at del usuario
			const myMem = myMemberships.find((m) => m.chat_id === msg.chat_id);
			if (myMem && myMem.status === "accepted") {
				const isAfterLastRead = new Date(msg.created_at) > new Date(myMem.last_read_at);
				const isFromOther = msg.sender_id !== ctx.userId;
				if (isAfterLastRead && isFromOther) {
					unreadCountByChat[msg.chat_id] = (unreadCountByChat[msg.chat_id] || 0) + 1;
				}
			}
		});

		// Construir lista de chats formateada
		const chats: InternalChat[] = myMemberships
			.filter((m) => m.chat)
			.map((m) => {
				const chat = m.chat;
				return {
					id: chat.id,
					account_id: chat.account_id,
					type: chat.type,
					name: chat.name,
					description: chat.description,
					avatar_url: chat.avatar_url,
					color: chat.color || "#10b981",
					created_by: chat.created_by,
					created_at: chat.created_at,
					updated_at: chat.updated_at,
					members: membersByChat[chat.id] || [],
					last_message: lastMessageByChat[chat.id] || null,
					unread_count: unreadCountByChat[chat.id] || 0,
					my_membership: {
						id: m.id,
						chat_id: m.chat_id,
						user_id: m.user_id,
						role: m.role,
						status: m.status,
						invited_by: m.invited_by,
						invited_at: m.invited_at,
						joined_at: m.joined_at,
						last_read_at: m.last_read_at,
						created_at: m.created_at,
					},
				};
			})
			.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

		return NextResponse.json({ chats });
	} catch (err) {
		return toErrorResponse(err);
	}
}

// POST /api/internal-chat — Crear un nuevo chat directo o grupo
export async function POST(request: Request) {
	try {
		const ctx = await getCurrentAccount();
		const body = await request.json();
		const { type, name, description, color, member_user_ids } = body;

		if (type !== "direct" && type !== "group") {
			return NextResponse.json({ error: "Tipo de chat no valido" }, { status: 400 });
		}

		if (!Array.isArray(member_user_ids) || member_user_ids.length === 0) {
			return NextResponse.json({ error: "Debes seleccionar al menos un miembro" }, { status: 400 });
		}

		const adminClient = getAdminClient();

		// Obtener nombre del creador
		const { data: creatorProfile } = await adminClient
			.from("profiles")
			.select("full_name, email")
			.eq("user_id", ctx.userId)
			.single();

		const creatorName = creatorProfile?.full_name || creatorProfile?.email || "Usuario";

		// Para chats directos: si ya existe un chat 1-a-1 entre ambos usuarios, retornar el existente
		if (type === "direct") {
			const targetUserId = member_user_ids[0];

			// Buscar si ya comparten un chat directo
			const { data: existingChats } = await adminClient
				.from("internal_chat_members")
				.select("chat_id, chat:internal_chats!inner(id, type, account_id)")
				.eq("user_id", ctx.userId)
				.eq("chat.type", "direct")
				.eq("chat.account_id", ctx.accountId);

			if (existingChats && existingChats.length > 0) {
				const directChatIds = existingChats.map((c: any) => c.chat_id);
				const { data: otherMember } = await adminClient
					.from("internal_chat_members")
					.select("chat_id")
					.in("chat_id", directChatIds)
					.eq("user_id", targetUserId)
					.maybeSingle();

				if (otherMember) {
					// Ya existe un chat directo
					return NextResponse.json({
						chat_id: otherMember.chat_id,
						already_exists: true,
					});
				}
			}
		}

		// Definir nombre por defecto
		let finalName = name?.trim();
		if (type === "group" && !finalName) {
			finalName = `Grupo de ${creatorName}`;
		}

		// 1. Crear el chat
		const { data: chat, error: chatErr } = await adminClient
			.from("internal_chats")
			.insert({
				account_id: ctx.accountId,
				type,
				name: finalName || null,
				description: description?.trim() || null,
				color: color || "#10b981",
				created_by: ctx.userId,
			})
			.select()
			.single();

		if (chatErr || !chat) {
			console.error("[POST /api/internal-chat] create error:", chatErr);
			return NextResponse.json({ error: "Error al crear el chat" }, { status: 500 });
		}

		// 2. Agregar al creador como admin aceptado
		await adminClient.from("internal_chat_members").insert({
			chat_id: chat.id,
			user_id: ctx.userId,
			role: "admin",
			status: "accepted",
			joined_at: new Date().toISOString(),
			last_read_at: new Date().toISOString(),
		});

		// 3. Agregar los miembros invitados con estado pendiente
		const invitedMembers = member_user_ids
			.filter((uid: string) => uid !== ctx.userId)
			.map((uid: string) => ({
				chat_id: chat.id,
				user_id: uid,
				role: "member",
				status: "pending",
				invited_by: ctx.userId,
			}));

		if (invitedMembers.length > 0) {
			await adminClient.from("internal_chat_members").insert(invitedMembers);

			// 4. Crear notificaciones en campana para los invitados
			const notificationsToInsert = invitedMembers.map((m: any) => ({
				account_id: ctx.accountId,
				user_id: m.user_id,
				type: "chat_invitation",
				chat_id: chat.id,
				actor_user_id: ctx.userId,
				title:
					type === "group"
						? `Invitacion al grupo: ${finalName}`
						: `Invitacion a chat de ${creatorName}`,
				body:
					type === "group"
						? `${creatorName} te invito a unirte al grupo "${finalName}".`
						: `${creatorName} quiere iniciar una conversacion directa contigo.`,
			}));

			await adminClient.from("notifications").insert(notificationsToInsert);
		}

		// 5. Insertar mensaje inicial del sistema
		const initialText =
			type === "group"
				? `${creatorName} creo el grupo "${finalName}"`
				: `Chat directo iniciado por ${creatorName}`;

		await adminClient.from("internal_messages").insert({
			chat_id: chat.id,
			sender_id: null,
			text: initialText,
			message_type: "system",
		});

		return NextResponse.json({ chat_id: chat.id, chat });
	} catch (err) {
		return toErrorResponse(err);
	}
}
