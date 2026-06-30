import { useState, useEffect } from 'react';
import { walletAPI, promoAPI } from '../services/api';
import { CreditCard, Lock, Coins, Shield, Landmark, ArrowDownLeft, ArrowUpRight, Gift, Sparkles } from 'lucide-react';
import AlertModal from '../components/AlertModal';
import Card from '../components/Card';
import Button from '../components/Button';
import TierBadge from '../components/TierBadge';

export default function Wallet() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]           = useState(30);
  const [visibleCount, setVisibleCount] = useState(5);
  const [promoCode, setPromoCode]       = useState('');
  const [redeeming, setRedeeming]       = useState(false);
  const [alert, setAlert]               = useState(null);

  useEffect(() => {
    setLoading(true);
    setVisibleCount(5);
    walletAPI.getBalance(filter)
      .then(res => setData(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter]);

  async function handleRedeem() {
    if (!promoCode.trim()) return;
    setRedeeming(true);
    try {
      const res = await promoAPI.redeem(promoCode);
      setAlert({
        variant: 'success',
        title:   'Code Redeemed!',
        message: res.data.message + '. Use it for airtime, data, or electricity.',
      });
      setPromoCode('');
      // Reload balance
      const balRes = await walletAPI.getBalance(filter);
      setData(balRes.data.data);
    } catch (err) {
      setAlert({
        variant: 'error',
        title:   'Could Not Redeem',
        message: err.response?.data?.message || 'Failed to redeem code',
      });
    } finally {
      setRedeeming(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-bold" style={{ color: '#1B2F5E' }}>My Wallet</h1>

      {/* Main balance card */}
      <div className="rounded-2xl shadow-sm p-6 text-white"
           style={{ background: 'linear-gradient(135deg, #1B2F5E 0%, #2d4a8a 100%)' }}>
        {loading ? (
          <p className="text-white opacity-60 animate-pulse text-center py-4">Loading...</p>
        ) : (
          <>
            <p className="text-xs opacity-70 mb-1">Cash Balance</p>
            <p className="text-4xl font-bold mb-4">{data?.availableFormatted || 'R0.00'}</p>

            <div className="border-t border-white border-opacity-20 pt-4 grid grid-cols-3 gap-3">
              <div>
                <p className="text-xs opacity-70 mb-1 flex items-center gap-1">
                  <Gift size={12} />
                  Bonus
                </p>
                <p className="text-sm font-semibold">{data?.bonusFormatted || 'R0.00'}</p>
              </div>
              <div>
                <p className="text-xs opacity-70 mb-1 flex items-center gap-1">
                  <Lock size={12} />
                  Held
                </p>
                <p className="text-sm font-semibold">{data?.heldFormatted || 'R0.00'}</p>
              </div>
              <div className="text-right">
                <p className="text-xs opacity-70 mb-1">Total</p>
                <p className="text-sm font-semibold">{data?.totalFormatted || 'R0.00'}</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Redeem Promo Code */}
      <Card>
        <h3 className="font-bold text-sm mb-2 flex items-center gap-2" style={{ color: '#1B2F5E' }}>
          <Sparkles size={16} style={{ color: '#E8621A' }} />
          Got a Promo Code?
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          Enter a code to add bonus credit. Bonus funds can only be spent on airtime, data, and electricity.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={promoCode}
            onChange={e => setPromoCode(e.target.value.toUpperCase())}
            placeholder="e.g. WELCOME50"
            className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-400"
          />
          <button
            onClick={handleRedeem}
            disabled={redeeming || !promoCode.trim()}
            className="px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
            style={{ backgroundColor: '#E8621A' }}>
            {redeeming ? 'Checking...' : 'Redeem'}
          </button>
        </div>
      </Card>

      <AlertModal
        open={!!alert}
        onClose={() => setAlert(null)}
        variant={alert?.variant}
        title={alert?.title}
        message={alert?.message}
      />

      {/* Held breakdown */}
      {data?.heldBreakdown?.length > 0 && (
        <Card>
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2" style={{ color: '#1B2F5E' }}>
            <Lock size={16} />
            Held in Active Groups
          </h3>
          <div className="flex flex-col gap-2">
            {data.heldBreakdown.map(h => (
              <div key={h.groupId} className="flex items-center justify-between p-3 rounded-xl"
                   style={{ backgroundColor: '#F5F7FA' }}>
                <div className="flex items-center gap-2">
                  <TierBadge tier={h.tier} size="small" />
                  <span className="text-sm text-gray-700">{h.tierLabel} ({h.status})</span>
                </div>
                <span className="font-semibold text-sm" style={{ color: '#1B2F5E' }}>
                  {h.formatted}
                </span>
              </div>
            ))}
            <p className="text-xs text-gray-400 text-center mt-1">
              Returned when each group completes
            </p>
          </div>
        </Card>
      )}

      {/* Deposit / Withdraw */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2" style={{ color: '#1B2F5E' }}>
            <ArrowDownLeft size={16} style={{ color: '#3A8B2F' }} />
            Deposit
          </h3>
          <p className="text-xs text-gray-500 mb-3">Add money via EFT or instant transfer.</p>
          <Button variant="green" className="w-full">
            Deposit via Ozow
          </Button>
          <p className="text-xs text-gray-400 mt-2 text-center">Coming soon</p>
        </Card>

        <Card>
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2" style={{ color: '#1B2F5E' }}>
            <ArrowUpRight size={16} style={{ color: '#E8621A' }} />
            Withdraw
          </h3>
          <p className="text-xs text-gray-500 mb-3">Transfer to your SA bank account.</p>
          <Button variant="outline" className="w-full">
            Withdraw to Bank
          </Button>
          <p className="text-xs text-gray-400 mt-2 text-center">Coming soon</p>
        </Card>
      </div>

      {/* Recent transactions */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm" style={{ color: '#1B2F5E' }}>Recent Transactions</h3>
          <select value={filter} onChange={e => setFilter(parseInt(e.target.value))}
            className="text-xs px-2 py-1 rounded-lg border border-gray-200 focus:outline-none">
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">This year</option>
            <option value="0">All time</option>
          </select>
        </div>
        {loading ? (
          <p className="text-gray-400 text-center py-4 animate-pulse">Loading...</p>
        ) : !data?.recentTransactions?.length ? (
          <p className="text-gray-400 text-center py-4 text-sm">No transactions yet</p>
        ) : (
          <div className="flex flex-col gap-2">
            {data.recentTransactions.slice(0, visibleCount).map(t => {
              const isCredit = ['deposit', 'payout', 'refund', 'bonus'].includes(t.type);
              const typeLabels = {
                contribution: 'Contribution',
                fee:          'Platform Fee',
                payout:       'Payout Received',
                deposit:      'Deposit',
                refund:       'Security Refund',
                bonus:        'Referral Bonus',
                withdrawal:   'Withdrawal',
              };
              return (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-xl"
                     style={{ backgroundColor: '#F5F7FA' }}>
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0`}
                         style={{ backgroundColor: isCredit ? '#dcfce7' : '#fee2e2' }}>
                      {isCredit
                        ? <ArrowDownLeft size={14} style={{ color: '#3A8B2F' }} />
                        : <ArrowUpRight  size={14} style={{ color: '#DC2626' }} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {typeLabels[t.type] || t.type}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {t.description}
                      </p>
                      <p className="text-xs text-gray-300">
                        {new Date(t.createdAt).toLocaleDateString('en-ZA', {
                          day: 'numeric', month: 'short', year: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                  <span className="font-bold text-sm whitespace-nowrap"
                        style={{ color: isCredit ? '#3A8B2F' : '#DC2626' }}>
                    {isCredit ? '+' : '-'} R{(t.amount / 100).toFixed(2)}
                  </span>
                </div>
              );
            })}
            {data.recentTransactions.length > visibleCount && (
              <button onClick={() => setVisibleCount(c => c + 10)}
                className="w-full py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition mt-2">
                Show {Math.min(10, data.recentTransactions.length - visibleCount)} more ({data.recentTransactions.length - visibleCount} remaining)
              </button>
            )}
            {visibleCount > 5 && data.recentTransactions.length > 5 && (
              <button onClick={() => setVisibleCount(5)}
                className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 transition">
                Show less
              </button>
            )}
          </div>
        )}
      </Card>

      {/* How the wallet works */}
      <Card>
        <h3 className="font-bold text-sm mb-3" style={{ color: '#1B2F5E' }}>How the Wallet Works</h3>
        <div className="flex flex-col gap-3 text-sm text-gray-600">
          {[
            { Icon: CreditCard, text: 'Deposit via Ozow instant EFT from any SA bank' },
            { Icon: Lock,       text: 'Contributions auto-deducted on cycle day' },
            { Icon: Coins,      text: 'Payouts land directly in your wallet instantly' },
            { Icon: Shield,     text: 'Security deposit held safely and returned on completion' },
            { Icon: Landmark,   text: 'Withdraw to your bank account within 1-2 business days' },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <item.Icon size={18} style={{ color: '#1B2F5E' }} className="flex-shrink-0 mt-0.5" />
              <p>{item.text}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
