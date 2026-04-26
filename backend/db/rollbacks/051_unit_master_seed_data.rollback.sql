DELETE FROM public.unit_master
WHERE company_id IS NULL
  AND LOWER(BTRIM(unit_code)) IN (
    'ton',
    'mt',
    'kg',
    'cft',
    'brass',
    'cum',
    'trip',
    'bag',
    'nos'
  );
