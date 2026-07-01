import { useState, useEffect } from 'react';
import { Smartphone, Wifi, Zap, ArrowRight, ArrowLeft, User, X, Clock, Star } from 'lucide-react';
import { vasAPI, walletAPI } from '../services/api';
import Card from '../components/Card';
import AlertModal from '../components/AlertModal';
import ConfirmModal from '../components/ConfirmModal';

const PRODUCT_TYPES = [
  { id: 'airtime',     label: 'Airtime',     Icon: Smartphone, color: '#3A8B2F' },
  { id: 'data',        label: 'Data',        Icon: Wifi,       color: '#1B2F5E' },
  { id: 'electricity', label: 'Electricity', Icon: Zap,        color: '#E8621A' },
];

export default function VAS() {
  const [products, setProducts]     = useState(null);
  const [balance, setBalance]       = useState(null);
  const [recipients, setRecipients] = useState([]);
  const [history, setHistory]       = useState([]);
  const [selected, setSelected]     = useState(null);
  const [form, setForm]             = useState({});
  const [saveLabel, setSaveLabel]   = useState('');
  const [purchasing, setPurchasing] = useState(false);
  const [alert, setAlert]           = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [lastPurchaseId, setLastPurchaseId] = useState(null);
  const [historyFilter, setHistoryFilter]   = useState(30);
  const [visibleCount, setVisibleCount]     = useState(5);
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(null);

  function loadAll() {
    walletAPI.getBalance().then(res => setBalance(res.data.data));
    vasAPI.recipients().then(res => setRecipients(res.data.data.recipients || []));
    vasAPI.history().then(res => setHistory(res.data.data.transactions || []));
  }

  useEffect(() => {
    vasAPI.products().then(res => setProducts(res.data.data));
    loadAll();
  }, []);

  function selectRecipient(r) {
    if (r.type === 'electricity') {
      setSelected('electricity');
      setForm({
        provider:    r.provider,
        meterNumber: r.meterNumber,
        recipientId: r.id,
      });
    } else {
      setSelected('airtime');
      setForm({
        network:     r.network,
        phoneNumber: r.phoneNumber,
        recipientId: r.id,
      });
    }
  }

  async function handlePurchase(confirmDuplicate = false) {
    if (!selected || !form.amount) return;
    setPurchasing(true);
    try {
      const data = { type: selected, ...form };
      if (saveLabel && !form.recipientId) data.saveAs = saveLabel;
      if (confirmDuplicate) data.confirmDuplicate = true;

      const res = await vasAPI.purchase(data);
      setAlert({
        variant: 'success',
        title:   'Purchase Successful',
        message: res.data.message,
      });
      setSelected(null);
      setForm({});
      setSaveLabel('');
      setShowDuplicateConfirm(null);
      loadAll();
      // Highlight the new transaction for 5 seconds
      setTimeout(async () => {
        const histRes = await vasAPI.history();
        const newest  = histRes.data.data.transactions?.[0];
        if (newest) {
          setLastPurchaseId(newest.id);
          setTimeout(() => setLastPurchaseId(null), 5000);
        }
      }, 200);
    } catch (err) {
      // Check for duplicate warning
      if (err.response?.status === 409 && err.response?.data?.data?.duplicate) {
        setShowDuplicateConfirm({
          message: err.response.data.message,
        });
      } else {
        setAlert({
          variant: 'error',
          title:   'Purchase Failed',
          message: err.response?.data?.message || 'Please try again',
        });
      }
    } finally {
      setPurchasing(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await vasAPI.deleteRecipient(deleteTarget.id);
      setDeleteTarget(null);
      loadAll();
    } catch (err) {
      setAlert({
        variant: 'error',
        title:   'Could Not Remove',
        message: 'Try again later',
      });
    }
  }

  const config = products?.[selected];
  const feePercent  = config?.feePercent || 0;
  const feeAmount   = form.amount ? Math.round(form.amount * feePercent / 100) : 0;
  const totalCharge = (form.amount || 0) + feeAmount;

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#1B2F5E' }}>
          Buy Airtime, Data & Electricity
        </h1>
        <p className="text-gray-500 text-sm">
          Top up your phone or buy electricity. Bonus used first.
        </p>
      </div>

      {balance && (
        <div className="rounded-2xl p-4 text-white"
             style={{ background: 'linear-gradient(135deg, #1B2F5E 0%, #2d4a8a 100%)' }}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs opacity-70">Bonus available</p>
              <p className="text-xl font-bold">{balance.bonusFormatted}</p>
            </div>
            <div className="text-right">
              <p className="text-xs opacity-70">Cash available</p>
              <p className="text-xl font-bold">{balance.availableFormatted}</p>
            </div>
          </div>
        </div>
      )}

      {/* Saved recipients */}
      {recipients.length > 0 && !selected && (
        <Card>
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2" style={{ color: '#1B2F5E' }}>
            <Star size={16} style={{ color: '#E8621A' }} />
            Quick Buy, Saved Recipients
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {recipients.map(r => (
              <div key={r.id} className="relative">
                <button onClick={() => selectRecipient(r)}
                  className="w-full text-left p-3 rounded-xl border border-gray-100 hover:border-blue-300 hover:bg-blue-50 transition">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center"
                         style={{ backgroundColor: r.type === 'electricity' ? '#FFF7ED' : '#F0FDF4' }}>
                      {r.type === 'electricity'
                        ? <Zap size={14} style={{ color: '#E8621A' }} />
                        : <Smartphone size={14} style={{ color: '#3A8B2F' }} />}
                    </div>
                    <p className="font-semibold text-sm text-gray-800 truncate">{r.label}</p>
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    {r.type === 'electricity'
                      ? `${r.provider} ${r.meterNumber}`
                      : `${r.network} ${r.phoneNumber}`}
                  </p>
                </button>
                <button onClick={() => setDeleteTarget(r)}
                  className="absolute top-2 right-2 p-1 rounded-lg hover:bg-red-50">
                  <X size={12} style={{ color: '#DC2626' }} />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {!selected ? (
        <div className="grid grid-cols-3 gap-3">
          {PRODUCT_TYPES.map(p => (
            <button key={p.id}
              onClick={() => setSelected(p.id)}
              className="rounded-2xl p-5 bg-white border border-gray-100 hover:shadow-md transition text-center">
              <div className="w-12 h-12 mx-auto mb-2 rounded-full flex items-center justify-center"
                   style={{ backgroundColor: p.color + '15' }}>
                <p.Icon size={24} style={{ color: p.color }} />
              </div>
              <p className="font-semibold text-sm" style={{ color: '#1B2F5E' }}>{p.label}</p>
            </button>
          ))}
        </div>
      ) : (
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => { setSelected(null); setForm({}); setSaveLabel(''); }}
              className="p-1 rounded-lg hover:bg-gray-100 transition">
              <ArrowLeft size={20} style={{ color: '#1B2F5E' }} />
            </button>
            <h3 className="font-bold flex-1" style={{ color: '#1B2F5E' }}>
              Buy {PRODUCT_TYPES.find(p => p.id === selected)?.label}
            </h3>
          </div>

          <div className="flex flex-col gap-3">
            {['airtime', 'data'].includes(selected) && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Network</label>
                  <select value={form.network || ''}
                    onChange={e => setForm({ ...form, network: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none">
                    <option value="">Select network</option>
                    {config?.networks?.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Phone Number</label>
                  <input type="tel"
                    value={form.phoneNumber || ''}
                    onChange={e => setForm({ ...form, phoneNumber: e.target.value })}
                    placeholder="0821234567"
                    maxLength={10}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none" />
                </div>
              </>
            )}

            {selected === 'airtime' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Amount</label>
                <div className="grid grid-cols-3 gap-2">
                  {config?.amounts?.slice(0, 6).map(amt => (
                    <button key={amt}
                      onClick={() => setForm({ ...form, amount: amt })}
                      className="py-2 rounded-xl text-sm font-medium transition"
                      style={{
                        backgroundColor: form.amount === amt ? '#1B2F5E' : '#F5F7FA',
                        color:           form.amount === amt ? 'white'  : '#1B2F5E',
                      }}>
                      R{amt / 100}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selected === 'data' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Bundle</label>
                <div className="flex flex-col gap-2">
                  {config?.bundles?.map(b => (
                    <button key={b.id}
                      onClick={() => setForm({ ...form, amount: b.price, bundleId: b.id })}
                      className="flex items-center justify-between p-3 rounded-xl text-sm transition border"
                      style={{
                        borderColor:     form.bundleId === b.id ? '#1B2F5E' : '#e5e7eb',
                        backgroundColor: form.bundleId === b.id ? '#F5F7FA' : 'white',
                      }}>
                      <div className="text-left">
                        <p className="font-semibold" style={{ color: '#1B2F5E' }}>{b.label}</p>
                        <p className="text-xs text-gray-500">{b.validity}</p>
                      </div>
                      <p className="font-bold" style={{ color: '#3A8B2F' }}>R{b.price / 100}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selected === 'electricity' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Provider</label>
                  <select value={form.provider || ''}
                    onChange={e => setForm({ ...form, provider: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none">
                    <option value="">Select provider</option>
                    {config?.providers?.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Meter Number</label>
                  <input type="text"
                    value={form.meterNumber || ''}
                    onChange={e => setForm({ ...form, meterNumber: e.target.value })}
                    placeholder="12345678901"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Amount (R)</label>
                  <input type="number"
                    value={form.amount ? form.amount / 100 : ''}
                    onChange={e => setForm({ ...form, amount: Math.round(parseFloat(e.target.value || 0) * 100) })}
                    placeholder="Min R50, Max R5000"
                    min="50" max="5000"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none" />
                </div>
              </>
            )}

            {/* Save as recipient — only show if not selected from saved */}
            {!form.recipientId && form.amount > 0 && (
              <div className="flex items-center gap-2">
                <User size={16} style={{ color: '#1B2F5E' }} />
                <input type="text"
                  value={saveLabel}
                  onChange={e => setSaveLabel(e.target.value)}
                  placeholder="Save as... e.g. Mom, Home meter (optional)"
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none" />
              </div>
            )}

            {form.amount > 0 && (
              <div className="rounded-xl p-3 text-sm" style={{ backgroundColor: '#F0FDF4' }}>
                <div className="flex justify-between text-gray-600">
                  <span>{selected === 'electricity' ? 'Voucher value' : 'Value sent'}</span>
                  <span>R{(form.amount / 100).toFixed(2)}</span>
                </div>
                {feeAmount > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Service fee ({feePercent}%)</span>
                    <span>R{(feeAmount / 100).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold pt-1 mt-1 border-t border-green-200" style={{ color: '#1B2F5E' }}>
                  <span>You will pay</span>
                  <span>R{(totalCharge / 100).toFixed(2)}</span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Bonus used first (R{Math.min(totalCharge, balance?.bonus || 0) / 100}),
                  then cash
                </p>
              </div>
            )}

            <button onClick={handlePurchase}
              disabled={purchasing || !form.amount}
              className="w-full py-3 rounded-xl text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ backgroundColor: '#3A8B2F' }}>
              {purchasing ? 'Processing...' : (
                <>
                  Pay R{(totalCharge / 100).toFixed(2)}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </Card>
      )}

      {/* Recent purchases history */}
      {history.length > 0 && !selected && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm flex items-center gap-2" style={{ color: '#1B2F5E' }}>
              <Clock size={16} />
              Recent Purchases
            </h3>
            <select value={historyFilter}
              onChange={e => { setHistoryFilter(parseInt(e.target.value)); setVisibleCount(5); }}
              className="text-xs px-2 py-1 rounded-lg border border-gray-200 focus:outline-none">
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">This year</option>
              <option value="0">All time</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            {(() => {
              const filtered = historyFilter === 0
                ? history
                : history.filter(t => {
                    const txDate = new Date(t.createdAt);
                    const cutoff = new Date(Date.now() - historyFilter * 24 * 60 * 60 * 1000);
                    return txDate >= cutoff;
                  });
              return filtered.slice(0, visibleCount).map(t => (
              <div key={t.id}
                   className={`flex items-center justify-between p-3 rounded-xl transition-all duration-500 ${
                     lastPurchaseId === t.id ? 'ring-2 ring-green-400 animate-pulse' : ''
                   }`}
                   style={{
                     backgroundColor: lastPurchaseId === t.id ? '#F0FDF4' : '#F5F7FA',
                   }}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {t.description.split(',')[0] || t.description}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(t.createdAt).toLocaleDateString('en-ZA', {
                      day: 'numeric', month: 'short', year: 'numeric'
                    })}
                  </p>
                </div>
                <p className="font-bold text-sm" style={{ color: '#DC2626' }}>
                  -R{(t.amount / 100).toFixed(2)}
                </p>
              </div>
              ));
            })()}
            {(() => {
              const filtered = historyFilter === 0
                ? history
                : history.filter(t => {
                    const txDate = new Date(t.createdAt);
                    const cutoff = new Date(Date.now() - historyFilter * 24 * 60 * 60 * 1000);
                    return txDate >= cutoff;
                  });
              if (filtered.length === 0) {
                return <p className="text-gray-400 text-center py-4 text-sm">No purchases in this period</p>;
              }
              return (
                <>
                  {filtered.length > visibleCount && (
                    <button onClick={() => setVisibleCount(c => c + 10)}
                      className="w-full py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition mt-2">
                      Show {Math.min(10, filtered.length - visibleCount)} more ({filtered.length - visibleCount} remaining)
                    </button>
                  )}
                  {visibleCount > 5 && filtered.length > 5 && (
                    <button onClick={() => setVisibleCount(5)}
                      className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 transition">
                      Show less
                    </button>
                  )}
                </>
              );
            })()}
          </div>
        </Card>
      )}

      <AlertModal
        open={!!alert}
        onClose={() => setAlert(null)}
        variant={alert?.variant}
        title={alert?.title}
        message={alert?.message}
      />

      <ConfirmModal
        open={!!showDuplicateConfirm}
        onClose={() => setShowDuplicateConfirm(null)}
        onConfirm={() => handlePurchase(true)}
        title="Duplicate Purchase?"
        message={showDuplicateConfirm?.message + '\n\nAre you sure you want to buy this again?'}
        confirmText="Yes, buy again"
        cancelText="Cancel"
        variant="warning"
        loading={purchasing}
      />

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Remove Saved Recipient?"
        message={deleteTarget ? `Remove "${deleteTarget.label}" from your saved list?` : ''}
        confirmText="Yes, remove"
        variant="danger"
      />
    </div>
  );
}
