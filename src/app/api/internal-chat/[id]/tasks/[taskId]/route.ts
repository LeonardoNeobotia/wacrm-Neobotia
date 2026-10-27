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
	params: Promise<{ id: string; taskId: string }>;
}

// PATCH /api/internal-chat/[id]/tasks/[taskId] — Actualizar tarea (completar, cambiar prioridad, reasignar)
export async function PATCH(request: Request, { params }: RouteParams) {
	try {
		const { id: chatId, taskId } = await params;
		const ctx = await getCurrentAccount();
		const body = await request.json();
		const adminClient = getAdminClient();

		const { status, title, description, priority, assigned_to, due_date } = body;
		const updateData: Record<string, any> = {
			updated_at: new Date().toISOString(),
		};

		if (status !== undefined) {
			updateData.status = status;
			updateData.completed_at = status === "completed" ? new Date().toISOString() : null;
		}
		if (title !== undefined) updateData.title = String(title).trim();
		if (description !== undefined) updateData.description = description ? String(description).trim() : null;
		if (priority !== undefined) updateData.priority = priority;
		if (assigned_to !== undefined) updateData.assigned_to = assigned_to || null;
		if (due_date !== undefined) updateData.due_date = due_date || null;

		const { data: updatedTask, error: updateErr } = await adminClient
			.from("internal_chat_tasks")
			.update(updateData)
			.eq("id", taskId)
			.eq("chat_id", chatId)
			.select("*")
			.single();

		if (updateErr) {
			return NextResponse.json({ error: updateErr.message }, { status: 500 });
		}

		return NextResponse.json({ task: updatedTask });
	} catch (err) {
		return toErrorResponse(err);
	}
}

// DELETE /api/internal-chat/[id]/tasks/[taskId] — Eliminar tarea
export async function DELETE(request: Request, { params }: RouteParams) {
	try {
		const { id: chatId, taskId } = await params;
		const ctx = await getCurrentAccount();
		const adminClient = getAdminClient();

		const { error: delErr } = await adminClient
			.from("internal_chat_tasks")
			.delete()
			.eq("id", taskId)
			.eq("chat_id", chatId);

		if (delErr) {
			return NextResponse.json({ error: delErr.message }, { status: 500 });
		}

		return NextResponse.json({ success: true });
	} catch (err) {
		return toErrorResponse(err);
	}
}
