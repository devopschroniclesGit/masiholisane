import { useState, useEffect } from 'react';
import { Check, Clock, Bell, Search, Shield, Lightbulb, Handshake, Globe, Users, AlertCircle } from 'lucide-react';
import { stokvelAPI } from '../services/api';
import Modal from './Modal';
import TierBadge from './TierBadge';
import AlertModal from './AlertModal';
import ConfirmModal from './ConfirmModal';

const REASSURANCE = [
  { icon: Lightbulb, text: 'Most Tier 1 groups fill within 2-3 days' },
  { icon: Bell,      text: 'We will notify you the moment your group is ready' },
  { icon: Shield,    text: 'Your security deposit is only taken when the group starts' },
  { icon: Check,     text: 'Your spot is secured no need to wait on this screen' },
  { icon: Globe,     text: 'Hundreds of South Africans are saving with Masiholisane' },
  { icon: Handshake, text: 'Masiholisane means "let us help each other"' },
];

const CANCEL_FEES       = { 1: 25, 2: 50, 3: 100 };
const FREE_CANCEL_HOURS = 1;

export default function FormingGroupCard({ initialStatus, onUpdate }) {
  const [status, setStatus]       = useState(initialStatus);
  const [leaving, setLeaving]     = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [msgIndex, setMsgIndex]   = useState(0);
  const [leaveError, setLeaveError] = useState('');
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await stokvelAPI.getMyWaitingStatus();
        if (res.data.data.waiting) {
          setStatus(res.data.data);
          onUpdate && onUpdate(res.data.data);
        } else {
          onUpdate && onUpdate(null);
        }
      } catch {}
    }, 30000);
    return () => clearInterval(poll);
  }, []);

  useEffect(() => {
    if (!showModal) return;
    const rotate = setInterval(() => {
      setMsgIndex(i => (i + 1) % REASSURANCE.length);
    }, 4000);
    return () => clearInterval(rotate);
  }, [showModal]);

  function openLeaveConfirm() {
    setShowLeaveConfirm(true);
  }

  async function confirmLeave() {
    setLeaving(true);
    try {
      await stokvelAPI.leavePool(status.groupId);
      setShowLeaveConfirm(false);
      setShowModal(false);
      onUpdate && onUpdate(null);
    } catch (err) {
      setShowLeaveConfirm(false);
      setLeaveError(err.response?.data?.message || 'Could not leave pool');
    } finally {
      setLeaving(false);
    }
  }

  const tierAmounts = { 1: 500, 2: 1000, 3: 2000 };
  const tierLabels  = { 1: 'Starter', 2: 'Builder', 3: 'Wealth' };
  const feeApplies  = status.hoursWaiting > FREE_CANCEL_HOURS;
  const feeAmount   = CANCEL_FEES[status.tier];
  const minutesLeftToFree = Math.max(0, 60 - Math.floor(status.hoursWaiting * 60));
  const CurrentMsg  = REASSURANCE[msgIndex];

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border-2 p-5"
           style={{ borderColor: '#3A8B2F20' }}>

        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <TierBadge tier={status.tier} size="small" />
              <span className="text-sm font-semibold text-gray-700">{tierLabels[status.tier]}</span>
            </div>
            <p className="text-xs text-gray-500">R{tierAmounts[status.tier]}/month</p>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full"
               style={{ backgroundColor: '#3A8B2F15' }}>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                    style={{ backgroundColor: '#3A8B2F' }}></span>
              <span className="relative inline-flex rounded-full h-2 w-2"
                    style={{ backgroundColor: '#3A8B2F' }}></span>
            </span>
            <span className="text-xs font-semibold" style={{ color: '#3A8B2F' }}>FINDING GROUP</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 mb-3">
          {[1, 2, 3].map(n => (
            <div key={n}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold transition-all duration-500"
              style={{ backgroundColor: n <= status.currentMembers ? '#3A8B2F' : '#E5E7EB' }}>
              {n <= status.currentMembers ? <Check size={16} /> : <span className="text-gray-400 text-sm">{n}</span>}
            </div>
          ))}
        </div>

        <p className="text-center text-sm font-medium text-gray-700 mb-3">
          {status.currentMembers} of 3 members joined
        </p>

        <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-4">
          <div className="h-full rounded-full transition-all duration-700"
               style={{ width: `${status.progressPct}%`, backgroundColor: '#3A8B2F' }} />
        </div>

        <div className="flex flex-col gap-2 mb-4 text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <Clock size={14} style={{ color: '#E8621A' }} />
            <span>Looking for {status.spotsRemaining} more member{status.spotsRemaining > 1 ? 's' : ''}...</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <Bell size={14} style={{ color: '#1B2F5E' }} />
            <span>You will be notified when your group is ready</span>
          </div>
        </div>

        <button onClick={() => setShowModal(true)}
          className="w-full py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90"
          style={{ backgroundColor: '#1B2F5E' }}>
          View Details
        </button>
      </div>

      {/* Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)}>
        <div className="p-8">
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
              <Check size={16} style={{ color: '#3A8B2F' }} />
              <span className="text-gray-600">You joined the Tier {status.tier} pool</span>
            </div>
            {status.currentMembers > 1 && (
              <div className="flex items-center gap-2.5 text-sm">
                <Users size={16} style={{ color: '#3A8B2F' }} />
                <span className="text-gray-600">
                  {status.currentMembers - 1} other{status.currentMembers - 1 > 1 ? 's' : ''} waiting with you
                </span>
              </div>
            )}
            <div className="flex items-center gap-2.5 text-sm">
              <Clock size={16} className="animate-pulse" style={{ color: '#E8621A' }} />
              <span className="text-gray-600">
                Looking for {status.spotsRemaining} more member{status.spotsRemaining > 1 ? 's' : ''}...
              </span>
            </div>
          </div>

          <div className="rounded-2xl p-4 mb-4 flex items-center gap-3"
               style={{ backgroundColor: '#F5F7FA' }}>
            <CurrentMsg.icon size={18} style={{ color: '#1B2F5E' }} className="flex-shrink-0" />
            <p className="text-sm text-gray-600">{CurrentMsg.text}</p>
          </div>

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

          <button onClick={openLeaveConfirm} disabled={leaving}
            className="w-full py-2.5 rounded-xl text-sm font-medium border transition disabled:opacity-50"
            style={{
              color:           feeApplies ? '#E8621A' : '#6B7280',
              borderColor:     feeApplies ? '#FED7AA' : '#E5E7EB',
              backgroundColor: 'white',
            }}>
            {leaving ? 'Leaving...' : feeApplies ? `Leave Pool (R${feeAmount} fee)` : 'Leave Pool (free)'}
          </button>

          <p className="text-center text-xs text-gray-400 mt-4">
            You can safely close this dialog.<br />
            We will notify you when your group is ready.
          </p>
        </div>
      </Modal>

      <AlertModal
        open={!!leaveError}
        onClose={() => setLeaveError('')}
        variant="error"
        message={leaveError}
      />

      <ConfirmModal
        open={showLeaveConfirm}
        onClose={() => setShowLeaveConfirm(false)}
        onConfirm={confirmLeave}
        title="Leave the pool?"
        message={
          status.hoursWaiting > FREE_CANCEL_HOURS
            ? `A cancellation fee of R${CANCEL_FEES[status.tier]} will be charged.\nYour spot will be given to someone else.`
            : 'Your spot will be given to someone else. You can rejoin anytime.'
        }
        confirmText={
          status.hoursWaiting > FREE_CANCEL_HOURS
            ? `Yes, leave (R${CANCEL_FEES[status.tier]} fee)`
            : 'Yes, leave pool'
        }
        cancelText="Stay in pool"
        variant={status.hoursWaiting > FREE_CANCEL_HOURS ? 'danger' : 'warning'}
        loading={leaving}
      />
    </>
  );
}
