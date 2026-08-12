-- ==============================================================================
-- Relax RLS for tags and custom_fields to allow Agent role creation/editing.
-- The previous policies restricted insert/update/delete to 'admin' and 'owner'.
-- ==============================================================================

-- 1. Drop existing admin-only policies
DROP POLICY IF EXISTS tags_insert ON tags;
DROP POLICY IF EXISTS tags_update ON tags;
DROP POLICY IF EXISTS tags_delete ON tags;

DROP POLICY IF EXISTS custom_fields_insert ON custom_fields;
DROP POLICY IF EXISTS custom_fields_update ON custom_fields;
DROP POLICY IF EXISTS custom_fields_delete ON custom_fields;

-- 2. Re-create them using 'agent' (which implicitly includes admin/owner)
CREATE POLICY tags_insert ON tags FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));
CREATE POLICY tags_update ON tags FOR UPDATE USING (is_account_member(account_id, 'agent'));
CREATE POLICY tags_delete ON tags FOR DELETE USING (is_account_member(account_id, 'agent'));

CREATE POLICY custom_fields_insert ON custom_fields FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));
CREATE POLICY custom_fields_update ON custom_fields FOR UPDATE USING (is_account_member(account_id, 'agent'));
CREATE POLICY custom_fields_delete ON custom_fields FOR DELETE USING (is_account_member(account_id, 'agent'));
