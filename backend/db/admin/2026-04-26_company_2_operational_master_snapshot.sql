BEGIN;

-- Operational master-data snapshot generated from local database.
-- Company: Gajanan Global Construction LLP
-- Company Code: GAJANAN_GLOBAL_CONSTRUCTION_LL
-- Source Company ID: 2
-- Purpose:
-- Recreate locally-fed operational master/rate data in another database
-- without manual re-entry. This script only updates/inserts matching rows.
-- It does not delete unrelated target-company data.


-- Company Profile
WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(companyName, branchName, addressLine1, addressLine2, city, stateName, stateCode, pincode, gstin, pan, mobile, email, bankName, bankAccount, ifscCode, termsNotes, isActive, companyLogoUrl) AS (
  VALUES
    ('Gajanan Global Construction LLP', 'Chandrapur Main Branch', 'House No. 212, M.I.D.C. Road, Datala', 'Kotwali Ward', 'Chandrapur', 'Maharashtra', '27', '442401', '27AABFG7700Q1Z3', 'AABFG7700Q', '8044566382', 'gcccha.project@gmail.com', NULL, NULL, NULL, NULL, TRUE, 'data:image/webp;base64,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')
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
    ('Gajanan Global Construction LLP', 'Chandrapur Main Branch', 'House No. 212, M.I.D.C. Road, Datala', 'Kotwali Ward', 'Chandrapur', 'Maharashtra', '27', '442401', '27AABFG7700Q1Z3', 'AABFG7700Q', '8044566382', 'gcccha.project@gmail.com', NULL, NULL, NULL, NULL, TRUE, 'data:image/webp;base64,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')
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
  sort_order = seed.sortOrder,
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
  seed.sortOrder,
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
  vehicle_capacity_tons = seed.vehicleCapacityTons,
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
  seed.vehicleCapacityTons,
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
  allow_manual_dispatch_conversion = seed.allowManualDispatchConversion,
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
  seed.allowManualDispatchConversion
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
  gst_rate = seed.gstRate,
  hsn_sac_code = seed.hsnSacCode,
  updated_at = CURRENT_TIMESTAMP
FROM seed
WHERE mm.company_id = (SELECT company_id FROM target_company)
  AND LOWER(BTRIM(mm.material_code)) = LOWER(BTRIM(seed.materialCode));

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
  seed.gstRate,
  seed.hsnSacCode,
  (SELECT company_id FROM target_company)
FROM seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.material_master existing
  WHERE existing.company_id = (SELECT company_id FROM target_company)
    AND LOWER(BTRIM(existing.material_code)) = LOWER(BTRIM(seed.materialCode))
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
  precision_scale = seed.precisionScale,
  is_base_unit = seed.isBaseUnit,
  is_active = seed.isActive,
  updated_at = CURRENT_TIMESTAMP
FROM seed
WHERE LOWER(BTRIM(um.unit_code)) = LOWER(BTRIM(seed.unitCode))
  AND COALESCE(um.company_id, 0) = COALESCE((SELECT company_id FROM target_company), 0)
  AND seed.scopeKey = 'company';

UPDATE public.unit_master um
SET
  unit_name = seed.unitName,
  dimension_type = seed.dimensionType,
  precision_scale = seed.precisionScale,
  is_base_unit = seed.isBaseUnit,
  is_active = seed.isActive,
  updated_at = CURRENT_TIMESTAMP
FROM seed
WHERE LOWER(BTRIM(um.unit_code)) = LOWER(BTRIM(seed.unitCode))
  AND um.company_id IS NULL
  AND seed.scopeKey = 'global';

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
  seed.precisionScale,
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
seed(materialCode, fromUnitCode, toUnitCode, conversionFactor, conversionMethod, effectiveFrom, effectiveTo, notes, isActive) AS (
  VALUES
    ('AGG-06', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-NVSI', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-NVSI', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-NVSI', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-NVSI', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-NVSI', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-NVSI', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-NVSI', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-NVSI', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-VSI', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-VSI', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-VSI', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-VSI', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-VSI', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-VSI', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-VSI', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-VSI', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-NVSI', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-NVSI', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-NVSI', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-NVSI', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-NVSI', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-NVSI', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-NVSI', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-NVSI', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-VSI', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-VSI', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-VSI', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-VSI', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-VSI', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-VSI', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-VSI', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-VSI', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-12', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-12', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-12', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-12', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-12', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-12', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-12', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-12', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-NVSI', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-NVSI', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-NVSI', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-NVSI', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-NVSI', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-NVSI', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-NVSI', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-NVSI', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-VSI', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-VSI', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-VSI', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-VSI', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-VSI', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-VSI', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-VSI', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-VSI', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-25', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-25', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-25', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-25', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-25', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-25', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-25', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-25', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-NVSI', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-NVSI', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-NVSI', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-NVSI', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-NVSI', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-NVSI', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-NVSI', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-NVSI', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-VSI', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-VSI', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-VSI', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-VSI', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-VSI', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-VSI', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-VSI', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-VSI', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-63', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-63', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-63', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-63', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-63', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-63', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-63', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-63', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('CRDUST', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('CRDUST', 'BRASS', 'MT', '4.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('CRDUST', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('CRDUST', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('CRDUST', 'CFT', 'MT', '0.040000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('CRDUST', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('CRDUST', 'MT', 'BRASS', '0.250000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('CRDUST', 'MT', 'CFT', '25.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-20', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-20', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-20', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-20', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-20', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-20', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-20', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-20', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-RAW', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-RAW', 'BRASS', 'MT', '4.761900', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-RAW', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-RAW', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-RAW', 'CFT', 'MT', '0.047619', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-RAW', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-RAW', 'MT', 'BRASS', '0.210000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-RAW', 'MT', 'CFT', '21.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DUST', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DUST', 'BRASS', 'MT', '4.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DUST', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DUST', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DUST', 'CFT', 'MT', '0.040000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DUST', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DUST', 'MT', 'BRASS', '0.250000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DUST', 'MT', 'CFT', '25.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB', 'BRASS', 'MT', '4.545500', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB', 'CFT', 'MT', '0.045455', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB', 'MT', 'BRASS', '0.220000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB', 'MT', 'CFT', '22.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G1', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G1', 'BRASS', 'MT', '4.545500', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G1', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G1', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G1', 'CFT', 'MT', '0.045455', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G1', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G1', 'MT', 'BRASS', '0.220000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G1', 'MT', 'CFT', '22.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G2', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G2', 'BRASS', 'MT', '4.545500', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G2', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G2', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G2', 'CFT', 'MT', '0.045455', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G2', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G2', 'MT', 'BRASS', '0.220000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G2', 'MT', 'CFT', '22.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G3', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G3', 'BRASS', 'MT', '4.545500', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G3', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G3', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G3', 'CFT', 'MT', '0.045455', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G3', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G3', 'MT', 'BRASS', '0.220000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G3', 'MT', 'CFT', '22.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('M-SAND', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('M-SAND', 'BRASS', 'MT', '5.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('M-SAND', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('M-SAND', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('M-SAND', 'CFT', 'MT', '0.050000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('M-SAND', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('M-SAND', 'MT', 'BRASS', '0.200000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('M-SAND', 'MT', 'CFT', '20.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('MURUM', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('MURUM', 'BRASS', 'MT', '4.545500', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('MURUM', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('MURUM', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('MURUM', 'CFT', 'MT', '0.045455', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('MURUM', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('MURUM', 'MT', 'BRASS', '0.220000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('MURUM', 'MT', 'CFT', '22.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('OPC-53', 'BAG', 'MT', '0.050000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('OPC-53', 'KG', 'MT', '0.001000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('OPC-53', 'MT', 'BAG', '20.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('OPC-53', 'MT', 'KG', '1000.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('P-SAND', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('P-SAND', 'BRASS', 'MT', '5.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('P-SAND', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('P-SAND', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('P-SAND', 'CFT', 'MT', '0.050000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('P-SAND', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('P-SAND', 'MT', 'BRASS', '0.200000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('P-SAND', 'MT', 'CFT', '20.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('PPC', 'BAG', 'MT', '0.050000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('PPC', 'KG', 'MT', '0.001000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('PPC', 'MT', 'BAG', '20.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('PPC', 'MT', 'KG', '1000.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('SCR-MET', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('SCR-MET', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('SCR-MET', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('SCR-MET', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('SCR-MET', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('SCR-MET', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('SCR-MET', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('SCR-MET', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('WMM', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('WMM', 'BRASS', 'MT', '4.444400', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('WMM', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('WMM', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('WMM', 'CFT', 'MT', '0.044444', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('WMM', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('WMM', 'MT', 'BRASS', '0.225000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('WMM', 'MT', 'CFT', '22.500000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE)
)
UPDATE public.material_unit_conversions muc
SET
  conversion_factor = seed.conversionFactor,
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
      AND LOWER(BTRIM(mm.material_code)) = LOWER(BTRIM(seed.materialCode))
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
seed(materialCode, fromUnitCode, toUnitCode, conversionFactor, conversionMethod, effectiveFrom, effectiveTo, notes, isActive) AS (
  VALUES
    ('AGG-06', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-NVSI', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-NVSI', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-NVSI', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-NVSI', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-NVSI', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-NVSI', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-NVSI', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-NVSI', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-VSI', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-VSI', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-VSI', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-VSI', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-VSI', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-VSI', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-VSI', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-06-VSI', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-NVSI', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-NVSI', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-NVSI', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-NVSI', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-NVSI', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-NVSI', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-NVSI', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-NVSI', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-VSI', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-VSI', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-VSI', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-VSI', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-VSI', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-VSI', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-VSI', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-10-VSI', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-12', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-12', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-12', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-12', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-12', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-12', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-12', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-12', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-NVSI', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-NVSI', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-NVSI', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-NVSI', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-NVSI', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-NVSI', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-NVSI', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-NVSI', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-VSI', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-VSI', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-VSI', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-VSI', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-VSI', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-VSI', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-VSI', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-20-VSI', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-25', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-25', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-25', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-25', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-25', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-25', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-25', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-25', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-NVSI', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-NVSI', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-NVSI', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-NVSI', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-NVSI', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-NVSI', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-NVSI', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-NVSI', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-VSI', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-VSI', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-VSI', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-VSI', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-VSI', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-VSI', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-VSI', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-40-VSI', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-63', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-63', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-63', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-63', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-63', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-63', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-63', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('AGG-63', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('CRDUST', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('CRDUST', 'BRASS', 'MT', '4.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('CRDUST', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('CRDUST', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('CRDUST', 'CFT', 'MT', '0.040000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('CRDUST', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('CRDUST', 'MT', 'BRASS', '0.250000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('CRDUST', 'MT', 'CFT', '25.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-20', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-20', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-20', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-20', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-20', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-20', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-20', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-20', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-RAW', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-RAW', 'BRASS', 'MT', '4.761900', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-RAW', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-RAW', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-RAW', 'CFT', 'MT', '0.047619', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-RAW', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-RAW', 'MT', 'BRASS', '0.210000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DOL-RAW', 'MT', 'CFT', '21.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DUST', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DUST', 'BRASS', 'MT', '4.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DUST', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DUST', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DUST', 'CFT', 'MT', '0.040000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DUST', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DUST', 'MT', 'BRASS', '0.250000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('DUST', 'MT', 'CFT', '25.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB', 'BRASS', 'MT', '4.545500', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB', 'CFT', 'MT', '0.045455', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB', 'MT', 'BRASS', '0.220000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB', 'MT', 'CFT', '22.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G1', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G1', 'BRASS', 'MT', '4.545500', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G1', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G1', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G1', 'CFT', 'MT', '0.045455', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G1', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G1', 'MT', 'BRASS', '0.220000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G1', 'MT', 'CFT', '22.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G2', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G2', 'BRASS', 'MT', '4.545500', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G2', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G2', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G2', 'CFT', 'MT', '0.045455', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G2', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G2', 'MT', 'BRASS', '0.220000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G2', 'MT', 'CFT', '22.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G3', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G3', 'BRASS', 'MT', '4.545500', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G3', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G3', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G3', 'CFT', 'MT', '0.045455', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G3', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G3', 'MT', 'BRASS', '0.220000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('GSB-G3', 'MT', 'CFT', '22.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('M-SAND', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('M-SAND', 'BRASS', 'MT', '5.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('M-SAND', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('M-SAND', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('M-SAND', 'CFT', 'MT', '0.050000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('M-SAND', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('M-SAND', 'MT', 'BRASS', '0.200000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('M-SAND', 'MT', 'CFT', '20.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('MURUM', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('MURUM', 'BRASS', 'MT', '4.545500', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('MURUM', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('MURUM', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('MURUM', 'CFT', 'MT', '0.045455', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('MURUM', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('MURUM', 'MT', 'BRASS', '0.220000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('MURUM', 'MT', 'CFT', '22.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('OPC-53', 'BAG', 'MT', '0.050000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('OPC-53', 'KG', 'MT', '0.001000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('OPC-53', 'MT', 'BAG', '20.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('OPC-53', 'MT', 'KG', '1000.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('P-SAND', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('P-SAND', 'BRASS', 'MT', '5.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('P-SAND', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('P-SAND', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('P-SAND', 'CFT', 'MT', '0.050000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('P-SAND', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('P-SAND', 'MT', 'BRASS', '0.200000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('P-SAND', 'MT', 'CFT', '20.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('PPC', 'BAG', 'MT', '0.050000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('PPC', 'KG', 'MT', '0.001000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('PPC', 'MT', 'BAG', '20.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('PPC', 'MT', 'KG', '1000.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('SCR-MET', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('SCR-MET', 'BRASS', 'MT', '4.347800', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('SCR-MET', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('SCR-MET', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('SCR-MET', 'CFT', 'MT', '0.043478', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('SCR-MET', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('SCR-MET', 'MT', 'BRASS', '0.230000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('SCR-MET', 'MT', 'CFT', '23.000000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('WMM', 'BRASS', 'CFT', '100.000000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('WMM', 'BRASS', 'MT', '4.444400', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('WMM', 'CFT', 'BRASS', '0.010000', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('WMM', 'CFT', 'CUM', '0.028317', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('WMM', 'CFT', 'MT', '0.044444', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('WMM', 'CUM', 'CFT', '35.314700', 'standard', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('WMM', 'MT', 'BRASS', '0.225000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE),
    ('WMM', 'MT', 'CFT', '22.500000', 'density_based', '2026-04-26', NULL, 'Suggested default; editable as per material density/site agreement.', TRUE)
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
      AND LOWER(BTRIM(mm.material_code)) = LOWER(BTRIM(seed.materialCode))
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
  seed.conversionFactor,
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
        AND LOWER(BTRIM(mm.material_code)) = LOWER(BTRIM(seed.materialCode))
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
seed(plantCode, partyCode, materialCode, effectiveFrom, ratePerTon, royaltyMode, royaltyValue, loadingCharge, notes, isActive, tonsPerBrass, rateUnit, rateUnitLabel, rateUnitsPerTon, loadingChargeBasis, rateUnitCode, billingBasis, pricePerUnit) AS (
  VALUES
    ('SCP', 'LLOYDS-GHG', 'AGG-10', '2026-04-25', '580.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'LLOYDS-GHG', 'AGG-20', '2026-04-25', '520.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'LLOYDS-GHG', 'AGG-40', '2026-04-25', '510.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'LLOYDS-GHG', 'M-SAND', '2026-04-25', '660.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'LLOYDS-GHG', 'DUST', '2026-04-25', '420.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'LLOYDS-GHG', 'GSB', '2026-04-25', '480.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'LLOYDS-GHG', 'WMM', '2026-04-25', '480.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'SONAI-INFRA', 'AGG-10', '2026-04-25', '630.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'SONAI-INFRA', 'AGG-20', '2026-04-25', '580.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'SONAI-INFRA', 'AGG-40', '2026-04-25', '520.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'SONAI-INFRA', 'M-SAND', '2026-04-25', '680.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'SONAI-INFRA', 'DUST', '2026-04-25', '430.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'SONAI-INFRA', 'GSB', '2026-04-25', '480.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'SONAI-INFRA', 'WMM', '2026-04-25', '485.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'LLOYDS-GHG', 'WMM', '2026-04-25', '445.00', 'per_brass', '800.00', '0.00', '', TRUE, '4.5000', 'per_cft', 'CFT', '22.5000', 'none', NULL, NULL, NULL),
    ('SCP', 'LLOYDS-KON', 'AGG-40', '2026-04-25', '480.00', 'per_brass', '800.00', '50.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.5000', 'per_metric_ton', 'metric ton', '1.0000', 'fixed', NULL, NULL, NULL)
)
UPDATE public.party_material_rates pmr
SET
  rate_per_ton = seed.ratePerTon,
  royalty_mode = seed.royaltyMode,
  royalty_value = seed.royaltyValue,
  loading_charge = seed.loadingCharge,
  notes = seed.notes,
  is_active = seed.isActive,
  tons_per_brass = seed.tonsPerBrass,
  rate_unit = seed.rateUnit,
  rate_unit_label = seed.rateUnitLabel,
  rate_units_per_ton = seed.rateUnitsPerTon,
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
  price_per_unit = seed.pricePerUnit,
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
      AND LOWER(BTRIM(mm.material_code)) = LOWER(BTRIM(seed.materialCode))
    LIMIT 1
  )
  AND COALESCE(pmr.effective_from::text, '') = COALESCE(seed.effectiveFrom, '');

WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(plantCode, partyCode, materialCode, effectiveFrom, ratePerTon, royaltyMode, royaltyValue, loadingCharge, notes, isActive, tonsPerBrass, rateUnit, rateUnitLabel, rateUnitsPerTon, loadingChargeBasis, rateUnitCode, billingBasis, pricePerUnit) AS (
  VALUES
    ('SCP', 'LLOYDS-GHG', 'AGG-10', '2026-04-25', '580.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'LLOYDS-GHG', 'AGG-20', '2026-04-25', '520.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'LLOYDS-GHG', 'AGG-40', '2026-04-25', '510.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'LLOYDS-GHG', 'M-SAND', '2026-04-25', '660.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'LLOYDS-GHG', 'DUST', '2026-04-25', '420.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'LLOYDS-GHG', 'GSB', '2026-04-25', '480.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'LLOYDS-GHG', 'WMM', '2026-04-25', '480.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'SONAI-INFRA', 'AGG-10', '2026-04-25', '630.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'SONAI-INFRA', 'AGG-20', '2026-04-25', '580.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'SONAI-INFRA', 'AGG-40', '2026-04-25', '520.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'SONAI-INFRA', 'M-SAND', '2026-04-25', '680.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'SONAI-INFRA', 'DUST', '2026-04-25', '430.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'SONAI-INFRA', 'GSB', '2026-04-25', '480.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'SONAI-INFRA', 'WMM', '2026-04-25', '485.00', 'per_brass', '600.00', '35.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.4500', 'per_ton', 'ton', '1.0000', 'fixed', NULL, NULL, NULL),
    ('SCP', 'LLOYDS-GHG', 'WMM', '2026-04-25', '445.00', 'per_brass', '800.00', '0.00', '', TRUE, '4.5000', 'per_cft', 'CFT', '22.5000', 'none', NULL, NULL, NULL),
    ('SCP', 'LLOYDS-KON', 'AGG-40', '2026-04-25', '480.00', 'per_brass', '800.00', '50.00', 'Rates exclude GST & Royalty. Subject to fuel price fluctuations. Wait time limit: 3 hrs.', TRUE, '4.5000', 'per_metric_ton', 'metric ton', '1.0000', 'fixed', NULL, NULL, NULL)
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
      AND LOWER(BTRIM(mm.material_code)) = LOWER(BTRIM(seed.materialCode))
    LIMIT 1
  ),
  seed.ratePerTon,
  seed.royaltyMode,
  seed.royaltyValue,
  seed.loadingCharge,
  seed.notes,
  seed.isActive,
  (SELECT company_id FROM target_company),
  seed.tonsPerBrass,
  seed.rateUnit,
  seed.rateUnitLabel,
  seed.rateUnitsPerTon,
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
  seed.pricePerUnit
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
        AND LOWER(BTRIM(mm.material_code)) = LOWER(BTRIM(seed.materialCode))
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
seed(plantCode, vendorName, materialCode, rateType, rateValue, distanceKm, isActive, rateUnitCode, billingBasis, minimumCharge) AS (
  VALUES
    ('SCP', 'Jungari Transport', 'AGG-10', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Jungari Transport', 'AGG-20', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Jungari Transport', 'AGG-40', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Jungari Transport', 'GSB', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Jungari Transport', 'WMM', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Jungari Transport', 'M-SAND', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Jungari Transport', 'DUST', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Sidhesh Transport', 'AGG-10', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Sidhesh Transport', 'AGG-20', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Sidhesh Transport', 'AGG-40', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Sidhesh Transport', 'M-SAND', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Sidhesh Transport', 'GSB', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Sidhesh Transport', 'DUST', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Sidhesh Transport', 'WMM', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL)
)
UPDATE public.transport_rates tr
SET
  rate_value = seed.rateValue,
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
  minimum_charge = seed.minimumCharge,
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
      AND LOWER(BTRIM(mm.material_code)) = LOWER(BTRIM(seed.materialCode))
    LIMIT 1
  )
  AND COALESCE(LOWER(BTRIM(tr.rate_type)), '') = COALESCE(LOWER(BTRIM(seed.rateType)), '')
  AND COALESCE(tr.distance_km, -1) = COALESCE(seed.distanceKm, -1);

WITH target_company AS (
  SELECT id AS company_id, company_code, company_name
  FROM public.companies
  WHERE company_code = 'GAJANAN_GLOBAL_CONSTRUCTION_LL'
  LIMIT 1
),
seed(plantCode, vendorName, materialCode, rateType, rateValue, distanceKm, isActive, rateUnitCode, billingBasis, minimumCharge) AS (
  VALUES
    ('SCP', 'Jungari Transport', 'AGG-10', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Jungari Transport', 'AGG-20', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Jungari Transport', 'AGG-40', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Jungari Transport', 'GSB', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Jungari Transport', 'WMM', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Jungari Transport', 'M-SAND', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Jungari Transport', 'DUST', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Sidhesh Transport', 'AGG-10', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Sidhesh Transport', 'AGG-20', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Sidhesh Transport', 'AGG-40', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Sidhesh Transport', 'M-SAND', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Sidhesh Transport', 'GSB', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Sidhesh Transport', 'DUST', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL),
    ('SCP', 'Sidhesh Transport', 'WMM', 'per_trip', '5500.00', NULL, TRUE, NULL, NULL, NULL)
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
      AND LOWER(BTRIM(mm.material_code)) = LOWER(BTRIM(seed.materialCode))
    LIMIT 1
  ),
  seed.rateType,
  seed.rateValue,
  seed.distanceKm,
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
  seed.minimumCharge
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
        AND LOWER(BTRIM(mm.material_code)) = LOWER(BTRIM(seed.materialCode))
      LIMIT 1
    )
    AND COALESCE(LOWER(BTRIM(existing.rate_type)), '') = COALESCE(LOWER(BTRIM(seed.rateType)), '')
    AND COALESCE(existing.distance_km, -1) = COALESCE(seed.distanceKm, -1)
);


COMMIT;
