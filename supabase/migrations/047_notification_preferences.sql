-- ============================================================
-- 047_notification_preferences.sql
-- Preferencias de notificaciones por correo electrónico en profiles
-- ============================================================

-- Añadir columna notification_preferences a la tabla profiles
-- Estructura esperada (JSONB):
-- {
--   "email_chat_invite": true,
--   "email_new_contact": true,
--   "email_web_lead": true,
--   "email_task_assigned": true
-- }
ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
	"email_chat_invite": true,
	"email_new_contact": true,
	"email_web_lead": true,
	"email_task_assigned": true
}'::jsonb;

-- Comentario explicativo en el catálogo de PostgreSQL
COMMENT ON COLUMN public.profiles.notification_preferences IS 'Preferencias de recepción de notificaciones por correo electrónico del usuario.';

