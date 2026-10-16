-- Migration 042: Web Form Submissions
CREATE TABLE IF NOT EXISTS web_form_submissions (
	id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
	account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
	form_id UUID NOT NULL REFERENCES web_forms(id) ON DELETE CASCADE,
	contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
	deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
	data JSONB NOT NULL DEFAULT '{}'::jsonb,
	ip_address TEXT,
	user_agent TEXT,
	created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_web_form_submissions_account_created
	ON web_form_submissions(account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_web_form_submissions_form
	ON web_form_submissions(form_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_web_form_submissions_contact
	ON web_form_submissions(contact_id);

ALTER TABLE web_form_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view account form submissions" ON web_form_submissions;
CREATE POLICY "Users can view account form submissions" ON web_form_submissions
	FOR SELECT USING (is_account_member(account_id));

DROP POLICY IF EXISTS "Service role can insert submissions" ON web_form_submissions;
CREATE POLICY "Service role can insert submissions" ON web_form_submissions
	FOR INSERT WITH CHECK (true);
