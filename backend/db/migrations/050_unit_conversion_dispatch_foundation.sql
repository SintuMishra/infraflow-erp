CREATE TABLE IF NOT EXISTS public.unit_master (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NULL REFERENCES public.companies(id),
  unit_code VARCHAR(40) NOT NULL,
  unit_name VARCHAR(100) NOT NULL,
  dimension_type VARCHAR(30) NOT NULL,
  precision_scale INTEGER NOT NULL DEFAULT 3,
  is_base_unit BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'unit_master_dimension_type_check'
  ) THEN
    ALTER TABLE public.unit_master
      ADD CONSTRAINT unit_master_dimension_type_check
      CHECK (dimension_type IN ('weight', 'volume', 'count', 'distance', 'time', 'custom'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'unit_master_precision_scale_check'
  ) THEN
    ALTER TABLE public.unit_master
      ADD CONSTRAINT unit_master_precision_scale_check
      CHECK (precision_scale BETWEEN 0 AND 6);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_unit_master_company_code
  ON public.unit_master (COALESCE(company_id, 0), LOWER(BTRIM(unit_code)));

CREATE UNIQUE INDEX IF NOT EXISTS uq_unit_master_company_name
  ON public.unit_master (COALESCE(company_id, 0), LOWER(BTRIM(unit_name)));

CREATE INDEX IF NOT EXISTS idx_unit_master_company_id
  ON public.unit_master (company_id);

CREATE INDEX IF NOT EXISTS idx_unit_master_dimension_type
  ON public.unit_master (dimension_type);

CREATE TABLE IF NOT EXISTS public.material_unit_conversions (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NULL REFERENCES public.companies(id),
  material_id BIGINT NOT NULL REFERENCES public.material_master(id),
  from_unit_id BIGINT NOT NULL REFERENCES public.unit_master(id),
  to_unit_id BIGINT NOT NULL REFERENCES public.unit_master(id),
  conversion_factor NUMERIC(18,6) NOT NULL,
  conversion_method VARCHAR(30) NOT NULL DEFAULT 'standard',
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE NULL,
  notes TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'material_unit_conversions_factor_check'
  ) THEN
    ALTER TABLE public.material_unit_conversions
      ADD CONSTRAINT material_unit_conversions_factor_check
      CHECK (conversion_factor > 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'material_unit_conversions_method_check'
  ) THEN
    ALTER TABLE public.material_unit_conversions
      ADD CONSTRAINT material_unit_conversions_method_check
      CHECK (
        conversion_method IN (
          'standard',
          'density_based',
          'vehicle_capacity_based',
          'manual_defined'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'material_unit_conversions_date_check'
  ) THEN
    ALTER TABLE public.material_unit_conversions
      ADD CONSTRAINT material_unit_conversions_date_check
      CHECK (effective_to IS NULL OR effective_to >= effective_from);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'material_unit_conversions_distinct_units_check'
  ) THEN
    ALTER TABLE public.material_unit_conversions
      ADD CONSTRAINT material_unit_conversions_distinct_units_check
      CHECK (from_unit_id <> to_unit_id);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_material_unit_conversion_effective
  ON public.material_unit_conversions (
    COALESCE(company_id, 0),
    material_id,
    from_unit_id,
    to_unit_id,
    effective_from
  );

CREATE INDEX IF NOT EXISTS idx_material_unit_conversions_material
  ON public.material_unit_conversions (material_id, effective_from DESC);

CREATE INDEX IF NOT EXISTS idx_material_unit_conversions_company
  ON public.material_unit_conversions (company_id);

ALTER TABLE public.party_material_rates
  ADD COLUMN IF NOT EXISTS rate_unit_id BIGINT NULL REFERENCES public.unit_master(id),
  ADD COLUMN IF NOT EXISTS billing_basis VARCHAR(30) NULL,
  ADD COLUMN IF NOT EXISTS conversion_id BIGINT NULL REFERENCES public.material_unit_conversions(id),
  ADD COLUMN IF NOT EXISTS price_per_unit NUMERIC(12,2) NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'party_material_rates_billing_basis_check'
  ) THEN
    ALTER TABLE public.party_material_rates
      ADD CONSTRAINT party_material_rates_billing_basis_check
      CHECK (
        billing_basis IS NULL OR
        billing_basis IN ('per_unit', 'per_ton', 'per_trip', 'fixed')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_party_material_rates_rate_unit_id
  ON public.party_material_rates (rate_unit_id);

CREATE INDEX IF NOT EXISTS idx_party_material_rates_conversion_id
  ON public.party_material_rates (conversion_id);

ALTER TABLE public.transport_rates
  ADD COLUMN IF NOT EXISTS rate_unit_id BIGINT NULL REFERENCES public.unit_master(id),
  ADD COLUMN IF NOT EXISTS billing_basis VARCHAR(30) NULL,
  ADD COLUMN IF NOT EXISTS minimum_charge NUMERIC(12,2) NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'transport_rates_billing_basis_check'
  ) THEN
    ALTER TABLE public.transport_rates
      ADD CONSTRAINT transport_rates_billing_basis_check
      CHECK (
        billing_basis IS NULL OR
        billing_basis IN ('per_unit', 'per_trip', 'per_km', 'per_day', 'per_ton')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transport_rates_rate_unit_id
  ON public.transport_rates (rate_unit_id);

ALTER TABLE public.party_master
  ADD COLUMN IF NOT EXISTS dispatch_quantity_mode VARCHAR(30) NULL,
  ADD COLUMN IF NOT EXISTS default_dispatch_unit_id BIGINT NULL REFERENCES public.unit_master(id),
  ADD COLUMN IF NOT EXISTS allow_manual_dispatch_conversion BOOLEAN NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'party_master_dispatch_quantity_mode_check'
  ) THEN
    ALTER TABLE public.party_master
      ADD CONSTRAINT party_master_dispatch_quantity_mode_check
      CHECK (
        dispatch_quantity_mode IS NULL OR
        dispatch_quantity_mode IN (
          'weighbridge_only',
          'vehicle_capacity_fallback',
          'manual_volume_fallback',
          'manual_weight_allowed'
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_party_master_default_dispatch_unit_id
  ON public.party_master (default_dispatch_unit_id);

ALTER TABLE public.dispatch_reports
  ADD COLUMN IF NOT EXISTS entered_quantity NUMERIC(18,3) NULL,
  ADD COLUMN IF NOT EXISTS entered_unit_id BIGINT NULL REFERENCES public.unit_master(id),
  ADD COLUMN IF NOT EXISTS quantity_source VARCHAR(30) NULL,
  ADD COLUMN IF NOT EXISTS conversion_factor_to_ton NUMERIC(18,6) NULL,
  ADD COLUMN IF NOT EXISTS conversion_id BIGINT NULL REFERENCES public.material_unit_conversions(id),
  ADD COLUMN IF NOT EXISTS conversion_method_snapshot VARCHAR(30) NULL,
  ADD COLUMN IF NOT EXISTS source_vehicle_capacity_tons NUMERIC(12,3) NULL,
  ADD COLUMN IF NOT EXISTS source_vehicle_capacity_unit_id BIGINT NULL REFERENCES public.unit_master(id),
  ADD COLUMN IF NOT EXISTS billing_basis_snapshot VARCHAR(30) NULL,
  ADD COLUMN IF NOT EXISTS billing_unit_id_snapshot BIGINT NULL REFERENCES public.unit_master(id),
  ADD COLUMN IF NOT EXISTS billed_quantity_snapshot NUMERIC(18,3) NULL,
  ADD COLUMN IF NOT EXISTS billed_rate_snapshot NUMERIC(12,2) NULL,
  ADD COLUMN IF NOT EXISTS transport_basis_snapshot VARCHAR(30) NULL,
  ADD COLUMN IF NOT EXISTS transport_unit_id_snapshot BIGINT NULL REFERENCES public.unit_master(id),
  ADD COLUMN IF NOT EXISTS transport_quantity_snapshot NUMERIC(18,3) NULL,
  ADD COLUMN IF NOT EXISTS conversion_notes_snapshot TEXT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'dispatch_reports_quantity_source_check'
  ) THEN
    ALTER TABLE public.dispatch_reports
      ADD CONSTRAINT dispatch_reports_quantity_source_check
      CHECK (
        quantity_source IS NULL OR
        quantity_source IN (
          'weighbridge',
          'manual_weight',
          'manual_volume',
          'vehicle_capacity',
          'trip_estimate',
          'fixed_default'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'dispatch_reports_conversion_method_snapshot_check'
  ) THEN
    ALTER TABLE public.dispatch_reports
      ADD CONSTRAINT dispatch_reports_conversion_method_snapshot_check
      CHECK (
        conversion_method_snapshot IS NULL OR
        conversion_method_snapshot IN (
          'standard',
          'density_based',
          'vehicle_capacity_based',
          'manual_defined'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'dispatch_reports_billing_basis_snapshot_check'
  ) THEN
    ALTER TABLE public.dispatch_reports
      ADD CONSTRAINT dispatch_reports_billing_basis_snapshot_check
      CHECK (
        billing_basis_snapshot IS NULL OR
        billing_basis_snapshot IN ('per_unit', 'per_ton', 'per_trip', 'fixed')
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'dispatch_reports_transport_basis_snapshot_check'
  ) THEN
    ALTER TABLE public.dispatch_reports
      ADD CONSTRAINT dispatch_reports_transport_basis_snapshot_check
      CHECK (
        transport_basis_snapshot IS NULL OR
        transport_basis_snapshot IN ('per_unit', 'per_trip', 'per_km', 'per_day', 'per_ton')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_dispatch_reports_entered_unit_id
  ON public.dispatch_reports (entered_unit_id);

CREATE INDEX IF NOT EXISTS idx_dispatch_reports_conversion_id
  ON public.dispatch_reports (conversion_id);

CREATE INDEX IF NOT EXISTS idx_dispatch_reports_quantity_source
  ON public.dispatch_reports (quantity_source);

CREATE INDEX IF NOT EXISTS idx_dispatch_reports_billing_unit_id_snapshot
  ON public.dispatch_reports (billing_unit_id_snapshot);

CREATE INDEX IF NOT EXISTS idx_dispatch_reports_transport_unit_id_snapshot
  ON public.dispatch_reports (transport_unit_id_snapshot);
