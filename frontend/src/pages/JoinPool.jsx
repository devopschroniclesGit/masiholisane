import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { stokvelAPI } from '../services/api';
import Card from '../components/Card';
import Button from '../components/Button';

const TIERS = [
  {
    tier:       1,
    name:       'Starter',
    amount:     500,
    deposit:    500,
    pot:        1470,
    minScore:   30,
    color:      '#3A8B2F',
    description: 'Perfect for first-time savers',
  },
  {
    tier:       2,
    name:       'Builder',
    amount:     1000,
    deposit:    1000,
    pot:        2940,
    minScore:   50,
    color:      '#1B2F5E',
    description: 'For working professionals',
  },
  {
    tier:       3,
    name:       'Wealth',
    amount:     2000,
    deposit:    2000,
    pot:        5880,
    minScore:   70,
    color:      '#E8621A',
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
    // Fetch pool status for all tiers
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
      const { groupId } = res.data.data;
      navigate(`/group/${groupId}`);
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

      {/* Why Stokvel */}
      <Card>
        <h3 className="font-bold text-sm mb-3" style={{ color: '#1B2F5E' }}>
          Why join instead of saving alone?
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="p-3 rounded-xl bg-red-50">
            <p className="font-semibold text-red-700 mb-1">Saving alone ✗</p>
            <p className="text-xs text-gray-600">Month 1: R500 — easy to spend</p>
            <p className="text-xs text-gray-600">Month 2: R1,000 — still tempting</p>
            <p className="text-xs text-gray-600">Month 3: Maybe R1,500?</p>
          </div>
          <div className="p-3 rounded-xl bg-green-50">
            <p className="font-semibold mb-1" style={{ color: '#3A8B2F' }}>Masiholisane ✓</p>
            <p className="text-xs text-gray-600">Month 1: R500 locked</p>
            <p className="text-xs text-gray-600">Month 2: R500 locked</p>
            <p className="text-xs text-gray-600">Month 3: R1,470 paid to you</p>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-3 text-center">
          Service fee: R10/month (R30 total). Less than a bank monthly fee.
        </p>
      </Card>

      {/* Tier Selection */}
      <div className="flex flex-col gap-3">
        {TIERS.map(t => {
          const status    = poolStatus[t.tier];
          const isSelected = selected === t.tier;

          return (
            <button
              key={t.tier}
              onClick={() => setSelected(t.tier)}
              className="text-left rounded-2xl border-2 p-5 transition-all"
              style={{
                borderColor:       isSelected ? t.color : '#e5e7eb',
                backgroundColor:   isSelected ? `${t.color}10` : 'white',
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: t.color }}
                    >
                      TIER {t.tier}
                    </span>
                    <span className="font-bold" style={{ color: t.color }}>
                      {t.name}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{t.description}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg" style={{ color: t.color }}>
                    R{t.amount.toLocaleString()}<span className="text-xs font-normal text-gray-400">/mo</span>
                  </p>
                  <p className="text-xs text-gray-500">Receive R{t.pot.toLocaleString()}</p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div className="text-center p-2 rounded-lg bg-gray-50">
                  <p className="text-gray-400">Security deposit</p>
                  <p className="font-semibold text-gray-700">R{t.deposit.toLocaleString()}</p>
                  <p className="text-gray-400">returned</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-gray-50">
                  <p className="text-gray-400">Service fee</p>
                  <p className="font-semibold text-gray-700">R{t.amount * 0.02}/mo</p>
                  <p className="text-gray-400">R{t.amount * 0.02 * 3} total</p>
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
                First month: R{(t.amount + t.deposit).toLocaleString()} •
                Min Trust Score: {t.minScore} •
                Max wait: 2 months
              </div>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="p-3 rounded-xl text-sm text-red-700 bg-red-50 border border-red-200">
          {error}
        </div>
      )}

      <Button
        variant="primary"
        disabled={!selected}
        loading={joining}
        className="w-full py-4 text-base"
        onClick={handleJoin}
      >
        {selected ? `Join Tier ${selected} Pool` : 'Select a tier to continue'}
      </Button>
    </div>
  );
}
