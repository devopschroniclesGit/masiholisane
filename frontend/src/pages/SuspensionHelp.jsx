import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ShieldOff, Mail, ChevronLeft, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { stokvelAPI } from '../services/api';
import Card from '../components/Card';
import Button from '../components/Button';

const TIER_LABELS = { 1: 'Starter', 2: 'Builder', 3: 'Wealth' };

export default function SuspensionHelp() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading]   = useState(true);
  const [issues, setIssues]     = useState([]); // [{ membership, group, amountOwed }]
  const [reinstating, setReinstating] = useState(null);
  const [message, setMessage]   = useState('');

  function load() {
    setLoading(true);
    stokvelAPI.getMyGroups()
      .then(async (res) => {
        const memberships = res.data.data.groups || [];
        const flagged = memberships.filter(m => ['suspended', 'blacklisted'].includes(m.status));

        const withDetail = await Promise.all(flagged.map(async (m) => {
          const group = m.group;
          let amountOwed = 0;
          try {
            const cyclesRes = await stokvelAPI.getCycles(group.id);
            const cycles = cyclesRes.data.data.cycles || [];
            cycles.forEach(c => {
              (c.contributions || []).forEach(contrib => {
                if (contrib.userId === user.id && contrib.type === 'contribution' && contrib.status === 'covered_by_backup') {
                  amountOwed += contrib.amount;
                }
              });
            });
          } catch {}
          return { membership: m, group, amountOwed };
        }));

        setIssues(withDetail);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleReinstate(groupId) {
    setReinstating(groupId);
    setMessage('');
    try {
      const res = await stokvelAPI.reinstate(groupId);
      setMessage(res.data.message || 'Reinstated.');
      load();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Reinstatement failed.');
    } finally {
      setReinstating(null);
    }
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-5">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 -mb-2">
        <ChevronLeft size={16} /> Back
      </button>

      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#1B2F5E' }}>Why Am I Suspended?</h1>
        <p className="text-sm text-gray-500 mt-1">Here's exactly what happened and what to do next.</p>
      </div>

      {message && (
        <div className="p-3 rounded-xl text-sm font-medium bg-green-50 border border-green-200 text-green-700">
          {message}
        </div>
      )}

      {loading ? (
        <Card><p className="text-gray-400 text-sm text-center py-4 animate-pulse">Checking your groups...</p></Card>
      ) : issues.length === 0 ? (
        <Card>
          <div className="text-center py-8">
            <CheckCircle2 size={28} className="mx-auto mb-3" style={{ color: '#3A8B2F' }} />
            <p className="text-gray-600 text-sm">You're in good standing in all your groups. Nothing to fix here.</p>
          </div>
        </Card>
      ) : (
        issues.map(({ membership, group, amountOwed }) => {
          const isBlacklisted = membership.status === 'blacklisted';
          return (
            <Card key={group.id}>
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: isBlacklisted ? '#FEF2F2' : '#FFF7ED' }}>
                  {isBlacklisted
                    ? <ShieldOff size={18} style={{ color: '#dc2626' }} />
                    : <AlertTriangle size={18} style={{ color: '#E8621A' }} />}
                </div>
                <div>
                  <p className="font-bold text-sm" style={{ color: '#1B2F5E' }}>
                    Tier {group.tier} — {TIER_LABELS[group.tier]}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {isBlacklisted
                      ? 'This membership was permanently suspended because a contribution was missed after you had already received your payout in this group. This cannot be reinstated.'
                      : 'A contribution you missed was covered by the group\'s security fund so the other members could still get paid on time. Your membership is on hold until it\'s repaid.'}
                  </p>
                </div>
              </div>

              {!isBlacklisted && amountOwed > 0 && (
                <div className="rounded-xl p-3 mb-4 flex items-center justify-between" style={{ backgroundColor: '#F5F7FA' }}>
                  <span className="text-sm text-gray-600">Amount owed</span>
                  <span className="font-bold text-lg" style={{ color: '#E8621A' }}>R{(amountOwed / 100).toFixed(2)}</span>
                </div>
              )}

              {!isBlacklisted && (
                <Button
                  variant="green"
                  className="w-full"
                  loading={reinstating === group.id}
                  onClick={() => handleReinstate(group.id)}
                >
                  Repay and Reinstate
                </Button>
              )}

              {isBlacklisted && (
                <p className="text-xs text-gray-400 text-center">
                  If you believe this is an error, contact support below.
                </p>
              )}
            </Card>
          );
        })
      )}

      <Card>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#F5F7FA' }}>
            <Mail size={18} style={{ color: '#1B2F5E' }} />
          </div>
          <div className="flex-1">
            <p className="font-bold text-sm" style={{ color: '#1B2F5E' }}>Still need help?</p>
            <p className="text-sm text-gray-500 mt-1 mb-3">
              If something here doesn't look right, send us the details and we'll look into it.
            </p>
            <a
              href={`mailto:support@masiholisane.co.za?subject=Suspension query&body=Hi, I need help with a suspended membership.%0D%0A%0D%0AName: ${encodeURIComponent(user?.name || '')}%0D%0AAccount: ${encodeURIComponent(user?.email || user?.phone || '')}`}
            >
              <Button variant="outline">Email Support</Button>
            </a>
          </div>
        </div>
      </Card>
    </div>
  );
}
