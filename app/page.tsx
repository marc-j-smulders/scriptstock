'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/lib/supabase';
import StockReportModal from '@/components/StockReportModal';

interface Medication {
  id: string;
  brand_name: string;
  generic_name: string;
  strength: string;
  dosage_form: string;
}

interface PharmacyStockItem {
  pharmacy_id: number;
  pharmacy_name: string;
  pharmacy_address: string;
  suburb: string;
  postcode?: string;
  phone?: string;
  lat: number;
  lng: number;
  latest_status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'unknown';
  pack_size?: string | null;
  notes?: string | null;
  report_id?: number | null;
  upvotes?: number;
  downvotes?: number;
  hours_ago?: number | null;
  distance_km?: number | null;
}

type DrawerState = 'peek' | 'half' | 'full';

// Helper to route users to official dispensary order portals based on pharmacy brand
function getPharmacyPortalUrl(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.includes('chemist warehouse')) {
    return 'https://www.chemistwarehouse.com.au/prescriptions';
  }
  if (lower.includes('terrywhite') || lower.includes('terry white')) {
    return 'https://www.terrywhitechemmart.com.au/services/scripts';
  }
  if (lower.includes('priceline')) {
    return 'https://www.priceline.com.au/pharmacy-services';
  }
  if (lower.includes('amcal')) {
    return 'https://www.amcal.com.au/scripts';
  }
  if (lower.includes('blooms')) {
    return 'https://www.blooms.net.au/prescriptions';
  }
  return null;
}

// Helper to evaluate stock report freshness and decay
function getStockFreshness(hoursAgo: number | null | undefined): {
  label: string;
  isStale: boolean;
} {
  if (hoursAgo === null || hoursAgo === undefined) {
    return { label: 'No recent reports', isStale: true };
  }

  if (hoursAgo === 0) {
    return { label: 'Just now', isStale: false };
  }

  if (hoursAgo < 24) {
    return { label: `${hoursAgo}h ago`, isStale: false };
  }

  const daysAgo = Math.floor(hoursAgo / 24);
  return { label: `${daysAgo}d ago`, isStale: true };
}


export default function Home() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const activePopupRef = useRef<mapboxgl.Popup | null>(null);

  const [medications, setMedications] = useState<Medication[]>([]);
  const [selectedMedicationId, setSelectedMedicationId] = useState<string>('vyvanse-30mg');
  const [pharmacies, setPharmacies] = useState<PharmacyStockItem[]>([]);
  const [selectedPharmacy, setSelectedPharmacy] = useState<PharmacyStockItem | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [votedReportIds, setVotedReportIds] = useState<Record<number, 'up' | 'down'>>({});

  const [tokenInput, setTokenInput] = useState('');
  const [copiedToken, setCopiedToken] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const handleCopyToken = () => {
    if (!tokenInput.trim()) return;
    navigator.clipboard.writeText(tokenInput.trim());
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2500);
  };
  
  // Mobile drawer state
  const [drawerState, setDrawerState] = useState<DrawerState>('half');

  // Default coordinate center (Mackay region)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number }>({
    lat: -21.1415,
    lng: 149.1847,
  });

  // 1. Fetch available medications on load
  useEffect(() => {
    async function fetchMeds() {
      const { data, error } = await supabase
        .from('medications')
        .select('*')
        .order('brand_name');

      if (!error && data && data.length > 0) {
        setMedications(data);
        if (!data.some((m) => m.id === 'vyvanse-30mg')) {
          setSelectedMedicationId(data[0].id);
        }
      }
    }
    fetchMeds();
  }, []);

  // 2. Fetch stock data using PostGIS RPC
  const fetchStock = useCallback(async (currentLat: number, currentLng: number) => {
    if (!selectedMedicationId) return;

    try {
      const { data, error } = await supabase.rpc('get_nearby_pharmacy_stock', {
        p_medication_id: selectedMedicationId,
        p_lat: Number(currentLat),
        p_lng: Number(currentLng),
        p_radius_meters: 500000,
      });

      if (!error && data) {
        setPharmacies(data);
        setSelectedPharmacy((prev) => {
          if (!prev) return null;
          return data.find((p: PharmacyStockItem) => p.pharmacy_id === prev.pharmacy_id) || prev;
        });
      } else if (error) {
        console.error('Supabase RPC Error:', error);
      }
    } catch (err) {
      console.error('Error fetching stock:', err);
    }
  }, [selectedMedicationId]);

  useEffect(() => {
    fetchStock(userLocation.lat, userLocation.lng);
  }, [selectedMedicationId, userLocation, fetchStock]);

  // Handle voting with toggle support
  const handleVote = async (reportId: number, targetType: 'up' | 'down') => {
    const currentVote = votedReportIds[reportId] || '';
    const nextVoteType = currentVote === targetType ? 'clear' : targetType;

    try {
      const { data, error } = await supabase.rpc('vote_stock_report', {
        p_report_id: Number(reportId),
        p_vote_type: nextVoteType,
        p_previous_vote: currentVote,
      });

      if (error) {
        console.error('Vote RPC error:', error);
        return;
      }

      if (data?.success) {
        setVotedReportIds((prev) => {
          const updated = { ...prev };
          if (nextVoteType === 'clear') {
            delete updated[reportId];
          } else {
            updated[reportId] = nextVoteType;
          }
          return updated;
        });

        const updatedUp = Number(data.upvotes ?? 0);
        const updatedDown = Number(data.downvotes ?? 0);

        setPharmacies((prev) =>
          prev.map((p) => {
            if (p.report_id === reportId) {
              return {
                ...p,
                upvotes: updatedUp,
                downvotes: updatedDown,
              };
            }
            return p;
          })
        );

        setSelectedPharmacy((prev) =>
          prev && prev.report_id === reportId
            ? {
                ...prev,
                upvotes: updatedUp,
                downvotes: updatedDown,
              }
            : prev
        );
      }
    } catch (err) {
      console.error('Error submitting vote:', err);
    }
  };

  // Browser Geolocation
  const handleRequestLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setLocating(false);
        map.current?.flyTo({
          center: [longitude, latitude],
          zoom: 13,
          essential: true,
        });
      },
      () => {
        setLocating(false);
        alert('Location access denied or unavailable.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // 3. Initialize Mapbox
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [userLocation.lng, userLocation.lat],
      zoom: 12,
    });

    map.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

    const geolocate = new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true,
    });
    map.current.addControl(geolocate, 'top-right');

    geolocate.on('geolocate', (e: any) => {
      setUserLocation({ lat: e.coords.latitude, lng: e.coords.longitude });
    });
  }, []);

  // 4. Update markers with pill icons and popups
  useEffect(() => {
    if (!map.current) return;

    if (activePopupRef.current) {
      activePopupRef.current.remove();
      activePopupRef.current = null;
    }

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    pharmacies.forEach((pharmacy) => {
      const lat = Number(pharmacy.lat);
      const lng = Number(pharmacy.lng);
      if (isNaN(lat) || isNaN(lng)) return;

      const displayName = pharmacy.pharmacy_name || 'Community Pharmacy';
      const displayAddress = pharmacy.pharmacy_address || 'Address unavailable';
      const phoneHtml = pharmacy.phone
        ? `<div style="margin-top: 6px; font-size: 12px; font-weight: 600; color: #2563eb;">📞 ${pharmacy.phone}</div>`
        : '';
      const status = pharmacy.latest_status || 'in_stock';

      const markerColor =
        status === 'in_stock'
          ? '#10B981'
          : status === 'low_stock'
          ? '#F59E0B'
          : status === 'out_of_stock'
          ? '#EF4444'
          : '#9CA3AF';

      const popup = new mapboxgl.Popup({
        offset: 18,
        closeButton: true,
        closeOnClick: false,
      }).setHTML(`
        <div style="font-family: inherit; padding: 6px 2px; min-width: 190px;">
          <h4 style="font-size: 13px; font-weight: 700; color: #0f172a; margin: 0 0 4px 0; line-height: 1.3;">
            ${displayName}
          </h4>
          <p style="font-size: 11px; color: #64748b; margin: 0; line-height: 1.4;">
            ${displayAddress}, ${pharmacy.suburb || ''}
          </p>
          ${phoneHtml}
          <div style="margin-top: 8px; display: inline-flex; align-items: center; gap: 6px; padding: 2px 8px; border-radius: 9999px; background-color: #f1f5f9; font-size: 11px; font-weight: 600; text-transform: capitalize; color: #334155;">
            <span style="width: 8px; height: 8px; border-radius: 50%; background-color: ${markerColor}; display: inline-block;"></span>
            ${status.replace('_', ' ')}
          </div>
        </div>
      `);

      popup.on('close', () => {
        if (activePopupRef.current === popup) {
          activePopupRef.current = null;
        }
      });

      const el = document.createElement('div');
      el.className = 'pill-pin';
      el.style.width = '30px';
      el.style.height = '30px';
      el.style.backgroundColor = markerColor;
      el.style.borderRadius = '50%';
      el.style.border = '2.5px solid white';
      el.style.boxShadow = '0 3px 8px rgba(0,0,0,0.35)';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.cursor = 'pointer';

      el.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" style="pointer-events: none;">
          <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/>
          <path d="m8.5 8.5 7 7"/>
        </svg>
      `;

      el.addEventListener('click', () => {
        if (activePopupRef.current) {
          activePopupRef.current.remove();
        }
        popup.setLngLat([lng, lat]).addTo(map.current!);
        activePopupRef.current = popup;
        setSelectedPharmacy(pharmacy);
        setDrawerState('half');
        map.current?.easeTo({ center: [lng, lat], zoom: 14 });
      });

      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([lng, lat])
        .addTo(map.current!);

      markersRef.current.push(marker);
    });
  }, [pharmacies]);

  const selectedMed = medications.find((m) => m.id === selectedMedicationId);

  const filteredPharmacies = pharmacies.filter((p) => {
  if (!searchQuery.trim()) return true;
  const q = searchQuery.toLowerCase();
  const nameMatch = p.pharmacy_name?.toLowerCase().includes(q);
  const addressMatch = p.address?.toLowerCase().includes(q);
  return nameMatch || addressMatch;
});


  // Dynamic height styling for the drawer on mobile
  const drawerHeightClass = {
    peek: 'h-14',
    half: 'h-[50vh]',
    full: 'h-[88vh]',
  }[drawerState];

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-slate-50 font-sans text-slate-800">
      {/* Top Floating App Bar (Mobile only) */}
      <header className="absolute top-3 left-3 right-16 z-20 flex md:hidden items-center justify-between rounded-xl bg-white/95 px-3 py-2 shadow-md backdrop-blur border border-slate-200/80">
        <div className="flex items-center gap-2">
          {/* Emerald Pill Badge */}
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm ring-2 ring-emerald-100">
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
              <path d="m8.5 8.5 7 7" />
            </svg>
          </div>
          <span className="text-sm font-black tracking-tight text-slate-900">ScriptStock</span>
        </div>

        <button
          onClick={handleRequestLocation}
          disabled={locating}
          className="text-xs font-semibold text-blue-600 hover:text-blue-700"
        >
          {locating ? 'Locating...' : '📍 Near Me'}
        </button>
      </header>

      {/* Responsive Panel: Left Sidebar on desktop, Bottom Drawer on mobile */}
      <aside
        className={`fixed md:static bottom-0 left-0 right-0 z-30 flex flex-col bg-white shadow-2xl transition-all duration-300 ease-in-out md:h-full md:w-96 md:border-r md:border-slate-200 md:shadow-lg rounded-t-3xl md:rounded-none ${drawerHeightClass}`}
      >
        {/* Mobile Drag Handle & Header bar */}
        <div
          onClick={() => setDrawerState((curr) => (curr === 'peek' ? 'half' : curr === 'half' ? 'full' : 'peek'))}
          className="md:hidden flex flex-col items-center justify-center pt-2 pb-1 cursor-pointer select-none"
        >
          <div className="h-1.5 w-12 rounded-full bg-slate-300"></div>
          {drawerState === 'peek' && (
            <div className="mt-1 flex items-center gap-2 text-xs font-semibold text-slate-500">
              <span>Touch to expand pharmacies ({pharmacies.length})</span>
            </div>
          )}
        </div>

        {/* Medication Selector Area */}
        <div className={`border-b border-slate-100 p-4 ${drawerState === 'peek' ? 'hidden md:block' : 'block'}`}>
          <div className="hidden md:flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2.5">
  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm ring-2 ring-emerald-100">
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
      <path d="m8.5 8.5 7 7" />
    </svg>
  </div>
  <h1 className="text-lg font-black tracking-tight text-slate-900">ScriptStock</h1>
</div>
              <h1 className="text-lg font-black tracking-tight text-slate-900">ScriptStock</h1>
            </div>

            <button
              onClick={handleRequestLocation}
              disabled={locating}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition"
              title="Locate me"
            >
              📍 {locating ? 'Locating...' : 'Near Me'}
            </button>
          </div>

          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Tracked Medication
          </label>
          <select
            value={selectedMedicationId}
            onChange={(e) => setSelectedMedicationId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:bg-white"
          >
            {medications.map((m) => (
              <option key={m.id} value={m.id}>
                {m.brand_name} ({m.strength}) - {m.dosage_form}
              </option>
            ))}
          </select>
        </div>

        {/* Scrollable Content (Detail Card + List) */}
        <div className={`flex-1 overflow-y-auto p-4 ${drawerState === 'peek' ? 'hidden md:block' : 'block'}`}>
          {selectedPharmacy ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-slate-900 leading-tight">
                    {selectedPharmacy.pharmacy_name}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {selectedPharmacy.pharmacy_address}, {selectedPharmacy.suburb}
                  </p>
                  {selectedPharmacy.phone && (
                    <a
                      href={`tel:${selectedPharmacy.phone}`}
                      className="inline-block mt-1 text-xs font-semibold text-blue-600 underline"
                    >
                      📞 {selectedPharmacy.phone}
                    </a>
                  )}
                </div>
                <button
                  onClick={() => setSelectedPharmacy(null)}
                  className="text-xs text-slate-400 hover:text-slate-600 p-1"
                >
                  ✕
                </button>
              </div>

              {/* Status Badge */}
              {(() => {
                const freshness = getStockFreshness(selectedPharmacy.hours_ago);
                return (
                  <div className="mt-4 rounded-xl bg-slate-50 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="block text-[10px] font-bold uppercase text-slate-400">
                          Current Stock
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${
                              selectedPharmacy.latest_status === 'in_stock'
                                ? 'bg-emerald-500'
                                : selectedPharmacy.latest_status === 'low_stock'
                                ? 'bg-amber-500'
                                : selectedPharmacy.latest_status === 'out_of_stock'
                                ? 'bg-rose-500'
                                : 'bg-slate-400'
                            }`}
                          ></span>
                          <span className="text-xs font-bold capitalize text-slate-800">
                            {selectedPharmacy.latest_status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          freshness.isStale
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-200/70 text-slate-700'
                        }`}
                      >
                        <span>🕒</span>
                        <span>{freshness.label}</span>
                      </span>
                    </div>

                    {freshness.isStale && (
                      <div className="mt-2.5 flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800">
                        <span>⚠️</span>
                        <span>Report is over 24h old and needs verification.</span>
                      </div>
                    )}

                {/* Verification row with separate up and down counters */}
                {selectedPharmacy.report_id && (
                  <div className="mt-3 flex items-center justify-between border-t border-slate-200/60 pt-2.5">
                    <span className="text-[11px] font-medium text-slate-500">Accurate info?</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleVote(selectedPharmacy.report_id!, 'up')}
                        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                          votedReportIds[selectedPharmacy.report_id!] === 'up'
                            ? 'bg-emerald-500 text-white shadow-sm ring-2 ring-emerald-200'
                            : 'bg-white text-slate-600 hover:bg-emerald-50 border border-slate-200'
                        }`}
                        title="Click to upvote, click again to remove"
                      >
                        <span>👍</span>
                        <span className="font-bold">{selectedPharmacy.upvotes ?? 0}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleVote(selectedPharmacy.report_id!, 'down')}
                        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                          votedReportIds[selectedPharmacy.report_id!] === 'down'
                            ? 'bg-rose-500 text-white shadow-sm ring-2 ring-rose-200'
                            : 'bg-white text-slate-600 hover:bg-rose-50 border border-slate-200'
                        }`}
                        title="Click to downvote, click again to remove"
                      >
                        <span>👎</span>
                        <span className="font-bold">{selectedPharmacy.downvotes ?? 0}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
              );
            })()}
              {selectedPharmacy.notes && (
                <p className="mt-3 rounded-lg bg-amber-50/60 p-2 text-xs italic text-amber-900 border border-amber-100">
                  “{selectedPharmacy.notes}”
                </p>
              )}

{/* Prescription Fulfillment Actions (When In Stock / Low Stock) */}
              {(selectedPharmacy.latest_status === 'in_stock' || selectedPharmacy.latest_status === 'low_stock') && (
                <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-900">
                      Fulfill Prescription
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      Stock Reported Available
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    Secure your script before driving in by calling or uploading through their dispensary portal:
                  </p>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {/* Call to Reserve Button */}
                    {selectedPharmacy.phone ? (
                      <a
                        href={`tel:${selectedPharmacy.phone.replace(/\s+/g, '')}`}
                        className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98]"
                      >
                        <span>📞</span> Call & Hold
                      </a>
                    ) : (
                      <button
                        disabled
                        className="flex items-center justify-center gap-1 rounded-xl bg-slate-200 py-2 text-xs font-medium text-slate-400 cursor-not-allowed"
                      >
                        Phone Unavailable
                      </button>
                    )}

                    {/* Official Portal Button */}
                    {getPharmacyPortalUrl(selectedPharmacy.pharmacy_name) ? (
                      <a
                        href={getPharmacyPortalUrl(selectedPharmacy.pharmacy_name)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-blue-600 active:scale-[0.98]"
                      >
                        <span>🌐</span> Official Portal
                      </a>
                    ) : (
                      <a
                        href={`https://www.google.com/search?q=${encodeURIComponent(
                          selectedPharmacy.pharmacy_name + ' dispensary e-script upload'
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.98]"
                      >
                        <span>🔍</span> Find Portal
                      </a>
                    )}
                  </div>

                  {/* Token Quick Copy Helper */}
                  <div className="mt-2.5 pt-2 border-t border-emerald-100">
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                      Quick e-Script Token / QR link copy:
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="Paste SMS script token or URL here..."
                        value={tokenInput}
                        onChange={(e) => setTokenInput(e.target.value)}
                        className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={handleCopyToken}
                        className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-bold text-white transition hover:bg-slate-900 active:scale-95"
                      >
                        {copiedToken ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Report Stock Button */}
              <button
                onClick={() => setIsReportModalOpen(true)}
                className="mt-4 w-full rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white transition hover:bg-blue-600 active:scale-[0.99]"
              >
                + Update Stock Level
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 p-4 md:p-6 text-center text-xs text-slate-400">
              Tap any pin on the map or select from the list below to view or submit live stock.
            </div>
          )}

          {/* Search / Filter Bar */}
            <div className="mt-3 mb-2">
              <div className="flex items-center justify-between mb-1.5 px-0.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Pharmacies ({filteredPharmacies.length})
                </span>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-700"
                  >
                    Clear Filter
                  </button>
                )}
              </div>

              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400">
                  🔍
                </span>
                <input
                  type="text"
                  placeholder="Search name, brand, or suburb..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-1.5 pl-8 pr-8 text-xs text-slate-800 placeholder-slate-400 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-xs text-slate-400 hover:text-slate-600"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          <div className="space-y-2 pb-16 md:pb-0">
            {filteredPharmacies.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">
                No pharmacies match &ldquo;{searchQuery}&rdquo;.
              </div>
            ) : (
              filteredPharmacies.map((p) => {
                const isSelected = selectedPharmacy?.pharmacy_id === p.pharmacy_id;
                return (
                  <div
                    key={p.pharmacy_id}
                    onClick={() => {
                      setSelectedPharmacy(p);
                      setDrawerState('half');
                      map.current?.easeTo({ center: [p.lng, p.lat], zoom: 14 });
                    }}
                    className={`flex cursor-pointer items-center justify-between rounded-xl border p-2.5 transition ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/50'
                        : 'border-slate-100 bg-white hover:border-slate-200'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <p className="truncate text-xs font-bold text-slate-800">{p.pharmacy_name}</p>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        <span>{p.suburb}</span>
                        {p.distance_km !== null && p.distance_km !== undefined && (
                          <>
                            <span>•</span>
                            <span className="font-semibold text-blue-600">{p.distance_km} km</span>
                          </>
                        )}
                        {(() => {
                          const freshness = getStockFreshness(p.hours_ago);
                          return (
                            <>
                              <span>•</span>
                              <span
                                className={
                                  freshness.isStale
                                    ? 'font-semibold text-amber-600'
                                    : 'text-slate-400'
                                }
                              >
                                {freshness.isStale ? '⚠️ ' : ''}
                                {freshness.label}
                              </span>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {p.upvotes && p.upvotes > 0 ? (
                        <span className="text-[10px] font-bold text-emerald-600">👍 {p.upvotes}</span>
                      ) : null}
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          p.latest_status === 'in_stock'
                            ? 'bg-emerald-500'
                            : p.latest_status === 'low_stock'
                            ? 'bg-amber-500'
                            : p.latest_status === 'out_of_stock'
                            ? 'bg-rose-500'
                            : 'bg-slate-300'
                        }`}
                      ></span>
                    </div>
                  </div>
            );
      })
    )}
  </div>

        </div>
      </aside>

      {/* Mapbox Canvas */}
      <main className="relative flex-1 h-full w-full">
        <div ref={mapContainer} className="h-full w-full" />
      </main>

      {/* Stock Report Modal */}
      {isReportModalOpen && selectedPharmacy && (
        <StockReportModal
          pharmacy={{
            id: Number(selectedPharmacy.pharmacy_id),
            name: selectedPharmacy.pharmacy_name,
            address: selectedPharmacy.pharmacy_address,
          }}
          medicationId={selectedMedicationId}
          medicationName={selectedMed ? `${selectedMed.brand_name} ${selectedMed.strength}` : 'Medication'}
          onClose={() => setIsReportModalOpen(false)}
          onSuccess={() => {
            fetchStock(userLocation.lat, userLocation.lng);
          }}
        />
      )}
    </div>
  );
}