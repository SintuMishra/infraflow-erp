-- Align dispatch party linkage with the commercial/customer party master.
-- Legacy rows that were incorrectly pointing to transporter vendor ids are
-- cleared before the foreign key is repointed.

BEGIN;

UPDATE dispatch_reports dr
SET party_id = NULL
WHERE dr.party_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM party_master pm
    WHERE pm.id = dr.party_id
  );

ALTER TABLE dispatch_reports
  DROP CONSTRAINT IF EXISTS dispatch_reports_party_id_fkey;

ALTER TABLE dispatch_reports
  ADD CONSTRAINT dispatch_reports_party_id_fkey
    FOREIGN KEY (party_id) REFERENCES party_master(id);

COMMIT;
