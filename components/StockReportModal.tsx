'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface StockReportModalProps {
  pharmacy: {
    id: number;
    name: string;
    address: string;
  };
  medicationId: string;
  medicationName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function StockReportModal({
  pharmacy,
  medicationId,
  medicationName,
  onClose,
  onSuccess,
}: StockReportModalProps) {
  const [status, setStatus] = useState<'in_stock' | 'low_stock' | 'out_of_stock'>('in_stock');
  const [packSize, setPackSize] = useState('Standard Pack');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const parsedPharmacyId = Number(pharmacy.id);

    if (!parsedPharmacyId || isNaN(parsedPharmacyId)) {
      setError('Invalid pharmacy ID. Please re-select the pharmacy.');
      setLoading(false);
      return;
    }

    try {
      const { data, error: rpcError } = await supabase.rpc('submit_stock_report', {
        p_pharmacy_id: parsedPharmacyId,
        p_medication_id: String(medicationId),
        p_status: status,
        p_pack_size: packSize || 'Standard Pack',
        p_notes: notes.trim() || null,
      });

      if (rpcError) throw rpcError;

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('RPC Submission Error:', err);
      setError(err.message || 'Failed to submit report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Report Stock Availability</h2>
            <p className="text-xs text-gray-500">{pharmacy.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-bold px-2"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-600">Medication</label>
            <div className="mt-1 font-medium text-sm text-gray-800 bg-gray-50 p-2.5 rounded-lg border border-gray-200">
              {medicationName}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">Stock Status</label>
            <div className="grid grid-cols-3 gap-2 mt-1.5">
              <button
                type="button"
                onClick={() => setStatus('in_stock')}
                className={`py-2 text-xs font-semibold rounded-lg border transition-all ${
                  status === 'in_stock'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-2 ring-emerald-200'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                In Stock
              </button>
              <button
                type="button"
                onClick={() => setStatus('low_stock')}
                className={`py-2 text-xs font-semibold rounded-lg border transition-all ${
                  status === 'low_stock'
                    ? 'bg-amber-50 border-amber-500 text-amber-700 ring-2 ring-amber-200'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Low Stock
              </button>
              <button
                type="button"
                onClick={() => setStatus('out_of_stock')}
                className={`py-2 text-xs font-semibold rounded-lg border transition-all ${
                  status === 'out_of_stock'
                    ? 'bg-rose-50 border-rose-500 text-rose-700 ring-2 ring-rose-200'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Out of Stock
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">Pack / Brand Note</label>
            <input
              type="text"
              value={packSize}
              onChange={(e) => setPackSize(e.target.value)}
              placeholder="e.g. 30 capsules, Generic available"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Verified by phone, limit 1 bottle per script"
              rows={2}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 rounded-lg bg-blue-600 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}