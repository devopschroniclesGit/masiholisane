import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { stokvelAPI } from '../services/api';
import Card from '../components/Card';
import TrustBadge from '../components/TrustBadge';

export default function Profile() {
  const { user }      = useAuth();
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    stokvelAPI.getMyGroups()
      .then(res => setGroups(res.data.data.groups || []))
      .catch(() => {});
  }, []);

  const completed = groups.filter(m => m.group?.status === 'completed').length;
  const active    = groups.filter(m => ['active','forming'].includes(m.group?.status)).length;
  const trustScore = user?.trustScore || 0;
  const trustTier  = user?.trustTier  || 'restricted';

  const tierGates = [
    { label: 'Tier 1 (Starter)',  minScore: 30,  tier: 1 },
    { label: 'Tier 2 (Builder)',  minScore: 50,  tier: 2 },
    { label: 'Tier 3 (Wealth)',   minScore: 70,  tier: 3 },
    { label: 'Elite (1.5% fee)', minScore: 90,  tier: 4 },
  ];

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-bold" style={{ color: '#1B2F5E' }}>My Profile</h1>

      {/* User card */}
      <Card>
        <div className="flex items-center gap-4 mb-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold"
            style={{ backgroundColor: '#1B2F5E' }}
          >
            {user?.name?.[0]}
          </div>
          <div>
            <p className="text-xl font-bold" style={{ color: '#1B2F5E' }}>{user?.name}</p>
            <p className="text-sm text-gray-500">{user?.email}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl text-center" style={{ backgroundColor: '#F5F7FA' }}>
            <p className="text-2xl font-bold" style={{ color: '#3A8B2F' }}>{completed}</p>
            <p className="text-xs text-gray-500">Groups completed</p>
          </div>
          <div className="p-3 rounded-xl text-center" style={{ backgroundColor: '#F5F7FA' }}>
            <p className="text-2xl font-bold" style={{ color: '#E8621A' }}>{active}</p>
            <p className="text-xs text-gray-500">Active groups</p>
          </div>
        </div>
      </Card>

      {/* Trust Score */}
      <Card>
        <h3 className="font-bold mb-4" style={{ color: '#1B2F5E' }}>Trust Score</h3>
        <TrustBadge score={trustScore} tier={trustTier} />

        <div className="mt-4 flex flex-col gap-2">
          {tierGates.map(gate => (
            <div key={gate.tier}
                 className="flex items-center justify-between p-2 rounded-lg text-sm"
                 style={{
                   backgroundColor: trustScore >= gate.minScore ? '#F0FDF4' : '#F5F7FA'
                 }}>
              <span className={trustScore >= gate.minScore ? 'text-green-700 font-medium' : 'text-gray-400'}>
                {gate.label}
              </span>
              <span className={`text-xs font-semibold ${trustScore >= gate.minScore ? 'text-green-600' : 'text-gray-400'}`}>
                {trustScore >= gate.minScore ? '✓ Unlocked' : `Need ${gate.minScore}`}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 rounded-xl" style={{ backgroundColor: '#F5F7FA' }}>
          <p className="text-xs font-semibold text-gray-600 mb-2">How to improve your score:</p>
          <div className="flex flex-col gap-1 text-xs text-gray-500">
            <p>✓ Verify your ID +10 points</p>
            <p>✓ Pay contributions on time +5 per month</p>
            <p>✓ Complete a full 3-cycle group +30 points</p>
            <p>✓ Refer a member who completes +10 points</p>
          </div>
        </div>
      </Card>

      {/* All Groups */}
      <Card>
        <h3 className="font-bold mb-3" style={{ color: '#1B2F5E' }}>All My Groups</h3>
        {groups.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No groups yet</p>
        ) : (
          <div className="flex flex-col gap-2">
            {groups.map(membership => {
              const g = membership.group;
              const tierLabels = { 1: 'Starter', 2: 'Builder', 3: 'Wealth' };
              const statusColor = {
                active: '#3A8B2F', forming: '#f59e0b',
                completed: '#1B2F5E', cancelled: '#dc2626',
              };
              return (
                <div key={g.id}
                     className="flex items-center justify-between p-3 rounded-xl"
                     style={{ backgroundColor: '#F5F7FA' }}>
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      Tier {g.tier} {tierLabels[g.tier]}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(g.createdAt).toLocaleDateString('en-ZA')}
                    </p>
                  </div>
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: statusColor[g.status] || '#9ca3af' }}
                  >
                    {g.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
