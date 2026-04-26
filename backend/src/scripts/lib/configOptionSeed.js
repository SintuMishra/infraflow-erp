const CONFIG_TYPES = [
  "plant_type",
  "power_source",
  "material_category",
  "material_unit",
  "vehicle_category",
  "material_hsn_rule",
  "employee_department",
  "procurement_item_category",
];

const OPTION_TYPE_LABELS = {
  plant_type: "Plant Type",
  power_source: "Power Source",
  material_category: "Material Category",
  material_unit: "Material Unit",
  vehicle_category: "Vehicle Category",
  material_hsn_rule: "Material HSN Auto Rule",
  employee_department: "Employee Department",
  procurement_item_category: "Procurement Item Category",
};

const TYPE_METADATA = {
  plant_type: {
    usesStoredText: "optionLabel",
    referenceTargets: [
      { tableName: "plant_master", columnName: "plant_type" },
      { tableName: "crusher_units", columnName: "plant_type" },
    ],
  },
  power_source: {
    usesStoredText: "optionValue",
    referenceTargets: [
      { tableName: "plant_master", columnName: "power_source_type" },
      { tableName: "crusher_units", columnName: "power_source_type" },
    ],
  },
  material_category: {
    usesStoredText: "optionLabel",
    referenceTargets: [{ tableName: "material_master", columnName: "category" }],
  },
  material_unit: {
    usesStoredText: "optionValue",
    referenceTargets: [{ tableName: "material_master", columnName: "unit" }],
  },
  vehicle_category: {
    usesStoredText: "optionLabel",
    referenceTargets: [{ tableName: "vehicle_type_master", columnName: "category" }],
  },
  material_hsn_rule: {
    usesStoredText: "optionValue",
    referenceTargets: [],
  },
  employee_department: {
    usesStoredText: "optionLabel",
    referenceTargets: [{ tableName: "employees", columnName: "department" }],
  },
  procurement_item_category: {
    usesStoredText: "optionValue",
    referenceTargets: [
      { tableName: "purchase_request_lines", columnName: "item_category" },
      { tableName: "purchase_order_lines", columnName: "item_category" },
      { tableName: "goods_receipt_lines", columnName: "item_category" },
      { tableName: "purchase_invoice_lines", columnName: "item_category" },
    ],
  },
};

const EMPLOYEE_ROLE_BY_DEPARTMENT = {
  Admin: "admin",
  Accounts: "manager",
  Finance: "manager",
  HR: "hr",
  "Human Resources": "hr",
  Sales: "manager",
  Marketing: "manager",
  Purchase: "manager",
  Procurement: "manager",
  Dispatch: "crusher_supervisor",
  Transport: "crusher_supervisor",
  Logistics: "crusher_supervisor",
  Production: "crusher_supervisor",
  "Plant Operations": "crusher_supervisor",
  "Crusher Operations": "crusher_supervisor",
  Weighbridge: "operator",
  Maintenance: "crusher_supervisor",
  Mechanical: "operator",
  Electrical: "operator",
  "Quality Control": "site_engineer",
  Laboratory: "site_engineer",
  Store: "crusher_supervisor",
  Inventory: "crusher_supervisor",
  Security: "operator",
  IT: "admin",
  Management: "manager",
  "Site Staff": "site_engineer",
  Labour: "operator",
  Driver: "operator",
  Operator: "operator",
  Supervisor: "crusher_supervisor",
  Housekeeping: "operator",
  Legal: "admin",
  Compliance: "admin",
  Safety: "site_engineer",
  Administration: "admin",
  Commercial: "manager",
  Contracts: "manager",
  Billing: "manager",
  Audit: "manager",
  Projects: "site_engineer",
  "Project Management": "site_engineer",
  Planning: "site_engineer",
  Engineering: "site_engineer",
  Execution: "site_engineer",
  Mining: "crusher_supervisor",
  "Stores & Inventory": "crusher_supervisor",
  "Fleet & Transport": "crusher_supervisor",
  "Logistics & Dispatch": "crusher_supervisor",
  "Machinery & Maintenance": "crusher_supervisor",
  Machinery: "crusher_supervisor",
  Vehicles: "crusher_supervisor",
  "IT & Systems": "admin",
  "Legal & Compliance": "admin",
  "Business Development": "manager",
  "Customer Support": "manager",
  General: "operator",
};

const CATALOG = {
  plant_type: [
    {
      key: "crusher_plant",
      label: "Crusher Plant",
      value: "Crusher Plant",
      description: "Primary crushing and size-reduction unit.",
      aliases: ["crushing plant", "crusher", "crusher unit"],
    },
    {
      key: "screening_plant",
      label: "Screening Plant",
      value: "Screening Plant",
      description: "Screens and grades mined or crushed material.",
    },
    {
      key: "washing_plant",
      label: "Washing Plant",
      value: "Washing Plant",
      description: "Washes sand, aggregates, or minerals.",
    },
    {
      key: "batching_plant",
      label: "Batching Plant",
      value: "Batching Plant",
      description: "Concrete or mortar batching operation.",
    },
    {
      key: "ready_mix_concrete_plant",
      label: "Ready Mix Concrete Plant",
      value: "Ready Mix Concrete Plant",
      description: "Ready mix concrete production site.",
      aliases: [
        "rmc plant",
        "ready mix concrete plant",
        "ready-mix concrete plant",
        "rmc",
        "ready-mix concrete (rmc)",
      ],
    },
    {
      key: "hot_mix_plant",
      label: "Hot Mix Plant",
      value: "Hot Mix Plant",
      description: "Hot mix or bituminous mix production unit.",
    },
    {
      key: "asphalt_plant",
      label: "Asphalt Plant",
      value: "Asphalt Plant",
      description: "Asphalt production or processing plant.",
    },
    {
      key: "concrete_plant",
      label: "Concrete Plant",
      value: "Concrete Plant",
      description: "General concrete manufacturing facility.",
    },
    {
      key: "cement_plant",
      label: "Cement Plant",
      value: "Cement Plant",
      description: "Cement manufacturing or grinding unit.",
    },
    {
      key: "mining_plant",
      label: "Mining Plant",
      value: "Mining Plant",
      description: "Mining or excavation-focused production facility.",
    },
    {
      key: "quarry_plant",
      label: "Quarry Plant",
      value: "Quarry Plant",
      description: "Stone quarry or extraction site.",
    },
    {
      key: "sand_plant",
      label: "Sand Plant",
      value: "Sand Plant",
      description: "Sand processing or stock management site.",
    },
    {
      key: "stone_plant",
      label: "Stone Plant",
      value: "Stone Plant",
      description: "Stone processing or dispatch plant.",
    },
    {
      key: "aggregate_plant",
      label: "Aggregate Plant",
      value: "Aggregate Plant",
      description: "Aggregate production, screening, or handling unit.",
    },
    {
      key: "processing_plant",
      label: "Processing Plant",
      value: "Processing Plant",
      description: "Generic processing unit for minerals or materials.",
    },
    {
      key: "manufacturing_plant",
      label: "Manufacturing Plant",
      value: "Manufacturing Plant",
      description: "General manufacturing facility.",
    },
    {
      key: "production_plant",
      label: "Production Plant",
      value: "Production Plant",
      description: "General production-oriented unit.",
    },
    {
      key: "storage_yard",
      label: "Storage Yard",
      value: "Storage Yard",
      description: "Open storage or holding yard.",
    },
    {
      key: "loading_yard",
      label: "Loading Yard",
      value: "Loading Yard",
      description: "Vehicle loading and outward movement point.",
    },
    {
      key: "stock_yard",
      label: "Stock Yard",
      value: "Stock Yard",
      description: "Stockpiling yard for materials and finished goods.",
    },
    {
      key: "weighbridge_site",
      label: "Weighbridge Site",
      value: "Weighbridge Site",
      description: "Weighbridge-only or weighment-focused location.",
    },
    {
      key: "workshop",
      label: "Workshop",
      value: "Workshop",
      description: "Fabrication, repair, or maintenance workshop.",
    },
    {
      key: "maintenance_plant",
      label: "Maintenance Plant",
      value: "Maintenance Plant",
      description: "Centralized maintenance and repair location.",
    },
    {
      key: "fuel_station",
      label: "Fuel Station",
      value: "Fuel Station",
      description: "Internal fueling point or pump area.",
    },
    {
      key: "warehouse",
      label: "Warehouse",
      value: "Warehouse",
      description: "Covered warehouse or inventory storage point.",
    },
    {
      key: "packing_plant",
      label: "Packing Plant",
      value: "Packing Plant",
      description: "Packing, bagging, or palletizing location.",
    },
  ],
  power_source: [
    {
      key: "grid_electricity",
      label: "Grid Electricity",
      value: "electricity",
      description: "Mains or utility-supplied electricity.",
      aliases: ["electric", "grid power", "egrid"],
    },
    {
      key: "diesel_generator",
      label: "Diesel Generator",
      value: "diesel",
      description: "Diesel-generated electrical power.",
      aliases: ["dg set", "diesel genset", "generator diesel", "diesel power"],
    },
    {
      key: "petrol_generator",
      label: "Petrol Generator",
      value: "petrol",
      description: "Petrol-driven generator power.",
    },
    {
      key: "gas_generator",
      label: "Gas Generator",
      value: "gas",
      description: "Gas-based generator or engine power.",
    },
    {
      key: "solar_power",
      label: "Solar Power",
      value: "solar",
      description: "Solar-generated power source.",
    },
    {
      key: "wind_power",
      label: "Wind Power",
      value: "wind",
      description: "Wind-generated power source.",
    },
    {
      key: "hybrid_power",
      label: "Hybrid Power",
      value: "hybrid",
      description: "Hybrid power using multiple energy sources.",
      aliases: ["hybrid grid dg", "grid dg hybrid"],
    },
    {
      key: "battery_backup",
      label: "Battery Backup",
      value: "battery",
      description: "Battery-based backup or UPS source.",
    },
    {
      key: "inverter_backup",
      label: "Inverter Backup",
      value: "inverter",
      description: "Inverter-based backup supply.",
    },
    {
      key: "manual",
      label: "Manual",
      value: "manual",
      description: "Manual or non-powered operation.",
    },
    {
      key: "no_power_required",
      label: "No Power Required",
      value: "no_power",
      description: "Operational point with no power dependency.",
      aliases: ["none", "not required"],
    },
    {
      key: "third_party_power",
      label: "Third Party Power",
      value: "third_party_power",
      description: "Power supplied by an external operator or landlord.",
    },
    {
      key: "captive_power_plant",
      label: "Captive Power Plant",
      value: "captive_power",
      description: "Internal captive power generation source.",
    },
  ],
  material_category: [
    { key: "aggregate", label: "Aggregate", value: "Aggregate", aliases: ["aggregates"] },
    { key: "coarse_aggregate", label: "Coarse Aggregate", value: "Coarse Aggregate" },
    { key: "fine_aggregate", label: "Fine Aggregate", value: "Fine Aggregate", aliases: ["fine aggregates"] },
    { key: "sand", label: "Sand", value: "Sand" },
    { key: "m_sand", label: "M-Sand", value: "M-Sand", aliases: ["manufactured sand", "msand", "crush sand"] },
    { key: "river_sand", label: "River Sand", value: "River Sand" },
    { key: "stone", label: "Stone", value: "Stone" },
    { key: "boulder", label: "Boulder", value: "Boulder", aliases: ["boulders"] },
    { key: "grit", label: "Grit", value: "Grit" },
    { key: "dust", label: "Dust", value: "Dust" },
    { key: "stone_dust", label: "Stone Dust", value: "Stone Dust" },
    { key: "crusher_dust", label: "Crusher Dust", value: "Crusher Dust" },
    { key: "cement", label: "Cement", value: "Cement" },
    { key: "concrete", label: "Concrete", value: "Concrete" },
    { key: "rmc", label: "RMC", value: "RMC", aliases: ["ready mix concrete"] },
    { key: "asphalt", label: "Asphalt", value: "Asphalt" },
    { key: "bitumen", label: "Bitumen", value: "Bitumen" },
    { key: "fly_ash", label: "Fly Ash", value: "Fly Ash" },
    { key: "soil", label: "Soil", value: "Soil" },
    { key: "murum", label: "Murum", value: "Murum" },
    { key: "metal", label: "Metal", value: "Metal" },
    { key: "steel", label: "Steel", value: "Steel" },
    { key: "scrap", label: "Scrap", value: "Scrap" },
    { key: "fuel", label: "Fuel", value: "Fuel" },
    { key: "diesel", label: "Diesel", value: "Diesel" },
    { key: "petrol", label: "Petrol", value: "Petrol" },
    { key: "lubricant", label: "Lubricant", value: "Lubricant", aliases: ["lubricants"] },
    { key: "oil", label: "Oil", value: "Oil" },
    { key: "grease", label: "Grease", value: "Grease" },
    { key: "spare_parts", label: "Spare Parts", value: "Spare Parts", aliases: ["spare part"] },
    { key: "consumables", label: "Consumables", value: "Consumables", aliases: ["consumable"] },
    { key: "packing_material", label: "Packing Material", value: "Packing Material", aliases: ["packaging material"] },
    { key: "raw_material", label: "Raw Material", value: "Raw Material", aliases: ["raw materials"] },
    { key: "semi_finished_goods", label: "Semi Finished Goods", value: "Semi Finished Goods", aliases: ["semi-finished goods"] },
    { key: "finished_goods", label: "Finished Goods", value: "Finished Goods", aliases: ["finished good"] },
    { key: "waste_material", label: "Waste Material", value: "Waste Material", aliases: ["waste materials"] },
    { key: "rejected_material", label: "Rejected Material", value: "Rejected Material", aliases: ["rejected materials"] },
    { key: "hazardous_material", label: "Hazardous Material", value: "Hazardous Material", aliases: ["hazardous materials"] },
    { key: "chemical", label: "Chemical", value: "Chemical", aliases: ["chemicals"] },
    { key: "water", label: "Water", value: "Water" },
    { key: "admixture", label: "Admixture", value: "Admixture", aliases: ["admixtures"] },
  ],
  material_unit: [
    { key: "metric_ton", label: "Metric Ton (MT)", value: "MT", aliases: ["ton", "metric ton", "metric tonne", "mt", "tonne"] },
    { key: "kilogram", label: "Kilogram (KG)", value: "KG", aliases: ["kg", "kilogram", "kilograms", "kilo"] },
    { key: "gram", label: "Gram (G)", value: "G", aliases: ["gram", "grams", "gm", "gms"] },
    { key: "quintal", label: "Quintal (QTL)", value: "QTL", aliases: ["quintal", "quintals", "qtl", "qtl."] },
    { key: "brass", label: "Brass (BRASS)", value: "BRASS", aliases: ["brass"] },
    { key: "cubic_meter", label: "Cubic Meter (CUM)", value: "CUM", aliases: ["cum", "cubic meter", "cubic metre", "cbm", "m3"] },
    { key: "cubic_feet", label: "Cubic Feet (CFT)", value: "CFT", aliases: ["cft", "cubic feet", "cubic foot", "ft3", "cuft"] },
    { key: "square_feet", label: "Square Feet (SQFT)", value: "SQFT", aliases: ["sqft", "square feet", "square foot"] },
    { key: "square_meter", label: "Square Meter (SQM)", value: "SQM", aliases: ["sqm", "square meter", "square metre", "m2"] },
    { key: "liter", label: "Liter (LTR)", value: "LTR", aliases: ["liter", "litre", "liters", "litres", "ltr"] },
    { key: "kiloliter", label: "Kiloliter (KL)", value: "KL", aliases: ["kiloliter", "kilolitre", "kl"] },
    { key: "milliliter", label: "Milliliter (ML)", value: "ML", aliases: ["milliliter", "millilitre", "ml"] },
    { key: "bag", label: "Bag", value: "BAG", aliases: ["bags", "bgs"] },
    { key: "nos", label: "Nos", value: "NOS", aliases: ["nos", "number", "numbers"] },
    { key: "piece", label: "Piece", value: "PIECE", aliases: ["pieces", "pc", "pcs"] },
    { key: "packet", label: "Packet", value: "PACKET", aliases: ["packets", "pkt"] },
    { key: "box", label: "Box", value: "BOX", aliases: ["boxes"] },
    { key: "bundle", label: "Bundle", value: "BUNDLE", aliases: ["bundles"] },
    { key: "roll", label: "Roll", value: "ROLL", aliases: ["rolls"] },
    { key: "drum", label: "Drum", value: "DRUM", aliases: ["drums"] },
    { key: "barrel", label: "Barrel", value: "BARREL", aliases: ["barrels"] },
    { key: "trip", label: "Trip", value: "TRIP", aliases: ["trips"] },
    { key: "load", label: "Load", value: "LOAD", aliases: ["loads"] },
    { key: "truck_load", label: "Truck Load", value: "TRUCK_LOAD", aliases: ["truckload", "truck load", "lorry load"] },
    { key: "hour", label: "Hour", value: "HOUR", aliases: ["hours", "hr", "hrs"] },
    { key: "day", label: "Day", value: "DAY", aliases: ["days"] },
    { key: "month", label: "Month", value: "MONTH", aliases: ["months", "mon"] },
    { key: "shift", label: "Shift", value: "SHIFT", aliases: ["shifts"] },
  ],
  vehicle_category: [
    { key: "truck", label: "Truck", value: "Truck", aliases: ["trucks"] },
    { key: "dumper", label: "Dumper", value: "Dumper", aliases: ["dumpers"] },
    { key: "tipper", label: "Tipper", value: "Tipper", aliases: ["tipper hyva", "tipper/hyva", "tippers"] },
    { key: "trailer", label: "Trailer", value: "Trailer", aliases: ["trailers"] },
    { key: "tractor", label: "Tractor", value: "Tractor", aliases: ["tractors"] },
    { key: "transit_mixer", label: "Transit Mixer", value: "Transit Mixer", aliases: ["transit mixers", "rmc mixer"] },
    { key: "tanker", label: "Tanker", value: "Tanker", aliases: ["tankers"] },
    { key: "water_tanker", label: "Water Tanker", value: "Water Tanker", aliases: ["water truck"] },
    { key: "fuel_tanker", label: "Fuel Tanker", value: "Fuel Tanker", aliases: ["diesel tanker"] },
    { key: "container", label: "Container", value: "Container", aliases: ["containers"] },
    { key: "pickup", label: "Pickup", value: "Pickup", aliases: ["pick up", "pickup vehicle"] },
    { key: "tempo", label: "Tempo", value: "Tempo", aliases: ["tempos"] },
    { key: "mini_truck", label: "Mini Truck", value: "Mini Truck", aliases: ["mini trucks"] },
    { key: "jcb", label: "JCB", value: "JCB", aliases: ["backhoe loader"] },
    { key: "excavator", label: "Excavator", value: "Excavator", aliases: ["excavators"] },
    { key: "loader", label: "Loader", value: "Loader", aliases: ["loaders"] },
    { key: "crane", label: "Crane", value: "Crane", aliases: ["hydra", "pick and carry crane"] },
    { key: "forklift", label: "Forklift", value: "Forklift", aliases: ["fork lift"] },
    { key: "roller", label: "Road Roller", value: "Road Roller", aliases: ["roller", "road roller compactor", "compactor"] },
    { key: "grader", label: "Grader", value: "Grader", aliases: ["motor grader"] },
    { key: "dozer", label: "Dozer", value: "Dozer", aliases: ["bulldozer", "bull dozer"] },
    { key: "company_vehicle", label: "Company Vehicle", value: "Company Vehicle" },
    { key: "third_party_vehicle", label: "Third Party Vehicle", value: "Third Party Vehicle" },
    { key: "customer_vehicle", label: "Customer Vehicle", value: "Customer Vehicle" },
    { key: "supplier_vehicle", label: "Supplier Vehicle", value: "Supplier Vehicle" },
    { key: "employee_vehicle", label: "Employee Vehicle", value: "Employee Vehicle" },
  ],
  material_hsn_rule: [
    { key: "aggregate", label: "aggregate", value: "2517", description: "Aggregate and road metal", priority: 10, gstRate: 5 },
    { key: "sand", label: "sand", value: "2505", description: "Construction sand", priority: 20, gstRate: 5 },
    { key: "stone", label: "stone", value: "2516", description: "Natural or quarried stone", priority: 30, gstRate: 5 },
    { key: "dust", label: "dust", value: "2517", description: "Crusher dust and stone dust", priority: 40, gstRate: 5 },
    { key: "cement", label: "cement", value: "2523", description: "Cement and clinker", priority: 50, gstRate: 28 },
    { key: "concrete", label: "concrete", value: "3824", description: "Concrete mixtures", priority: 60, gstRate: 18 },
    { key: "rmc", label: "rmc", value: "3824", description: "Ready mix concrete", priority: 70, gstRate: 18, aliases: ["ready mix concrete"] },
    { key: "asphalt", label: "asphalt", value: "2715", description: "Bituminous mixture / asphalt mix", priority: 80, gstRate: 18 },
    { key: "bitumen", label: "bitumen", value: "2713", description: "Petroleum bitumen", priority: 90, gstRate: 18 },
    { key: "scrap", label: "scrap", value: "7204", description: "Generic ferrous scrap template", priority: 100, gstRate: 18 },
    { key: "fuel", label: "fuel", value: "2710", description: "Fuel oils and mineral fuels", priority: 110, gstRate: 18 },
    { key: "diesel", label: "diesel", value: "2710", description: "Diesel fuel template", priority: 120, gstRate: 18 },
    { key: "petrol", label: "petrol", value: "2710", description: "Petrol fuel template", priority: 130, gstRate: 18 },
    { key: "lubricant", label: "lubricant", value: "2710", description: "Lubricants and oils", priority: 140, gstRate: 18, aliases: ["lubricants", "oil", "grease"] },
    { key: "spare_parts", label: "spare part", value: "8431", description: "Common machinery spare parts template", priority: 150, gstRate: 18, aliases: ["spare parts"] },
    { key: "consumables", label: "consumable", value: "3824", description: "Generic industrial consumables template", priority: 160, gstRate: 18, aliases: ["consumables"] },
    { key: "packing_material", label: "packing material", value: "3923", description: "Packing and plastic articles", priority: 170, gstRate: 18, aliases: ["packaging material"] },
    { key: "chemical", label: "chemical", value: "3824", description: "Generic construction chemical template", priority: 180, gstRate: 18, aliases: ["chemicals"] },
    { key: "water", label: "water", value: "2201", description: "Water template", priority: 190, gstRate: 18 },
    { key: "admixture", label: "admixture", value: "3824", description: "Concrete admixture template", priority: 200, gstRate: 18, aliases: ["admixtures"] },
  ],
  employee_department: [
    "Admin",
    "Accounts",
    "Finance",
    "HR",
    "Sales",
    "Marketing",
    "Purchase",
    "Procurement",
    "Dispatch",
    "Transport",
    "Logistics",
    "Production",
    "Plant Operations",
    "Crusher Operations",
    "Weighbridge",
    "Maintenance",
    "Mechanical",
    "Electrical",
    "Quality Control",
    "Laboratory",
    "Store",
    "Inventory",
    "Security",
    "IT",
    "Management",
    "Site Staff",
    "Labour",
    "Driver",
    "Operator",
    "Supervisor",
    "Housekeeping",
    "Legal",
    "Compliance",
    "Safety",
    "Administration",
    "Commercial",
    "Contracts",
    "Billing",
    "Audit",
    "Projects",
    "Project Management",
    "Planning",
    "Execution",
    "Engineering",
    "Mining",
    "Stores & Inventory",
    "Fleet & Transport",
    "Logistics & Dispatch",
    "Machinery & Maintenance",
    "Machinery",
    "Vehicles",
    "IT & Systems",
    "Legal & Compliance",
    "Business Development",
    "Customer Support",
    "General",
  ].map((label) => ({
    key: normalizeLooseText(label),
    label,
    value: EMPLOYEE_ROLE_BY_DEPARTMENT[label] || "operator",
    description: `Department with default role ${EMPLOYEE_ROLE_BY_DEPARTMENT[label] || "operator"}`,
  })),
  procurement_item_category: [
    { key: "material", label: "Material", value: "material", description: "Inventory and raw material purchases." },
    { key: "equipment", label: "Equipment", value: "equipment", description: "Machines, tools, and equipment." },
    { key: "spare_part", label: "Spare Part", value: "spare_part", description: "Spare and replacement parts." },
    { key: "consumable", label: "Consumable", value: "consumable", description: "Consumables and low-value operational items." },
    { key: "service", label: "Service", value: "service", description: "Service or subcontract procurement." },
  ],
};

function normalizeLooseText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[()]/g, " ")
    .replace(/[_/.-]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function singularizeWord(word) {
  const value = String(word || "");
  if (value.endsWith("ies") && value.length > 3) {
    return `${value.slice(0, -3)}y`;
  }
  if (value.endsWith("sses") || value.endsWith("ss")) {
    return value;
  }
  if (value.endsWith("s") && value.length > 3) {
    return value.slice(0, -1);
  }
  return value;
}

function normalizeComparableText(value) {
  const loose = normalizeLooseText(value);
  return loose
    .split(" ")
    .map((part) => singularizeWord(part))
    .join(" ")
    .trim();
}

function buildComparableSet(value) {
  const set = new Set();
  const loose = normalizeLooseText(value);
  const comparable = normalizeComparableText(value);

  if (loose) {
    set.add(loose);
  }
  if (comparable) {
    set.add(comparable);
  }

  return set;
}

function getEntryAliases(entry) {
  const values = [entry.label, entry.value, ...(entry.aliases || [])];
  const set = new Set();

  values.forEach((value) => {
    buildComparableSet(value).forEach((item) => set.add(item));
  });

  return set;
}

function getStoredText(type, row) {
  const source = TYPE_METADATA[type]?.usesStoredText || "optionLabel";
  return source === "optionValue" ? row.optionValue || row.optionLabel : row.optionLabel || row.optionValue;
}

function buildExistingComparableValues(type, row) {
  const values = new Set();
  [row.optionLabel, row.optionValue, getStoredText(type, row)].forEach((value) => {
    buildComparableSet(value).forEach((item) => values.add(item));
  });
  return values;
}

function findMatchingCatalogEntry(type, row) {
  const entries = CATALOG[type] || [];
  const rowValues = buildExistingComparableValues(type, row);

  for (const entry of entries) {
    const aliases = getEntryAliases(entry);
    for (const value of rowValues) {
      if (aliases.has(value)) {
        return entry;
      }
    }
  }

  return null;
}

function buildFallbackKey(type, row) {
  const storedText = normalizeComparableText(getStoredText(type, row));
  const label = normalizeComparableText(row.optionLabel);
  const value = normalizeComparableText(row.optionValue);
  return `${type}:${storedText || label || value || `row_${row.id}`}`;
}

function buildOptionKey(type, row) {
  const matched = findMatchingCatalogEntry(type, row);
  return matched?.key || buildFallbackKey(type, row);
}

function rankCanonicalCandidate({ type, row, references, matchedEntry }) {
  const normalizedLabel = normalizeComparableText(row.optionLabel);
  const normalizedValue = normalizeComparableText(row.optionValue);
  const normalizedStoredText = normalizeComparableText(getStoredText(type, row));
  const normalizedEntryLabel = matchedEntry
    ? normalizeComparableText(matchedEntry.label)
    : "";
  const normalizedEntryValue = matchedEntry
    ? normalizeComparableText(matchedEntry.value)
    : "";

  return [
    matchedEntry ? 1 : 0,
    matchedEntry && normalizedValue === normalizedEntryValue ? 1 : 0,
    matchedEntry && normalizedLabel === normalizedEntryLabel ? 1 : 0,
    matchedEntry &&
    (normalizedStoredText === normalizedEntryLabel ||
      normalizedStoredText === normalizedEntryValue)
      ? 1
      : 0,
    row.isActive ? 1 : 0,
    references > 0 ? 1 : 0,
    Number(references || 0),
    -Number(row.sortOrder || 0),
    -Number(row.id || 0),
  ];
}

function compareRank(left, right) {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const delta = Number(right[index] || 0) - Number(left[index] || 0);
    if (delta !== 0) {
      return delta;
    }
  }
  return 0;
}

function chooseCanonicalRow(type, rows, referenceCountsByRowId) {
  return [...rows].sort((left, right) => {
    const leftEntry = findMatchingCatalogEntry(type, left);
    const rightEntry = findMatchingCatalogEntry(type, right);
    const leftRank = rankCanonicalCandidate({
      type,
      row: left,
      references: Number(referenceCountsByRowId.get(left.id) || 0),
      matchedEntry: leftEntry,
    });
    const rightRank = rankCanonicalCandidate({
      type,
      row: right,
      references: Number(referenceCountsByRowId.get(right.id) || 0),
      matchedEntry: rightEntry,
    });

    return compareRank(leftRank, rightRank);
  })[0];
}

function getScopeKey(companyId) {
  return companyId === null || companyId === undefined ? "global" : `company:${companyId}`;
}

function getScopeLabel(companyId) {
  return companyId === null || companyId === undefined ? "global" : `company ${companyId}`;
}

function groupRowsByScopeAndType(rows) {
  const grouped = new Map();

  rows.forEach((row) => {
    const scopeKey = getScopeKey(row.companyId ?? null);
    const groupKey = `${scopeKey}||${row.configType}`;
    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, []);
    }
    grouped.get(groupKey).push(row);
  });

  return grouped;
}

function hasSeedMatch(type, scopeRows, entry) {
  const seedAliases = getEntryAliases(entry);

  return scopeRows.some((row) => {
    const rowValues = buildExistingComparableValues(type, row);
    for (const value of rowValues) {
      if (seedAliases.has(value)) {
        return true;
      }
    }
    return false;
  });
}

function buildInsertActions({ existingRows, scopes }) {
  const actions = [];
  const skipped = [];
  const grouped = groupRowsByScopeAndType(existingRows);

  scopes.forEach((scope) => {
    CONFIG_TYPES.forEach((type) => {
      const groupKey = `${getScopeKey(scope.companyId)}||${type}`;
      const scopeRows = grouped.get(groupKey) || [];
      const entries = CATALOG[type] || [];
      let offset = 0;
      const maxSortOrder = scopeRows.reduce(
        (max, row) => Math.max(max, Number(row.sortOrder || 0)),
        0
      );

      entries.forEach((entry) => {
        if (hasSeedMatch(type, scopeRows, entry)) {
          skipped.push({
            companyId: scope.companyId,
            configType: type,
            optionLabel: entry.label,
            optionValue: entry.value,
            reason: "duplicate_or_similar_existing_option",
          });
          return;
        }

        offset += 1;
        actions.push({
          action: "insert",
          companyId: scope.companyId,
          configType: type,
          optionLabel: entry.label,
          optionValue: entry.value,
          sortOrder: maxSortOrder + offset,
          description: entry.description || null,
          priority: entry.priority || null,
          gstRate: entry.gstRate || null,
        });
      });
    });
  });

  return { actions, skipped };
}

function buildDuplicatePlan({ existingRows, referenceCountsByRowId, referenceBreakdownByRowId }) {
  const duplicateGroups = [];
  const cleanupActions = [];
  const grouped = groupRowsByScopeAndType(existingRows);

  grouped.forEach((scopeRows, key) => {
    const [, type] = key.split("||");
    const rowsByOptionKey = new Map();

    scopeRows.forEach((row) => {
      const optionKey = buildOptionKey(type, row);
      if (!rowsByOptionKey.has(optionKey)) {
        rowsByOptionKey.set(optionKey, []);
      }
      rowsByOptionKey.get(optionKey).push(row);
    });

    rowsByOptionKey.forEach((rows, optionKey) => {
      if (rows.length <= 1) {
        return;
      }

      const canonical = chooseCanonicalRow(type, rows, referenceCountsByRowId);
      const canonicalStoredText = getStoredText(type, canonical);

      duplicateGroups.push({
        companyId: canonical.companyId ?? null,
        configType: type,
        optionKey,
        canonicalId: canonical.id,
        members: rows.map((row) => ({
          id: row.id,
          optionLabel: row.optionLabel,
          optionValue: row.optionValue,
          isActive: Boolean(row.isActive),
          sortOrder: Number(row.sortOrder || 0),
          references: Number(referenceCountsByRowId.get(row.id) || 0),
        })),
      });

      rows
        .filter((row) => row.id !== canonical.id)
        .forEach((row) => {
          const references = Number(referenceCountsByRowId.get(row.id) || 0);
          const updates = references > 0 ? referenceBreakdownByRowId.get(row.id) || [] : [];

          if (references === 0) {
            cleanupActions.push({
              action: "delete",
              companyId: row.companyId ?? null,
              configType: type,
              id: row.id,
              canonicalId: canonical.id,
              optionLabel: row.optionLabel,
              optionValue: row.optionValue,
              reason: "unused_duplicate",
            });
            return;
          }

          if (updates.length > 0 && canonicalStoredText) {
            cleanupActions.push({
              action: "merge_references_and_delete",
              companyId: row.companyId ?? null,
              configType: type,
              id: row.id,
              canonicalId: canonical.id,
              optionLabel: row.optionLabel,
              optionValue: row.optionValue,
              canonicalStoredText,
              referenceUpdates: updates,
              reason: "duplicate_with_safe_text_reference_updates",
            });
            return;
          }

          cleanupActions.push({
            action: "deactivate",
            companyId: row.companyId ?? null,
            configType: type,
            id: row.id,
            canonicalId: canonical.id,
            optionLabel: row.optionLabel,
            optionValue: row.optionValue,
            reason: "referenced_duplicate_kept_inactive_for_safety",
          });
        });
    });
  });

  return {
    duplicateGroups,
    cleanupActions,
  };
}

function buildDetectedTypes({ codeTypes = [], existingTypes = [] }) {
  return Array.from(new Set([...CONFIG_TYPES, ...codeTypes, ...existingTypes])).sort();
}

module.exports = {
  CATALOG,
  CONFIG_TYPES,
  OPTION_TYPE_LABELS,
  TYPE_METADATA,
  buildDetectedTypes,
  buildDuplicatePlan,
  buildInsertActions,
  buildOptionKey,
  buildComparableSet,
  findMatchingCatalogEntry,
  getScopeKey,
  getScopeLabel,
  getStoredText,
  normalizeComparableText,
  normalizeLooseText,
};
