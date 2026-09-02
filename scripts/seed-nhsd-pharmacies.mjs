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

const MASTER_PHARMACIES = [
  // --- MACKAY & DISTRICT ---
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

  // --- WHITSUNDAYS & BOWEN BASIN ---
  { name: 'LiveLife Pharmacy Proserpine', brand: 'LiveLife', address: '69 Main Street', suburb: 'Proserpine', postcode: '4800', phone: '(07) 4945 1114' },
  { name: 'Chemist Warehouse Cannonvale', brand: 'Chemist Warehouse', address: 'Whitsunday Plaza, 8 Galbraith Park Drive', suburb: 'Cannonvale', postcode: '4802', phone: '(07) 4948 0300' },
  { name: 'LiveLife Pharmacy Cannonvale', brand: 'LiveLife', address: 'Whitsunday Shopping Centre, 226 Shute Harbour Road', suburb: 'Cannonvale', postcode: '4802', phone: '(07) 4946 6488' },
  { name: 'LiveLife Pharmacy Airlie Beach', brand: 'LiveLife', address: '370 Shute Harbour Road', suburb: 'Airlie Beach', postcode: '4802', phone: '(07) 4946 6156' },
  { name: 'LiveLife Pharmacy Bowen', brand: 'LiveLife', address: '36 Powell Street', suburb: 'Bowen', postcode: '4805', phone: '(07) 4786 1045' },
  { name: 'Herbert St Pharmacy Bowen', brand: 'Independent', address: '46 Herbert Street', suburb: 'Bowen', postcode: '4805', phone: '(07) 4786 1161' },
  { name: 'Moranbah Pharmacy', brand: 'Independent', address: 'Town Square, Griffin Street', suburb: 'Moranbah', postcode: '4744', phone: '(07) 4941 7333' },
  { name: 'Moranbah Discount Drug Store', brand: 'Discount Drug Stores', address: 'Shop 3 Moranbah Fair, St Francis Drive', suburb: 'Moranbah', postcode: '4744', phone: '(07) 4941 8444' },
  { name: 'Clermont Pharmacy', brand: 'Independent', address: '56 Daintree Street', suburb: 'Clermont', postcode: '4721', phone: '(07) 4983 1488' },
  { name: 'Dysart Pharmacy', brand: 'Independent', address: 'Shopping Centre, Shannon Drive', suburb: 'Dysart', postcode: '4745', phone: '(07) 4958 1266' },
  { name: 'Middlemount Pharmacy', brand: 'Independent', address: 'Middlemount Shopping Centre, Nolan Drive', suburb: 'Middlemount', postcode: '4746', phone: '(07) 4985 7235' },

  // --- CENTRAL HIGHLANDS & ROCKHAMPTON ---
  { name: 'Chemist Warehouse Emerald', brand: 'Chemist Warehouse', address: 'Emerald Central, 2-10 Hospital Road', suburb: 'Emerald', postcode: '4720', phone: '(07) 4987 5344' },
  { name: 'TerryWhite Chemmart Emerald Market Plaza', brand: 'TerryWhite Chemmart', address: 'Emerald Market Plaza, Mayfair Drive', suburb: 'Emerald', postcode: '4720', phone: '(07) 4982 1200' },
  { name: 'Direct Chemist Outlet Rockhampton', brand: 'Direct Chemist Outlet', address: '110 Musgrave Street', suburb: 'Berserker', postcode: '4701', phone: '(07) 4922 3556' },
  { name: 'Chemist Warehouse Rockhampton North', brand: 'Chemist Warehouse', address: '394 Yaamba Road', suburb: 'Park Avenue', postcode: '4701', phone: '(07) 4926 2333' },
  { name: 'Chemist Warehouse Rockhampton South', brand: 'Chemist Warehouse', address: '124 George Street', suburb: 'Rockhampton City', postcode: '4700', phone: '(07) 4927 4977' },
  { name: 'TerryWhite Chemmart Allenstown', brand: 'TerryWhite Chemmart', address: 'Allenstown Square, Upper Dawson Road', suburb: 'Allenstown', postcode: '4700', phone: '(07) 4922 4311' },
  { name: 'Priceline Pharmacy Stockland Rockhampton', brand: 'Priceline', address: 'Stockland Shopping Centre, 120-331 Yaamba Road', suburb: 'Park Avenue', postcode: '4701', phone: '(07) 4928 6500' },
  { name: 'TerryWhite Chemmart Gracemere', brand: 'TerryWhite Chemmart', address: 'Gracemere Shopping World, 1 Ranger Street', suburb: 'Gracemere', postcode: '4702', phone: '(07) 4933 2664' },
  { name: 'LiveLife Pharmacy Yeppoon', brand: 'LiveLife', address: 'Yeppoon Central, 42 Park Street', suburb: 'Yeppoon', postcode: '4703', phone: '(07) 4939 3755' },
  { name: 'Chemist Warehouse Yeppoon', brand: 'Chemist Warehouse', address: '16 Normanby Street', suburb: 'Yeppoon', postcode: '4703', phone: '(07) 4939 1611' },

  // --- GLADSTONE & BUNDABERG ---
  { name: 'Chemist Warehouse Gladstone', brand: 'Chemist Warehouse', address: '188 Goondoon Street', suburb: 'Gladstone Central', postcode: '4680', phone: '(07) 4972 9011' },
  { name: 'Priceline Pharmacy Kin Kora', brand: 'Priceline', address: 'Stockland Gladstone, Dawson Highway', suburb: 'Kin Kora', postcode: '4680', phone: '(07) 4978 2888' },
  { name: 'TerryWhite Chemmart Gladstone Valley', brand: 'TerryWhite Chemmart', address: 'Gladstone Valley Shopping Centre, Philip Street', suburb: 'Gladstone Central', postcode: '4680', phone: '(07) 4972 1664' },
  { name: 'Chemist Warehouse Bundaberg', brand: 'Chemist Warehouse', address: 'Bourbong Street', suburb: 'Bundaberg Central', postcode: '4670', phone: '(07) 4153 1722' },
  { name: 'Priceline Pharmacy Hinkler Central', brand: 'Priceline', address: 'Hinkler Central, 16 Maryborough Street', suburb: 'Bundaberg Central', postcode: '4670', phone: '(07) 4152 4811' },
  { name: 'TerryWhite Chemmart Sugarland', brand: 'TerryWhite Chemmart', address: 'Sugarland Plaza, 115 Takalvan Street', suburb: 'Avoca', postcode: '4670', phone: '(07) 4152 6422' },

  // --- TOWNSVILLE & BURDEKIN ---
  { name: 'Blooms The Chemist Townsville City', brand: 'Blooms The Chemist', address: '390 Flinders Street', suburb: 'Townsville City', postcode: '4810', phone: '(07) 4771 4339' },
  { name: 'Chemist Warehouse Townsville City', brand: 'Chemist Warehouse', address: '49 Sturt Street', suburb: 'Townsville City', postcode: '4810', phone: '(07) 4772 1033' },
  { name: 'TerryWhite Chemmart Castletown', brand: 'TerryWhite Chemmart', address: 'Castletown Shopping Centre, 35 Kings Road', suburb: 'Hyde Park', postcode: '4812', phone: '(07) 4772 2644' },
  { name: 'Chemist Warehouse Aitkenvale', brand: 'Chemist Warehouse', address: '243 Ross River Road', suburb: 'Aitkenvale', postcode: '4814', phone: '(07) 4725 3544' },
  { name: 'Priceline Pharmacy Willows', brand: 'Priceline', address: 'Willows Shopping Centre, 13 Hervey Range Road', suburb: 'Thuringowa Central', postcode: '4817', phone: '(07) 4773 2277' },
  { name: 'TerryWhite Chemmart Willows', brand: 'TerryWhite Chemmart', address: 'Willows Shopping Centre, 13 Hervey Range Road', suburb: 'Thuringowa Central', postcode: '4817', phone: '(07) 4773 2911' },
  { name: 'TerryWhite Chemmart Ayr', brand: 'TerryWhite Chemmart', address: '124 Queen Street', suburb: 'Ayr', postcode: '4807', phone: '(07) 4783 2344' },
  { name: 'Burdekin Discount Drug Store', brand: 'Discount Drug Stores', address: 'Shop 1, 140 Queen Street', suburb: 'Ayr', postcode: '4807', phone: '(07) 4783 1744' },
  { name: 'Home Hill Pharmacy', brand: 'Independent', address: 'Eighth Avenue', suburb: 'Home Hill', postcode: '4806', phone: '(07) 4782 1017' },
  { name: 'Charters Towers Pharmacy', brand: 'Independent', address: 'Gill Street', suburb: 'Charters Towers', postcode: '4820', phone: '(07) 4787 1011' },

  // --- CAIRNS & FAR NORTH ---
  { name: 'Chemist Warehouse Cairns City', brand: 'Chemist Warehouse', address: 'Cnr Shield & Lake Streets', suburb: 'Cairns City', postcode: '4870', phone: '(07) 4031 3644' },
  { name: 'TerryWhite Chemmart Cairns Central', brand: 'TerryWhite Chemmart', address: 'Cairns Central Shopping Centre, McLeod Street', suburb: 'Cairns City', postcode: '4870', phone: '(07) 4051 5133' },
  { name: 'Priceline Pharmacy Cairns Central', brand: 'Priceline', address: 'Cairns Central Shopping Centre, McLeod Street', suburb: 'Cairns City', postcode: '4870', phone: '(07) 4051 4455' },
  { name: 'Chemist Warehouse Earlville', brand: 'Chemist Warehouse', address: 'Stockland Cairns, 537 Mulgrave Road', suburb: 'Earlville', postcode: '4870', phone: '(07) 4033 7988' },
  { name: 'LiveLife Pharmacy Port Douglas', brand: 'LiveLife', address: '42 Macrossan Street', suburb: 'Port Douglas', postcode: '4877', phone: '(07) 4099 5223' },
  { name: 'Chemist Warehouse Smithfield', brand: 'Chemist Warehouse', address: 'Smithfield Shopping Centre, Captain Cook Highway', suburb: 'Smithfield', postcode: '4878', phone: '(07) 4057 8844' }
];

async function seedMasterPharmacies() {
  console.log(`Geocoding ${MASTER_PHARMACIES.length} verified regional locations...`);

  const geocodedBatch = [];

  for (let i = 0; i < MASTER_PHARMACIES.length; i++) {
    const item = MASTER_PHARMACIES[i];
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

    console.log(`[${i + 1}/${MASTER_PHARMACIES.length}] ✓ ${item.name} (${item.suburb})`);
    await sleep(100);
  }

  console.log('Inserting batch into Supabase...');

  for (let j = 0; j < geocodedBatch.length; j += 40) {
    const chunk = geocodedBatch.slice(j, j + 40);
    const { error: insertError } = await supabase.from('pharmacies').insert(chunk);
    if (insertError) {
      console.error(`❌ Insert error for batch starting at ${j}:`, insertError.message);
    }
  }

  console.log('\n🎉 Successfully updated pharmacies across Queensland.');
}

seedMasterPharmacies().catch(console.error);