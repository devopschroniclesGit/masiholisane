import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { stokvelAPI } from '../services/api';
import Card from '../components/Card';
import Button from '../components/Button';
import TrustBadge from '../components/TrustBadge';
import Countdown from '../components/Countdown';
import FormingGroupCard from '../components/FormingGroupCard';
import TierBadge from '../components/TierBadge';

export default function Dashboard() {
  const { user }        = useAuth();
  const navigate        = useNavigate();
  const [groups, setGroups]       = useState([]);
  const [waitingStatus, setWaitingStatus] = useState(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([
      stokvelAPI.getMyGroups(),
      stokvelAPI.getMyWaitingStatus(),
    ]).then(([g, w]) => {
      setGroups(g.data.data.groups || []);
      if (w.data.data.waiting) setWaitingStatus(w.data.data);
    }).catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const activeGroups = groups.filter(m =>
    ['active', 'forming'].includes(m.group?.status)
  );

  const trustScore = user?.trustScore || 0;
  const trustTier  = user?.trustTier  || 'restricted';

  return (
    <div className="flex flex-col gap-6">

      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1B2F5E' }}>
            Sawubona, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">Your savings dashboard</p>
        </div>
        <Button variant="green" onClick={() => navigate('/join')}>
          + Join Pool
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <p className="text-xs text-gray-500 mb-1">Active Groups</p>
          <p className="text-3xl font-bold" style={{ color: '#1B2F5E' }}>
            {activeGroups.length}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 mb-1">Completed Groups</p>
          <p className="text-3xl font-bold" style={{ color: '#3A8B2F' }}>
            {groups.filter(m => m.group?.status === 'completed').length}
          </p>
        </Card>
        <Card className="col-span-2 md:col-span-1">
          <p className="text-xs text-gray-500 mb-2">Trust Score</p>
          <TrustBadge score={trustScore} tier={trustTier} />
        </Card>
      </div>

      {/* Active Groups */}
      <div>
        <h2 className="text-lg font-bold mb-3" style={{ color: '#1B2F5E' }}>
          My Groups
        </h2>

        {waitingStatus && (
          <div className="mb-4">
            <FormingGroupCard
              initialStatus={waitingStatus}
              onUpdate={(newStatus) => {
                setWaitingStatus(newStatus);
                if (!newStatus) {
                  // Group activated or user left refresh groups
                  stokvelAPI.getMyGroups()
                    .then(res => setGroups(res.data.data.groups || []))
                    .catch(() => {});
                }
              }}
            />
          </div>
        )}

        {loading ? (
          <Card>
            <p className="text-gray-400 text-sm text-center py-4">Loading...</p>
          </Card>
        ) : activeGroups.length === 0 ? (
          <Card>
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm mb-4">You are not in any active groups yet.</p>
              <Button variant="primary" onClick={() => navigate('/join')}>
                Join a Stokvel Pool
              </Button>
            </div>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {activeGroups.map(membership => {
              const group        = membership.group;
              const currentCycle = group.cycles?.find(c => c.status === 'collecting');
              const myPosition   = membership.position;
              const myPayoutCycle = group.cycles?.find(c => c.cycleNumber === myPosition);
              const tierLabels   = { 1: 'Starter', 2: 'Builder', 3: 'Wealth' };
              const tierAmounts  = { 1: 500, 2: 1000, 3: 2000 };
              const potAmounts   = { 1: 1000, 2: 2000, 3: 4000 };

              return (
                <Card key={group.id}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <TierBadge tier={group.tier} showName />
                      <p className="text-xs text-gray-500 mt-2">
                        R{tierAmounts[group.tier]}/month
                      </p>
                    </div>
                    <span
                      className="text-xs font-semibold px-2 py-1 rounded-full"
                      style={{
                        backgroundColor: group.status === 'active' ? '#dcfce7' : '#fef9c3',
                        color: group.status === 'active' ? '#3A8B2F' : '#92400e',
                      }}
                    >
                      {group.status === 'active' ? 'Active' : 'Forming'}
                    </span>
                  </div>

                  {group.status === 'active' && (
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Cycle</p>
                        <p className="font-bold text-lg" style={{ color: '#1B2F5E' }}>
                          {group.currentCycle}/3
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500">My Position</p>
                        <p className="font-bold text-lg" style={{ color: '#E8621A' }}>
                          #{myPosition}
                        </p>
                      </div>
                      {currentCycle && (
                        <Countdown
                          targetDate={currentCycle.dueDate}
                          label="days to pay"
                        />
                      )}
                    </div>
                  )}

                  {myPayoutCycle && myPayoutCycle.status !== 'paid' && (
                    <div
                      className="rounded-xl p-3 mb-4 text-center"
                      style={{ backgroundColor: '#F5F7FA' }}
                    >
                      <p className="text-xs text-gray-500">Your payout</p>
                      <p className="font-bold text-xl" style={{ color: '#3A8B2F' }}>
                        R{potAmounts[group.tier].toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(myPayoutCycle.dueDate).toLocaleDateString('en-ZA', {
                          day: 'numeric', month: 'long', year: 'numeric'
                        })}
                      </p>
                    </div>
                  )}

                  {membership.status === 'suspended' && (
                    <div className="rounded-xl p-3 mb-4 bg-red-50 border border-red-200">
                      <p className="text-sm text-red-700 font-medium">
                        ⚠️ Your membership is suspended. Top up your wallet and repay your missed contribution.
                      </p>
                    </div>
                  )}

                  <Button
                    variant="primary"
                    className="w-full"
                    onClick={() => navigate(`/group/${group.id}`)}
                  >
                    View Group
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
