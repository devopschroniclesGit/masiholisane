import { useState, useEffect } from 'react';
import { Smartphone, Wifi, Zap, Save, AlertTriangle } from 'lucide-react';
import { adminVasFeesAPI } from '../../services/api';

const PRODUCT_META = {
  airtime:     { label: 'Airtime',     Icon: Smartphone, color: '#3A8B2F' },
  data:        { label: 'Data',        Icon: Wifi,       color: '#1B2F5E' },
  electricity: { label: 'Electricity', Icon: Zap,        color: '#E8621A' },
};

export default function AdminVasFees() {
  const [fees, setFees]       = useState([]);
  const [edits, setEdits]     = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(null);
  const [message, setMessage] = useState('');

  function load() {
    setLoading(true);
    adminVasFeesAPI.list()
      .then((res) => setFees(res.data.data.fees || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleSave(productType) {
    const value = parseFloat(edits[productType]);
    if (isNaN(value) || value < 0 || value > 50) {
      setMessage(`Enter a value between 0 and 50 for ${productType}`);
      return;
    }
    setSaving(productType);
    setMessage('');
    try {
      await adminVasFeesAPI.update(productType, value);
      setEdits((e) => { const next = { ...e }; delete next[productType]; return next; });
      load();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Could not save');
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#1B2F5E' }}>VAS Fees</h1>
        <p className="text-gray-500 text-sm">
          Percentage added on top of face value for airtime, data and electricity purchases. Changes apply immediately, no redeploy needed.
        </p>
      </div>

      {message && (
        <div className="p-3 rounded-xl text-sm bg-red-50 border border-red-200 text-red-700">{message}</div>
      )}

      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : (
        <div className="flex flex-col gap-4">
          {fees.map((fee) => {
            const meta = PRODUCT_META[fee.productType];
            const currentEdit = edits[fee.productType];
            const displayValue = currentEdit !== undefined ? currentEdit : fee.feePercent;
            const dirty = currentEdit !== undefined && parseFloat(currentEdit) !== fee.feePercent;

            return (
              <div key={fee.productType} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: meta.color + '15' }}>
                    <meta.Icon size={18} style={{ color: meta.color }} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm" style={{ color: '#1B2F5E' }}>{meta.label}</p>
                    {fee.isDefault && (
                      <p className="text-xs text-gray-400">Using default, never explicitly set</p>
                    )}
                  </div>
                </div>

                {fee.productType === 'electricity' && (
                  <div className="flex items-start gap-2 mb-3 p-2.5 rounded-lg text-xs text-amber-800 bg-amber-50 border border-amber-200">
                    <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                    <span>Electricity token prices are regulated under NRS 057. Confirm a markup is actually permitted before setting this above 0%.</span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="50"
                    step="0.5"
                    value={displayValue}
                    onChange={(e) => setEdits((prev) => ({ ...prev, [fee.productType]: e.target.value }))}
                    className="w-24 px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  />
                  <span className="text-sm text-gray-500">%</span>
                  <button
                    onClick={() => handleSave(fee.productType)}
                    disabled={!dirty || saving === fee.productType}
                    className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
                    style={{ backgroundColor: '#1B2F5E' }}
                  >
                    <Save size={14} /> {saving === fee.productType ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
