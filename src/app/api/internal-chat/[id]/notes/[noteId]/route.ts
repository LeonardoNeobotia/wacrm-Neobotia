import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getCurrentAccount, toErrorResponse } from "@/lib/auth/account";

export const dynamic = "force-dynamic";

function getAdminClient() {
	return createSupabaseClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.SUPABASE_SERVICE_ROLE_KEY!
	);
}

interface RouteParams {
	params: Promise<{ id: string; noteId: string }>;
}

// PATCH /api/internal-chat/[id]/notes/[noteId] — Actualizar nota
export async function PATCH(request: Request, { params }: RouteParams) {
	try {
		const { id: chatId, noteId } = await params;
		const ctx = await getCurrentAccount();
		const body = await request.json();
		const adminClient = getAdminClient();

		const { title, content, color, is_pinned } = body;
		const updateData: Record<string, any> = {
			updated_at: new Date().toISOString(),
		};

		if (title !== undefined) updateData.title = title ? String(title).trim() : null;
		if (content !== undefined) updateData.content = String(content).trim();
		if (color !== undefined) updateData.color = color;
		if (is_pinned !== undefined) updateData.is_pinned = Boolean(is_pinned);

		const { data: updatedNote, error: updateErr } = await adminClient
			.from("internal_chat_notes")
			.update(updateData)
			.eq("id", noteId)
			.eq("chat_id", chatId)
			.select("*")
			.single();

		if (updateErr) {
			return NextResponse.json({ error: updateErr.message }, { status: 500 });
		}

		return NextResponse.json({ note: updatedNote });
	} catch (err) {
		return toErrorResponse(err);
	}
}

// DELETE /api/internal-chat/[id]/notes/[noteId] — Eliminar nota
export async function DELETE(request: Request, { params }: RouteParams) {
	try {
		const { id: chatId, noteId } = await params;
		const ctx = await getCurrentAccount();
		const adminClient = getAdminClient();

		const { error: delErr } = await adminClient
			.from("internal_chat_notes")
			.delete()
			.eq("id", noteId)
			.eq("chat_id", chatId);

		if (delErr) {
			return NextResponse.json({ error: delErr.message }, { status: 500 });
		}

		return NextResponse.json({ success: true });
	} catch (err) {
		return toErrorResponse(err);
	}
}
