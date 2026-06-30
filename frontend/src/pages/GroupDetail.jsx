import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { stokvelAPI } from '../services/api';
import Card from '../components/Card';
import Button from '../components/Button';
import Countdown from '../components/Countdown';
import AlertModal from '../components/AlertModal';
import TrustScoreModal from '../components/TrustScoreModal';


export default function GroupDetail() {
  const { id }        = useParams();
  const { user }      = useAuth();
  const navigate      = useNavigate();
  const [group, setGroup]             = useState(null);
  const [loading, setLoading]         = useState(true);
  const [contributing, setContributing] = useState(false);
  const [message, setMessage]         = useState('');
  const [error, setError]             = useState('');
  const [trustReward, setTrustReward] = useState(null);

  function loadGroup() {
    stokvelAPI.getGroup(id)
      .then(res => setGroup(res.data.data.group))
      .catch(() => navigate('/dashboard'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadGroup(); }, [id]);

  async function handleContribute() {
    setContributing(true);
    setError('');
    setMessage('');
    try {
      const oldScore = user?.trustScore || 0;
      const oldTier  = user?.trustTier  || 'restricted';
      const res = await stokvelAPI.contribute(id);
      const { trustScore, trustTier } = res.data.data;

      // Show trust reward if score increased
      if (trustScore && trustScore > oldScore) {
        setTrustReward({
          oldScore,
          newScore: trustScore,
          oldTier,
          newTier:  trustTier,
          delta:    trustScore - oldScore,
        });
        // Update local user state
        const updated = { ...user, trustScore, trustTier };
        localStorage.setItem('user', JSON.stringify(updated));
      } else {
        setMessage(res.data.data.message || 'Contribution successful');
      }
      loadGroup();
    } catch (err) {
      setError(err.response?.data?.message || 'Contribution failed');
    } finally {
      setContributing(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <p className="text-gray-400 animate-pulse">Loading group...</p>
    </div>
  );

  if (!group) return null;

  const myMembership = group.members?.find(m => m.userId === user?.id);
  const currentCycle = group.cycles?.find(c => c.status === 'collecting');
  const tierAmounts  = { 1: 500,  2: 1000, 3: 2000 };
  const potAmounts   = { 1: 1000, 2: 2000, 3: 4000 };
  const tierLabels   = { 1: 'Starter', 2: 'Builder', 3: 'Wealth' };

  const alreadyPaid = currentCycle?.contributions?.some(
    c => c.userId === user?.id && c.status === 'paid'
  );

  const statusColor = {
    active:    '#3A8B2F',
    forming:   '#f59e0b',
    completed: '#1B2F5E',
    cancelled: '#dc2626',
    suspended: '#E8621A',
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-gray-600">
          ← Back
        </button>
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1B2F5E' }}>
            Tier {group.tier} {tierLabels[group.tier]}
          </h1>
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
            style={{ backgroundColor: statusColor[group.status] || '#9ca3af' }}
          >
            {group.status.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Modals */}
      <AlertModal
        open={!!message}
        onClose={() => setMessage('')}
        variant="success"
        title="Contribution Successful"
        message={message}
      />
      <AlertModal
        open={!!error}
        onClose={() => setError('')}
        variant="error"
        message={error}
      />

      <TrustScoreModal
        open={!!trustReward}
        onClose={() => setTrustReward(null)}
        oldScore={trustReward?.oldScore}
        newScore={trustReward?.newScore}
        oldTier={trustReward?.oldTier}
        newTier={trustReward?.newTier}
        delta={trustReward?.delta}
      />

      {/* Suspended warning */}
      {myMembership?.status === 'suspended' && (
        <Card>
          <p className="text-sm font-medium text-red-700">
            ⚠️ Your membership is suspended. Top up your wallet and contact support to reinstate.
          </p>
        </Card>
      )}

      {/* Contribute card */}
      {group.status === 'active' && currentCycle && myMembership?.status === 'active' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-gray-500">Cycle {currentCycle.cycleNumber} of 3</p>
              <p className="font-bold text-lg" style={{ color: '#1B2F5E' }}>
                {currentCycle.recipientId === user?.id ? 'You Receive This Cycle' : 'Contribution Due'}
              </p>
              <p className="text-sm text-gray-500">
                {new Date(currentCycle.dueDate).toLocaleDateString('en-ZA', {
                  weekday: 'long', day: 'numeric', month: 'long'
                })}
              </p>
            </div>
            <Countdown targetDate={currentCycle.dueDate} label="days left" />
          </div>

          {currentCycle.recipientId === user?.id ? (
            <>
              <div className="flex items-center justify-between p-3 rounded-xl mb-4"
                   style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                <span className="text-sm text-gray-600">Your incoming payout</span>
                <span className="font-bold text-lg" style={{ color: '#3A8B2F' }}>
                  R{potAmounts[group.tier].toLocaleString()}
                </span>
              </div>
              <button disabled
                className="w-full py-3 rounded-xl text-sm font-semibold text-gray-400 bg-gray-100 cursor-not-allowed">
                Awaiting other members
              </button>
              <p className="text-xs text-gray-400 text-center mt-2">
                Your payout lands automatically when both other members pay
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between p-3 rounded-xl mb-4"
                   style={{ backgroundColor: '#F5F7FA' }}>
                <span className="text-sm text-gray-600">Amount due</span>
                <span className="font-bold text-lg" style={{ color: '#1B2F5E' }}>
                  R{tierAmounts[group.tier].toLocaleString()}
                </span>
              </div>

              {alreadyPaid ? (
                <div className="p-3 rounded-xl text-center bg-green-50 border border-green-200">
                  <p className="text-sm font-medium text-green-700">✓ You have paid this cycle</p>
                </div>
              ) : (
                <Button variant="green" className="w-full py-3" loading={contributing} onClick={handleContribute}>
                  Pay R{tierAmounts[group.tier].toLocaleString()} Now
                </Button>
              )}
            </>
          )}
        </Card>
      )}

      {/* Members */}
      <Card>
        <h3 className="font-bold mb-3" style={{ color: '#1B2F5E' }}>Members</h3>
        <div className="flex flex-col gap-2">
          {group.members?.map(member => {
            const isMe = member.userId === user?.id;
            return (
              <div key={member.id}
                   className="flex items-center justify-between p-3 rounded-xl"
                   style={{ backgroundColor: isMe ? '#EAF0FB' : '#F5F7FA' }}>
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                    style={{ backgroundColor: '#1B2F5E' }}
                  >
                    M
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {member.user?.name || 'Member'}
                      {isMe && <span className="ml-1 text-xs" style={{ color: '#E8621A' }}>(you)</span>}
                    </p>
                    <p className="text-xs text-gray-400">Position {member.position}</p>
                  </div>
                </div>
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: member.status === 'active'    ? '#dcfce7' :
                                     member.status === 'suspended' ? '#fef9c3' :
                                     member.status === 'completed' ? '#dbeafe' : '#fee2e2',
                    color: member.status === 'active'    ? '#3A8B2F' :
                           member.status === 'suspended' ? '#92400e' :
                           member.status === 'completed' ? '#1B2F5E' : '#dc2626',
                  }}
                >
                  {member.status}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Cycle Timeline */}
      <Card>
        <h3 className="font-bold mb-3" style={{ color: '#1B2F5E' }}>Cycle Timeline</h3>
        <div className="flex flex-col gap-3">
          {group.cycles?.map(cycle => {
            const isRecipient = cycle.recipientId === user?.id;
            const recipient   = group.members?.find(m => m.userId === cycle.recipientId);
            return (
              <div key={cycle.id}
                   className="flex items-center gap-4 p-3 rounded-xl"
                   style={{
                     backgroundColor: isRecipient ? '#F0FDF4' : '#F5F7FA',
                     border: isRecipient ? '1px solid #86efac' : '1px solid transparent',
                   }}>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                  style={{
                    backgroundColor: cycle.status === 'paid'       ? '#3A8B2F' :
                                     cycle.status === 'collecting' ? '#E8621A' : '#9ca3af'
                  }}
                >
                  {cycle.cycleNumber}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">
                    {recipient?.user?.name || 'Unknown'}
                    {isRecipient && <span className="ml-1 text-xs" style={{ color: '#E8621A' }}>(you)</span>}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(cycle.dueDate).toLocaleDateString('en-ZA', {
                      day: 'numeric', month: 'long', year: 'numeric'
                    })}
                  </p>
                </div>
                <div className="text-right">
                  {cycle.status === 'paid' ? (
                    <div>
                      <p className="text-sm font-bold" style={{ color: '#3A8B2F' }}>
                        R{(cycle.totalPot / 100).toLocaleString()}
                      </p>
                      <p className="text-xs text-green-600">Paid ✓</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-bold text-gray-700">
                        R{potAmounts[group.tier].toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-400">
                        {cycle.status === 'collecting' ? 'Collecting' : 'Pending'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

    </div>
  );
}
