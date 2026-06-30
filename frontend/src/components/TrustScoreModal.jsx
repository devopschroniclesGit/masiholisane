import { Trophy, Sparkles } from 'lucide-react';
import Modal from './Modal';

const TIER_LABELS = {
  restricted: { label: 'Restricted', color: '#DC2626' },
  new:        { label: 'New Member',  color: '#F59E0B' },
  trusted:    { label: 'Trusted',     color: '#3A8B2F' },
  good:       { label: 'Good Standing', color: '#1B2F5E' },
  elite:      { label: 'Elite',       color: '#E8621A' },
};

export default function TrustScoreModal({ open, onClose, newScore, oldScore, newTier, oldTier, delta }) {
  const tierChanged = newTier !== oldTier;
  const tierConfig  = TIER_LABELS[newTier] || TIER_LABELS.new;

  return (
    <Modal open={open} onClose={onClose}>
      <div className="p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
             style={{ backgroundColor: '#FEF3C7' }}>
          {tierChanged
            ? <Trophy size={32} style={{ color: '#F59E0B' }} />
            : <Sparkles size={28} style={{ color: '#F59E0B' }} />}
        </div>

        <h3 className="text-xl font-bold mb-2" style={{ color: '#1B2F5E' }}>
          {tierChanged ? 'Tier Upgrade!' : 'Trust Score Up!'}
        </h3>

        <p className="text-sm text-gray-600 mb-5">
          {tierChanged
            ? `You have reached ${tierConfig.label} status`
            : `You earned +${delta} trust points for paying on time`}
        </p>

        <div className="rounded-2xl p-4 mb-5" style={{ backgroundColor: '#F5F7FA' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500">Previous score</span>
            <span className="text-sm font-medium text-gray-400">{oldScore}/100</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">New score</span>
            <span className="text-2xl font-bold" style={{ color: tierConfig.color }}>
              {newScore}/100
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden mt-3">
            <div className="h-full rounded-full transition-all duration-1000"
                 style={{ width: `${newScore}%`, backgroundColor: tierConfig.color }} />
          </div>
        </div>

        {tierChanged && (
          <p className="text-xs text-gray-500 mb-5">
            Status now: <strong style={{ color: tierConfig.color }}>{tierConfig.label}</strong>
          </p>
        )}

        <button onClick={onClose}
          className="px-6 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90"
          style={{ backgroundColor: '#1B2F5E' }}>
          Awesome
        </button>
      </div>
    </Modal>
  );
}
