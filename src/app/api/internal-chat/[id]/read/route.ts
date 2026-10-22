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
	params: Promise<{ id: string }>;
}

// POST /api/internal-chat/[id]/read — Marcar todos los mensajes del chat como leidos
export async function POST(request: Request, { params }: RouteParams) {
	try {
		const { id: chatId } = await params;
		const ctx = await getCurrentAccount();
		const adminClient = getAdminClient();

		await adminClient
			.from("internal_chat_members")
			.update({ last_read_at: new Date().toISOString() })
			.eq("chat_id", chatId)
			.eq("user_id", ctx.userId);

		return NextResponse.json({ success: true });
	} catch (err) {
		return toErrorResponse(err);
	}
}
