-- ============================================================
-- 046_fix_internal_chat_realtime_recursion.sql
-- Solución a recursión infinita en RLS y Supabase Realtime
-- ============================================================

-- 1. Redefinir is_chat_member en PL/pgSQL con SECURITY DEFINER
-- Al usar PL/pgSQL en lugar de SQL plano, PostgreSQL no inlinea la función en el AST
-- de la consulta del planificador. Con SECURITY DEFINER y propietario postgres,
-- omite RLS al consultar internal_chat_members, evitando la recursión infinita (error 42P17).

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

-- 2. Redefinir is_chat_accepted_member en PL/pgSQL con SECURITY DEFINER
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

-- 3. Actualizar políticas de internal_chat_members para evitar cualquier subconsulta cíclica
DROP POLICY IF EXISTS "Members can view chat participants" ON public.internal_chat_members;
CREATE POLICY "Members can view chat participants" ON public.internal_chat_members
	FOR SELECT USING (
		user_id = auth.uid() OR public.is_chat_member(chat_id, auth.uid())
	);

DROP POLICY IF EXISTS "Chat creators and admins can add members" ON public.internal_chat_members;
CREATE POLICY "Chat creators and admins can add members" ON public.internal_chat_members
	FOR INSERT WITH CHECK (
		user_id = auth.uid()
		OR EXISTS (
			SELECT 1 FROM public.internal_chats
			WHERE public.internal_chats.id = internal_chat_members.chat_id
			AND public.internal_chats.created_by = auth.uid()
		)
		OR public.is_chat_accepted_member(chat_id, auth.uid())
	);

DROP POLICY IF EXISTS "Members can update their own status or last_read" ON public.internal_chat_members;
CREATE POLICY "Members can update their own status or last_read" ON public.internal_chat_members
	FOR UPDATE USING (
		user_id = auth.uid()
	) WITH CHECK (
		user_id = auth.uid()
	);
