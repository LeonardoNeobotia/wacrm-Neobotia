-- ============================================================
-- 043_internal_chat.sql — Chat Interno y Grupos entre Miembros
-- ============================================================

-- 1. Tabla de Chats Internos (Directos o Grupos)
CREATE TABLE IF NOT EXISTS internal_chats (
	id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
	account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
	type TEXT NOT NULL CHECK (type IN ('direct', 'group')),
	name TEXT,
	description TEXT,
	avatar_url TEXT,
	color TEXT DEFAULT '#10b981',
	created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_internal_chats_account_updated
	ON internal_chats(account_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_internal_chats_created_by
	ON internal_chats(created_by);

-- 2. Tabla de Miembros del Chat e Invitaciones
CREATE TABLE IF NOT EXISTS internal_chat_members (
	id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
	chat_id UUID NOT NULL REFERENCES internal_chats(id) ON DELETE CASCADE,
	user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
	status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
	invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
	invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	joined_at TIMESTAMPTZ,
	last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	CONSTRAINT uq_internal_chat_member UNIQUE (chat_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_internal_chat_members_chat
	ON internal_chat_members(chat_id);

CREATE INDEX IF NOT EXISTS idx_internal_chat_members_user_status
	ON internal_chat_members(user_id, status);

-- 3. Tabla de Mensajes Internos
CREATE TABLE IF NOT EXISTS internal_messages (
	id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
	chat_id UUID NOT NULL REFERENCES internal_chats(id) ON DELETE CASCADE,
	sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
	text TEXT NOT NULL,
	message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system')),
	file_url TEXT,
	file_name TEXT,
	file_size INTEGER,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_internal_messages_chat_created
	ON internal_messages(chat_id, created_at ASC);

-- 4. Soporte para notificaciones de invitaciones en tabla notifications
DO $$
BEGIN
	-- Ajustar restriccion de tipo en notifications para permitir 'chat_invitation'
	ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
	ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
		CHECK (type IN ('conversation_assigned', 'chat_invitation'));

	-- Agregar columna opcional chat_id si no existe
	IF NOT EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_name = 'notifications' AND column_name = 'chat_id'
	) THEN
		ALTER TABLE notifications ADD COLUMN chat_id UUID REFERENCES internal_chats(id) ON DELETE CASCADE;
	END IF;
END $$;

-- 5. Habilitar Row Level Security (RLS)
ALTER TABLE internal_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_messages ENABLE ROW LEVEL SECURITY;

-- Funciones de ayuda con SECURITY DEFINER para evitar recursión en las políticas RLS
CREATE OR REPLACE FUNCTION is_chat_member(p_chat_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
	SELECT EXISTS (
		SELECT 1 FROM internal_chat_members
		WHERE chat_id = p_chat_id
		AND user_id = p_user_id
		AND status IN ('accepted', 'pending')
	);
$$;

CREATE OR REPLACE FUNCTION is_chat_accepted_member(p_chat_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
	SELECT EXISTS (
		SELECT 1 FROM internal_chat_members
		WHERE chat_id = p_chat_id
		AND user_id = p_user_id
		AND status = 'accepted'
	);
$$;

-- Politicas para internal_chats
DROP POLICY IF EXISTS "Members can view their chats" ON internal_chats;
CREATE POLICY "Members can view their chats" ON internal_chats
	FOR SELECT USING (
		is_chat_member(id, auth.uid())
	);

DROP POLICY IF EXISTS "Account members can create chats" ON internal_chats;
CREATE POLICY "Account members can create chats" ON internal_chats
	FOR INSERT WITH CHECK (
		is_account_member(account_id) AND created_by = auth.uid()
	);

DROP POLICY IF EXISTS "Admins can update their chats" ON internal_chats;
CREATE POLICY "Admins can update their chats" ON internal_chats
	FOR UPDATE USING (
		EXISTS (
			SELECT 1 FROM internal_chat_members
			WHERE internal_chat_members.chat_id = internal_chats.id
			AND internal_chat_members.user_id = auth.uid()
			AND internal_chat_members.role = 'admin'
			AND internal_chat_members.status = 'accepted'
		)
	);

-- Politicas para internal_chat_members
DROP POLICY IF EXISTS "Members can view chat participants" ON internal_chat_members;
CREATE POLICY "Members can view chat participants" ON internal_chat_members
	FOR SELECT USING (
		user_id = auth.uid() OR is_chat_member(chat_id, auth.uid())
	);

DROP POLICY IF EXISTS "Chat creators and admins can add members" ON internal_chat_members;
CREATE POLICY "Chat creators and admins can add members" ON internal_chat_members
	FOR INSERT WITH CHECK (
		-- El propio creador al inicio o un admin existente
		user_id = auth.uid()
		OR EXISTS (
			SELECT 1 FROM internal_chats
			WHERE internal_chats.id = internal_chat_members.chat_id
			AND internal_chats.created_by = auth.uid()
		)
		OR EXISTS (
			SELECT 1 FROM internal_chat_members m
			WHERE m.chat_id = internal_chat_members.chat_id
			AND m.user_id = auth.uid()
			AND m.role = 'admin'
			AND m.status = 'accepted'
		)
	);

DROP POLICY IF EXISTS "Members can update their own status or last_read" ON internal_chat_members;
CREATE POLICY "Members can update their own status or last_read" ON internal_chat_members
	FOR UPDATE USING (
		user_id = auth.uid()
	) WITH CHECK (
		user_id = auth.uid()
	);

-- Politicas para internal_messages
DROP POLICY IF EXISTS "Chat members can read messages" ON internal_messages;
CREATE POLICY "Chat members can read messages" ON internal_messages
	FOR SELECT USING (
		is_chat_member(chat_id, auth.uid())
	);

DROP POLICY IF EXISTS "Accepted members can post messages" ON internal_messages;
CREATE POLICY "Accepted members can post messages" ON internal_messages
	FOR INSERT WITH CHECK (
		(sender_id = auth.uid() OR sender_id IS NULL)
		AND is_chat_accepted_member(chat_id, auth.uid())
	);

-- 6. Habilitar Replicacion en Tiempo Real (Supabase Realtime)
ALTER TABLE internal_chats REPLICA IDENTITY FULL;
ALTER TABLE internal_chat_members REPLICA IDENTITY FULL;
ALTER TABLE internal_messages REPLICA IDENTITY FULL;

DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
		ALTER PUBLICATION supabase_realtime ADD TABLE internal_chats;
		ALTER PUBLICATION supabase_realtime ADD TABLE internal_chat_members;
		ALTER PUBLICATION supabase_realtime ADD TABLE internal_messages;
	END IF;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
