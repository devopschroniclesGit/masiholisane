import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, CheckCircle2, Wallet, Mail, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { stokvelAPI, walletAPI } from '../services/api';
import Card from '../components/Card';
import Button from '../components/Button';

const TIER_LABELS  = { 1: 'Starter', 2: 'Builder', 3: 'Wealth' };
const TIER_AMOUNTS = { 1: 500, 2: 1000, 3: 2000 };
const POT_AMOUNTS  = { 1: 1000, 2: 2000, 3: 4000 };

export default function PayoutHelp() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading]   = useState(true);
  const [myCycles, setMyCycles] = useState([]); // [{ group, cycle, paidCount }]
  const [pendingWithdrawal, setPendingWithdrawal] = useState(null);

  useEffect(() => {
    Promise.all([stokvelAPI.getMyGroups(), walletAPI.getBalance()])
      .then(async ([groupsRes, balanceRes]) => {
        const memberships = groupsRes.data.data.groups || [];
        const recentTx    = balanceRes.data.data.recentTransactions || [];

        const pending = recentTx.find(tx => tx.type === 'withdrawal' && tx.status === 'pending');
        setPendingWithdrawal(pending || null);

        // Find this user's own payout cycle in each group they belong to
        const relevant = memberships
          .map(m => {
            const group = m.group;
            const cycle = group?.cycles?.find(c => c.recipientId === user.id);
            return cycle ? { group, cycle } : null;
          })
          .filter(Boolean);

        // For cycles still collecting, fetch contribution counts so we can show "1 of 2 paid"
        const withCounts = await Promise.all(relevant.map(async ({ group, cycle }) => {
          if (cycle.status !== 'collecting') return { group, cycle, paidCount: null };
          try {
            const res = await stokvelAPI.getCycles(group.id);
            const fullCycle = res.data.data.cycles.find(c => c.id === cycle.id);
            const paidCount = fullCycle?.contributions?.filter(
              c => c.type === 'contribution' && ['paid', 'covered_by_backup'].includes(c.status)
            ).length || 0;
            return { group, cycle, paidCount };
          } catch {
            return { group, cycle, paidCount: null };
          }
        }));

        setMyCycles(withCounts);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user.id]);

  function statusFor({ group, cycle, paidCount }) {
    if (cycle.status === 'paid') {
      return {
        Icon: CheckCircle2,
        color: '#3A8B2F',
        bg: '#F0FDF4',
        title: 'Paid',
        detail: `R${(cycle.totalPot / 100).toLocaleString()} was added to your wallet on ${new Date(cycle.paidAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
      };
    }
    if (cycle.status === 'collecting') {
      return {
        Icon: Clock,
        color: '#E8621A',
        bg: '#FFF7ED',
        title: 'Still collecting',
        detail: paidCount === null
          ? 'Waiting for the other members to contribute.'
          : `${paidCount} of 2 members have contributed. You'll be paid automatically the moment both are in — there's no waiting period after that.`,
      };
    }
    // pending
    return {
      Icon: Clock,
      color: '#9ca3af',
      bg: '#F5F7FA',
      title: 'Not your turn yet',
      detail: `This is scheduled for ${new Date(cycle.dueDate).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}. Nothing to do until then.`,
    };
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-5">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 -mb-2">
        <ChevronLeft size={16} /> Back
      </button>

      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#1B2F5E' }}>I Didn't Receive My Payout</h1>
        <p className="text-sm text-gray-500 mt-1">Here's exactly where things stand for each of your groups.</p>
      </div>

      {pendingWithdrawal && (
        <Card>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#EFF6FF' }}>
              <Wallet size={18} style={{ color: '#1B2F5E' }} />
            </div>
            <div>
              <p className="font-bold text-sm" style={{ color: '#1B2F5E' }}>A withdrawal is still processing</p>
              <p className="text-sm text-gray-600 mt-1">
                Your withdrawal of R{(pendingWithdrawal.amount / 100).toFixed(2)} requested on{' '}
                {new Date(pendingWithdrawal.createdAt).toLocaleDateString('en-ZA')} hasn't been confirmed by the bank yet.
                This is the most likely reason a payout doesn't show as cash in your bank account yet — it's already left
                your Masiholisane wallet and is in transit.
              </p>
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <Card><p className="text-gray-400 text-sm text-center py-4 animate-pulse">Checking your groups...</p></Card>
      ) : myCycles.length === 0 ? (
        <Card>
          <div className="text-center py-8">
            <p className="text-gray-400 text-sm mb-4">
              You're not the recipient of a payout in any group yet. This usually means your group hasn't started,
              or your position hasn't come up.
            </p>
            <Button variant="primary" onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
          </div>
        </Card>
      ) : (
        myCycles.map(({ group, cycle, paidCount }) => {
          const s = statusFor({ group, cycle, paidCount });
          return (
            <Card key={cycle.id}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: s.bg }}>
                  <s.Icon size={18} style={{ color: s.color }} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-sm" style={{ color: '#1B2F5E' }}>
                      Tier {group.tier} — {TIER_LABELS[group.tier]}, Cycle {cycle.cycleNumber}
                    </p>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: s.bg, color: s.color }}>
                      {s.title}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{s.detail}</p>
                  <button
                    onClick={() => navigate(`/group/${group.id}`)}
                    className="flex items-center gap-0.5 text-xs font-semibold mt-2"
                    style={{ color: '#1B2F5E' }}
                  >
                    View group <ChevronRight size={12} />
                  </button>
                </div>
              </div>
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
              href={`mailto:support@masiholisane.co.za?subject=Payout query&body=Hi, I need help with a payout.%0D%0A%0D%0AName: ${encodeURIComponent(user?.name || '')}%0D%0AAccount email: ${encodeURIComponent(user?.email || user?.phone || '')}`}
            >
              <Button variant="outline">Email Support</Button>
            </a>
          </div>
        </div>
      </Card>
    </div>
  );
}
