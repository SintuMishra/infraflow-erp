BEGIN;

-- Operational master-data snapshot generated from local database.
-- Company: Gajanan Global Construction LLP
-- Company Code: GAJANAN_GLOBAL_CONSTRUCTION_LL
-- Source Company ID: 2
-- Mode: sync
-- Purpose:
-- Recreate locally-fed operational master/rate data in another database
-- without manual re-entry.
-- Preserve mode only inserts missing rows so already-fed target data stays intact.
-- Sync mode updates matching rows and inserts missing rows.
-- The script never deletes unrelated target-company data.


-- Company Profile
WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(companyName, branchName, addressLine1, addressLine2, city, stateName, stateCode, pincode, gstin, pan, mobile, email, bankName, bankAccount, ifscCode, termsNotes, isActive, companyLogoUrl) AS (
  VALUES
    ('Gajanan Global Construction LLP', 'Chandrapur Main Branch', 'House No. 212, M.I.D.C. Road, Datala', 'Kotwali Ward', 'Chandrapur', 'Maharashtra', '27', '442401', '27AABFG7700Q1Z3', 'AABFG7700Q', '8044566382', 'gcccha.project@gmail.com', NULL, NULL, NULL, NULL, TRUE, NULL)
)
UPDATE public.company_profile cp
SET
  company_name = seed.companyName,
  branch_name = seed.branchName,
  address_line1 = seed.addressLine1,
  address_line2 = seed.addressLine2,
  city = seed.city,
  state_name = seed.stateName,
  state_code = seed.stateCode,
  pincode = seed.pincode,
  gstin = seed.gstin,
  pan = seed.pan,
  mobile = seed.mobile,
  email = seed.email,
  bank_name = seed.bankName,
  bank_account = seed.bankAccount,
  ifsc_code = seed.ifscCode,
  terms_notes = seed.termsNotes,
  is_active = seed.isActive,
  company_logo_url = seed.companyLogoUrl,
  updated_at = CURRENT_TIMESTAMP
FROM seed
WHERE cp.company_id = (SELECT company_id FROM target_company);

WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(companyName, branchName, addressLine1, addressLine2, city, stateName, stateCode, pincode, gstin, pan, mobile, email, bankName, bankAccount, ifscCode, termsNotes, isActive, companyLogoUrl) AS (
  VALUES
    ('Gajanan Global Construction LLP', 'Chandrapur Main Branch', 'House No. 212, M.I.D.C. Road, Datala', 'Kotwali Ward', 'Chandrapur', 'Maharashtra', '27', '442401', '27AABFG7700Q1Z3', 'AABFG7700Q', '8044566382', 'gcccha.project@gmail.com', NULL, NULL, NULL, NULL, TRUE, NULL)
)
INSERT INTO public.company_profile (
  company_name,
  branch_name,
  address_line1,
  address_line2,
  city,
  state_name,
  state_code,
  pincode,
  gstin,
  pan,
  mobile,
  email,
  bank_name,
  bank_account,
  ifsc_code,
  terms_notes,
  is_active,
  company_logo_url,
  company_id
)
SELECT
  seed.companyName,
  seed.branchName,
  seed.addressLine1,
  seed.addressLine2,
  seed.city,
  seed.stateName,
  seed.stateCode,
  seed.pincode,
  seed.gstin,
  seed.pan,
  seed.mobile,
  seed.email,
  seed.bankName,
  seed.bankAccount,
  seed.ifscCode,
  seed.termsNotes,
  seed.isActive,
  seed.companyLogoUrl,
  (SELECT company_id FROM target_company)
FROM seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.company_profile existing
  WHERE existing.company_id = (SELECT company_id FROM target_company)
);


-- Shift Master
WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(shiftName, startTime, endTime, isActive) AS (
  VALUES
    ('Morning', '08:30:00', '19:30:00', TRUE),
    ('Night', '19:30:00', '08:30:00', TRUE)
)
UPDATE public.shift_master sm
SET
  start_time = seed.startTime::time,
  end_time = seed.endTime::time,
  is_active = seed.isActive,
  updated_at = CURRENT_TIMESTAMP
FROM seed
WHERE sm.company_id = (SELECT company_id FROM target_company)
  AND LOWER(BTRIM(sm.shift_name)) = LOWER(BTRIM(seed.shiftName));

WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(shiftName, startTime, endTime, isActive) AS (
  VALUES
    ('Morning', '08:30:00', '19:30:00', TRUE),
    ('Night', '19:30:00', '08:30:00', TRUE)
)
INSERT INTO public.shift_master (
  shift_name,
  start_time,
  end_time,
  is_active,
  company_id
)
SELECT
  seed.shiftName,
  seed.startTime::time,
  seed.endTime::time,
  seed.isActive,
  (SELECT company_id FROM target_company)
FROM seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.shift_master existing
  WHERE existing.company_id = (SELECT company_id FROM target_company)
    AND LOWER(BTRIM(existing.shift_name)) = LOWER(BTRIM(seed.shiftName))
);


-- Config Options
WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(configType, optionLabel, optionValue, sortOrder, isActive) AS (
  VALUES
    ('material_category', 'Aggregates', 'AGTS', 1, TRUE),
    ('material_category', 'Admixtures', 'ADMXT', 2, TRUE),
    ('material_category', 'Bitumen', 'BITM', 3, TRUE),
    ('material_category', 'Cement', 'CEMT', 4, TRUE),
    ('material_category', 'Sand', 'SAND', 5, TRUE),
    ('material_category', 'Fuel', 'FUEL', 6, TRUE),
    ('material_category', 'Fine Aggregate', 'Fine Aggregate', 7, TRUE),
    ('material_unit', 'Metric Ton (MT)', 'MT', 1, TRUE),
    ('material_unit', 'Brass (BRASS)', 'BRASS', 2, TRUE),
    ('material_unit', 'Cubic Meter (CUM)', 'CUM', 3, TRUE),
    ('material_unit', 'Kilogram (KG)', 'KG', 4, TRUE),
    ('material_unit', 'Liter (LTR)', 'LTR', 5, TRUE),
    ('material_unit', 'Bags (Legacy BGS)', 'BGS', 6, TRUE),
    ('material_unit', 'Bag', 'BAG', 7, TRUE),
    ('material_unit', 'CFT', 'CFT', 8, TRUE),
    ('material_unit', 'DAY', 'DAY', 9, TRUE),
    ('material_unit', 'KM', 'KM', 10, TRUE),
    ('material_unit', 'NOS', 'NOS', 11, TRUE),
    ('material_unit', 'TRIP', 'TRIP', 12, TRUE),
    ('plant_type', 'Crushing Plant', 'CP', 1, TRUE),
    ('plant_type', 'Ready-Mix Concrete (RMC)', 'RMC', 2, TRUE),
    ('plant_type', 'Batching Plant', 'BP', 3, TRUE),
    ('plant_type', 'Hot Mix Plant', 'HMP', 4, TRUE),
    ('power_source', 'Electricity (Grid)', 'EGRID', 1, FALSE),
    ('power_source', 'DG Set (Generator)', 'DG SET', 2, FALSE),
    ('power_source', 'Hybrid (Grid/DG)', 'HYBRID', 3, TRUE),
    ('power_source', 'diesel', 'diesel', 4, TRUE),
    ('power_source', 'electricity', 'electricity', 5, TRUE),
    ('power_source', 'electric', 'electric', 6, TRUE),
    ('vehicle_category', 'Transit Mixer', 'TM', 1, TRUE),
    ('vehicle_category', 'Tipper/Hyva', 'TPR/HVA', 2, TRUE),
    ('vehicle_category', 'Bulldozer', 'BLDZ', 3, TRUE),
    ('vehicle_category', 'Excavator', 'EXVTR', 4, TRUE),
    ('vehicle_category', 'Loader', 'LDR', 5, TRUE),
    ('vehicle_category', 'Tanker', 'TNKR', 6, TRUE),
    ('vehicle_category', 'Motor Grader', 'MG', 7, TRUE),
    ('vehicle_category', 'Backhoe Loader', 'BACKL', 8, TRUE),
    ('vehicle_category', 'Scraper', 'SCPR', 9, TRUE),
    ('vehicle_category', 'Road Roller (Compactor)', 'RRC', 10, TRUE),
    ('vehicle_category', 'Asphalt Paver', 'PAVER', 11, TRUE),
    ('vehicle_category', 'Cold Planer (Miller)', 'MILLER', 12, TRUE),
    ('vehicle_category', 'Pick & Carry Crane (Hydra)', 'HYDRA', 13, TRUE),
    ('vehicle_category', 'Water Truck', 'WT', 14, TRUE),
    ('vehicle_category', 'Utility Vehicle', 'Utility Vehicle', 15, TRUE),
    ('vehicle_category', 'Road Roller', 'Road Roller', 16, TRUE)
)
UPDATE public.master_config_options mco
SET
  option_label = seed.optionLabel,
  sort_order = seed.sortOrder::integer,
  is_active = seed.isActive,
  updated_at = CURRENT_TIMESTAMP
FROM seed
WHERE mco.company_id = (SELECT company_id FROM target_company)
  AND LOWER(BTRIM(mco.config_type)) = LOWER(BTRIM(seed.configType))
  AND LOWER(BTRIM(COALESCE(mco.option_value, ''))) = LOWER(BTRIM(COALESCE(seed.optionValue, '')));

WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(configType, optionLabel, optionValue, sortOrder, isActive) AS (
  VALUES
    ('material_category', 'Aggregates', 'AGTS', 1, TRUE),
    ('material_category', 'Admixtures', 'ADMXT', 2, TRUE),
    ('material_category', 'Bitumen', 'BITM', 3, TRUE),
    ('material_category', 'Cement', 'CEMT', 4, TRUE),
    ('material_category', 'Sand', 'SAND', 5, TRUE),
    ('material_category', 'Fuel', 'FUEL', 6, TRUE),
    ('material_category', 'Fine Aggregate', 'Fine Aggregate', 7, TRUE),
    ('material_unit', 'Metric Ton (MT)', 'MT', 1, TRUE),
    ('material_unit', 'Brass (BRASS)', 'BRASS', 2, TRUE),
    ('material_unit', 'Cubic Meter (CUM)', 'CUM', 3, TRUE),
    ('material_unit', 'Kilogram (KG)', 'KG', 4, TRUE),
    ('material_unit', 'Liter (LTR)', 'LTR', 5, TRUE),
    ('material_unit', 'Bags (Legacy BGS)', 'BGS', 6, TRUE),
    ('material_unit', 'Bag', 'BAG', 7, TRUE),
    ('material_unit', 'CFT', 'CFT', 8, TRUE),
    ('material_unit', 'DAY', 'DAY', 9, TRUE),
    ('material_unit', 'KM', 'KM', 10, TRUE),
    ('material_unit', 'NOS', 'NOS', 11, TRUE),
    ('material_unit', 'TRIP', 'TRIP', 12, TRUE),
    ('plant_type', 'Crushing Plant', 'CP', 1, TRUE),
    ('plant_type', 'Ready-Mix Concrete (RMC)', 'RMC', 2, TRUE),
    ('plant_type', 'Batching Plant', 'BP', 3, TRUE),
    ('plant_type', 'Hot Mix Plant', 'HMP', 4, TRUE),
    ('power_source', 'Electricity (Grid)', 'EGRID', 1, FALSE),
    ('power_source', 'DG Set (Generator)', 'DG SET', 2, FALSE),
    ('power_source', 'Hybrid (Grid/DG)', 'HYBRID', 3, TRUE),
    ('power_source', 'diesel', 'diesel', 4, TRUE),
    ('power_source', 'electricity', 'electricity', 5, TRUE),
    ('power_source', 'electric', 'electric', 6, TRUE),
    ('vehicle_category', 'Transit Mixer', 'TM', 1, TRUE),
    ('vehicle_category', 'Tipper/Hyva', 'TPR/HVA', 2, TRUE),
    ('vehicle_category', 'Bulldozer', 'BLDZ', 3, TRUE),
    ('vehicle_category', 'Excavator', 'EXVTR', 4, TRUE),
    ('vehicle_category', 'Loader', 'LDR', 5, TRUE),
    ('vehicle_category', 'Tanker', 'TNKR', 6, TRUE),
    ('vehicle_category', 'Motor Grader', 'MG', 7, TRUE),
    ('vehicle_category', 'Backhoe Loader', 'BACKL', 8, TRUE),
    ('vehicle_category', 'Scraper', 'SCPR', 9, TRUE),
    ('vehicle_category', 'Road Roller (Compactor)', 'RRC', 10, TRUE),
    ('vehicle_category', 'Asphalt Paver', 'PAVER', 11, TRUE),
    ('vehicle_category', 'Cold Planer (Miller)', 'MILLER', 12, TRUE),
    ('vehicle_category', 'Pick & Carry Crane (Hydra)', 'HYDRA', 13, TRUE),
    ('vehicle_category', 'Water Truck', 'WT', 14, TRUE),
    ('vehicle_category', 'Utility Vehicle', 'Utility Vehicle', 15, TRUE),
    ('vehicle_category', 'Road Roller', 'Road Roller', 16, TRUE)
)
INSERT INTO public.master_config_options (
  config_type,
  option_label,
  option_value,
  sort_order,
  is_active,
  company_id
)
SELECT
  seed.configType,
  seed.optionLabel,
  seed.optionValue,
  seed.sortOrder::integer,
  seed.isActive,
  (SELECT company_id FROM target_company)
FROM seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.master_config_options existing
  WHERE existing.company_id = (SELECT company_id FROM target_company)
    AND LOWER(BTRIM(existing.config_type)) = LOWER(BTRIM(seed.configType))
    AND LOWER(BTRIM(COALESCE(existing.option_value, ''))) = LOWER(BTRIM(COALESCE(seed.optionValue, '')))
);


-- Plant Master
WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(plantName, plantCode, plantType, location, powerSourceType, isActive) AS (
  VALUES
    ('Stone Crusher Plant', 'SCP', 'Crushing Plant', 'Mohada', 'hybrid', TRUE),
    ('Wandhari RMC Plant', 'Wandri', 'Ready-Mix Concrete (RMC)', 'Wandri Phata', 'hybrid', TRUE),
    ('Rasa Concrete Road Plant', 'RASA-1', 'Ready-Mix Concrete (RMC)', 'Rasa', 'hybrid', TRUE),
    ('Dolomite Crusher Unit', 'Dolomite', 'Crushing Plant', 'Gadchiroli', 'hybrid', TRUE)
)
UPDATE public.plant_master pm
SET
  plant_name = seed.plantName,
  plant_type = seed.plantType,
  location = seed.location,
  power_source_type = seed.powerSourceType,
  is_active = seed.isActive,
  updated_at = CURRENT_TIMESTAMP
FROM seed
WHERE pm.company_id = (SELECT company_id FROM target_company)
  AND LOWER(BTRIM(pm.plant_code)) = LOWER(BTRIM(seed.plantCode));

WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(plantName, plantCode, plantType, location, powerSourceType, isActive) AS (
  VALUES
    ('Stone Crusher Plant', 'SCP', 'Crushing Plant', 'Mohada', 'hybrid', TRUE),
    ('Wandhari RMC Plant', 'Wandri', 'Ready-Mix Concrete (RMC)', 'Wandri Phata', 'hybrid', TRUE),
    ('Rasa Concrete Road Plant', 'RASA-1', 'Ready-Mix Concrete (RMC)', 'Rasa', 'hybrid', TRUE),
    ('Dolomite Crusher Unit', 'Dolomite', 'Crushing Plant', 'Gadchiroli', 'hybrid', TRUE)
)
INSERT INTO public.plant_master (
  plant_name,
  plant_code,
  plant_type,
  location,
  power_source_type,
  is_active,
  company_id
)
SELECT
  seed.plantName,
  seed.plantCode,
  seed.plantType,
  seed.location,
  seed.powerSourceType,
  seed.isActive,
  (SELECT company_id FROM target_company)
FROM seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.plant_master existing
  WHERE existing.company_id = (SELECT company_id FROM target_company)
    AND LOWER(BTRIM(existing.plant_code)) = LOWER(BTRIM(seed.plantCode))
);


-- Crusher Units
WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(unitName, unitCode, location, powerSourceType, isActive, plantType) AS (
  VALUES
    ('Primary Crushing Line', 'CRU-PLC-01', 'Main crushing bay', 'diesel', TRUE, 'Crushing Plant'),
    ('Secondary Screening Line', 'CRU-SSL-01', 'Screening deck', 'electric', TRUE, 'Crushing Plant'),
    ('Stock Yard Feed Hopper', 'CRU-SFH-01', 'Stock yard feed point', 'diesel', TRUE, 'Crushing Plant'),
    ('Stone Crusher Primary Hopper', 'SCP-PH-01', 'Stone Crusher Plant intake', 'diesel', TRUE, 'Crushing Plant'),
    ('Stone Crusher Secondary Line', 'SCP-SL-01', 'Stone Crusher Plant secondary line', 'electric', TRUE, 'Crushing Plant'),
    ('Dolomite Primary Crusher', 'DCU-PC-01', 'Dolomite Crusher Unit primary bay', 'diesel', TRUE, 'Crushing Plant'),
    ('Dolomite Screening Deck', 'DCU-SD-01', 'Dolomite Crusher Unit screening deck', 'electric', TRUE, 'Crushing Plant')
)
UPDATE public.crusher_units cu
SET
  unit_name = seed.unitName,
  location = seed.location,
  power_source_type = seed.powerSourceType,
  is_active = seed.isActive,
  plant_type = seed.plantType,
  updated_at = CURRENT_TIMESTAMP
FROM seed
WHERE cu.company_id = (SELECT company_id FROM target_company)
  AND LOWER(BTRIM(cu.unit_code)) = LOWER(BTRIM(seed.unitCode));

WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(unitName, unitCode, location, powerSourceType, isActive, plantType) AS (
  VALUES
    ('Primary Crushing Line', 'CRU-PLC-01', 'Main crushing bay', 'diesel', TRUE, 'Crushing Plant'),
    ('Secondary Screening Line', 'CRU-SSL-01', 'Screening deck', 'electric', TRUE, 'Crushing Plant'),
    ('Stock Yard Feed Hopper', 'CRU-SFH-01', 'Stock yard feed point', 'diesel', TRUE, 'Crushing Plant'),
    ('Stone Crusher Primary Hopper', 'SCP-PH-01', 'Stone Crusher Plant intake', 'diesel', TRUE, 'Crushing Plant'),
    ('Stone Crusher Secondary Line', 'SCP-SL-01', 'Stone Crusher Plant secondary line', 'electric', TRUE, 'Crushing Plant'),
    ('Dolomite Primary Crusher', 'DCU-PC-01', 'Dolomite Crusher Unit primary bay', 'diesel', TRUE, 'Crushing Plant'),
    ('Dolomite Screening Deck', 'DCU-SD-01', 'Dolomite Crusher Unit screening deck', 'electric', TRUE, 'Crushing Plant')
)
INSERT INTO public.crusher_units (
  unit_name,
  unit_code,
  location,
  power_source_type,
  is_active,
  company_id,
  plant_type
)
SELECT
  seed.unitName,
  seed.unitCode,
  seed.location,
  seed.powerSourceType,
  seed.isActive,
  (SELECT company_id FROM target_company),
  seed.plantType
FROM seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.crusher_units existing
  WHERE existing.company_id = (SELECT company_id FROM target_company)
    AND LOWER(BTRIM(existing.unit_code)) = LOWER(BTRIM(seed.unitCode))
);


-- Vehicle Type Master
WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(typeName, category, isActive) AS (
  VALUES
    ('Tata Signa', 'Tipper/Hyva', TRUE),
    ('Ashok Leyland', 'Tipper/Hyva', TRUE),
    ('BharatBenz', 'Tipper/Hyva', TRUE),
    ('Eicher', 'Tipper/Hyva', TRUE),
    ('JCB 3DX', 'Backhoe Loader', TRUE),
    ('Hindustan Wheel Loader', 'Loader', TRUE),
    ('L&T Komatsu PC210', 'Excavator', TRUE),
    ('Schwing Stetter CP30', 'Transit Mixer', TRUE),
    ('Hyundai R210 Smart', 'Excavator', TRUE),
    ('Water Tanker', 'Water Truck', TRUE),
    ('Mahindra Bolero Camper', 'Utility Vehicle', TRUE),
    ('CASE 752 Tandem Roller', 'Road Roller (Compactor)', TRUE),
    ('Mahindra Scorpio N', 'Utility Vehicle', TRUE)
)
UPDATE public.vehicle_type_master vt
SET
  category = seed.category,
  is_active = seed.isActive,
  updated_at = CURRENT_TIMESTAMP
FROM seed
WHERE vt.company_id = (SELECT company_id FROM target_company)
  AND LOWER(BTRIM(vt.type_name)) = LOWER(BTRIM(seed.typeName));

WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(typeName, category, isActive) AS (
  VALUES
    ('Tata Signa', 'Tipper/Hyva', TRUE),
    ('Ashok Leyland', 'Tipper/Hyva', TRUE),
    ('BharatBenz', 'Tipper/Hyva', TRUE),
    ('Eicher', 'Tipper/Hyva', TRUE),
    ('JCB 3DX', 'Backhoe Loader', TRUE),
    ('Hindustan Wheel Loader', 'Loader', TRUE),
    ('L&T Komatsu PC210', 'Excavator', TRUE),
    ('Schwing Stetter CP30', 'Transit Mixer', TRUE),
    ('Hyundai R210 Smart', 'Excavator', TRUE),
    ('Water Tanker', 'Water Truck', TRUE),
    ('Mahindra Bolero Camper', 'Utility Vehicle', TRUE),
    ('CASE 752 Tandem Roller', 'Road Roller (Compactor)', TRUE),
    ('Mahindra Scorpio N', 'Utility Vehicle', TRUE)
)
INSERT INTO public.vehicle_type_master (
  type_name,
  category,
  is_active,
  company_id
)
SELECT
  seed.typeName,
  seed.category,
  seed.isActive,
  (SELECT company_id FROM target_company)
FROM seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.vehicle_type_master existing
  WHERE existing.company_id = (SELECT company_id FROM target_company)
    AND LOWER(BTRIM(existing.type_name)) = LOWER(BTRIM(seed.typeName))
);


-- Vendor Master
WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(vendorName, vendorType, contactPerson, mobileNumber, address, isActive) AS (
  VALUES
    ('Jungari Transport', 'Transporter', 'Santosh Jungari', NULL, 'Mohda', TRUE),
    ('Sidhesh Transport', 'Transporter', 'Nikash Sindhe', NULL, 'Mohda', TRUE),
    ('K.K. Transport', 'Transporter', 'KK', NULL, 'Chandrapur', TRUE)
)
UPDATE public.vendor_master vm
SET
  vendor_type = seed.vendorType,
  contact_person = seed.contactPerson,
  mobile_number = seed.mobileNumber,
  address = seed.address,
  is_active = seed.isActive,
  updated_at = CURRENT_TIMESTAMP
FROM seed
WHERE vm.company_id = (SELECT company_id FROM target_company)
  AND LOWER(BTRIM(vm.vendor_name)) = LOWER(BTRIM(seed.vendorName));

WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(vendorName, vendorType, contactPerson, mobileNumber, address, isActive) AS (
  VALUES
    ('Jungari Transport', 'Transporter', 'Santosh Jungari', NULL, 'Mohda', TRUE),
    ('Sidhesh Transport', 'Transporter', 'Nikash Sindhe', NULL, 'Mohda', TRUE),
    ('K.K. Transport', 'Transporter', 'KK', NULL, 'Chandrapur', TRUE)
)
INSERT INTO public.vendor_master (
  vendor_name,
  vendor_type,
  contact_person,
  mobile_number,
  address,
  is_active,
  company_id
)
SELECT
  seed.vendorName,
  seed.vendorType,
  seed.contactPerson,
  seed.mobileNumber,
  seed.address,
  seed.isActive,
  (SELECT company_id FROM target_company)
FROM seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.vendor_master existing
  WHERE existing.company_id = (SELECT company_id FROM target_company)
    AND LOWER(BTRIM(existing.vendor_name)) = LOWER(BTRIM(seed.vendorName))
);


-- Vehicles
WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(vehicleNumber, vehicleType, assignedDriver, status, ownershipType, vendorName, plantCode, vehicleCapacityTons) AS (
  VALUES
    ('MH34AB9090', 'Tata Signa', 'In Remarks', 'active', 'transporter', 'Jungari Transport', 'SCP', '32'),
    ('MH34AQ3454', 'Tata Signa', 'In Remarks', 'active', 'transporter', 'Jungari Transport', 'SCP', '32'),
    ('MH34CF4565', 'Tata Signa', 'In Remarks', 'active', 'transporter', 'Sidhesh Transport', 'SCP', '32'),
    ('MH34CF4567', 'BharatBenz', 'In Remarks', 'active', 'transporter', 'Sidhesh Transport', 'SCP', '32')
)
UPDATE public.vehicles vh
SET
  vehicle_type = seed.vehicleType,
  assigned_driver = seed.assignedDriver,
  status = seed.status,
  ownership_type = seed.ownershipType,
  vendor_id = (
    SELECT vm.id
    FROM public.vendor_master vm
    WHERE vm.company_id = (SELECT company_id FROM target_company)
      AND LOWER(BTRIM(vm.vendor_name)) = LOWER(BTRIM(seed.vendorName))
    LIMIT 1
  ),
  plant_id = (
    SELECT pm.id
    FROM public.plant_master pm
    WHERE pm.company_id = (SELECT company_id FROM target_company)
      AND LOWER(BTRIM(pm.plant_code)) = LOWER(BTRIM(seed.plantCode))
    LIMIT 1
  ),
  vehicle_capacity_tons = seed.vehicleCapacityTons::numeric,
  updated_at = CURRENT_TIMESTAMP
FROM seed
WHERE vh.company_id = (SELECT company_id FROM target_company)
  AND LOWER(BTRIM(vh.vehicle_number)) = LOWER(BTRIM(seed.vehicleNumber));

WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(vehicleNumber, vehicleType, assignedDriver, status, ownershipType, vendorName, plantCode, vehicleCapacityTons) AS (
  VALUES
    ('MH34AB9090', 'Tata Signa', 'In Remarks', 'active', 'transporter', 'Jungari Transport', 'SCP', '32'),
    ('MH34AQ3454', 'Tata Signa', 'In Remarks', 'active', 'transporter', 'Jungari Transport', 'SCP', '32'),
    ('MH34CF4565', 'Tata Signa', 'In Remarks', 'active', 'transporter', 'Sidhesh Transport', 'SCP', '32'),
    ('MH34CF4567', 'BharatBenz', 'In Remarks', 'active', 'transporter', 'Sidhesh Transport', 'SCP', '32')
)
INSERT INTO public.vehicles (
  vehicle_number,
  vehicle_type,
  assigned_driver,
  status,
  ownership_type,
  vendor_id,
  plant_id,
  vehicle_capacity_tons,
  company_id
)
SELECT
  seed.vehicleNumber,
  seed.vehicleType,
  seed.assignedDriver,
  seed.status,
  seed.ownershipType,
  (
    SELECT vm.id
    FROM public.vendor_master vm
    WHERE vm.company_id = (SELECT company_id FROM target_company)
      AND LOWER(BTRIM(vm.vendor_name)) = LOWER(BTRIM(seed.vendorName))
    LIMIT 1
  ),
  (
    SELECT pm.id
    FROM public.plant_master pm
    WHERE pm.company_id = (SELECT company_id FROM target_company)
      AND LOWER(BTRIM(pm.plant_code)) = LOWER(BTRIM(seed.plantCode))
    LIMIT 1
  ),
  seed.vehicleCapacityTons::numeric,
  (SELECT company_id FROM target_company)
FROM seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.vehicles existing
  WHERE existing.company_id = (SELECT company_id FROM target_company)
    AND LOWER(BTRIM(existing.vehicle_number)) = LOWER(BTRIM(seed.vehicleNumber))
);


-- Party Master
WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(partyName, partyCode, contactPerson, mobileNumber, gstin, pan, addressLine1, addressLine2, city, stateName, stateCode, pincode, partyType, isActive, dispatchQuantityMode, defaultDispatchUnitCode, allowManualDispatchConversion) AS (
  VALUES
    ('Lloyds Metals and Energy Ltd (Ghugus)', 'LLOYDS-GHG', 'Mr. Akshay Vora (CS)', '7172285398', '27AAACL0830E1Z1', 'AAACL0830E', 'Plot No. A 1-2, MIDC Area', 'Ghugus', 'Chandrapur', 'Maharashtra', '27', '442505', 'customer', TRUE, NULL, NULL, NULL),
    ('Lloyds Metals (Konsari Plant)', 'LLOYDS-KON', 'Plant Manager', '7172285103', '27AAACL0830E1Z1', 'AAACL0830E', 'Plot No. A-1, Chamorshi', 'Industrial Area, Konsari', 'Gadchiroli', 'Maharashtra', '27', '442707', 'customer', TRUE, NULL, NULL, NULL),
    ('Sonai Infrastructure Pvt Ltd', 'SONAI-INFRA', 'Plant Manager', '2069086908', '27AAOCS1420M1Z3', 'AAOCS1420M', 'Manthan+, 1st Floor, Shriram Plaza', 'Opp. Ram Mandir', 'Sangli', 'Maharashtra', '27', '416416', 'customer', TRUE, NULL, NULL, NULL)
)
UPDATE public.party_master pm
SET
  party_name = seed.partyName,
  contact_person = seed.contactPerson,
  mobile_number = seed.mobileNumber,
  gstin = seed.gstin,
  pan = seed.pan,
  address_line1 = seed.addressLine1,
  address_line2 = seed.addressLine2,
  city = seed.city,
  state_name = seed.stateName,
  state_code = seed.stateCode,
  pincode = seed.pincode,
  party_type = seed.partyType,
  is_active = seed.isActive,
  dispatch_quantity_mode = seed.dispatchQuantityMode,
  default_dispatch_unit_id = (
    SELECT um.id
    FROM public.unit_master um
    WHERE LOWER(BTRIM(um.unit_code)) = LOWER(BTRIM(seed.defaultDispatchUnitCode))
      AND (um.company_id IS NULL OR um.company_id = (SELECT company_id FROM target_company))
    ORDER BY um.company_id NULLS FIRST, um.id
    LIMIT 1
  ),
  allow_manual_dispatch_conversion = seed.allowManualDispatchConversion::boolean,
  updated_at = CURRENT_TIMESTAMP
FROM seed
WHERE pm.company_id = (SELECT company_id FROM target_company)
  AND LOWER(BTRIM(pm.party_code)) = LOWER(BTRIM(seed.partyCode));

WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(partyName, partyCode, contactPerson, mobileNumber, gstin, pan, addressLine1, addressLine2, city, stateName, stateCode, pincode, partyType, isActive, dispatchQuantityMode, defaultDispatchUnitCode, allowManualDispatchConversion) AS (
  VALUES
    ('Lloyds Metals and Energy Ltd (Ghugus)', 'LLOYDS-GHG', 'Mr. Akshay Vora (CS)', '7172285398', '27AAACL0830E1Z1', 'AAACL0830E', 'Plot No. A 1-2, MIDC Area', 'Ghugus', 'Chandrapur', 'Maharashtra', '27', '442505', 'customer', TRUE, NULL, NULL, NULL),
    ('Lloyds Metals (Konsari Plant)', 'LLOYDS-KON', 'Plant Manager', '7172285103', '27AAACL0830E1Z1', 'AAACL0830E', 'Plot No. A-1, Chamorshi', 'Industrial Area, Konsari', 'Gadchiroli', 'Maharashtra', '27', '442707', 'customer', TRUE, NULL, NULL, NULL),
    ('Sonai Infrastructure Pvt Ltd', 'SONAI-INFRA', 'Plant Manager', '2069086908', '27AAOCS1420M1Z3', 'AAOCS1420M', 'Manthan+, 1st Floor, Shriram Plaza', 'Opp. Ram Mandir', 'Sangli', 'Maharashtra', '27', '416416', 'customer', TRUE, NULL, NULL, NULL)
)
INSERT INTO public.party_master (
  party_name,
  party_code,
  contact_person,
  mobile_number,
  gstin,
  pan,
  address_line1,
  address_line2,
  city,
  state_name,
  state_code,
  pincode,
  party_type,
  is_active,
  company_id,
  dispatch_quantity_mode,
  default_dispatch_unit_id,
  allow_manual_dispatch_conversion
)
SELECT
  seed.partyName,
  seed.partyCode,
  seed.contactPerson,
  seed.mobileNumber,
  seed.gstin,
  seed.pan,
  seed.addressLine1,
  seed.addressLine2,
  seed.city,
  seed.stateName,
  seed.stateCode,
  seed.pincode,
  seed.partyType,
  seed.isActive,
  (SELECT company_id FROM target_company),
  seed.dispatchQuantityMode,
  (
    SELECT um.id
    FROM public.unit_master um
    WHERE LOWER(BTRIM(um.unit_code)) = LOWER(BTRIM(seed.defaultDispatchUnitCode))
      AND (um.company_id IS NULL OR um.company_id = (SELECT company_id FROM target_company))
    ORDER BY um.company_id NULLS FIRST, um.id
    LIMIT 1
  ),
  seed.allowManualDispatchConversion::boolean
FROM seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.party_master existing
  WHERE existing.company_id = (SELECT company_id FROM target_company)
    AND LOWER(BTRIM(existing.party_code)) = LOWER(BTRIM(seed.partyCode))
);


-- Employees
WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(employeeCode, fullName, department, designation, status, relievingDate, remarks, mobileNumber, joiningDate, email, emergencyContactNumber, address, employmentType, idProofType, idProofNumber) AS (
  VALUES
    ('EMP0002', 'Jayant Umakant Mamidwar', 'Admin', 'Managing Director', 'active', NULL, NULL, '8044566382', '2026-04-17', NULL, NULL, NULL, 'full_time', NULL, NULL),
    ('PRJ0001', 'JaiPrakash Mishra', 'Projects', 'Manager', 'active', NULL, NULL, '7667315773', '2026-04-18', NULL, NULL, NULL, 'full_time', NULL, NULL),
    ('PLT0001', 'Praful Mohitkar', 'Crusher', 'Supervisor', 'active', NULL, NULL, '7667315773', '2026-04-20', NULL, NULL, NULL, 'full_time', NULL, NULL)
)
UPDATE public.employees emp
SET
  full_name = seed.fullName,
  department = seed.department,
  designation = seed.designation,
  status = seed.status,
  relieving_date = seed.relievingDate::date,
  remarks = seed.remarks,
  mobile_number = seed.mobileNumber,
  joining_date = seed.joiningDate::date,
  email = seed.email,
  emergency_contact_number = seed.emergencyContactNumber,
  address = seed.address,
  employment_type = seed.employmentType,
  id_proof_type = seed.idProofType,
  id_proof_number = seed.idProofNumber,
  updated_at = CURRENT_TIMESTAMP
FROM seed
WHERE emp.company_id = (SELECT company_id FROM target_company)
  AND LOWER(BTRIM(emp.employee_code)) = LOWER(BTRIM(seed.employeeCode));

WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(employeeCode, fullName, department, designation, status, relievingDate, remarks, mobileNumber, joiningDate, email, emergencyContactNumber, address, employmentType, idProofType, idProofNumber) AS (
  VALUES
    ('EMP0002', 'Jayant Umakant Mamidwar', 'Admin', 'Managing Director', 'active', NULL, NULL, '8044566382', '2026-04-17', NULL, NULL, NULL, 'full_time', NULL, NULL),
    ('PRJ0001', 'JaiPrakash Mishra', 'Projects', 'Manager', 'active', NULL, NULL, '7667315773', '2026-04-18', NULL, NULL, NULL, 'full_time', NULL, NULL),
    ('PLT0001', 'Praful Mohitkar', 'Crusher', 'Supervisor', 'active', NULL, NULL, '7667315773', '2026-04-20', NULL, NULL, NULL, 'full_time', NULL, NULL)
)
INSERT INTO public.employees (
  employee_code,
  full_name,
  department,
  designation,
  status,
  relieving_date,
  remarks,
  mobile_number,
  joining_date,
  email,
  emergency_contact_number,
  address,
  employment_type,
  id_proof_type,
  id_proof_number,
  company_id
)
SELECT
  seed.employeeCode,
  seed.fullName,
  seed.department,
  seed.designation,
  seed.status,
  seed.relievingDate::date,
  seed.remarks,
  seed.mobileNumber,
  seed.joiningDate::date,
  seed.email,
  seed.emergencyContactNumber,
  seed.address,
  seed.employmentType,
  seed.idProofType,
  seed.idProofNumber,
  (SELECT company_id FROM target_company)
FROM seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.employees existing
  WHERE existing.company_id = (SELECT company_id FROM target_company)
    AND LOWER(BTRIM(existing.employee_code)) = LOWER(BTRIM(seed.employeeCode))
);


-- Material Master
WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(materialName, materialCode, category, unit, isActive, gstRate, hsnSacCode) AS (
  VALUES
    ('Aggregate 10mm', 'AGG-10', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Aggregate 20mm', 'AGG-20', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Aggregate 40mm', 'AGG-40', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('GSB (Granular Sub-Base)', 'GSB', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('WMM Material', 'WMM', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Dolomite Boulders', 'DOL-RAW', 'Aggregates', 'MT', TRUE, '5.00', '2518'),
    ('Crush Sand (M-Sand)', 'M-SAND', 'Sand', 'MT', TRUE, '5.00', '2505'),
    ('Stone Dust', 'DUST', 'Fine Aggregate', 'MT', TRUE, '5.00', '2517'),
    ('Plaster Sand (P-Sand)', 'P-SAND', 'Sand', 'MT', TRUE, '5.00', '2505'),
    ('Dolomite 20mm', 'DOL-20', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('OPC 53 Grade', 'OPC-53', 'Cement', 'BGS', TRUE, '28.00', '2523'),
    ('PPC Cement', 'PPC', 'Cement', 'BGS', TRUE, '28.00', '2523'),
    ('Bitumen VG-30', 'BIT-VG30', 'Bitumen', 'MT', TRUE, '18.00', '2713'),
    ('Emulsion', 'EMUL', 'Bitumen', 'MT', TRUE, '18.00', '2713'),
    ('Plasticizers', 'ADM-PLAS', 'Admixtures', 'LTR', TRUE, '18.00', '3824'),
    ('Retarders', 'ADM-RET', 'Admixtures', 'LTR', TRUE, '18.00', '2710'),
    ('Diesel (HSD)', 'DSL', 'Fuel', 'LTR', TRUE, '0.00', '2710'),
    ('Aggregate 6mm', 'AGG-06', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Aggregate 6mm VSI', 'AGG-06-VSI', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Aggregate 6mm Non-VSI', 'AGG-06-NVSI', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Aggregate 10mm VSI', 'AGG-10-VSI', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Aggregate 10mm Non-VSI', 'AGG-10-NVSI', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Aggregate 20mm VSI', 'AGG-20-VSI', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Aggregate 20mm Non-VSI', 'AGG-20-NVSI', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Aggregate 40mm VSI', 'AGG-40-VSI', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Aggregate 40mm Non-VSI', 'AGG-40-NVSI', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Aggregate 12mm', 'AGG-12', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Aggregate 25mm', 'AGG-25', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Aggregate 63mm', 'AGG-63', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Crusher Dust', 'CRDUST', 'Fine Aggregate', 'MT', TRUE, '5.00', '2517'),
    ('Murum', 'MURUM', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Screened Metal', 'SCR-MET', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('GSB Grade 1', 'GSB-G1', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('GSB Grade 2', 'GSB-G2', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('GSB Grade 3', 'GSB-G3', 'Aggregates', 'MT', TRUE, '5.00', '2517')
)
UPDATE public.material_master mm
SET
  material_name = seed.materialName,
  category = seed.category,
  unit = seed.unit,
  is_active = seed.isActive,
  gst_rate = seed.gstRate::numeric,
  hsn_sac_code = seed.hsnSacCode,
  updated_at = CURRENT_TIMESTAMP
FROM seed
WHERE mm.company_id = (SELECT company_id FROM target_company)
  AND (
    LOWER(BTRIM(mm.material_code)) = LOWER(BTRIM(seed.materialCode))
    OR LOWER(BTRIM(mm.material_name)) = LOWER(BTRIM(seed.materialName))
  );

WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(materialName, materialCode, category, unit, isActive, gstRate, hsnSacCode) AS (
  VALUES
    ('Aggregate 10mm', 'AGG-10', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Aggregate 20mm', 'AGG-20', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Aggregate 40mm', 'AGG-40', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('GSB (Granular Sub-Base)', 'GSB', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('WMM Material', 'WMM', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Dolomite Boulders', 'DOL-RAW', 'Aggregates', 'MT', TRUE, '5.00', '2518'),
    ('Crush Sand (M-Sand)', 'M-SAND', 'Sand', 'MT', TRUE, '5.00', '2505'),
    ('Stone Dust', 'DUST', 'Fine Aggregate', 'MT', TRUE, '5.00', '2517'),
    ('Plaster Sand (P-Sand)', 'P-SAND', 'Sand', 'MT', TRUE, '5.00', '2505'),
    ('Dolomite 20mm', 'DOL-20', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('OPC 53 Grade', 'OPC-53', 'Cement', 'BGS', TRUE, '28.00', '2523'),
    ('PPC Cement', 'PPC', 'Cement', 'BGS', TRUE, '28.00', '2523'),
    ('Bitumen VG-30', 'BIT-VG30', 'Bitumen', 'MT', TRUE, '18.00', '2713'),
    ('Emulsion', 'EMUL', 'Bitumen', 'MT', TRUE, '18.00', '2713'),
    ('Plasticizers', 'ADM-PLAS', 'Admixtures', 'LTR', TRUE, '18.00', '3824'),
    ('Retarders', 'ADM-RET', 'Admixtures', 'LTR', TRUE, '18.00', '2710'),
    ('Diesel (HSD)', 'DSL', 'Fuel', 'LTR', TRUE, '0.00', '2710'),
    ('Aggregate 6mm', 'AGG-06', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Aggregate 6mm VSI', 'AGG-06-VSI', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Aggregate 6mm Non-VSI', 'AGG-06-NVSI', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Aggregate 10mm VSI', 'AGG-10-VSI', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Aggregate 10mm Non-VSI', 'AGG-10-NVSI', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Aggregate 20mm VSI', 'AGG-20-VSI', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Aggregate 20mm Non-VSI', 'AGG-20-NVSI', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Aggregate 40mm VSI', 'AGG-40-VSI', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Aggregate 40mm Non-VSI', 'AGG-40-NVSI', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Aggregate 12mm', 'AGG-12', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Aggregate 25mm', 'AGG-25', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Aggregate 63mm', 'AGG-63', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Crusher Dust', 'CRDUST', 'Fine Aggregate', 'MT', TRUE, '5.00', '2517'),
    ('Murum', 'MURUM', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('Screened Metal', 'SCR-MET', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('GSB Grade 1', 'GSB-G1', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('GSB Grade 2', 'GSB-G2', 'Aggregates', 'MT', TRUE, '5.00', '2517'),
    ('GSB Grade 3', 'GSB-G3', 'Aggregates', 'MT', TRUE, '5.00', '2517')
)
INSERT INTO public.material_master (
  material_name,
  material_code,
  category,
  unit,
  is_active,
  gst_rate,
  hsn_sac_code,
  company_id
)
SELECT
  seed.materialName,
  seed.materialCode,
  seed.category,
  seed.unit,
  seed.isActive,
  seed.gstRate::numeric,
  seed.hsnSacCode,
  (SELECT company_id FROM target_company)
FROM seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.material_master existing
  WHERE existing.company_id = (SELECT company_id FROM target_company)
    AND (
      LOWER(BTRIM(existing.material_code)) = LOWER(BTRIM(seed.materialCode))
      OR LOWER(BTRIM(existing.material_name)) = LOWER(BTRIM(seed.materialName))
    )
);


-- Referenced Units
WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(scopeKey, unitCode, unitName, dimensionType, precisionScale, isBaseUnit, isActive) AS (
  VALUES
    ('global', 'MT', 'Metric Ton', 'weight', 3, FALSE, TRUE),
    ('global', 'KG', 'Kilogram', 'weight', 3, FALSE, TRUE),
    ('global', 'CFT', 'Cubic Feet', 'volume', 3, FALSE, TRUE),
    ('global', 'BRASS', 'Brass', 'volume', 3, FALSE, TRUE),
    ('global', 'CUM', 'Cubic Meter', 'volume', 3, FALSE, TRUE),
    ('global', 'BAG', 'Bag', 'count', 0, FALSE, TRUE)
)
UPDATE public.unit_master um
SET
  unit_name = seed.unitName,
  dimension_type = seed.dimensionType,
  precision_scale = seed.precisionScale::integer,
  is_base_unit = seed.isBaseUnit,
  is_active = seed.isActive,
  updated_at = CURRENT_TIMESTAMP
FROM seed
WHERE LOWER(BTRIM(um.unit_code)) = LOWER(BTRIM(seed.unitCode))
  AND (
    (seed.scopeKey = 'company' AND um.company_id = (SELECT company_id FROM target_company))
    OR (seed.scopeKey = 'global' AND um.company_id IS NULL)
  );

WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(scopeKey, unitCode, unitName, dimensionType, precisionScale, isBaseUnit, isActive) AS (
  VALUES
    ('global', 'MT', 'Metric Ton', 'weight', 3, FALSE, TRUE),
    ('global', 'KG', 'Kilogram', 'weight', 3, FALSE, TRUE),
    ('global', 'CFT', 'Cubic Feet', 'volume', 3, FALSE, TRUE),
    ('global', 'BRASS', 'Brass', 'volume', 3, FALSE, TRUE),
    ('global', 'CUM', 'Cubic Meter', 'volume', 3, FALSE, TRUE),
    ('global', 'BAG', 'Bag', 'count', 0, FALSE, TRUE)
)
INSERT INTO public.unit_master (
  company_id,
  unit_code,
  unit_name,
  dimension_type,
  precision_scale,
  is_base_unit,
  is_active
)
SELECT
  CASE WHEN seed.scopeKey = 'company' THEN (SELECT company_id FROM target_company) ELSE NULL::BIGINT END,
  seed.unitCode,
  seed.unitName,
  seed.dimensionType,
  seed.precisionScale::integer,
  seed.isBaseUnit,
  seed.isActive
FROM seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.unit_master existing
  WHERE LOWER(BTRIM(existing.unit_code)) = LOWER(BTRIM(seed.unitCode))
    AND (
      (seed.scopeKey = 'global' AND existing.company_id IS NULL)
      OR (seed.scopeKey = 'company' AND existing.company_id = (SELECT company_id FROM target_company))
    )
);


-- Material Unit Conversions
WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(materialCode, materialName, fromUnitCode, toUnitCode, conversionFactor, conversionMethod, effectiveFrom, effectiveTo, notes, isActive) AS (
  VALUES
    ('AGG-06', 'Aggregate 6mm', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06', 'Aggregate 6mm', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06', 'Aggregate 6mm', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06', 'Aggregate 6mm', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06', 'Aggregate 6mm', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06', 'Aggregate 6mm', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06', 'Aggregate 6mm', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06', 'Aggregate 6mm', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-NVSI', 'Aggregate 6mm Non-VSI', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-NVSI', 'Aggregate 6mm Non-VSI', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-NVSI', 'Aggregate 6mm Non-VSI', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-NVSI', 'Aggregate 6mm Non-VSI', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-NVSI', 'Aggregate 6mm Non-VSI', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-NVSI', 'Aggregate 6mm Non-VSI', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-NVSI', 'Aggregate 6mm Non-VSI', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-NVSI', 'Aggregate 6mm Non-VSI', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-VSI', 'Aggregate 6mm VSI', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-VSI', 'Aggregate 6mm VSI', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-VSI', 'Aggregate 6mm VSI', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-VSI', 'Aggregate 6mm VSI', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-VSI', 'Aggregate 6mm VSI', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-VSI', 'Aggregate 6mm VSI', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-VSI', 'Aggregate 6mm VSI', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-VSI', 'Aggregate 6mm VSI', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10', 'Aggregate 10mm', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10', 'Aggregate 10mm', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10', 'Aggregate 10mm', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10', 'Aggregate 10mm', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10', 'Aggregate 10mm', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10', 'Aggregate 10mm', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10', 'Aggregate 10mm', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10', 'Aggregate 10mm', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-NVSI', 'Aggregate 10mm Non-VSI', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-NVSI', 'Aggregate 10mm Non-VSI', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-NVSI', 'Aggregate 10mm Non-VSI', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-NVSI', 'Aggregate 10mm Non-VSI', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-NVSI', 'Aggregate 10mm Non-VSI', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-NVSI', 'Aggregate 10mm Non-VSI', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-NVSI', 'Aggregate 10mm Non-VSI', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-NVSI', 'Aggregate 10mm Non-VSI', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-VSI', 'Aggregate 10mm VSI', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-VSI', 'Aggregate 10mm VSI', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-VSI', 'Aggregate 10mm VSI', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-VSI', 'Aggregate 10mm VSI', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-VSI', 'Aggregate 10mm VSI', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-VSI', 'Aggregate 10mm VSI', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-VSI', 'Aggregate 10mm VSI', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-VSI', 'Aggregate 10mm VSI', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-12', 'Aggregate 12mm', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-12', 'Aggregate 12mm', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-12', 'Aggregate 12mm', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-12', 'Aggregate 12mm', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-12', 'Aggregate 12mm', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-12', 'Aggregate 12mm', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-12', 'Aggregate 12mm', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-12', 'Aggregate 12mm', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20', 'Aggregate 20mm', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20', 'Aggregate 20mm', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20', 'Aggregate 20mm', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20', 'Aggregate 20mm', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20', 'Aggregate 20mm', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20', 'Aggregate 20mm', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20', 'Aggregate 20mm', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20', 'Aggregate 20mm', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-NVSI', 'Aggregate 20mm Non-VSI', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-NVSI', 'Aggregate 20mm Non-VSI', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-NVSI', 'Aggregate 20mm Non-VSI', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-NVSI', 'Aggregate 20mm Non-VSI', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-NVSI', 'Aggregate 20mm Non-VSI', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-NVSI', 'Aggregate 20mm Non-VSI', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-NVSI', 'Aggregate 20mm Non-VSI', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-NVSI', 'Aggregate 20mm Non-VSI', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-VSI', 'Aggregate 20mm VSI', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-VSI', 'Aggregate 20mm VSI', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-VSI', 'Aggregate 20mm VSI', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-VSI', 'Aggregate 20mm VSI', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-VSI', 'Aggregate 20mm VSI', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-VSI', 'Aggregate 20mm VSI', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-VSI', 'Aggregate 20mm VSI', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-VSI', 'Aggregate 20mm VSI', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-25', 'Aggregate 25mm', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-25', 'Aggregate 25mm', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-25', 'Aggregate 25mm', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-25', 'Aggregate 25mm', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-25', 'Aggregate 25mm', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-25', 'Aggregate 25mm', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-25', 'Aggregate 25mm', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-25', 'Aggregate 25mm', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40', 'Aggregate 40mm', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40', 'Aggregate 40mm', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40', 'Aggregate 40mm', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40', 'Aggregate 40mm', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40', 'Aggregate 40mm', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40', 'Aggregate 40mm', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40', 'Aggregate 40mm', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40', 'Aggregate 40mm', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-NVSI', 'Aggregate 40mm Non-VSI', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-NVSI', 'Aggregate 40mm Non-VSI', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-NVSI', 'Aggregate 40mm Non-VSI', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-NVSI', 'Aggregate 40mm Non-VSI', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-NVSI', 'Aggregate 40mm Non-VSI', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-NVSI', 'Aggregate 40mm Non-VSI', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-NVSI', 'Aggregate 40mm Non-VSI', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-NVSI', 'Aggregate 40mm Non-VSI', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-VSI', 'Aggregate 40mm VSI', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-VSI', 'Aggregate 40mm VSI', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-VSI', 'Aggregate 40mm VSI', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-VSI', 'Aggregate 40mm VSI', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-VSI', 'Aggregate 40mm VSI', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-VSI', 'Aggregate 40mm VSI', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-VSI', 'Aggregate 40mm VSI', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-VSI', 'Aggregate 40mm VSI', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-63', 'Aggregate 63mm', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-63', 'Aggregate 63mm', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-63', 'Aggregate 63mm', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-63', 'Aggregate 63mm', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-63', 'Aggregate 63mm', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-63', 'Aggregate 63mm', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-63', 'Aggregate 63mm', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-63', 'Aggregate 63mm', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('CRDUST', 'Crusher Dust', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('CRDUST', 'Crusher Dust', 'BRASS', 'MT', '4.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('CRDUST', 'Crusher Dust', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('CRDUST', 'Crusher Dust', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('CRDUST', 'Crusher Dust', 'CFT', 'MT', '0.040000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('CRDUST', 'Crusher Dust', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('CRDUST', 'Crusher Dust', 'MT', 'BRASS', '0.250000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('CRDUST', 'Crusher Dust', 'MT', 'CFT', '25.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-20', 'Dolomite 20mm', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-20', 'Dolomite 20mm', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-20', 'Dolomite 20mm', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-20', 'Dolomite 20mm', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-20', 'Dolomite 20mm', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-20', 'Dolomite 20mm', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-20', 'Dolomite 20mm', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-20', 'Dolomite 20mm', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-RAW', 'Dolomite Boulders', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-RAW', 'Dolomite Boulders', 'BRASS', 'MT', '4.761900', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-RAW', 'Dolomite Boulders', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-RAW', 'Dolomite Boulders', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-RAW', 'Dolomite Boulders', 'CFT', 'MT', '0.047619', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-RAW', 'Dolomite Boulders', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-RAW', 'Dolomite Boulders', 'MT', 'BRASS', '0.210000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-RAW', 'Dolomite Boulders', 'MT', 'CFT', '21.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DUST', 'Stone Dust', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DUST', 'Stone Dust', 'BRASS', 'MT', '4.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DUST', 'Stone Dust', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DUST', 'Stone Dust', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DUST', 'Stone Dust', 'CFT', 'MT', '0.040000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DUST', 'Stone Dust', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DUST', 'Stone Dust', 'MT', 'BRASS', '0.250000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DUST', 'Stone Dust', 'MT', 'CFT', '25.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB', 'GSB (Granular Sub-Base)', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB', 'GSB (Granular Sub-Base)', 'BRASS', 'MT', '4.545500', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB', 'GSB (Granular Sub-Base)', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB', 'GSB (Granular Sub-Base)', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB', 'GSB (Granular Sub-Base)', 'CFT', 'MT', '0.045455', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB', 'GSB (Granular Sub-Base)', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB', 'GSB (Granular Sub-Base)', 'MT', 'BRASS', '0.220000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB', 'GSB (Granular Sub-Base)', 'MT', 'CFT', '22.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G1', 'GSB Grade 1', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G1', 'GSB Grade 1', 'BRASS', 'MT', '4.545500', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G1', 'GSB Grade 1', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G1', 'GSB Grade 1', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G1', 'GSB Grade 1', 'CFT', 'MT', '0.045455', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G1', 'GSB Grade 1', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G1', 'GSB Grade 1', 'MT', 'BRASS', '0.220000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G1', 'GSB Grade 1', 'MT', 'CFT', '22.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G2', 'GSB Grade 2', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G2', 'GSB Grade 2', 'BRASS', 'MT', '4.545500', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G2', 'GSB Grade 2', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G2', 'GSB Grade 2', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G2', 'GSB Grade 2', 'CFT', 'MT', '0.045455', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G2', 'GSB Grade 2', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G2', 'GSB Grade 2', 'MT', 'BRASS', '0.220000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G2', 'GSB Grade 2', 'MT', 'CFT', '22.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G3', 'GSB Grade 3', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G3', 'GSB Grade 3', 'BRASS', 'MT', '4.545500', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G3', 'GSB Grade 3', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G3', 'GSB Grade 3', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G3', 'GSB Grade 3', 'CFT', 'MT', '0.045455', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G3', 'GSB Grade 3', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G3', 'GSB Grade 3', 'MT', 'BRASS', '0.220000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G3', 'GSB Grade 3', 'MT', 'CFT', '22.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('M-SAND', 'Crush Sand (M-Sand)', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('M-SAND', 'Crush Sand (M-Sand)', 'BRASS', 'MT', '5.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('M-SAND', 'Crush Sand (M-Sand)', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('M-SAND', 'Crush Sand (M-Sand)', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('M-SAND', 'Crush Sand (M-Sand)', 'CFT', 'MT', '0.050000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('M-SAND', 'Crush Sand (M-Sand)', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('M-SAND', 'Crush Sand (M-Sand)', 'MT', 'BRASS', '0.200000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('M-SAND', 'Crush Sand (M-Sand)', 'MT', 'CFT', '20.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('MURUM', 'Murum', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('MURUM', 'Murum', 'BRASS', 'MT', '4.545500', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('MURUM', 'Murum', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('MURUM', 'Murum', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('MURUM', 'Murum', 'CFT', 'MT', '0.045455', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('MURUM', 'Murum', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('MURUM', 'Murum', 'MT', 'BRASS', '0.220000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('MURUM', 'Murum', 'MT', 'CFT', '22.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('OPC-53', 'OPC 53 Grade', 'BAG', 'MT', '0.050000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('OPC-53', 'OPC 53 Grade', 'KG', 'MT', '0.001000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('OPC-53', 'OPC 53 Grade', 'MT', 'BAG', '20.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('OPC-53', 'OPC 53 Grade', 'MT', 'KG', '1000.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('P-SAND', 'Plaster Sand (P-Sand)', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('P-SAND', 'Plaster Sand (P-Sand)', 'BRASS', 'MT', '5.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('P-SAND', 'Plaster Sand (P-Sand)', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('P-SAND', 'Plaster Sand (P-Sand)', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('P-SAND', 'Plaster Sand (P-Sand)', 'CFT', 'MT', '0.050000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('P-SAND', 'Plaster Sand (P-Sand)', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('P-SAND', 'Plaster Sand (P-Sand)', 'MT', 'BRASS', '0.200000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('P-SAND', 'Plaster Sand (P-Sand)', 'MT', 'CFT', '20.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('PPC', 'PPC Cement', 'BAG', 'MT', '0.050000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('PPC', 'PPC Cement', 'KG', 'MT', '0.001000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('PPC', 'PPC Cement', 'MT', 'BAG', '20.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('PPC', 'PPC Cement', 'MT', 'KG', '1000.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('SCR-MET', 'Screened Metal', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('SCR-MET', 'Screened Metal', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('SCR-MET', 'Screened Metal', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('SCR-MET', 'Screened Metal', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('SCR-MET', 'Screened Metal', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('SCR-MET', 'Screened Metal', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('SCR-MET', 'Screened Metal', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('SCR-MET', 'Screened Metal', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('WMM', 'WMM Material', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('WMM', 'WMM Material', 'BRASS', 'MT', '4.444400', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('WMM', 'WMM Material', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('WMM', 'WMM Material', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('WMM', 'WMM Material', 'CFT', 'MT', '0.044444', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('WMM', 'WMM Material', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('WMM', 'WMM Material', 'MT', 'BRASS', '0.225000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('WMM', 'WMM Material', 'MT', 'CFT', '22.500000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE)
)
UPDATE public.material_unit_conversions muc
SET
  conversion_factor = seed.conversionFactor::numeric,
  conversion_method = seed.conversionMethod,
  effective_to = seed.effectiveTo::date,
  notes = seed.notes,
  is_active = seed.isActive,
  updated_at = CURRENT_TIMESTAMP
FROM seed
WHERE muc.material_id = (
    SELECT mm.id
    FROM public.material_master mm
    WHERE mm.company_id = (SELECT company_id FROM target_company)
      AND (
        LOWER(BTRIM(mm.material_code)) = LOWER(BTRIM(seed.materialCode))
        OR LOWER(BTRIM(mm.material_name)) = LOWER(BTRIM(seed.materialName))
      )
    LIMIT 1
  )
  AND muc.from_unit_id = (
    SELECT um.id
    FROM public.unit_master um
    WHERE LOWER(BTRIM(um.unit_code)) = LOWER(BTRIM(seed.fromUnitCode))
      AND (um.company_id IS NULL OR um.company_id = (SELECT company_id FROM target_company))
    ORDER BY um.company_id NULLS FIRST, um.id
    LIMIT 1
  )
  AND muc.to_unit_id = (
    SELECT um.id
    FROM public.unit_master um
    WHERE LOWER(BTRIM(um.unit_code)) = LOWER(BTRIM(seed.toUnitCode))
      AND (um.company_id IS NULL OR um.company_id = (SELECT company_id FROM target_company))
    ORDER BY um.company_id NULLS FIRST, um.id
    LIMIT 1
  )
  AND COALESCE(muc.effective_from::text, '') = COALESCE(seed.effectiveFrom, '');

WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(materialCode, materialName, fromUnitCode, toUnitCode, conversionFactor, conversionMethod, effectiveFrom, effectiveTo, notes, isActive) AS (
  VALUES
    ('AGG-06', 'Aggregate 6mm', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06', 'Aggregate 6mm', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06', 'Aggregate 6mm', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06', 'Aggregate 6mm', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06', 'Aggregate 6mm', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06', 'Aggregate 6mm', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06', 'Aggregate 6mm', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06', 'Aggregate 6mm', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-NVSI', 'Aggregate 6mm Non-VSI', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-NVSI', 'Aggregate 6mm Non-VSI', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-NVSI', 'Aggregate 6mm Non-VSI', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-NVSI', 'Aggregate 6mm Non-VSI', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-NVSI', 'Aggregate 6mm Non-VSI', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-NVSI', 'Aggregate 6mm Non-VSI', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-NVSI', 'Aggregate 6mm Non-VSI', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-NVSI', 'Aggregate 6mm Non-VSI', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-VSI', 'Aggregate 6mm VSI', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-VSI', 'Aggregate 6mm VSI', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-VSI', 'Aggregate 6mm VSI', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-VSI', 'Aggregate 6mm VSI', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-VSI', 'Aggregate 6mm VSI', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-VSI', 'Aggregate 6mm VSI', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-VSI', 'Aggregate 6mm VSI', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-VSI', 'Aggregate 6mm VSI', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10', 'Aggregate 10mm', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10', 'Aggregate 10mm', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10', 'Aggregate 10mm', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10', 'Aggregate 10mm', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10', 'Aggregate 10mm', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10', 'Aggregate 10mm', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10', 'Aggregate 10mm', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10', 'Aggregate 10mm', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-NVSI', 'Aggregate 10mm Non-VSI', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-NVSI', 'Aggregate 10mm Non-VSI', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-NVSI', 'Aggregate 10mm Non-VSI', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-NVSI', 'Aggregate 10mm Non-VSI', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-NVSI', 'Aggregate 10mm Non-VSI', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-NVSI', 'Aggregate 10mm Non-VSI', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-NVSI', 'Aggregate 10mm Non-VSI', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-NVSI', 'Aggregate 10mm Non-VSI', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-VSI', 'Aggregate 10mm VSI', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-VSI', 'Aggregate 10mm VSI', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-VSI', 'Aggregate 10mm VSI', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-VSI', 'Aggregate 10mm VSI', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-VSI', 'Aggregate 10mm VSI', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-VSI', 'Aggregate 10mm VSI', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-VSI', 'Aggregate 10mm VSI', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-VSI', 'Aggregate 10mm VSI', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-12', 'Aggregate 12mm', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-12', 'Aggregate 12mm', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-12', 'Aggregate 12mm', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-12', 'Aggregate 12mm', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-12', 'Aggregate 12mm', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-12', 'Aggregate 12mm', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-12', 'Aggregate 12mm', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-12', 'Aggregate 12mm', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20', 'Aggregate 20mm', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20', 'Aggregate 20mm', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20', 'Aggregate 20mm', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20', 'Aggregate 20mm', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20', 'Aggregate 20mm', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20', 'Aggregate 20mm', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20', 'Aggregate 20mm', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20', 'Aggregate 20mm', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-NVSI', 'Aggregate 20mm Non-VSI', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-NVSI', 'Aggregate 20mm Non-VSI', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-NVSI', 'Aggregate 20mm Non-VSI', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-NVSI', 'Aggregate 20mm Non-VSI', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-NVSI', 'Aggregate 20mm Non-VSI', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-NVSI', 'Aggregate 20mm Non-VSI', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-NVSI', 'Aggregate 20mm Non-VSI', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-NVSI', 'Aggregate 20mm Non-VSI', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-VSI', 'Aggregate 20mm VSI', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-VSI', 'Aggregate 20mm VSI', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-VSI', 'Aggregate 20mm VSI', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-VSI', 'Aggregate 20mm VSI', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-VSI', 'Aggregate 20mm VSI', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-VSI', 'Aggregate 20mm VSI', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-VSI', 'Aggregate 20mm VSI', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-VSI', 'Aggregate 20mm VSI', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-25', 'Aggregate 25mm', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-25', 'Aggregate 25mm', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-25', 'Aggregate 25mm', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-25', 'Aggregate 25mm', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-25', 'Aggregate 25mm', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-25', 'Aggregate 25mm', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-25', 'Aggregate 25mm', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-25', 'Aggregate 25mm', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40', 'Aggregate 40mm', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40', 'Aggregate 40mm', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40', 'Aggregate 40mm', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40', 'Aggregate 40mm', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40', 'Aggregate 40mm', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40', 'Aggregate 40mm', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40', 'Aggregate 40mm', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40', 'Aggregate 40mm', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-NVSI', 'Aggregate 40mm Non-VSI', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-NVSI', 'Aggregate 40mm Non-VSI', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-NVSI', 'Aggregate 40mm Non-VSI', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-NVSI', 'Aggregate 40mm Non-VSI', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-NVSI', 'Aggregate 40mm Non-VSI', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-NVSI', 'Aggregate 40mm Non-VSI', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-NVSI', 'Aggregate 40mm Non-VSI', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-NVSI', 'Aggregate 40mm Non-VSI', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-VSI', 'Aggregate 40mm VSI', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-VSI', 'Aggregate 40mm VSI', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-VSI', 'Aggregate 40mm VSI', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-VSI', 'Aggregate 40mm VSI', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-VSI', 'Aggregate 40mm VSI', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-VSI', 'Aggregate 40mm VSI', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-VSI', 'Aggregate 40mm VSI', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-VSI', 'Aggregate 40mm VSI', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-63', 'Aggregate 63mm', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-63', 'Aggregate 63mm', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-63', 'Aggregate 63mm', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-63', 'Aggregate 63mm', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-63', 'Aggregate 63mm', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-63', 'Aggregate 63mm', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-63', 'Aggregate 63mm', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-63', 'Aggregate 63mm', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('CRDUST', 'Crusher Dust', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('CRDUST', 'Crusher Dust', 'BRASS', 'MT', '4.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('CRDUST', 'Crusher Dust', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('CRDUST', 'Crusher Dust', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('CRDUST', 'Crusher Dust', 'CFT', 'MT', '0.040000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('CRDUST', 'Crusher Dust', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('CRDUST', 'Crusher Dust', 'MT', 'BRASS', '0.250000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('CRDUST', 'Crusher Dust', 'MT', 'CFT', '25.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-20', 'Dolomite 20mm', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-20', 'Dolomite 20mm', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-20', 'Dolomite 20mm', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-20', 'Dolomite 20mm', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-20', 'Dolomite 20mm', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-20', 'Dolomite 20mm', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-20', 'Dolomite 20mm', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-20', 'Dolomite 20mm', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-RAW', 'Dolomite Boulders', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-RAW', 'Dolomite Boulders', 'BRASS', 'MT', '4.761900', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-RAW', 'Dolomite Boulders', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-RAW', 'Dolomite Boulders', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-RAW', 'Dolomite Boulders', 'CFT', 'MT', '0.047619', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-RAW', 'Dolomite Boulders', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-RAW', 'Dolomite Boulders', 'MT', 'BRASS', '0.210000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-RAW', 'Dolomite Boulders', 'MT', 'CFT', '21.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DUST', 'Stone Dust', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DUST', 'Stone Dust', 'BRASS', 'MT', '4.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DUST', 'Stone Dust', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DUST', 'Stone Dust', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DUST', 'Stone Dust', 'CFT', 'MT', '0.040000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DUST', 'Stone Dust', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DUST', 'Stone Dust', 'MT', 'BRASS', '0.250000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DUST', 'Stone Dust', 'MT', 'CFT', '25.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB', 'GSB (Granular Sub-Base)', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB', 'GSB (Granular Sub-Base)', 'BRASS', 'MT', '4.545500', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB', 'GSB (Granular Sub-Base)', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB', 'GSB (Granular Sub-Base)', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB', 'GSB (Granular Sub-Base)', 'CFT', 'MT', '0.045455', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB', 'GSB (Granular Sub-Base)', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB', 'GSB (Granular Sub-Base)', 'MT', 'BRASS', '0.220000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB', 'GSB (Granular Sub-Base)', 'MT', 'CFT', '22.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G1', 'GSB Grade 1', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G1', 'GSB Grade 1', 'BRASS', 'MT', '4.545500', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G1', 'GSB Grade 1', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G1', 'GSB Grade 1', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G1', 'GSB Grade 1', 'CFT', 'MT', '0.045455', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G1', 'GSB Grade 1', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G1', 'GSB Grade 1', 'MT', 'BRASS', '0.220000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G1', 'GSB Grade 1', 'MT', 'CFT', '22.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G2', 'GSB Grade 2', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G2', 'GSB Grade 2', 'BRASS', 'MT', '4.545500', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G2', 'GSB Grade 2', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G2', 'GSB Grade 2', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G2', 'GSB Grade 2', 'CFT', 'MT', '0.045455', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G2', 'GSB Grade 2', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G2', 'GSB Grade 2', 'MT', 'BRASS', '0.220000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G2', 'GSB Grade 2', 'MT', 'CFT', '22.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G3', 'GSB Grade 3', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G3', 'GSB Grade 3', 'BRASS', 'MT', '4.545500', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G3', 'GSB Grade 3', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G3', 'GSB Grade 3', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G3', 'GSB Grade 3', 'CFT', 'MT', '0.045455', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G3', 'GSB Grade 3', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G3', 'GSB Grade 3', 'MT', 'BRASS', '0.220000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G3', 'GSB Grade 3', 'MT', 'CFT', '22.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('M-SAND', 'Crush Sand (M-Sand)', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('M-SAND', 'Crush Sand (M-Sand)', 'BRASS', 'MT', '5.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('M-SAND', 'Crush Sand (M-Sand)', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('M-SAND', 'Crush Sand (M-Sand)', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('M-SAND', 'Crush Sand (M-Sand)', 'CFT', 'MT', '0.050000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('M-SAND', 'Crush Sand (M-Sand)', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('M-SAND', 'Crush Sand (M-Sand)', 'MT', 'BRASS', '0.200000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('M-SAND', 'Crush Sand (M-Sand)', 'MT', 'CFT', '20.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('MURUM', 'Murum', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('MURUM', 'Murum', 'BRASS', 'MT', '4.545500', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('MURUM', 'Murum', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('MURUM', 'Murum', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('MURUM', 'Murum', 'CFT', 'MT', '0.045455', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('MURUM', 'Murum', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('MURUM', 'Murum', 'MT', 'BRASS', '0.220000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('MURUM', 'Murum', 'MT', 'CFT', '22.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('OPC-53', 'OPC 53 Grade', 'BAG', 'MT', '0.050000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('OPC-53', 'OPC 53 Grade', 'KG', 'MT', '0.001000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('OPC-53', 'OPC 53 Grade', 'MT', 'BAG', '20.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('OPC-53', 'OPC 53 Grade', 'MT', 'KG', '1000.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('P-SAND', 'Plaster Sand (P-Sand)', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('P-SAND', 'Plaster Sand (P-Sand)', 'BRASS', 'MT', '5.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('P-SAND', 'Plaster Sand (P-Sand)', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('P-SAND', 'Plaster Sand (P-Sand)', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('P-SAND', 'Plaster Sand (P-Sand)', 'CFT', 'MT', '0.050000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('P-SAND', 'Plaster Sand (P-Sand)', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('P-SAND', 'Plaster Sand (P-Sand)', 'MT', 'BRASS', '0.200000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('P-SAND', 'Plaster Sand (P-Sand)', 'MT', 'CFT', '20.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('PPC', 'PPC Cement', 'BAG', 'MT', '0.050000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('PPC', 'PPC Cement', 'KG', 'MT', '0.001000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('PPC', 'PPC Cement', 'MT', 'BAG', '20.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('PPC', 'PPC Cement', 'MT', 'KG', '1000.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('SCR-MET', 'Screened Metal', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('SCR-MET', 'Screened Metal', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('SCR-MET', 'Screened Metal', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('SCR-MET', 'Screened Metal', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('SCR-MET', 'Screened Metal', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('SCR-MET', 'Screened Metal', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('SCR-MET', 'Screened Metal', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('SCR-MET', 'Screened Metal', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('WMM', 'WMM Material', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('WMM', 'WMM Material', 'BRASS', 'MT', '4.444400', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('WMM', 'WMM Material', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('WMM', 'WMM Material', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('WMM', 'WMM Material', 'CFT', 'MT', '0.044444', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('WMM', 'WMM Material', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('WMM', 'WMM Material', 'MT', 'BRASS', '0.225000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('WMM', 'WMM Material', 'MT', 'CFT', '22.500000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE)
)
INSERT INTO public.material_unit_conversions (
  company_id,
  material_id,
  from_unit_id,
  to_unit_id,
  conversion_factor,
  conversion_method,
  effective_from,
  effective_to,
  notes,
  is_active
)
SELECT
  (SELECT company_id FROM target_company),
  (
    SELECT mm.id
    FROM public.material_master mm
    WHERE mm.company_id = (SELECT company_id FROM target_company)
      AND (
        LOWER(BTRIM(mm.material_code)) = LOWER(BTRIM(seed.materialCode))
        OR LOWER(BTRIM(mm.material_name)) = LOWER(BTRIM(seed.materialName))
      )
    LIMIT 1
  ),
  (
    SELECT um.id
    FROM public.unit_master um
    WHERE LOWER(BTRIM(um.unit_code)) = LOWER(BTRIM(seed.fromUnitCode))
      AND (um.company_id IS NULL OR um.company_id = (SELECT company_id FROM target_company))
    ORDER BY um.company_id NULLS FIRST, um.id
    LIMIT 1
  ),
  (
    SELECT um.id
    FROM public.unit_master um
    WHERE LOWER(BTRIM(um.unit_code)) = LOWER(BTRIM(seed.toUnitCode))
      AND (um.company_id IS NULL OR um.company_id = (SELECT company_id FROM target_company))
    ORDER BY um.company_id NULLS FIRST, um.id
    LIMIT 1
  ),
  seed.conversionFactor::numeric,
  seed.conversionMethod,
  seed.effectiveFrom::date,
  seed.effectiveTo::date,
  seed.notes,
  seed.isActive
FROM seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.material_unit_conversions existing
  WHERE existing.material_id = (
      SELECT mm.id
      FROM public.material_master mm
      WHERE mm.company_id = (SELECT company_id FROM target_company)
        AND (
          LOWER(BTRIM(mm.material_code)) = LOWER(BTRIM(seed.materialCode))
          OR LOWER(BTRIM(mm.material_name)) = LOWER(BTRIM(seed.materialName))
        )
      LIMIT 1
    )
    AND existing.from_unit_id = (
      SELECT um.id
      FROM public.unit_master um
      WHERE LOWER(BTRIM(um.unit_code)) = LOWER(BTRIM(seed.fromUnitCode))
        AND (um.company_id IS NULL OR um.company_id = (SELECT company_id FROM target_company))
      ORDER BY um.company_id NULLS FIRST, um.id
      LIMIT 1
    )
    AND existing.to_unit_id = (
      SELECT um.id
      FROM public.unit_master um
      WHERE LOWER(BTRIM(um.unit_code)) = LOWER(BTRIM(seed.toUnitCode))
        AND (um.company_id IS NULL OR um.company_id = (SELECT company_id FROM target_company))
      ORDER BY um.company_id NULLS FIRST, um.id
      LIMIT 1
    )
    AND COALESCE(existing.effective_from::text, '') = COALESCE(seed.effectiveFrom, '')
);


-- Party Material Rates
WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(plantCode, partyCode, materialCode, materialName, effectiveFrom, ratePerTon, royaltyMode, royaltyValue, loadingCharge, notes, isActive, tonsPerBrass, rateUnit, rateUnitLabel, rateUnitsPerTon, loadingChargeBasis, rateUnitCode, billingBasis, pricePerUnit) AS (
  VALUES
    ('SCP', 'LLOYDS-GHG', 'AGG-10', 'Aggregate 10mm', '2026-04-25', '580.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'LLOYDS-GHG', 'AGG-20', 'Aggregate 20mm', '2026-04-25', '520.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'LLOYDS-GHG', 'AGG-40', 'Aggregate 40mm', '2026-04-25', '510.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'LLOYDS-GHG', 'M-SAND', 'Crush Sand (M-Sand)', '2026-04-25', '660.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'LLOYDS-GHG', 'DUST', 'Stone Dust', '2026-04-25', '420.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'LLOYDS-GHG', 'GSB', 'GSB (Granular Sub-Base)', '2026-04-25', '480.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'LLOYDS-GHG', 'WMM', 'WMM Material', '2026-04-25', '480.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'SONAI-INFRA', 'AGG-10', 'Aggregate 10mm', '2026-04-25', '630.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'SONAI-INFRA', 'AGG-20', 'Aggregate 20mm', '2026-04-25', '580.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'SONAI-INFRA', 'AGG-40', 'Aggregate 40mm', '2026-04-25', '520.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'SONAI-INFRA', 'M-SAND', 'Crush Sand (M-Sand)', '2026-04-25', '680.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'SONAI-INFRA', 'DUST', 'Stone Dust', '2026-04-25', '430.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'SONAI-INFRA', 'GSB', 'GSB (Granular Sub-Base)', '2026-04-25', '480.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'SONAI-INFRA', 'WMM', 'WMM Material', '2026-04-25', '485.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'LLOYDS-GHG', 'WMM', 'WMM Material', '2026-04-25', '445.00', 'per_brass', '800.00', '0.00', '', TRUE, '4.5000', 'per_cft', 'CFT', '22.5000', 'none', NULL, NULL, NULL),
    ('SCP', 'LLOYDS-KON', 'AGG-40', 'Aggregate 40mm', '2026-04-25', '480.00', 'per_brass', '800.00', '50.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.5000', 'per_metric_ton', 'metric ton', '1.0000', 'fixed', NULL, NULL, NULL)
)
UPDATE public.party_material_rates pmr
SET
  rate_per_ton = seed.ratePerTon::numeric,
  royalty_mode = seed.royaltyMode,
  royalty_value = seed.royaltyValue::numeric,
  loading_charge = seed.loadingCharge::numeric,
  notes = seed.notes,
  is_active = seed.isActive,
  tons_per_brass = seed.tonsPerBrass::numeric,
  rate_unit = seed.rateUnit,
  rate_unit_label = seed.rateUnitLabel,
  rate_units_per_ton = seed.rateUnitsPerTon::numeric,
  loading_charge_basis = seed.loadingChargeBasis,
  rate_unit_id = (
    SELECT um.id
    FROM public.unit_master um
    WHERE LOWER(BTRIM(um.unit_code)) = LOWER(BTRIM(seed.rateUnitCode))
      AND (um.company_id IS NULL OR um.company_id = (SELECT company_id FROM target_company))
    ORDER BY um.company_id NULLS FIRST, um.id
    LIMIT 1
  ),
  billing_basis = seed.billingBasis,
  price_per_unit = seed.pricePerUnit::numeric,
  updated_at = CURRENT_TIMESTAMP
FROM seed
WHERE pmr.company_id = (SELECT company_id FROM target_company)
  AND pmr.plant_id = (
    SELECT pl.id
    FROM public.plant_master pl
    WHERE pl.company_id = (SELECT company_id FROM target_company)
      AND LOWER(BTRIM(pl.plant_code)) = LOWER(BTRIM(seed.plantCode))
    LIMIT 1
  )
  AND pmr.party_id = (
    SELECT pt.id
    FROM public.party_master pt
    WHERE pt.company_id = (SELECT company_id FROM target_company)
      AND LOWER(BTRIM(pt.party_code)) = LOWER(BTRIM(seed.partyCode))
    LIMIT 1
  )
  AND pmr.material_id = (
    SELECT mm.id
    FROM public.material_master mm
    WHERE mm.company_id = (SELECT company_id FROM target_company)
      AND (
        LOWER(BTRIM(mm.material_code)) = LOWER(BTRIM(seed.materialCode))
        OR LOWER(BTRIM(mm.material_name)) = LOWER(BTRIM(seed.materialName))
      )
    LIMIT 1
  )
  AND COALESCE(pmr.effective_from::text, '') = COALESCE(seed.effectiveFrom, '');

WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(plantCode, partyCode, materialCode, materialName, effectiveFrom, ratePerTon, royaltyMode, royaltyValue, loadingCharge, notes, isActive, tonsPerBrass, rateUnit, rateUnitLabel, rateUnitsPerTon, loadingChargeBasis, rateUnitCode, billingBasis, pricePerUnit) AS (
  VALUES
    ('SCP', 'LLOYDS-GHG', 'AGG-10', 'Aggregate 10mm', '2026-04-25', '580.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'LLOYDS-GHG', 'AGG-20', 'Aggregate 20mm', '2026-04-25', '520.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'LLOYDS-GHG', 'AGG-40', 'Aggregate 40mm', '2026-04-25', '510.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'LLOYDS-GHG', 'M-SAND', 'Crush Sand (M-Sand)', '2026-04-25', '660.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'LLOYDS-GHG', 'DUST', 'Stone Dust', '2026-04-25', '420.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'LLOYDS-GHG', 'GSB', 'GSB (Granular Sub-Base)', '2026-04-25', '480.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'LLOYDS-GHG', 'WMM', 'WMM Material', '2026-04-25', '480.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'SONAI-INFRA', 'AGG-10', 'Aggregate 10mm', '2026-04-25', '630.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'SONAI-INFRA', 'AGG-20', 'Aggregate 20mm', '2026-04-25', '580.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'SONAI-INFRA', 'AGG-40', 'Aggregate 40mm', '2026-04-25', '520.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'SONAI-INFRA', 'M-SAND', 'Crush Sand (M-Sand)', '2026-04-25', '680.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'SONAI-INFRA', 'DUST', 'Stone Dust', '2026-04-25', '430.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'SONAI-INFRA', 'GSB', 'GSB (Granular Sub-Base)', '2026-04-25', '480.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'SONAI-INFRA', 'WMM', 'WMM Material', '2026-04-25', '485.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'LLOYDS-GHG', 'WMM', 'WMM Material', '2026-04-25', '445.00', 'per_brass', '800.00', '0.00', '', TRUE, '4.5000', 'per_cft', 'CFT', '22.5000', 'none', NULL, NULL, NULL),
    ('SCP', 'LLOYDS-KON', 'AGG-40', 'Aggregate 40mm', '2026-04-25', '480.00', 'per_brass', '800.00', '50.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.5000', 'per_metric_ton', 'metric ton', '1.0000', 'fixed', NULL, NULL, NULL)
)
INSERT INTO public.party_material_rates (
  plant_id,
  party_id,
  material_id,
  rate_per_ton,
  royalty_mode,
  royalty_value,
  loading_charge,
  notes,
  is_active,
  company_id,
  tons_per_brass,
  rate_unit,
  rate_unit_label,
  rate_units_per_ton,
  effective_from,
  loading_charge_basis,
  rate_unit_id,
  billing_basis,
  price_per_unit
)
SELECT
  (
    SELECT pl.id
    FROM public.plant_master pl
    WHERE pl.company_id = (SELECT company_id FROM target_company)
      AND LOWER(BTRIM(pl.plant_code)) = LOWER(BTRIM(seed.plantCode))
    LIMIT 1
  ),
  (
    SELECT pt.id
    FROM public.party_master pt
    WHERE pt.company_id = (SELECT company_id FROM target_company)
      AND LOWER(BTRIM(pt.party_code)) = LOWER(BTRIM(seed.partyCode))
    LIMIT 1
  ),
  (
    SELECT mm.id
    FROM public.material_master mm
    WHERE mm.company_id = (SELECT company_id FROM target_company)
      AND (
        LOWER(BTRIM(mm.material_code)) = LOWER(BTRIM(seed.materialCode))
        OR LOWER(BTRIM(mm.material_name)) = LOWER(BTRIM(seed.materialName))
      )
    LIMIT 1
  ),
  seed.ratePerTon::numeric,
  seed.royaltyMode,
  seed.royaltyValue::numeric,
  seed.loadingCharge::numeric,
  seed.notes,
  seed.isActive,
  (SELECT company_id FROM target_company),
  seed.tonsPerBrass::numeric,
  seed.rateUnit,
  seed.rateUnitLabel,
  seed.rateUnitsPerTon::numeric,
  seed.effectiveFrom::date,
  seed.loadingChargeBasis,
  (
    SELECT um.id
    FROM public.unit_master um
    WHERE LOWER(BTRIM(um.unit_code)) = LOWER(BTRIM(seed.rateUnitCode))
      AND (um.company_id IS NULL OR um.company_id = (SELECT company_id FROM target_company))
    ORDER BY um.company_id NULLS FIRST, um.id
    LIMIT 1
  ),
  seed.billingBasis,
  seed.pricePerUnit::numeric
FROM seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.party_material_rates existing
  WHERE existing.company_id = (SELECT company_id FROM target_company)
    AND existing.plant_id = (
      SELECT pl.id
      FROM public.plant_master pl
      WHERE pl.company_id = (SELECT company_id FROM target_company)
        AND LOWER(BTRIM(pl.plant_code)) = LOWER(BTRIM(seed.plantCode))
      LIMIT 1
    )
    AND existing.party_id = (
      SELECT pt.id
      FROM public.party_master pt
      WHERE pt.company_id = (SELECT company_id FROM target_company)
        AND LOWER(BTRIM(pt.party_code)) = LOWER(BTRIM(seed.partyCode))
      LIMIT 1
    )
    AND existing.material_id = (
      SELECT mm.id
      FROM public.material_master mm
      WHERE mm.company_id = (SELECT company_id FROM target_company)
        AND (
          LOWER(BTRIM(mm.material_code)) = LOWER(BTRIM(seed.materialCode))
          OR LOWER(BTRIM(mm.material_name)) = LOWER(BTRIM(seed.materialName))
        )
      LIMIT 1
    )
    AND COALESCE(existing.effective_from::text, '') = COALESCE(seed.effectiveFrom, '')
);


-- Transport Rates
WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(plantCode, vendorName, materialCode, materialName, rateType, rateValue, distanceKm, isActive, rateUnitCode, billingBasis, minimumCharge) AS (
  VALUES
    ('SCP', 'Jungari Transport', 'AGG-10', 'Aggregate 10mm', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Jungari Transport', 'AGG-20', 'Aggregate 20mm', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Jungari Transport', 'AGG-40', 'Aggregate 40mm', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Jungari Transport', 'GSB', 'GSB (Granular Sub-Base)', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Jungari Transport', 'WMM', 'WMM Material', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Jungari Transport', 'M-SAND', 'Crush Sand (M-Sand)', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Jungari Transport', 'DUST', 'Stone Dust', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Sidhesh Transport', 'AGG-10', 'Aggregate 10mm', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Sidhesh Transport', 'AGG-20', 'Aggregate 20mm', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Sidhesh Transport', 'AGG-40', 'Aggregate 40mm', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Sidhesh Transport', 'M-SAND', 'Crush Sand (M-Sand)', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Sidhesh Transport', 'GSB', 'GSB (Granular Sub-Base)', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Sidhesh Transport', 'DUST', 'Stone Dust', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Sidhesh Transport', 'WMM', 'WMM Material', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL)
)
UPDATE public.transport_rates tr
SET
  rate_value = seed.rateValue::numeric,
  is_active = seed.isActive,
  rate_unit_id = (
    SELECT um.id
    FROM public.unit_master um
    WHERE LOWER(BTRIM(um.unit_code)) = LOWER(BTRIM(seed.rateUnitCode))
      AND (um.company_id IS NULL OR um.company_id = (SELECT company_id FROM target_company))
    ORDER BY um.company_id NULLS FIRST, um.id
    LIMIT 1
  ),
  billing_basis = seed.billingBasis,
  minimum_charge = seed.minimumCharge::numeric,
  updated_at = CURRENT_TIMESTAMP
FROM seed
WHERE tr.company_id = (SELECT company_id FROM target_company)
  AND tr.plant_id = (
    SELECT pl.id
    FROM public.plant_master pl
    WHERE pl.company_id = (SELECT company_id FROM target_company)
      AND LOWER(BTRIM(pl.plant_code)) = LOWER(BTRIM(seed.plantCode))
    LIMIT 1
  )
  AND tr.vendor_id = (
    SELECT vm.id
    FROM public.vendor_master vm
    WHERE vm.company_id = (SELECT company_id FROM target_company)
      AND LOWER(BTRIM(vm.vendor_name)) = LOWER(BTRIM(seed.vendorName))
    LIMIT 1
  )
  AND tr.material_id = (
    SELECT mm.id
    FROM public.material_master mm
    WHERE mm.company_id = (SELECT company_id FROM target_company)
      AND (
        LOWER(BTRIM(mm.material_code)) = LOWER(BTRIM(seed.materialCode))
        OR LOWER(BTRIM(mm.material_name)) = LOWER(BTRIM(seed.materialName))
      )
    LIMIT 1
  )
  AND COALESCE(LOWER(BTRIM(tr.rate_type)), '') = COALESCE(LOWER(BTRIM(seed.rateType)), '')
  AND COALESCE(tr.distance_km, -1) = COALESCE(seed.distanceKm::numeric, -1);

WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(plantCode, vendorName, materialCode, materialName, rateType, rateValue, distanceKm, isActive, rateUnitCode, billingBasis, minimumCharge) AS (
  VALUES
    ('SCP', 'Jungari Transport', 'AGG-10', 'Aggregate 10mm', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Jungari Transport', 'AGG-20', 'Aggregate 20mm', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Jungari Transport', 'AGG-40', 'Aggregate 40mm', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Jungari Transport', 'GSB', 'GSB (Granular Sub-Base)', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Jungari Transport', 'WMM', 'WMM Material', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Jungari Transport', 'M-SAND', 'Crush Sand (M-Sand)', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Jungari Transport', 'DUST', 'Stone Dust', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Sidhesh Transport', 'AGG-10', 'Aggregate 10mm', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Sidhesh Transport', 'AGG-20', 'Aggregate 20mm', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Sidhesh Transport', 'AGG-40', 'Aggregate 40mm', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Sidhesh Transport', 'M-SAND', 'Crush Sand (M-Sand)', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Sidhesh Transport', 'GSB', 'GSB (Granular Sub-Base)', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Sidhesh Transport', 'DUST', 'Stone Dust', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Sidhesh Transport', 'WMM', 'WMM Material', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL)
)
INSERT INTO public.transport_rates (
  plant_id,
  vendor_id,
  material_id,
  rate_type,
  rate_value,
  distance_km,
  is_active,
  company_id,
  rate_unit_id,
  billing_basis,
  minimum_charge
)
SELECT
  (
    SELECT pl.id
    FROM public.plant_master pl
    WHERE pl.company_id = (SELECT company_id FROM target_company)
      AND LOWER(BTRIM(pl.plant_code)) = LOWER(BTRIM(seed.plantCode))
    LIMIT 1
  ),
  (
    SELECT vm.id
    FROM public.vendor_master vm
    WHERE vm.company_id = (SELECT company_id FROM target_company)
      AND LOWER(BTRIM(vm.vendor_name)) = LOWER(BTRIM(seed.vendorName))
    LIMIT 1
  ),
  (
    SELECT mm.id
    FROM public.material_master mm
    WHERE mm.company_id = (SELECT company_id FROM target_company)
      AND (
        LOWER(BTRIM(mm.material_code)) = LOWER(BTRIM(seed.materialCode))
        OR LOWER(BTRIM(mm.material_name)) = LOWER(BTRIM(seed.materialName))
      )
    LIMIT 1
  ),
  seed.rateType,
  seed.rateValue::numeric,
  seed.distanceKm::numeric,
  seed.isActive,
  (SELECT company_id FROM target_company),
  (
    SELECT um.id
    FROM public.unit_master um
    WHERE LOWER(BTRIM(um.unit_code)) = LOWER(BTRIM(seed.rateUnitCode))
      AND (um.company_id IS NULL OR um.company_id = (SELECT company_id FROM target_company))
    ORDER BY um.company_id NULLS FIRST, um.id
    LIMIT 1
  ),
  seed.billingBasis,
  seed.minimumCharge::numeric
FROM seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.transport_rates existing
  WHERE existing.company_id = (SELECT company_id FROM target_company)
    AND existing.plant_id = (
      SELECT pl.id
      FROM public.plant_master pl
      WHERE pl.company_id = (SELECT company_id FROM target_company)
        AND LOWER(BTRIM(pl.plant_code)) = LOWER(BTRIM(seed.plantCode))
      LIMIT 1
    )
    AND existing.vendor_id = (
      SELECT vm.id
      FROM public.vendor_master vm
      WHERE vm.company_id = (SELECT company_id FROM target_company)
        AND LOWER(BTRIM(vm.vendor_name)) = LOWER(BTRIM(seed.vendorName))
      LIMIT 1
    )
    AND existing.material_id = (
      SELECT mm.id
      FROM public.material_master mm
      WHERE mm.company_id = (SELECT company_id FROM target_company)
        AND (
          LOWER(BTRIM(mm.material_code)) = LOWER(BTRIM(seed.materialCode))
          OR LOWER(BTRIM(mm.material_name)) = LOWER(BTRIM(seed.materialName))
        )
      LIMIT 1
    )
    AND COALESCE(LOWER(BTRIM(existing.rate_type)), '') = COALESCE(LOWER(BTRIM(seed.rateType)), '')
    AND COALESCE(existing.distance_km, -1) = COALESCE(seed.distanceKm::numeric, -1)
);


COMMIT;
