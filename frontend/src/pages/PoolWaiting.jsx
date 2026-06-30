import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { stokvelAPI } from '../services/api';
import {
  Search, Check, Clock, Shield, Bell, Users, Lightbulb,
  Handshake, Globe, ArrowLeft, AlertCircle
} from 'lucide-react';
import AlertModal from '../components/AlertModal';
import logo from '../assets/logo.png';

const REASSURANCE = [
  { icon: Lightbulb, text: 'Most Tier 1 groups fill within 2-3 days' },
  { icon: Bell,      text: 'We will notify you the moment your group is ready' },
  { icon: Shield,    text: 'Your security deposit is only taken when the group starts' },
  { icon: Check,     text: 'Your spot is secured no need to wait on this screen' },
  { icon: Globe,     text: 'Hundreds of South Africans are saving with Masiholisane' },
  { icon: Handshake, text: 'Masiholisane means "let us help each other"' },
];

// Cancellation fee thresholds (in hours since joining)
const FREE_CANCEL_HOURS  = 1;
const CANCEL_FEES        = { 1: 25, 2: 50, 3: 100 };

export default function PoolWaiting() {
  const navigate              = useNavigate();
  const [status, setStatus]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [msgIndex, setMsgIndex] = useState(0);
  const [leaveError, setLeaveError] = useState('');

  function load() {
    stokvelAPI.getMyWaitingStatus()
      .then(res => {
        const data = res.data.data;
        if (!data.waiting) { navigate('/dashboard'); return; }
        setStatus(data);
      })
      .catch(() => navigate('/dashboard'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    const poll = setInterval(load, 8000);
    return () => clearInterval(poll);
  }, []);

  useEffect(() => {
    const rotate = setInterval(() => {
      setMsgIndex(i => (i + 1) % REASSURANCE.length);
    }, 4000);
    return () => clearInterval(rotate);
  }, []);

  async function handleLeave() {
    const feeApplies = status.hoursWaiting > FREE_CANCEL_HOURS;
    const feeAmount  = feeApplies ? CANCEL_FEES[status.tier] : 0;

    const message = feeApplies
      ? `Leaving now will charge a R${feeAmount} cancellation fee. Continue?`
      : 'Leave the pool? Your spot will be given to someone else.';

    if (!confirm(message)) return;

    try {
      await stokvelAPI.leavePool(status.groupId);
      navigate('/dashboard');
    } catch (err) {
      setLeaveError(err.response?.data?.message || 'Could not leave pool');
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F5F7FA' }}>
      <p className="text-gray-400 animate-pulse">Loading...</p>
    </div>
  );

  if (!status) return null;

  const tierAmounts = { 1: 500, 2: 1000, 3: 2000 };
  const tierLabels  = { 1: 'Starter', 2: 'Builder', 3: 'Wealth' };
  const CurrentMsg  = REASSURANCE[msgIndex];
  const feeApplies  = status.hoursWaiting > FREE_CANCEL_HOURS;
  const feeAmount   = CANCEL_FEES[status.tier];
  const minutesLeftToFree = Math.max(0, 60 - Math.floor(status.hoursWaiting * 60));

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8"
         style={{ backgroundColor: '#F5F7FA' }}>
      <div className="w-full max-w-md">

        {/* Back button */}
        <button onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-sm font-medium mb-4 hover:opacity-70 transition"
          style={{ color: '#1B2F5E' }}>
          <ArrowLeft size={18} />
          Back to Dashboard
        </button>

        <div className="text-center mb-6">
          <img src={logo} alt="Masiholisane" className="h-16 w-16 mx-auto mb-2 object-contain" />
          <h1 className="text-lg font-bold" style={{ color: '#1B2F5E' }}>MASIHOLISANE</h1>
        </div>

        <div className="bg-white rounded-3xl shadow-lg p-8">

          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 mb-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                      style={{ backgroundColor: '#3A8B2F' }}></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5"
                      style={{ backgroundColor: '#3A8B2F' }}></span>
              </span>
              <span className="text-sm font-semibold flex items-center gap-1.5" style={{ color: '#3A8B2F' }}>
                <Search size={15} /> Finding your group
              </span>
            </div>
            <h2 className="text-2xl font-bold" style={{ color: '#1B2F5E' }}>
              Tier {status.tier} {tierLabels[status.tier]}
            </h2>
            <p className="text-sm text-gray-500">R{tierAmounts[status.tier]}/month</p>
          </div>

          <div className="flex items-center justify-center gap-3 mb-4">
            {[1, 2, 3].map(n => (
              <div key={n}
                className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg transition-all duration-500"
                style={{
                  backgroundColor: n <= status.currentMembers ? '#3A8B2F' : '#E5E7EB',
                  transform: n <= status.currentMembers ? 'scale(1.05)' : 'scale(1)',
                }}>
                {n <= status.currentMembers ? <Check size={20} /> : <span className="text-gray-400">{n}</span>}
              </div>
            ))}
          </div>

          <p className="text-center text-sm font-medium text-gray-700 mb-4">
            {status.currentMembers} of 3 members joined
          </p>

          <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-6">
            <div className="h-full rounded-full transition-all duration-700"
                 style={{ width: `${status.progressPct}%`, backgroundColor: '#3A8B2F' }} />
          </div>

          <div className="flex flex-col gap-2.5 mb-6">
            <div className="flex items-center gap-2.5 text-sm">
              <Check size={16} style={{ color: '#3A8B2F' }} className="flex-shrink-0" />
              <span className="text-gray-600">You joined the Tier {status.tier} pool</span>
            </div>
            {status.currentMembers > 1 && (
              <div className="flex items-center gap-2.5 text-sm">
                <Users size={16} style={{ color: '#3A8B2F' }} className="flex-shrink-0" />
                <span className="text-gray-600">
                  {status.currentMembers - 1} other member{status.currentMembers - 1 > 1 ? 's' : ''} waiting with you
                </span>
              </div>
            )}
            <div className="flex items-center gap-2.5 text-sm">
              <Clock size={16} className="flex-shrink-0 animate-pulse" style={{ color: '#E8621A' }} />
              <span className="text-gray-600">
                Looking for {status.spotsRemaining} more member{status.spotsRemaining > 1 ? 's' : ''}...
              </span>
            </div>
          </div>

          {/* Rotating reassurance */}
          <div className="rounded-2xl p-4 mb-6 flex items-center gap-3 transition-all duration-300"
               style={{ backgroundColor: '#F5F7FA' }}>
            <CurrentMsg.icon size={18} style={{ color: '#1B2F5E' }} className="flex-shrink-0" />
            <p className="text-sm text-gray-600">{CurrentMsg.text}</p>
          </div>

          {/* Cancellation notice */}
          {feeApplies && (
            <div className="rounded-2xl p-3 mb-4 flex items-start gap-2"
                 style={{ backgroundColor: '#FFF7ED', border: '1px solid #FED7AA' }}>
              <AlertCircle size={16} style={{ color: '#E8621A' }} className="flex-shrink-0 mt-0.5" />
              <p className="text-xs" style={{ color: '#9A3412' }}>
                Cancellation fee of <strong>R{feeAmount}</strong> applies after the 1-hour grace period.
              </p>
            </div>
          )}
          {!feeApplies && minutesLeftToFree > 0 && (
            <div className="rounded-2xl p-3 mb-4 flex items-start gap-2"
                 style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
              <Clock size={16} style={{ color: '#3A8B2F' }} className="flex-shrink-0 mt-0.5" />
              <p className="text-xs" style={{ color: '#166534' }}>
                Free cancellation for <strong>{minutesLeftToFree} more minute{minutesLeftToFree > 1 ? 's' : ''}</strong>
              </p>
            </div>
          )}

          {/* Leave button */}
          <button onClick={handleLeave}
            className="w-full py-2.5 rounded-xl text-sm font-medium border transition"
            style={{
              color:           feeApplies ? '#E8621A' : '#6B7280',
              borderColor:     feeApplies ? '#FED7AA' : '#E5E7EB',
              backgroundColor: 'white',
            }}>
            {feeApplies ? `Leave Pool (R${feeAmount} fee)` : 'Leave Pool (free)'}
          </button>

          <p className="text-center text-xs text-gray-400 mt-4">
            You can safely close this page.<br />
            We will notify you when your group is ready.
          </p>
        </div>
      </div>

      <AlertModal
        open={!!leaveError}
        onClose={() => setLeaveError('')}
        variant="error"
        message={leaveError}
      />
    </div>
  );
}
