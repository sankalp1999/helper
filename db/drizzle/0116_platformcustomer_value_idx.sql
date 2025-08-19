-- Adds index to support value-based filters and ordering

CREATE INDEX CONCURRENTLY IF NOT EXISTS "platformcustomer_value_idx"
  ON "mailboxes_platformcustomer" ("value" DESC NULLS LAST);


