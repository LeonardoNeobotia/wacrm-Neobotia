import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getCurrentAccount, toErrorResponse } from "@/lib/auth/account";
import { sendTaskAssignedEmail } from "@/lib/email/resend";
import type { InternalChatTask } from "@/types";

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

// GET /api/internal-chat/[id]/tasks — Obtener todas las tareas del chat
export async function GET(request: Request, { params }: RouteParams) {
	try {
		const { id: chatId } = await params;
		const ctx = await getCurrentAccount();
		const adminClient = getAdminClient();

		// Verificar pertenencia al chat
		const { data: member, error: memErr } = await adminClient
			.from("internal_chat_members")
			.select("status")
			.eq("chat_id", chatId)
			.eq("user_id", ctx.userId)
			.single();

		if (memErr || !member) {
			return NextResponse.json({ error: "No tienes acceso a este chat" }, { status: 403 });
		}

		// Consultar tareas
		const { data: rawTasks, error: tasksErr } = await adminClient
			.from("internal_chat_tasks")
			.select("*")
			.eq("chat_id", chatId)
			.order("created_at", { ascending: false });

		if (tasksErr) {
			// Si la tabla aun no existe en Postgres (codigo 42P01), devolver lista vacia de forma segura
			if (tasksErr.code === "42P01") {
				return NextResponse.json({ tasks: [], pendingMigration: true });
			}
			console.error("[GET /api/internal-chat/[id]/tasks] error:", tasksErr);
			return NextResponse.json({ error: "Error al cargar tareas" }, { status: 500 });
		}

		// Enriquecer con perfiles de creador y asignado
		const userIds = Array.from(
			new Set(
				(rawTasks || [])
					.flatMap((t: any) => [t.created_by, t.assigned_to])
					.filter(Boolean)
			)
		);

		const { data: profiles } = userIds.length > 0
			? await adminClient
				.from("profiles")
				.select("user_id, full_name, avatar_url")
				.in("user_id", userIds)
			: { data: [] };

		const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

		const tasks: InternalChatTask[] = (rawTasks || []).map((t: any) => ({
			...t,
			creator_profile: t.created_by ? profileMap.get(t.created_by) || null : null,
			assignee_profile: t.assigned_to ? profileMap.get(t.assigned_to) || null : null,
		}));

		return NextResponse.json(
			{ tasks },
			{
				headers: {
					"Cache-Control": "no-store, no-cache, must-revalidate",
					Pragma: "no-cache",
				},
			}
		);
	} catch (err) {
		return toErrorResponse(err);
	}
}

// POST /api/internal-chat/[id]/tasks — Crear una nueva tarea
export async function POST(request: Request, { params }: RouteParams) {
	try {
		const { id: chatId } = await params;
		const ctx = await getCurrentAccount();
		const body = await request.json();
		const {
			title,
			description,
			priority = "medium",
			assigned_to,
			due_date,
		} = body;

		if (!title?.trim()) {
			return NextResponse.json({ error: "El título de la tarea es obligatorio" }, { status: 400 });
		}

		const adminClient = getAdminClient();

		// Verificar membresia aceptada
		const { data: member, error: memErr } = await adminClient
			.from("internal_chat_members")
			.select("status")
			.eq("chat_id", chatId)
			.eq("user_id", ctx.userId)
			.single();

		if (memErr || !member || member.status !== "accepted") {
			return NextResponse.json(
				{ error: "Debes aceptar la invitación antes de crear tareas" },
				{ status: 403 }
			);
		}

		const { data: newTask, error: insertErr } = await adminClient
			.from("internal_chat_tasks")
			.insert({
				chat_id: chatId,
				account_id: ctx.accountId,
				created_by: ctx.userId,
				assigned_to: assigned_to || null,
				title: title.trim(),
				description: description?.trim() || null,
				priority,
				status: "pending",
				due_date: due_date || null,
			})
			.select("*")
			.single();

		if (insertErr || !newTask) {
			console.error("[POST /api/internal-chat/[id]/tasks] error:", insertErr);
			return NextResponse.json(
				{ error: insertErr?.message || "Error al crear tarea. Asegúrate de haber ejecutado la migración de base de datos." },
				{ status: 500 }
			);
		}

		// Obtener informacion del chat para contextualizar las notificaciones
		const { data: chatData } = await adminClient
			.from("internal_chats")
			.select("id, name, type, is_group")
			.eq("id", chatId)
			.single();

		const isGroup = Boolean(chatData?.is_group || chatData?.type === "group");

		// Obtener todos los miembros del chat excluyendo al creador de la tarea
		const { data: otherMembers } = await adminClient
			.from("internal_chat_members")
			.select("user_id, status")
			.eq("chat_id", chatId)
			.neq("user_id", ctx.userId)
			.in("status", ["accepted", "pending"]);

		const recipientUserIds = (otherMembers || []).map((m: any) => m.user_id);

		// Cargar perfiles de creador, asignado y todos los miembros destinatarios
		const profilesToLoad = Array.from(new Set([ctx.userId, assigned_to, ...recipientUserIds].filter(Boolean)));
		const { data: profiles } = await adminClient
			.from("profiles")
			.select("user_id, full_name, avatar_url, email")
			.in("user_id", profilesToLoad);

		const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

		// Mapa de correos con fallback a auth.admin si el perfil no tiene email registrado
		const emailMap = new Map<string, string>();
		for (const p of profiles || []) {
			if (p.email) emailMap.set(p.user_id, p.email);
		}

		for (const uid of recipientUserIds) {
			if (!emailMap.has(uid)) {
				try {
					const { data: authUser } = await adminClient.auth.admin.getUserById(uid);
					if (authUser?.user?.email) {
						emailMap.set(uid, authUser.user.email);
					}
				} catch {
					// Fallback silencioso
				}
			}
		}

		const creatorProfile = profileMap.get(ctx.userId);
		const assigneeProfile = assigned_to ? profileMap.get(assigned_to) : null;
		const chatDisplayName = chatData?.name || (isGroup ? "Grupo de Trabajo" : creatorProfile?.full_name ? `Chat con ${creatorProfile.full_name}` : "Chat Interno");

		// Enviar correo con los detalles de la tarea a todos los destinatarios correspondientes
		for (const uid of recipientUserIds) {
			const targetEmail = emailMap.get(uid);
			if (!targetEmail) continue;

			const recipientProfile = profileMap.get(uid);
			const isDirectAssignee = assigned_to === uid;

			sendTaskAssignedEmail({
				toEmail: targetEmail,
				recipientName: recipientProfile?.full_name || undefined,
				assignedByName: creatorProfile?.full_name || "Un compañero de equipo",
				assigneeName: assigneeProfile?.full_name || (isGroup ? "Todo el grupo" : undefined),
				isDirectAssignee,
				taskTitle: newTask.title,
				taskDescription: newTask.description || undefined,
				taskPriority: newTask.priority,
				dueDate: newTask.due_date,
				chatName: chatDisplayName,
				chatId,
				isGroup,
			}).catch((err) => {
				console.warn("[tasks] Error al enviar email de tarea a:", targetEmail, err);
			});
		}

		// Insertar notificaciones dentro de la aplicacion para los miembros
		if (recipientUserIds.length > 0 && ctx.accountId) {
			try {
				const notificationsToInsert = recipientUserIds.map((uid) => ({
					account_id: ctx.accountId,
					user_id: uid,
					type: "internal_chat_task",
					chat_id: chatId,
					actor_user_id: ctx.userId,
					title: isGroup ? `Nueva tarea en grupo: ${newTask.title}` : `Nueva tarea: ${newTask.title}`,
					body: `${creatorProfile?.full_name || "Un compañero"} creó la tarea: "${newTask.title}".`,
				}));
				await adminClient.from("notifications").insert(notificationsToInsert);
			} catch {
				// Falla silenciosa si las notificaciones internas fallan
			}
		}

		const taskWithProfiles: InternalChatTask = {
			...newTask,
			creator_profile: profileMap.get(ctx.userId) || null,
			assignee_profile: assigned_to ? profileMap.get(assigned_to) || null : null,
		};

		return NextResponse.json({ task: taskWithProfiles });
	} catch (err) {
		return toErrorResponse(err);
	}
}
