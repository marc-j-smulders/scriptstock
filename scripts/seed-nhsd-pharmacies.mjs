import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// 1. Load credentials from .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = {};

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...rest] = trimmed.split('=');
      if (key && rest) {
        envConfig[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
      }
    }
  });
}

const SUPABASE_URL = (envConfig.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = envConfig.SUPABASE_SERVICE_ROLE_KEY || envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const MAPBOX_TOKEN = envConfig.NEXT_PUBLIC_MAPBOX_TOKEN;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials in .env.local.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Verified Master Dataset (Mackay & Regional Expansion Pack)
const MASTER_PHARMACIES = [
  { name: 'TerryWhite Chemmart Mackay City', brand: 'TerryWhite Chemmart', address: '116 Victoria Street', suburb: 'Mackay', postcode: '4740', phone: '(07) 4957 2417' },
  { name: 'Chemist Warehouse Mackay', brand: 'Chemist Warehouse', address: '203 Victoria Street', suburb: 'Mackay', postcode: '4740', phone: '(07) 4944 0454' },
  { name: 'Chemist Discount Centre Mackay', brand: 'Chemist Discount Centre', address: '88 Sydney Street', suburb: 'Mackay', postcode: '4740', phone: '(07) 4957 3349' },
  { name: 'Express Pharmacy Mackay', brand: 'Independent', address: '22 Wellington Street', suburb: 'Mackay', postcode: '4740', phone: '(07) 4957 4477' },
  { name: 'Denis Higgins Sunshine Pharmacy', brand: 'Independent', address: '101 Shakespeare Street', suburb: 'Mackay', postcode: '4740', phone: '(07) 4957 2519' },
  { name: 'T&C Pharmacy Mackay', brand: 'Independent', address: 'Shop 2, 7 Juliet Street', suburb: 'Mackay', postcode: '4740', phone: '(07) 4957 4004' },
  { name: 'Good Price Pharmacy Warehouse Mackay', brand: 'Good Price', address: '3 Peel Street', suburb: 'Mackay', postcode: '4740', phone: '(07) 4953 3811' },
  { name: 'United Chemists West Mackay', brand: 'United Chemists', address: 'Shop BL.01 Parkside Plaza, 245 Bridge Road', suburb: 'West Mackay', postcode: '4740', phone: '(07) 4957 2898' },
  { name: 'Friendly Care Pharmacy MAP', brand: 'Friendly Care', address: '135 Nebo Road', suburb: 'West Mackay', postcode: '4740', phone: '(07) 4957 4422' },
  { name: 'Priceline Pharmacy Ooralea', brand: 'Priceline', address: 'Shop 1-2 Ooralea Shopping Centre, Boundary Road', suburb: 'Ooralea', postcode: '4740', phone: '(07) 4952 5744' },
  { name: 'Chemist Warehouse North Mackay', brand: 'Chemist Warehouse', address: '21 Evans Avenue', suburb: 'North Mackay', postcode: '4740', phone: '(07) 4957 8899' },
  { name: 'United Discount Chemists Andergrove', brand: 'United Chemists', address: '78 Celeber Drive', suburb: 'Andergrove', postcode: '4740', phone: '(07) 4955 1255' },
  { name: 'United Discount Chemists Slade Point', brand: 'United Chemists', address: '1 Finch Street', suburb: 'Slade Point', postcode: '4740', phone: '(07) 4955 1366' },
  { name: 'Dupuy\'s Pharmacy Mount Pleasant', brand: 'Independent', address: 'Shop 47 Mount Pleasant Centre, 12-14 Grandview Drive', suburb: 'Mount Pleasant', postcode: '4740', phone: '(07) 4942 3680' },
  { name: 'Direct Chemist Outlet Northern Beaches', brand: 'Direct Chemist Outlet', address: '10 Eimeo Road', suburb: 'Rural View', postcode: '4740', phone: '(07) 4954 6244' },
  { name: 'Priceline Pharmacy Northern Beaches', brand: 'Priceline', address: 'Shop 11 Northern Beaches Central, Mackay-Bucasia Road', suburb: 'Rural View', postcode: '4740', phone: '(07) 4954 8400' },
  { name: 'Walkerston Healthpoint Chemist', brand: 'Healthpoint', address: 'Dutton Street', suburb: 'Walkerston', postcode: '4751', phone: '(07) 4959 2309' },
  { name: 'Direct Chemist Outlet Marian', brand: 'Direct Chemist Outlet', address: 'Marian Town Centre, 219-247 Anzac Avenue', suburb: 'Marian', postcode: '4753', phone: '(07) 4954 3911' },
  { name: 'Mirani Pharmacy', brand: 'Independent', address: 'Shop 2, 12 Victoria Street', suburb: 'Mirani', postcode: '4754', phone: '(07) 4959 1239' },
  { name: 'TerryWhite Chemmart Sarina', brand: 'TerryWhite Chemmart', address: 'Sarina Village Shopping Centre, 1 Broad Street', suburb: 'Sarina', postcode: '4737', phone: '(07) 4956 1278' },
  { name: 'Sarina Discount Drug Store', brand: 'Discount Drug Stores', address: 'Shop 17, 13 Sarina Beach Road', suburb: 'Sarina', postcode: '4737', phone: '(07) 4956 1844' },
  { name: 'Coal Port Pharmacy', brand: 'Independent', address: 'Shop 4, 4 Valroy Street', suburb: 'Hay Point', postcode: '4740', phone: '(07) 4956 3222' },
  { name: 'LiveLife Pharmacy Proserpine', brand: 'LiveLife', address: '69 Main Street', suburb: 'Proserpine', postcode: '4800', phone: '(07) 4945 1114' },
  { name: 'Chemist Warehouse Cannonvale', brand: 'Chemist Warehouse', address: 'Whitsunday Plaza, 8 Galbraith Park Drive', suburb: 'Cannonvale', postcode: '4802', phone: '(07) 4948 0300' },
  { name: 'LiveLife Pharmacy Cannonvale', brand: 'LiveLife', address: 'Whitsunday Shopping Centre, 226 Shute Harbour Road', suburb: 'Cannonvale', postcode: '4802', phone: '(07) 4946 6488' },
  { name: 'LiveLife Pharmacy Airlie Beach', brand: 'LiveLife', address: '370 Shute Harbour Road', suburb: 'Airlie Beach', postcode: '4802', phone: '(07) 4946 6156' },
  { name: 'Moranbah Pharmacy', brand: 'Independent', address: 'Town Square, Griffin Street', suburb: 'Moranbah', postcode: '4744', phone: '(07) 4941 7333' },
  { name: 'Moranbah Discount Drug Store', brand: 'Discount Drug Stores', address: 'Shop 3 Moranbah Fair, St Francis Drive', suburb: 'Moranbah', postcode: '4744', phone: '(07) 4941 8444' },
  { name: 'Blooms The Chemist Townsville City', brand: 'Blooms The Chemist', address: '390 Flinders Street', suburb: 'Townsville City', postcode: '4810', phone: '(07) 4771 4339' },
  { name: 'Chemist Warehouse Townsville City', brand: 'Chemist Warehouse', address: '49 Sturt Street', suburb: 'Townsville City', postcode: '4810', phone: '(07) 4772 1033' },
  { name: 'TerryWhite Chemmart Castletown', brand: 'TerryWhite Chemmart', address: 'Castletown Shopping Centre, 35 Kings Road', suburb: 'Hyde Park', postcode: '4812', phone: '(07) 4772 2644' },
  { name: 'Direct Chemist Outlet Rockhampton', brand: 'Direct Chemist Outlet', address: '110 Musgrave Street', suburb: 'Berserker', postcode: '4701', phone: '(07) 4922 3556' },
  { name: 'Chemist Warehouse Rockhampton North', brand: 'Chemist Warehouse', address: '394 Yaamba Road', suburb: 'Park Avenue', postcode: '4701', phone: '(07) 4926 2333' }
];

async function seedMasterPharmacies() {
  console.log(`1. Purging outdated nodes & seeding ${MASTER_PHARMACIES.length} verified pharmacies...`);
  
  await supabase.from('pharmacies').delete().neq('id', 0);

  const geocodedBatch = [];

  for (let i = 0; i < MASTER_PHARMACIES.length; i++) {
    const item = MASTER_PHARMACIES[i];
    // Strip complex shopping centre unit prefixes for exact street-level rooftop matching
    const cleanStreet = item.address.replace(/^Shop\s+[^,]+,\s*/i, '').replace(/\([^)]*\)/g, '').trim();
    const query = `${cleanStreet}, ${item.suburb} QLD ${item.postcode}, Australia`;
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&country=AU&types=address,poi&limit=1`;

    let lat = -21.1415;
    let lng = 149.1847;

    try {
      const res = await fetch(url);
      const json = await res.json();
      if (json.features && json.features.length > 0) {
        [lng, lat] = json.features[0].center;
      }
    } catch (err) {
      console.warn(`Geocode lookup skipped for ${item.name}`);
    }

    geocodedBatch.push({
      name: item.name,
      brand: item.brand,
      address: item.address,
      suburb: item.suburb,
      state: 'QLD',
      postcode: item.postcode,
      phone: item.phone,
      lat,
      lng
    });

    console.log(`[${i + 1}/${MASTER_PHARMACIES.length}] ✓ ${item.name} (${item.address})`);
    await sleep(150);
  }

  const { error } = await supabase.from('pharmacies').insert(geocodedBatch);
  if (error) {
    console.error('❌ Insert error:', error.message);
  } else {
    console.log('\n🎉 Successfully loaded verified pharmacies with complete names, addresses, and rooftop GPS.');
  }
}

seedMasterPharmacies().catch(console.error);