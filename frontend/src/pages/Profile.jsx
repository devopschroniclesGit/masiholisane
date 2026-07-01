import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { stokvelAPI } from '../services/api';
import { ShieldCheck, ShieldAlert, Clock, AlertCircle, Check, LifeBuoy, ChevronRight, Users, TrendingUp, FileText, Lock, Trash2 } from 'lucide-react';
import Card from '../components/Card';
import Button from '../components/Button';
import TrustBadge from '../components/TrustBadge';
import IdVerificationModal from '../components/IdVerificationModal';

export default function Profile() {
  const { user }      = useAuth();
  const navigate       = useNavigate();
  const [groups, setGroups] = useState([]);
  const [idModalOpen, setIdModalOpen] = useState(false);

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
    { label: 'Tier 1 (Starter)',  minScore: 10,  tier: 1 },
    { label: 'Tier 2 (Builder)',  minScore: 50,  tier: 2 },
    { label: 'Tier 3 (Wealth)',   minScore: 70,  tier: 3 },
    { label: 'Elite (1.5% fee)', minScore: 90,  tier: 4 },
  ];

  return (
    <>
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-bold" style={{ color: '#1B2F5E' }}>My Profile</h1>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
        <button onClick={() => navigate('/dashboard')} className="text-left">
          <Card className="flex flex-col items-center text-center gap-2 py-4">
            <Users size={20} style={{ color: '#1B2F5E' }} />
            <p className="text-xs font-semibold text-gray-700">My Groups</p>
          </Card>
        </button>
        <button onClick={() => navigate('/trust-history')} className="text-left">
          <Card className="flex flex-col items-center text-center gap-2 py-4">
            <TrendingUp size={20} style={{ color: '#3A8B2F' }} />
            <p className="text-xs font-semibold text-gray-700">Trust Score</p>
          </Card>
        </button>
        <button onClick={() => navigate('/help')} className="text-left">
          <Card className="flex flex-col items-center text-center gap-2 py-4">
            <LifeBuoy size={20} style={{ color: '#E8621A' }} />
            <p className="text-xs font-semibold text-gray-700">Help</p>
          </Card>
        </button>
      </div>

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

      {/* ID Verification */}
      <Card>
        {user?.verified ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#F0FDF4' }}>
              <ShieldCheck size={20} style={{ color: '#3A8B2F' }} />
            </div>
            <div>
              <p className="font-bold text-sm" style={{ color: '#1B2F5E' }}>ID Verified</p>
              <p className="text-xs text-gray-500">Deposits and joining pools are unlocked</p>
            </div>
          </div>
        ) : user?.idVerificationStatus === 'pending' ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FFF7ED' }}>
              <Clock size={20} style={{ color: '#E8621A' }} />
            </div>
            <div>
              <p className="font-bold text-sm" style={{ color: '#1B2F5E' }}>Under Review</p>
              <p className="text-xs text-gray-500">Submitted — usually reviewed within 24-48 hours</p>
            </div>
          </div>
        ) : user?.idVerificationStatus === 'rejected' ? (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FEF2F2' }}>
                <AlertCircle size={20} style={{ color: '#dc2626' }} />
              </div>
              <div>
                <p className="font-bold text-sm" style={{ color: '#1B2F5E' }}>Submission Rejected</p>
                <p className="text-xs text-gray-500">{user?.idRejectionReason || 'Please resubmit'}</p>
              </div>
            </div>
            <Button variant="orange" onClick={() => setIdModalOpen(true)}>Resubmit</Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FFF7ED' }}>
                <ShieldAlert size={20} style={{ color: '#E8621A' }} />
              </div>
              <div>
                <p className="font-bold text-sm" style={{ color: '#1B2F5E' }}>ID Not Verified</p>
                <p className="text-xs text-gray-500">Required before deposits or joining pools</p>
              </div>
            </div>
            <Button variant="orange" onClick={() => setIdModalOpen(true)}>Verify ID</Button>
          </div>
        )}
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
              <span className={`flex items-center gap-1 text-xs font-semibold ${trustScore >= gate.minScore ? 'text-green-600' : 'text-gray-400'}`}>
                {trustScore >= gate.minScore ? <><Check size={12} /> Unlocked</> : `Need ${gate.minScore}`}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 rounded-xl" style={{ backgroundColor: '#F5F7FA' }}>
          <p className="text-xs font-semibold text-gray-600 mb-2">How to improve your score:</p>
          <div className="flex flex-col gap-1.5 text-xs text-gray-500">
            <p className="flex items-center gap-1.5"><Check size={12} className="flex-shrink-0" style={{ color: '#3A8B2F' }} /> Verify your ID +10 points</p>
            <p className="flex items-center gap-1.5"><Check size={12} className="flex-shrink-0" style={{ color: '#3A8B2F' }} /> Pay contributions on time +5 per month</p>
            <p className="flex items-center gap-1.5"><Check size={12} className="flex-shrink-0" style={{ color: '#3A8B2F' }} /> Complete a full 3-cycle group +30 points</p>
            <p className="flex items-center gap-1.5"><Check size={12} className="flex-shrink-0" style={{ color: '#3A8B2F' }} /> Refer a member who completes +10 points</p>
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

      {/* Get Help */}
      <Card>
        <h3 className="font-bold mb-3" style={{ color: '#1B2F5E' }}>Get Help</h3>
        <button
          onClick={() => navigate('/help')}
          className="w-full flex items-center justify-between p-3 rounded-xl hover:opacity-90 transition"
          style={{ backgroundColor: '#F5F7FA' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#EFF6FF' }}>
              <LifeBuoy size={16} style={{ color: '#1B2F5E' }} />
            </div>
            <span className="text-sm font-medium text-gray-800">How Can We Help?</span>
          </div>
          <ChevronRight size={16} className="text-gray-400" />
        </button>
      </Card>

      {/* Account & Legal */}
      <Card>
        <h3 className="font-bold mb-3" style={{ color: '#1B2F5E' }}>Account & Legal</h3>
        <div className="flex flex-col gap-2">
          {[
            { to: '/terms',           label: 'Terms of Service',          Icon: FileText },
            { to: '/privacy',         label: 'Privacy Policy',            Icon: Lock },
            { to: '/request-deletion', label: 'Request Account Deletion', Icon: Trash2, danger: true },
          ].map(({ to, label, Icon, danger }) => (
            <button
              key={to}
              onClick={() => navigate(to)}
              className="w-full flex items-center justify-between p-3 rounded-xl hover:opacity-90 transition"
              style={{ backgroundColor: '#F5F7FA' }}
            >
              <div className="flex items-center gap-3">
                <Icon size={16} style={{ color: danger ? '#dc2626' : '#1B2F5E' }} />
                <span className="text-sm font-medium" style={{ color: danger ? '#dc2626' : '#374151' }}>{label}</span>
              </div>
              <ChevronRight size={16} className="text-gray-400" />
            </button>
          ))}
        </div>
      </Card>
    </div>

    <IdVerificationModal open={idModalOpen} onClose={() => setIdModalOpen(false)} />
    </>
  );
}
