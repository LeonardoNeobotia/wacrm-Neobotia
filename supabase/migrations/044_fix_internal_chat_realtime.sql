-- Migration 044: Fix Supabase Realtime publication for internal chat tables
-- Agrega de forma segura e independiente cada tabla de chat interno a supabase_realtime.

ALTER TABLE IF EXISTS internal_chats REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS internal_chat_members REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS internal_messages REPLICA IDENTITY FULL;

DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
		BEGIN
			ALTER PUBLICATION supabase_realtime ADD TABLE internal_chats;
		EXCEPTION WHEN duplicate_object THEN NULL;
		END;

		BEGIN
			ALTER PUBLICATION supabase_realtime ADD TABLE internal_chat_members;
		EXCEPTION WHEN duplicate_object THEN NULL;
		END;

		BEGIN
			ALTER PUBLICATION supabase_realtime ADD TABLE internal_messages;
		EXCEPTION WHEN duplicate_object THEN NULL;
		END;
	END IF;
END $$;
