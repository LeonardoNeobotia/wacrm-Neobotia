import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getCurrentAccount, toErrorResponse } from "@/lib/auth/account";
import type { InternalChatNote } from "@/types";

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

// GET /api/internal-chat/[id]/notes — Obtener todas las notas del chat
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

		// Consultar notas
		const { data: rawNotes, error: notesErr } = await adminClient
			.from("internal_chat_notes")
			.select("*")
			.eq("chat_id", chatId)
			.order("is_pinned", { ascending: false })
			.order("created_at", { ascending: false });

		if (notesErr) {
			// Si la tabla aun no existe en Postgres (codigo 42P01), devolver lista vacia de forma segura
			if (notesErr.code === "42P01") {
				return NextResponse.json({ notes: [], pendingMigration: true });
			}
			console.error("[GET /api/internal-chat/[id]/notes] error:", notesErr);
			return NextResponse.json({ error: "Error al cargar notas" }, { status: 500 });
		}

		// Enriquecer con perfiles de autores
		const authorIds = Array.from(
			new Set((rawNotes || []).map((n: any) => n.created_by).filter(Boolean))
		);

		const { data: profiles } = authorIds.length > 0
			? await adminClient
				.from("profiles")
				.select("user_id, full_name, avatar_url")
				.in("user_id", authorIds)
			: { data: [] };

		const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

		const notes: InternalChatNote[] = (rawNotes || []).map((n: any) => ({
			...n,
			author_profile: n.created_by ? profileMap.get(n.created_by) || null : null,
		}));

		return NextResponse.json(
			{ notes },
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

// POST /api/internal-chat/[id]/notes — Crear una nueva nota en el chat
export async function POST(request: Request, { params }: RouteParams) {
	try {
		const { id: chatId } = await params;
		const ctx = await getCurrentAccount();
		const body = await request.json();
		const { title, content, color = "amber", is_pinned = false } = body;

		if (!content?.trim()) {
			return NextResponse.json({ error: "El contenido de la nota no puede estar vacío" }, { status: 400 });
		}

		const adminClient = getAdminClient();

		// Verificar que sea miembro aceptado
		const { data: member, error: memErr } = await adminClient
			.from("internal_chat_members")
			.select("status")
			.eq("chat_id", chatId)
			.eq("user_id", ctx.userId)
			.single();

		if (memErr || !member || member.status !== "accepted") {
			return NextResponse.json(
				{ error: "Debes aceptar la invitación antes de crear notas" },
				{ status: 403 }
			);
		}

		const { data: newNote, error: insertErr } = await adminClient
			.from("internal_chat_notes")
			.insert({
				chat_id: chatId,
				account_id: ctx.accountId,
				created_by: ctx.userId,
				title: title?.trim() || null,
				content: content.trim(),
				color,
				is_pinned: Boolean(is_pinned),
			})
			.select("*")
			.single();

		if (insertErr || !newNote) {
			console.error("[POST /api/internal-chat/[id]/notes] error:", insertErr);
			return NextResponse.json(
				{ error: insertErr?.message || "Error al crear nota. Asegúrate de haber ejecutado la migración de base de datos." },
				{ status: 500 }
			);
		}

		// Cargar perfil del creador
		const { data: creatorProf } = await adminClient
			.from("profiles")
			.select("user_id, full_name, avatar_url")
			.eq("user_id", ctx.userId)
			.single();

		const noteWithProfile: InternalChatNote = {
			...newNote,
			author_profile: creatorProf || null,
		};

		return NextResponse.json({ note: noteWithProfile });
	} catch (err) {
		return toErrorResponse(err);
	}
}
