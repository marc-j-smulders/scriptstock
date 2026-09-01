import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Automatically parse .env.local file
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

// Extract credentials
const SUPABASE_URL = (envConfig.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = envConfig.SUPABASE_SERVICE_ROLE_KEY || envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const MAPBOX_TOKEN = envConfig.NEXT_PUBLIC_MAPBOX_TOKEN;

if (!SUPABASE_URL || !MAPBOX_TOKEN) {
  console.error('❌ Error: Missing credentials in .env.local.');
  console.log('Checked URL:', SUPABASE_URL);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Small delay helper to respect Mapbox rate limits
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function geocodePharmacies() {
  console.log('1. Fetching all pharmacies from Supabase...');
  
  const { data: pharmacies, error } = await supabase
    .from('pharmacies')
    .select('id, name, address, suburb, postcode')
    .order('id', { ascending: true });

  if (error) {
    console.error('Error fetching pharmacies from database:', error.message);
    return;
  }

  console.log(`✓ Found ${pharmacies.length} pharmacies. Running rooftop geocoding...\n`);

  let updatedCount = 0;

  for (const pharmacy of pharmacies) {
    // Construct clean search query
    const addressQuery = `${pharmacy.address}, ${pharmacy.suburb} QLD ${pharmacy.postcode}, Australia`;
    const encodedQuery = encodeURIComponent(addressQuery);
    const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?access_token=${MAPBOX_TOKEN}&country=AU&types=address,poi&limit=1`;

    try {
      const response = await fetch(geocodeUrl);
      const data = await response.json();

      if (data.features && data.features.length > 0) {
        const [exactLng, exactLat] = data.features[0].center; // Mapbox returns [lng, lat]
        const placeName = data.features[0].place_name;

        // Update exact coordinate in Supabase
        const { error: updateError } = await supabase
          .from('pharmacies')
          .update({
            lat: exactLat,
            lng: exactLng
          })
          .eq('id', pharmacy.id);

        if (updateError) {
          console.error(`❌ Error updating ID ${pharmacy.id} (${pharmacy.name}):`, updateError.message);
        } else {
          updatedCount++;
          console.log(`[${pharmacy.id}] ✓ ${pharmacy.name}`);
          console.log(`     → Matched: "${placeName}"`);
          console.log(`     → Rooftop GPS: [${exactLat}, ${exactLng}]\n`);
        }
      } else {
        console.warn(`⚠️ No rooftop match found for: ${pharmacy.name} (${addressQuery})`);
      }
    } catch (err) {
      console.error(`❌ Network error geocoding ID ${pharmacy.id}:`, err.message);
    }

    // Rate-limit buffer (5 requests per second)
    await sleep(200);
  }

  console.log(`\n🎉 Finished! Successfully calibrated ${updatedCount} / ${pharmacies.length} pharmacy locations.`);
}

geocodePharmacies().catch(console.error);