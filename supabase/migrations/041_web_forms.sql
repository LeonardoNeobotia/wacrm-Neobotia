-- Web Forms Migration
CREATE TABLE IF NOT EXISTS web_forms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  fields_config JSONB NOT NULL DEFAULT '{"name": {"enabled": true, "required": true}, "email": {"enabled": true, "required": true}, "phone": {"enabled": false, "required": false}, "company": {"enabled": false, "required": false}}'::jsonb,
  theme_color TEXT NOT NULL DEFAULT '#3b82f6',
  pipeline_id UUID REFERENCES pipelines(id) ON DELETE SET NULL,
  stage_id UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_web_forms_account ON web_forms(account_id);

ALTER TABLE web_forms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view account web forms" ON web_forms;
CREATE POLICY "Users can view account web forms" ON web_forms FOR SELECT USING (is_account_member(account_id));

DROP POLICY IF EXISTS "Admins can insert web forms" ON web_forms;
CREATE POLICY "Admins can insert web forms" ON web_forms FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS "Admins can update web forms" ON web_forms;
CREATE POLICY "Admins can update web forms" ON web_forms FOR UPDATE USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS "Admins can delete web forms" ON web_forms;
CREATE POLICY "Admins can delete web forms" ON web_forms FOR DELETE USING (is_account_member(account_id, 'admin'));
