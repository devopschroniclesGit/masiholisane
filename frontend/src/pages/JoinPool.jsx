import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { stokvelAPI } from '../services/api';
import Card from '../components/Card';
import Button from '../components/Button';
import TierBadge from '../components/TierBadge';
import AlertModal from '../components/AlertModal';

const TIERS = [
  {
    tier:        1,
    name:        'Starter',
    amount:      500,
    pot: 1000,
    minScore:    30,
    color:       '#3A8B2F',
    description: 'Perfect for first-time savers',
  },
  {
    tier:        2,
    name:        'Builder',
    amount:      1000,
    pot: 2000,
    minScore:    50,
    color:       '#1B2F5E',
    description: 'For working professionals',
  },
  {
    tier:        3,
    name:        'Wealth',
    amount:      2000,
    pot: 4000,
    minScore:    70,
    color:       '#E8621A',
    description: 'Serious savers and business owners',
  },
];

export default function JoinPool() {
  const navigate                    = useNavigate();
  const [selected, setSelected]     = useState(null);
  const [poolStatus, setPoolStatus] = useState({});
  const [joining, setJoining]       = useState(false);
  const [error, setError]           = useState('');

  useEffect(() => {
    Promise.all(TIERS.map(t => stokvelAPI.getPoolStatus(t.tier)))
      .then(results => {
        const status = {};
        results.forEach((res, i) => {
          status[TIERS[i].tier] = res.data.data;
        });
        setPoolStatus(status);
      })
      .catch(() => {});
  }, []);

  async function handleJoin() {
    if (!selected) return;
    setJoining(true);
    setError('');
    try {
      const res = await stokvelAPI.joinPool(selected);
      const { groupId, groupStatus } = res.data.data;
      if (groupStatus === 'active') {
        navigate(`/group/${groupId}`);
      } else {
        navigate('/dashboard?joined=' + selected);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to join pool');
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#1B2F5E' }}>
          Join a Stokvel Pool
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Select a tier that matches your budget. Maximum wait: 2 months.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {TIERS.map(t => {
          const status     = poolStatus[t.tier];
          const isSelected = selected === t.tier;

          return (
            <button
              key={t.tier}
              onClick={() => setSelected(t.tier)}
              className="text-left rounded-2xl border-2 p-5 transition-all"
              style={{
                borderColor:     isSelected ? t.color : '#e5e7eb',
                backgroundColor: isSelected ? `${t.color}10` : 'white',
              }}>

              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <TierBadge tier={t.tier} size="small" color={t.color} />
                    <span className="font-bold" style={{ color: t.color }}>
                      {t.name}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{t.description}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg" style={{ color: t.color }}>
                    R{t.amount.toLocaleString()}
                    <span className="text-xs font-normal text-gray-400">/cycle</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    Receive R{t.pot.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div className="text-center p-2 rounded-lg bg-gray-50">
                  <p className="text-gray-400">You pay</p>
                  <p className="font-semibold text-gray-700">
                    R{t.amount} × 2
                  </p>
                  <p className="text-gray-400">cycles</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-gray-50">
                  <p className="text-gray-400">You receive</p>
                  <p className="font-semibold" style={{ color: t.color }}>
                    R{t.pot.toLocaleString()}
                  </p>
                  <p className="text-gray-400">once</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-gray-50">
                  <p className="text-gray-400">Pool status</p>
                  <p className="font-semibold" style={{ color: t.color }}>
                    {status ? `${status.currentMembers}/3` : '...'}
                  </p>
                  <p className="text-gray-400">members</p>
                </div>
              </div>

              <div className="mt-3 text-xs text-gray-500">
                Join with R{t.amount} • Min Trust Score: {t.minScore} • Max wait: 2 months
              </div>
            </button>
          );
        })}
      </div>

      <AlertModal
        open={!!error}
        onClose={() => setError('')}
        variant="error"
        title="Cannot Join Pool"
        message={error}
      />

      <Button
        variant="primary"
        disabled={!selected}
        loading={joining}
        className="w-full py-4 text-base"
        onClick={handleJoin}>
        {selected ? `Join Tier ${selected} Pool` : 'Select a tier to continue'}
      </Button>
    </div>
  );
}
