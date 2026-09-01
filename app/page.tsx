'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/lib/supabase';
import { 
  Search, 
  MapPin, 
  Phone, 
  Clock, 
  PlusCircle, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  HelpCircle,
  X,
  Pill
} from 'lucide-react';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

interface Medication {
  id: string;
  brand_name: string;
  generic_name: string;
  strength: string;
  form: string;
}

interface PharmacyStock {
  pharmacy_id: number;
  pharmacy_name: string;
  pharmacy_address: string;
  suburb?: string;
  postcode?: string;
  phone?: string;
  lat: number;
  lng: number;
  latest_status?: string;
  pack_size?: string;
  notes?: string;
  reported_at?: string;
  hours_ago?: number | null;
  distance_km?: number | null;
}

export default function ScriptStockApp() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  const [medications, setMedications] = useState<Medication[]>([]);
  const [selectedMedId, setSelectedMedId] = useState<string>('');
  const [pharmacies, setPharmacies] = useState<PharmacyStock[]>([]);
  const [selectedPharmacy, setSelectedPharmacy] = useState<PharmacyStock | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Loading medications...');
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportStatus, setReportStatus] = useState<'in_stock' | 'low_stock' | 'out_of_stock'>('in_stock');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // 1. Fetch Medications from Supabase
  useEffect(() => {
    async function loadMeds() {
      const { data, error } = await supabase
        .from('medications')
        .select('*')
        .order('brand_name', { ascending: true });

      if (error) {
        console.error('Supabase error loading meds:', error);
        setStatusMessage(`DB Error: ${error.message}`);
        return;
      }

      if (data && data.length > 0) {
        setMedications(data);
        setSelectedMedId(data[0].id);
        setStatusMessage(`${data.length} medications loaded`);
      } else {
        setStatusMessage('No medications found in database');
      }
    }

    loadMeds();
  }, []);

  // 2. Fetch Nearby Pharmacies
  const fetchNearbyStock = useCallback(async () => {
    if (!selectedMedId) return;

    const { data, error } = await supabase.rpc('get_nearby_pharmacy_stock', {
      p_medication_id: selectedMedId,
      p_lat: -21.1415,
      p_lng: 149.1868,
      p_radius_meters: 50000
    });

    if (error) {
      console.error('Error fetching stock:', error);
    } else if (data) {
      setPharmacies(data);
    }
  }, [selectedMedId]);

  useEffect(() => {
    if (selectedMedId) {
      fetchNearbyStock();
    }
  }, [selectedMedId, fetchNearbyStock]);

  // 3. Initialize Mapbox Map
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [149.1868, -21.1415],
      zoom: 12
    });
map.current.on('click', (e) => {
  console.log(`LAT: ${e.lngLat.lat.toFixed(5)}, LNG: ${e.lngLat.lng.toFixed(5)}`);
  alert(`Clicked Coordinates:\nLat: ${e.lngLat.lat.toFixed(5)}\nLng: ${e.lngLat.lng.toFixed(5)}`);
});

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.current.on('load', () => {
      map.current?.resize();
    });
  }, []);

// 4. Update Map Markers & Direct Click Popup
  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers and popups
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }

    pharmacies.forEach((pharmacy) => {
      // Determine marker color and badge
      let markerColor = '#94a3b8';
      let statusBadge = '<span style="color: #64748b; font-weight: 700;">Unknown</span>';

      if (pharmacy.latest_status === 'in_stock') {
        markerColor = '#10b981';
        statusBadge = '<span style="color: #059669; font-weight: 700;">● In Stock</span>';
      } else if (pharmacy.latest_status === 'low_stock') {
        markerColor = '#f59e0b';
        statusBadge = '<span style="color: #d97706; font-weight: 700;">▲ Low Stock</span>';
      } else if (pharmacy.latest_status === 'out_of_stock') {
        markerColor = '#ef4444';
        statusBadge = '<span style="color: #dc2626; font-weight: 700;">✕ Out of Stock</span>';
      }

      // Marker container element
      const el = document.createElement('div');
      el.className = 'custom-marker';
      el.style.width = '32px';
      el.style.height = '32px';
      el.style.borderRadius = '50%';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.cursor = 'pointer';
      el.style.backgroundColor = markerColor;
      el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.35)';
      el.style.border = '2px solid #ffffff';

      // SVG pill capsule icon
      el.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events: none;">
          <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" fill="rgba(255, 255, 255, 0.2)" />
          <path d="m8.5 8.5 7 7" />
        </svg>
      `;

      // Popup HTML content referencing exact type properties
      const popupHtml = `
        <div style="font-family: inherit; padding: 6px 4px; min-width: 160px; color: #0f172a;">
          <div style="font-size: 13px; font-weight: 700; margin-bottom: 2px;">
            ${pharmacy.pharmacy_name}
          </div>
          <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">
            ${pharmacy.pharmacy_address}
          </div>
          <div style="font-size: 11px;">
            ${statusBadge}
          </div>
        </div>
      `;

      // Click handler
      el.onclick = (e) => {
        e.stopPropagation();
        setSelectedPharmacy(pharmacy);

        if (popupRef.current) popupRef.current.remove();

        popupRef.current = new mapboxgl.Popup({ offset: 20, closeButton: true })
          .setLngLat([pharmacy.lng, pharmacy.lat])
          .setHTML(popupHtml)
          .addTo(map.current!);

       map.current?.flyTo({ center: [pharmacy.lng, pharmacy.lat], zoom: 14, speed: 1.2 });
      };

      const marker = new mapboxgl.Marker({ element: el })
  .setLngLat([Number(pharmacy.lng), Number(pharmacy.lat)]) // Must be [lng, lat]
  .addTo(map.current!);

      markersRef.current.push(marker);
    });
  }, [pharmacies]);

  // 5. Submit Stock Report
  const handleReportSubmit = async () => {
    if (!selectedPharmacy || !selectedMedId) return;
    setReportSubmitting(true);

    const { error } = await supabase.from('stock_reports').insert({
      pharmacy_id: selectedPharmacy.pharmacy_id,
      medication_id: selectedMedId,
      status: reportStatus
    });

    setReportSubmitting(false);

    if (error) {
      alert('Error: ' + error.message);
    } else {
      setIsReportModalOpen(false);
      setFeedbackMessage('Thanks! Stock status updated.');
      setTimeout(() => setFeedbackMessage(null), 4000);
      fetchNearbyStock();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden', fontFamily: 'sans-serif' }}>
      {/* 🟢 TOP HEADER BAR */}
      <header style={{ 
        backgroundColor: '#ffffff', 
        borderBottom: '2px solid #e2e8f0', 
        padding: '12px 20px', 
        display: 'flex', 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        gap: '16px',
        zIndex: 100,
        boxShadow: '0 2px 4px rgba(0,0,0,0.06)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ backgroundColor: '#059669', color: '#ffffff', padding: '8px 10px', borderRadius: '8px', fontWeight: 'bold' }}>
            <Pill style={{ width: '20px', height: '20px' }} />
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>ScriptStock</div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>Live Community Stock Tracker</div>
          </div>
        </div>

        {/* Medication Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '320px', maxWidth: '480px', width: '100%' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155', whiteSpace: 'nowrap' }}>
            Medication:
          </label>
          <select
            value={selectedMedId}
            onChange={(e) => setSelectedMedId(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              backgroundColor: '#f8fafc',
              border: '2px solid #059669',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              color: '#0f172a',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            {medications.length === 0 ? (
              <option value="">{statusMessage}</option>
            ) : (
              medications.map((med) => (
                <option key={med.id} value={med.id}>
                  {med.brand_name} {med.strength} ({med.form})
                </option>
              ))
            )}
          </select>
        </div>
      </header>

      {/* 🟢 MAIN SPLIT VIEW (MAP + SIDEBAR) */}
      <div style={{ display: 'flex', flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Mapbox Container */}
        <div ref={mapContainer} style={{ flex: 1, width: '100%', height: '100%' }} />

        {/* Feedback Alert Toast */}
        {feedbackMessage && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-700 text-white text-xs font-bold px-5 py-3 rounded-full shadow-2xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {feedbackMessage}
          </div>
        )}

        {/* Sidebar */}
        <aside className="w-full md:w-96 max-h-[45vh] md:max-h-full bg-white border-t md:border-t-0 md:border-l border-slate-200 flex flex-col shadow-xl z-20">
          <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Pharmacies ({pharmacies.length})
            </span>
            <span className="text-xs text-slate-400">Mackay Region</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-2">
            {pharmacies.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                No pharmacy stock reported yet.
              </div>
            ) : (
             pharmacies.map((pharmacy) => {
  const isSelected = selectedPharmacy?.pharmacy_id === pharmacy.pharmacy_id;

  return (
    <div
      key={pharmacy.pharmacy_id}
      onClick={() => {
        setSelectedPharmacy(pharmacy);
        map.current?.flyTo({ center: [Number(pharmacy.lng), Number(pharmacy.lat)], zoom: 14 });
      }}
      className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
        isSelected
          ? 'border-emerald-500 bg-emerald-50/50 shadow-sm'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
                  
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h2 className="font-bold text-slate-900 text-sm">{pharmacy.pharmacy_name}</h2>
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {pharmacy.pharmacy_address}
                        </p>
                      </div>
                      <span className="text-xs font-bold text-slate-500 whitespace-nowrap">
                        {pharmacy.distance_km} km
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100">
                      <div>
                        {pharmacy.latest_status === 'in_stock' && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-md">
                            <CheckCircle2 className="w-3.5 h-3.5" /> In Stock
                          </span>
                        )}
                        {pharmacy.latest_status === 'low_stock' && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-100/80 px-2.5 py-1 rounded-md">
                            <AlertTriangle className="w-3.5 h-3.5" /> Low Stock
                          </span>
                        )}
                        {pharmacy.latest_status === 'out_of_stock' && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-100/80 px-2.5 py-1 rounded-md">
                            <XCircle className="w-3.5 h-3.5" /> Out of Stock
                          </span>
                        )}
                        {!pharmacy.latest_status && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
                            <HelpCircle className="w-3.5 h-3.5" /> Unconfirmed
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                        <Clock className="w-3 h-3" />
                        {pharmacy.hours_ago !== null ? `${pharmacy.hours_ago}h ago` : 'No reports'}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Report Button */}
          {selectedPharmacy && (
            <div className="p-3 bg-white border-t border-slate-200 flex gap-2">
              <button
                onClick={() => setIsReportModalOpen(true)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md"
              >
                <PlusCircle className="w-4 h-4" /> Report Stock
              </button>
              {selectedPharmacy.phone && (
                <a
                  href={`tel:${selectedPharmacy.phone}`}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2.5 rounded-xl flex items-center justify-center transition-all"
                  title="Call Pharmacy"
                >
                  <Phone className="w-4 h-4" />
                </a>
              )}
            </div>
          )}
        </aside>
      </div>

      {/* Report Modal */}
      {isReportModalOpen && selectedPharmacy && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-sm w-full rounded-2xl p-5 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Report Stock Status</h3>
              <button onClick={() => setIsReportModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-3">
              <p className="text-xs text-slate-500">Pharmacy</p>
              <p className="text-sm font-semibold text-slate-800">{selectedPharmacy.pharmacy_name}</p>
            </div>

            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => setReportStatus('in_stock')}
                className={`w-full p-3 rounded-xl border-2 text-left flex items-center justify-between transition-all ${
                  reportStatus === 'in_stock'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold'
                    : 'border-slate-200 bg-slate-50 text-slate-700'
                }`}
              >
                <span className="flex items-center gap-2 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> In Stock / Got Script Filled
                </span>
              </button>

              <button
                type="button"
                onClick={() => setReportStatus('low_stock')}
                className={`w-full p-3 rounded-xl border-2 text-left flex items-center justify-between transition-all ${
                  reportStatus === 'low_stock'
                    ? 'border-amber-500 bg-amber-50 text-amber-900 font-bold'
                    : 'border-slate-200 bg-slate-50 text-slate-700'
                }`}
              >
                <span className="flex items-center gap-2 text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600" /> Low Stock / Limited Supply
                </span>
              </button>

              <button
                type="button"
                onClick={() => setReportStatus('out_of_stock')}
                className={`w-full p-3 rounded-xl border-2 text-left flex items-center justify-between transition-all ${
                  reportStatus === 'out_of_stock'
                    ? 'border-rose-500 bg-rose-50 text-rose-900 font-bold'
                    : 'border-slate-200 bg-slate-50 text-slate-700'
                }`}
              >
                <span className="flex items-center gap-2 text-xs">
                  <XCircle className="w-4 h-4 text-rose-600" /> Out of Stock / Backordered
                </span>
              </button>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setIsReportModalOpen(false)}
                className="w-1/2 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={reportSubmitting}
                onClick={handleReportSubmit}
                className="w-1/2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50 shadow-sm"
              >
                {reportSubmitting ? 'Saving...' : 'Submit Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}