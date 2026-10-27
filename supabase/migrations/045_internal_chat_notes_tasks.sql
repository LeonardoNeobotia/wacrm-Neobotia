-- ============================================================
-- 045_internal_chat_notes_tasks.sql
-- Notas, Tareas y Soporte para Video/Audio en Chat Interno
-- ============================================================

-- 1. Actualizar restriccion de tipos de mensaje en internal_messages para soportar 'video' y 'audio'
ALTER TABLE IF EXISTS internal_messages DROP CONSTRAINT IF EXISTS internal_messages_message_type_check;
ALTER TABLE IF EXISTS internal_messages ADD CONSTRAINT internal_messages_message_type_check
	CHECK (message_type IN ('text', 'image', 'video', 'audio', 'file', 'system'));

-- 2. Asegurar existencia de funciones auxiliares de comprobación de miembros (con schema public explícito y PL/pgSQL)
CREATE OR REPLACE FUNCTION public.is_chat_member(p_chat_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
	v_exists BOOLEAN;
BEGIN
	SELECT EXISTS (
		SELECT 1 FROM public.internal_chat_members
		WHERE chat_id = p_chat_id
		AND user_id = p_user_id
		AND status IN ('accepted', 'pending')
	) INTO v_exists;
	RETURN COALESCE(v_exists, false);
END;
$$;

ALTER FUNCTION public.is_chat_member(UUID, UUID) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.is_chat_member(UUID, UUID) TO authenticated, service_role, anon;

CREATE OR REPLACE FUNCTION public.is_chat_accepted_member(p_chat_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
	v_exists BOOLEAN;
BEGIN
	SELECT EXISTS (
		SELECT 1 FROM public.internal_chat_members
		WHERE chat_id = p_chat_id
		AND user_id = p_user_id
		AND status = 'accepted'
	) INTO v_exists;
	RETURN COALESCE(v_exists, false);
END;
$$;

ALTER FUNCTION public.is_chat_accepted_member(UUID, UUID) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.is_chat_accepted_member(UUID, UUID) TO authenticated, service_role, anon;

-- 3. Tabla de Notas del Chat Interno
CREATE TABLE IF NOT EXISTS public.internal_chat_notes (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	chat_id UUID NOT NULL REFERENCES public.internal_chats(id) ON DELETE CASCADE,
	account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
	created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
	title TEXT,
	content TEXT NOT NULL,
	color TEXT DEFAULT 'amber',
	is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_internal_chat_notes_chat
	ON public.internal_chat_notes(chat_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_internal_chat_notes_account
	ON public.internal_chat_notes(account_id);

-- 4. Tabla de Tareas del Chat Interno
CREATE TABLE IF NOT EXISTS public.internal_chat_tasks (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	chat_id UUID NOT NULL REFERENCES public.internal_chats(id) ON DELETE CASCADE,
	account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
	created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
	assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
	title TEXT NOT NULL,
	description TEXT,
	priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
	status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
	due_date TIMESTAMPTZ,
	completed_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_internal_chat_tasks_chat
	ON public.internal_chat_tasks(chat_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_internal_chat_tasks_account_status
	ON public.internal_chat_tasks(account_id, status);

-- 5. Habilitar Seguridad a Nivel de Fila (RLS)
ALTER TABLE public.internal_chat_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_chat_tasks ENABLE ROW LEVEL SECURITY;

-- Politicas para internal_chat_notes (autónomas sin depender de funciones externas)
DROP POLICY IF EXISTS "Members can view chat notes" ON public.internal_chat_notes;
CREATE POLICY "Members can view chat notes" ON public.internal_chat_notes
	FOR SELECT USING (
		EXISTS (
			SELECT 1 FROM public.internal_chat_members m
			WHERE m.chat_id = internal_chat_notes.chat_id
			AND m.user_id = auth.uid()
			AND m.status IN ('accepted', 'pending')
		)
	);

DROP POLICY IF EXISTS "Accepted members can insert chat notes" ON public.internal_chat_notes;
CREATE POLICY "Accepted members can insert chat notes" ON public.internal_chat_notes
	FOR INSERT WITH CHECK (
		EXISTS (
			SELECT 1 FROM public.internal_chat_members m
			WHERE m.chat_id = internal_chat_notes.chat_id
			AND m.user_id = auth.uid()
			AND m.status = 'accepted'
		)
	);

DROP POLICY IF EXISTS "Members can update their notes or admins" ON public.internal_chat_notes;
CREATE POLICY "Members can update their notes or admins" ON public.internal_chat_notes
	FOR UPDATE USING (
		created_by = auth.uid()
		OR EXISTS (
			SELECT 1 FROM public.internal_chat_members m
			WHERE m.chat_id = internal_chat_notes.chat_id
			AND m.user_id = auth.uid()
			AND m.status = 'accepted'
		)
	);

DROP POLICY IF EXISTS "Members can delete their notes or admins" ON public.internal_chat_notes;
CREATE POLICY "Members can delete their notes or admins" ON public.internal_chat_notes
	FOR DELETE USING (
		created_by = auth.uid()
		OR EXISTS (
			SELECT 1 FROM public.internal_chat_members m
			WHERE m.chat_id = internal_chat_notes.chat_id
			AND m.user_id = auth.uid()
			AND m.role = 'admin'
			AND m.status = 'accepted'
		)
	);

-- Politicas para internal_chat_tasks (autónomas sin depender de funciones externas)
DROP POLICY IF EXISTS "Members can view chat tasks" ON public.internal_chat_tasks;
CREATE POLICY "Members can view chat tasks" ON public.internal_chat_tasks
	FOR SELECT USING (
		EXISTS (
			SELECT 1 FROM public.internal_chat_members m
			WHERE m.chat_id = internal_chat_tasks.chat_id
			AND m.user_id = auth.uid()
			AND m.status IN ('accepted', 'pending')
		)
	);

DROP POLICY IF EXISTS "Accepted members can insert chat tasks" ON public.internal_chat_tasks;
CREATE POLICY "Accepted members can insert chat tasks" ON public.internal_chat_tasks
	FOR INSERT WITH CHECK (
		EXISTS (
			SELECT 1 FROM public.internal_chat_members m
			WHERE m.chat_id = internal_chat_tasks.chat_id
			AND m.user_id = auth.uid()
			AND m.status = 'accepted'
		)
	);

DROP POLICY IF EXISTS "Members can update chat tasks" ON public.internal_chat_tasks;
CREATE POLICY "Members can update chat tasks" ON public.internal_chat_tasks
	FOR UPDATE USING (
		EXISTS (
			SELECT 1 FROM public.internal_chat_members m
			WHERE m.chat_id = internal_chat_tasks.chat_id
			AND m.user_id = auth.uid()
			AND m.status = 'accepted'
		)
	);

DROP POLICY IF EXISTS "Members can delete chat tasks" ON public.internal_chat_tasks;
CREATE POLICY "Members can delete chat tasks" ON public.internal_chat_tasks
	FOR DELETE USING (
		created_by = auth.uid()
		OR EXISTS (
			SELECT 1 FROM public.internal_chat_members m
			WHERE m.chat_id = internal_chat_tasks.chat_id
			AND m.user_id = auth.uid()
			AND m.role = 'admin'
			AND m.status = 'accepted'
		)
	);

-- 6. Agregar tablas a publicacion de Realtime para sincronizacion instantanea entre usuarios
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
		BEGIN
			ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_chat_notes;
		EXCEPTION WHEN duplicate_object THEN NULL;
		END;

		BEGIN
			ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_chat_tasks;
		EXCEPTION WHEN duplicate_object THEN NULL;
		END;
	END IF;
END $$;

-- 7. Ampliar tipos MIME permitidos en el bucket 'chat-media' para incluir audio y video webm
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
	'image/png', 'image/jpeg', 'image/webp',
	'video/mp4', 'video/3gpp', 'video/webm', 'video/quicktime',
	'application/pdf',
	'application/vnd.ms-powerpoint',
	'application/msword',
	'application/vnd.ms-excel',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'application/vnd.openxmlformats-officedocument.presentationml.presentation',
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	'text/plain',
	'audio/ogg',
	'audio/mpeg',
	'audio/aac',
	'audio/mp4',
	'audio/amr',
	'audio/webm'
]
WHERE id = 'chat-media';
