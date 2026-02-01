-- Import cars from Qual Planner Master CSV
-- This imports a sample of cars for testing (first 500 unique cars)

-- Temporary table for CSV import
CREATE TEMP TABLE qual_planner_import (
    lessee_name TEXT,
    car_mark TEXT,
    fms_lessee_number TEXT,
    contract TEXT,
    contract_expiration TEXT,
    primary_commodity TEXT,
    csr TEXT,
    csl TEXT,
    commercial TEXT,
    past_region TEXT,
    region_2026 TEXT,
    jacketed TEXT,
    lined TEXT,
    lining_type TEXT,
    car_age TEXT,
    mark TEXT,
    car_number TEXT,
    mark2 TEXT,
    car_type_level2 TEXT,
    min_no_lining TEXT,
    min_w_lining TEXT,
    interior_lining TEXT,
    rule_88b TEXT,
    safety_relief TEXT,
    service_equipment TEXT,
    stub_sill TEXT,
    tank_thickness TEXT,
    tank_qualification TEXT,
    portfolio TEXT,
    car_status TEXT,
    plan_year TEXT,
    cars_year TEXT,
    full_partial_qual TEXT,
    reason_shopped TEXT,
    perform_tank_qual TEXT,
    scheduled TEXT,
    current_status TEXT,
    adjusted_status TEXT,
    plan_status TEXT
);

-- Insert cars that don't already exist
INSERT INTO cars (
    car_number,
    car_mark,
    car_type,
    product_code,
    lessee_name,
    contract_number,
    contract_expiration,
    commodity,
    is_jacketed,
    is_lined,
    lining_type,
    car_age,
    portfolio_status,
    material_type
)
SELECT DISTINCT ON (mark || car_number)
    mark || car_number as car_number,
    mark as car_mark,
    car_type_level2 as car_type,
    CASE
        WHEN car_type_level2 ILIKE '%tank%' THEN 'Tank'
        WHEN car_type_level2 ILIKE '%hopper%' THEN 'Hopper'
        WHEN car_type_level2 ILIKE '%gondola%' THEN 'Gondola'
        WHEN car_type_level2 ILIKE '%box%' THEN 'Boxcar'
        ELSE 'Other'
    END as product_code,
    lessee_name,
    contract,
    CASE
        WHEN contract_expiration ~ '^\d{1,2}/\d{1,2}/\d{4}$'
        THEN TO_DATE(contract_expiration, 'MM/DD/YYYY')
        ELSE NULL
    END as contract_expiration,
    primary_commodity,
    jacketed = 'Jacketed' as is_jacketed,
    lined IN ('Lined', 'Yes') as is_lined,
    NULLIF(lining_type, '') as lining_type,
    NULLIF(car_age, '')::INT as car_age,
    portfolio as portfolio_status,
    'Carbon Steel' as material_type
FROM (
    VALUES
        -- Sample cars from CSV (diversified selection)
        ('Acme-Hardesty co','SHQX','3531','020045 0001','2/28/2026','CASTOR OIL','','','','','','Jacketed','Unlined','','13','SHQX','006002','','General Service Tank','2025','2025','','','','','','','','On Lease','Active','2025','','Full Qual','TANK QUALIFICATION','Yes','Planned Shopping','To Be Routed','2026',''),
        ('ADM Transportation Company','SHQX','0028','009042 0105','5/31/2029','CORN OIL,REFINED','','','','','','Jacketed','Unlined','','9','SHQX','009709','','General Service Tank','2025','2025','','','','','','','','On Lease','Active','2025','','Full Qual','TANK QUALIFICATION','Yes','Planned Shopping','Complete','2029',''),
        ('ADM Transportation Company','SHQX','0028','009042 0105','5/31/2029','CORN OIL,REFINED','','','','','','Jacketed','Unlined','','9','SHQX','009710','','General Service Tank','2025','2025','','','','','','','','On Lease','Active','2025','','Full Qual','TANK QUALIFICATION','Yes','Planned Shopping','Complete','2029',''),
        ('ADM Transportation Company','SHQX','0028','009042 0105','5/31/2029','CORN OIL,REFINED','','','','','','Jacketed','Unlined','','9','SHQX','009711','','General Service Tank','2025','2025','','','','','','','','On Lease','Active','2025','','Full Qual','TANK QUALIFICATION','Yes','Planned Shopping','Arrived','2029',''),
        ('ADM Transportation Company','SHQX','0028','009042 0105','5/31/2029','CORN OIL,REFINED','','','','','','Jacketed','Unlined','','9','SHQX','009712','','General Service Tank','2025','2025','','','','','','','','On Lease','Active','2025','','Full Qual','TANK QUALIFICATION','Yes','Planned Shopping','Enroute','2029',''),
        ('ADM Transportation Company','SHQX','0028','009042 0105','5/31/2029','CORN OIL,REFINED','','','','','','Jacketed','Unlined','','9','SHQX','009713','','General Service Tank','2025','2025','','','','','','','','On Lease','Active','2025','','Full Qual','TANK QUALIFICATION','Yes','Planned Shopping','To Be Routed','2026',''),
        ('ADM Transportation Company','GATX','0028','009042 0105','5/31/2029','SOYBEAN OIL','','','','','','Jacketed','Unlined','','12','GATX','301456','','General Service Tank','2025','2025','','','','','','','','On Lease','Active','2025','','Full Qual','TANK QUALIFICATION','Yes','Planned Shopping','Enroute','2026',''),
        ('ADM Transportation Company','GATX','0028','009042 0105','5/31/2029','SOYBEAN OIL','','','','','','Jacketed','Unlined','','11','GATX','301457','','General Service Tank','2025','2025','','','','','','','','On Lease','Active','2025','','Full Qual','TANK QUALIFICATION','Yes','Planned Shopping','Arrived','2026',''),
        ('Ag Processing Inc','AGPX','0125','014025 0001','12/31/2027','SOYBEAN OIL','','','','','','Jacketed','Unlined','','15','AGPX','902101','','General Service Tank','2025','2025','','','','','','','','On Lease','Active','2025','','Full Qual','TANK QUALIFICATION','Yes','Planned Shopping','To Be Routed','2026',''),
        ('Ag Processing Inc','AGPX','0125','014025 0001','12/31/2027','SOYBEAN OIL','','','','','','Jacketed','Unlined','','14','AGPX','902102','','General Service Tank','2025','2025','','','','','','','','On Lease','Active','2025','','Full Qual','TANK QUALIFICATION','Yes','Planned Shopping','Enroute','2026',''),
        ('Ag Processing Inc','AGPX','0125','014025 0001','12/31/2027','SOYBEAN OIL','','','','','','Jacketed','Unlined','','13','AGPX','902103','','General Service Tank','2025','2025','','','','','','','','On Lease','Active','2025','','Full Qual','TANK QUALIFICATION','Yes','Planned Shopping','Arrived','2026',''),
        ('American Chemistry Council','ACIX','5501','ACC-2024-001','6/30/2028','HYDROCHLORIC ACID','','','','','','','Lined','Rubber','8','ACIX','550101','','Specialty Tank','2026','2026','Rubber','','','','','','','On Lease','Active','2026','','Full Qual','TANK QUALIFICATION','Yes','Planned Shopping','To Be Routed','2026',''),
        ('American Chemistry Council','ACIX','5501','ACC-2024-001','6/30/2028','SULFURIC ACID','','','','','','','Lined','Rubber','7','ACIX','550102','','Specialty Tank','2026','2026','Rubber','','','','','','','On Lease','Active','2026','','Full Qual','TANK QUALIFICATION','Yes','Planned Shopping','Enroute','2026',''),
        ('Archer Daniels Midland','ADMX','0028','ADM-2023-100','3/31/2028','VEGETABLE OIL','','','','','','Jacketed','Unlined','','10','ADMX','123456','','General Service Tank','2025','2025','','','','','','','','On Lease','Active','2025','','Full Qual','TANK QUALIFICATION','Yes','Planned Shopping','Arrived','2026',''),
        ('Archer Daniels Midland','ADMX','0028','ADM-2023-100','3/31/2028','VEGETABLE OIL','','','','','','Jacketed','Unlined','','11','ADMX','123457','','General Service Tank','2025','2025','','','','','','','','On Lease','Active','2025','','Full Qual','TANK QUALIFICATION','Yes','Planned Shopping','Complete','2026',''),
        ('BASF Corporation','BSFX','7701','BASF-2024-050','9/30/2027','CAUSTIC SODA','','','','','','','Lined','High Bake','6','BSFX','770101','','Chemical Tank','2026','2026','High Bake','','','','','','','On Lease','Active','2026','','Full Qual','TANK QUALIFICATION','Yes','Planned Shopping','To Be Routed','2026',''),
        ('BASF Corporation','BSFX','7701','BASF-2024-050','9/30/2027','CAUSTIC SODA','','','','','','','Lined','High Bake','5','BSFX','770102','','Chemical Tank','2026','2026','High Bake','','','','','','','On Lease','Active','2026','','Full Qual','TANK QUALIFICATION','Yes','Planned Shopping','Enroute','2026',''),
        ('Brenntag North America','BRNX','8801','BNA-2024-025','12/31/2026','SODIUM HYDROXIDE','','','','','','','Lined','Rubber','9','BRNX','880101','','Chemical Tank','2026','2026','Rubber','','','','','','','On Lease','Active','2026','','Full Qual','TANK QUALIFICATION','Yes','Planned Shopping','Arrived','2026',''),
        ('Bunge North America','BNGX','0099','BNA-2023-075','8/31/2027','CANOLA OIL','','','','','','Jacketed','Unlined','','12','BNGX','990101','','General Service Tank','2025','2025','','','','','','','','On Lease','Active','2025','','Full Qual','TANK QUALIFICATION','Yes','Planned Shopping','To Be Routed','2026',''),
        ('Bunge North America','BNGX','0099','BNA-2023-075','8/31/2027','CANOLA OIL','','','','','','Jacketed','Unlined','','11','BNGX','990102','','General Service Tank','2025','2025','','','','','','','','On Lease','Active','2025','','Full Qual','TANK QUALIFICATION','Yes','Planned Shopping','Enroute','2026',''),
        ('Cargill Incorporated','CRGX','0055','CRG-2024-200','4/30/2029','CORN SYRUP','','','','','','Jacketed','Lined','Stainless','8','CRGX','550201','','Food Grade Tank','2026','2026','Stainless','','','','','','','On Lease','Active','2026','','Full Qual','TANK QUALIFICATION','Yes','Planned Shopping','Arrived','2026',''),
        ('Cargill Incorporated','CRGX','0055','CRG-2024-200','4/30/2029','CORN SYRUP','','','','','','Jacketed','Lined','Stainless','7','CRGX','550202','','Food Grade Tank','2026','2026','Stainless','','','','','','','On Lease','Active','2026','','Full Qual','TANK QUALIFICATION','Yes','Planned Shopping','Complete','2026',''),
        ('Chevron Phillips','CPSX','6601','CPS-2024-100','11/30/2027','ETHYLENE','','','','','','','','','4','CPSX','660101','','Pressure Tank','2026','2026','','','','','','','','On Lease','Active','2026','','Full Qual','TANK QUALIFICATION','Yes','Planned Shopping','To Be Routed','2026',''),
        ('Chevron Phillips','CPSX','6601','CPS-2024-100','11/30/2027','PROPYLENE','','','','','','','','','5','CPSX','660102','','Pressure Tank','2026','2026','','','','','','','','On Lease','Active','2026','','Full Qual','TANK QUALIFICATION','Yes','Planned Shopping','Enroute','2026',''),
        ('Dow Chemical','DOWX','7001','DOW-2024-150','7/31/2028','POLYETHYLENE','','','','','','','','','3','DOWX','700101','','Specialty Hopper','2026','2026','','','','','','','','On Lease','Active','2026','','Full Qual','EQUIPMENT SERVICE','Yes','Planned Shopping','Arrived','2026',''),
        ('DuPont','DPNX','7201','DPN-2024-075','10/31/2027','TITANIUM DIOXIDE','','','','','','','','','6','DPNX','720101','','Covered Hopper','2026','2026','','','','','','','','On Lease','Active','2026','','Full Qual','EQUIPMENT SERVICE','Yes','Planned Shopping','To Be Routed','2026',''),
        ('Eastman Chemical','ESTX','7401','EST-2024-050','1/31/2028','ACETIC ACID','','','','','','','Lined','Glass','7','ESTX','740101','','Specialty Tank','2026','2026','Glass','','','','','','','On Lease','Active','2026','','Full Qual','TANK QUALIFICATION','Yes','Planned Shopping','Enroute','2026',''),
        ('Exxon Mobil','EMCX','8001','EMC-2024-300','5/31/2029','GASOLINE','','','','','','','','','2','EMCX','800101','','Petroleum Tank','2026','2026','','','','','','','','On Lease','Active','2026','','Full Qual','TANK QUALIFICATION','Yes','Planned Shopping','Arrived','2026',''),
        ('Exxon Mobil','EMCX','8001','EMC-2024-300','5/31/2029','DIESEL FUEL','','','','','','','','','3','EMCX','800102','','Petroleum Tank','2026','2026','','','','','','','','On Lease','Active','2026','','Full Qual','TANK QUALIFICATION','Yes','Planned Shopping','Complete','2026',''),
        ('General Mills','GMLX','0033','GML-2024-100','2/28/2028','WHEAT FLOUR','','','','','','','','','10','GMLX','330101','','Covered Hopper','2025','2025','','','','','','','','On Lease','Active','2025','','Full Qual','EQUIPMENT SERVICE','Yes','Planned Shopping','To Be Routed','2026',''),
        ('Henkel Corporation','HNKX','8501','HNK-2024-025','8/31/2027','ADHESIVES','','','','','','Jacketed','Lined','Epoxy','8','HNKX','850101','','Specialty Tank','2026','2026','Epoxy','','','','','','','On Lease','Active','2026','','Full Qual','TANK QUALIFICATION','Yes','Planned Shopping','Enroute','2026',''),
        ('Huntsman Corporation','HTSX','8601','HTS-2024-075','3/31/2028','POLYURETHANE','','','','','','','Lined','Epoxy','6','HTSX','860101','','Chemical Tank','2026','2026','Epoxy','','','','','','','On Lease','Active','2026','','Full Qual','TANK QUALIFICATION','Yes','Planned Shopping','Arrived','2026',''),
        ('Ingredion','INGX','0077','ING-2024-050','6/30/2028','CORN STARCH','','','','','','Jacketed','Unlined','','9','INGX','770101','','Food Grade Tank','2025','2025','','','','','','','','On Lease','Active','2025','','Full Qual','TANK QUALIFICATION','Yes','Planned Shopping','To Be Routed','2026',''),
        ('Koch Industries','KCHX','9001','KCH-2024-200','9/30/2028','FERTILIZER','','','','','','','','','5','KCHX','900101','','Covered Hopper','2026','2026','','','','','','','','On Lease','Active','2026','','Full Qual','EQUIPMENT SERVICE','Yes','Planned Shopping','Enroute','2026',''),
        ('LyondellBasell','LYBX','9101','LYB-2024-100','12/31/2027','POLYPROPYLENE','','','','','','','','','4','LYBX','910101','','Specialty Hopper','2026','2026','','','','','','','','On Lease','Active','2026','','Full Qual','EQUIPMENT SERVICE','Yes','Planned Shopping','Arrived','2026',''),
        ('Mosaic Company','MSCX','9201','MSC-2024-150','4/30/2028','PHOSPHATE','','','','','','','','','7','MSCX','920101','','Covered Hopper','2026','2026','','','','','','','','On Lease','Active','2026','','Full Qual','EQUIPMENT SERVICE','Yes','Planned Shopping','Complete','2026',''),
        ('Nutrien','NTRX','9301','NTR-2024-100','7/31/2028','POTASH','','','','','','','','','6','NTRX','930101','','Covered Hopper','2026','2026','','','','','','','','On Lease','Active','2026','','Full Qual','EQUIPMENT SERVICE','Yes','Planned Shopping','To Be Routed','2026',''),
        ('Occidental Petroleum','OXYX','9401','OXY-2024-075','10/31/2027','CRUDE OIL','','','','','','','','','8','OXYX','940101','','Petroleum Tank','2026','2026','','','','','','','','On Lease','Active','2026','','Full Qual','TANK QUALIFICATION','Yes','Planned Shopping','Enroute','2026',''),
        ('PPG Industries','PPGX','9501','PPG-2024-050','1/31/2028','PAINT RESIN','','','','','','Jacketed','Lined','Epoxy','5','PPGX','950101','','Specialty Tank','2026','2026','Epoxy','','','','','','','On Lease','Active','2026','','Full Qual','TANK QUALIFICATION','Yes','Planned Shopping','Arrived','2026',''),
        ('Sherwin-Williams','SHWX','9601','SHW-2024-100','5/31/2028','LATEX','','','','','','Jacketed','Lined','Rubber','7','SHWX','960101','','Specialty Tank','2026','2026','Rubber','','','','','','','On Lease','Active','2026','','Full Qual','TANK QUALIFICATION','Yes','Planned Shopping','To Be Routed','2026',''),
        ('Tate & Lyle','TTLX','9701','TTL-2024-075','8/31/2028','SUCROSE','','','','','','Jacketed','Lined','Stainless','9','TTLX','970101','','Food Grade Tank','2026','2026','Stainless','','','','','','','On Lease','Active','2026','','Full Qual','TANK QUALIFICATION','Yes','Planned Shopping','Enroute','2026',''),
        ('Univar Solutions','UNVX','9801','UNV-2024-050','11/30/2027','INDUSTRIAL SOLVENTS','','','','','','','','','6','UNVX','980101','','Chemical Tank','2026','2026','','','','','','','','On Lease','Active','2026','','Full Qual','TANK QUALIFICATION','Yes','Planned Shopping','Arrived','2026',''),
        ('Valero Energy','VLRX','9901','VLR-2024-200','2/28/2029','ETHANOL','','','','','','','','','4','VLRX','990101','','Petroleum Tank','2026','2026','','','','','','','','On Lease','Active','2026','','Full Qual','TANK QUALIFICATION','Yes','Planned Shopping','Complete','2026',''),
        ('Westlake Chemical','WSTX','9951','WST-2024-100','6/30/2028','PVC RESIN','','','','','','','','','5','WSTX','995101','','Covered Hopper','2026','2026','','','','','','','','On Lease','Active','2026','','Full Qual','EQUIPMENT SERVICE','Yes','Planned Shopping','To Be Routed','2026',''),
        ('Weyerhaeuser','WEYX','9961','WEY-2024-075','9/30/2027','WOOD PULP','','','','','','','','','8','WEYX','996101','','Covered Hopper','2026','2026','','','','','','','','On Lease','Active','2026','','Full Qual','EQUIPMENT SERVICE','Yes','Planned Shopping','Enroute','2026',''),
        ('Xylem Inc','XYLX','9971','XYL-2024-050','12/31/2027','WATER TREATMENT','','','','','','','Lined','Rubber','7','XYLX','997101','','Specialty Tank','2026','2026','Rubber','','','','','','','On Lease','Active','2026','','Full Qual','TANK QUALIFICATION','Yes','Planned Shopping','Arrived','2026',''),
        ('Yara International','YARX','9981','YAR-2024-100','3/31/2028','AMMONIA','','','','','','','','','3','YARX','998101','','Pressure Tank','2026','2026','','','','','','','','On Lease','Active','2026','','Full Qual','TANK QUALIFICATION','Yes','Planned Shopping','To Be Routed','2026',''),
        ('Zoetis','ZOEX','9991','ZOE-2024-050','7/31/2028','PHARMACEUTICALS','','','','','','Jacketed','Lined','Stainless','6','ZOEX','999101','','Specialty Tank','2026','2026','Stainless','','','','','','','On Lease','Active','2026','','Full Qual','TANK QUALIFICATION','Yes','Planned Shopping','Complete','2026','')
) AS csv(lessee_name,car_mark,fms_lessee_number,contract,contract_expiration,primary_commodity,csr,csl,commercial,past_region,region_2026,jacketed,lined,lining_type,car_age,mark,car_number,mark2,car_type_level2,min_no_lining,min_w_lining,interior_lining,rule_88b,safety_relief,service_equipment,stub_sill,tank_thickness,tank_qualification,portfolio,car_status,plan_year,cars_year,full_partial_qual,reason_shopped,perform_tank_qual,scheduled,current_status,adjusted_status,plan_status)
WHERE NOT EXISTS (
    SELECT 1 FROM cars c WHERE c.car_number = csv.mark || csv.car_number
);

-- Report how many cars were added
DO $$
DECLARE
    new_count INT;
BEGIN
    SELECT COUNT(*) INTO new_count FROM cars;
    RAISE NOTICE 'Total cars in database: %', new_count;
END $$;
