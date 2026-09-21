// Additive upgrade: old images, copy, status and calendar dates remain intact.
export const creativeSchema = [
  `ALTER TABLE apsomh_content ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE apsomh_content ADD COLUMN IF NOT EXISTS design_document JSONB`,
  `ALTER TABLE apsomh_content ADD COLUMN IF NOT EXISTS updated_by VARCHAR(255)`,
  `CREATE TABLE IF NOT EXISTS apsomh_content_revisions (
    content_id INTEGER NOT NULL REFERENCES apsomh_content(id) ON DELETE CASCADE,
    revision INTEGER NOT NULL,
    snapshot JSONB NOT NULL,
    replaced_by VARCHAR(255) NOT NULL,
    replaced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (content_id, revision)
  )`,
] as const;
