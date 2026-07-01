import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, TrendingUp, TrendingDown } from 'lucide-react';
import { authAPI } from '../services/api';
import Card from '../components/Card';
import TrustBadge from '../components/TrustBadge';

const EVENT_LABELS = {
  id_verified:        'ID Verified',
  contribution_paid:  'On-time Contribution',
  completed_cycle:    'Completed a Full Cycle',
  missed_contribution: 'Missed Contribution',
  late_contribution:  'Late Contribution',
  reinstated:         'Reinstated',
  referred_member:    'Referral Completed',
  account_created:    'Account Created',
};

function labelFor(event) {
  return EVENT_LABELS[event] || event.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function TrustHistory() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData]       = useState({ currentScore: 0, currentTier: 'restricted', events: [] });

  useEffect(() => {
    authAPI.getTrustHistory()
      .then(res => setData(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-5">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 -mb-2">
        <ChevronLeft size={16} /> Back
      </button>

      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#1B2F5E' }}>Trust Score History</h1>
        <p className="text-sm text-gray-500 mt-1">Every change, and why.</p>
      </div>

      <Card>
        <TrustBadge score={data.currentScore} tier={data.currentTier} />
      </Card>

      {loading ? (
        <Card><p className="text-gray-400 text-sm text-center py-4 animate-pulse">Loading history...</p></Card>
      ) : data.events.length === 0 ? (
        <Card><p className="text-gray-400 text-sm text-center py-8">No score changes yet. Verify your ID to get started.</p></Card>
      ) : (
        <Card>
          <div className="flex flex-col">
            {data.events.map((e, i) => {
              const positive = e.delta >= 0;
              return (
                <div key={e.id}
                     className={`flex items-start gap-3 py-3 ${i !== data.events.length - 1 ? 'border-b border-gray-100' : ''}`}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                       style={{ backgroundColor: positive ? '#F0FDF4' : '#FEF2F2' }}>
                    {positive
                      ? <TrendingUp size={14} style={{ color: '#3A8B2F' }} />
                      : <TrendingDown size={14} style={{ color: '#dc2626' }} />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-800">{labelFor(e.event)}</p>
                      <span className="text-sm font-bold" style={{ color: positive ? '#3A8B2F' : '#dc2626' }}>
                        {positive ? '+' : ''}{e.delta}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{e.reason}</p>
                    <p className="text-xs text-gray-300 mt-0.5">
                      {new Date(e.createdAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}
                      {' \u00b7 '}{e.scoreBefore} to {e.scoreAfter}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
