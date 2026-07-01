import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { stokvelAPI } from '../services/api';
import { ShieldAlert, Clock, AlertOctagon, AlertTriangle } from 'lucide-react';
import { Home, Plus, Wallet, User, LogOut } from 'lucide-react';
import IdVerificationModal from './IdVerificationModal';
import logo from '../assets/logo.png';

const TIER_LABELS = { 1: 'Starter', 2: 'Builder', 3: 'Wealth' };

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [idModalOpen, setIdModalOpen] = useState(false);
  const [alerts, setAlerts] = useState({ suspended: [], blacklisted: [], dueSoon: [] });

  useEffect(() => {
    if (!user) return;
    stokvelAPI.getAlerts()
      .then((res) => setAlerts(res.data.data))
      .catch(() => {});
  }, [user?.id]);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-light">

      {/* Top Navigation */}
      <nav style={{ backgroundColor: '#1B2F5E' }} className="shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="bg-white rounded-full p-1 flex items-center justify-center" style={{ width: 44, height: 44 }}>
              <img src={logo} alt="Masiholisane" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="text-white font-bold text-lg leading-none">MASIHOLISANE</div>
              <div style={{ color: '#E8621A' }} className="text-xs leading-none">Let Us Help Each Other</div>
            </div>
          </div>

          {/* Nav Links desktop */}
          <div className="hidden md:flex items-center gap-1">
            {[
              { to: '/dashboard', label: 'Dashboard' },
              { to: '/join',      label: 'Join Pool' },
              { to: '/wallet',    label: 'Wallet' },
              { to: '/vas',       label: 'Buy' },
              { to: '/profile',   label: 'Profile' },
            ].map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? 'bg-white' : 'hover:bg-white/20'
                  }`
                }
                style={({ isActive }) => ({ color: isActive ? '#1B2F5E' : 'white' })}
              >
                {label}
              </NavLink>
            ))}
          </div>

          {/* User + Logout */}
          <div className="flex items-center gap-3">
            <span className="text-white text-sm hidden md:block">
              {user?.name?.split(' ')[0]}
            </span>
            <button
              onClick={handleLogout}
              style={{ backgroundColor: '#E8621A' }}
              className="text-white text-sm px-3 py-1.5 rounded-lg hover:opacity-90 transition"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        <div className="md:hidden flex border-t border-white/20">
          {[
            { to: '/dashboard', Icon: Home },
            { to: '/join',      Icon: Plus },
            { to: '/wallet',    Icon: Wallet },
            { to: '/profile',   Icon: User },
          ].map(({ to, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex-1 flex items-center justify-center py-3 transition ${
                  isActive ? 'bg-white/20' : ''
                }`
              }
            >
              <Icon size={20} className="text-white" />
            </NavLink>
          ))}
        </div>
      </nav>

      {/* ID Verification Banner */}
      {user && !user.verified && user.idVerificationStatus !== 'pending' && (
        <div style={{ backgroundColor: '#FFF7ED', borderBottom: '1px solid #FED7AA' }}>
          <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm" style={{ color: '#9A3412' }}>
              <ShieldAlert size={16} className="flex-shrink-0" />
              <span>
                {user.idVerificationStatus === 'rejected'
                  ? 'Your ID submission was rejected. Please resubmit to unlock deposits and joining pools.'
                  : 'Verify your ID to unlock deposits and joining pools.'}
              </span>
            </div>
            <button
              onClick={() => setIdModalOpen(true)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white hover:opacity-90 flex-shrink-0"
              style={{ backgroundColor: '#E8621A' }}
            >
              {user.idVerificationStatus === 'rejected' ? 'Resubmit' : 'Verify now'}
            </button>
          </div>
        </div>
      )}

      {user && !user.verified && user.idVerificationStatus === 'pending' && (
        <div style={{ backgroundColor: '#EFF6FF', borderBottom: '1px solid #BFDBFE' }}>
          <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-2 text-sm" style={{ color: '#1B2F5E' }}>
            <Clock size={16} className="flex-shrink-0" />
            <span>Your ID is under review. We will confirm within 24-48 hours.</span>
          </div>
        </div>
      )}

      {/* Blacklisted - most severe, shown first */}
      {alerts.blacklisted.length > 0 && (
        <div style={{ backgroundColor: '#FEF2F2', borderBottom: '1px solid #FECACA' }}>
          <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm" style={{ color: '#7F1D1D' }}>
              <AlertOctagon size={16} className="flex-shrink-0" />
              <span>
                {alerts.blacklisted.length === 1
                  ? `Your Tier ${alerts.blacklisted[0].tier} ${TIER_LABELS[alerts.blacklisted[0].tier]} membership was permanently suspended after a missed payment.`
                  : `${alerts.blacklisted.length} of your memberships were permanently suspended after missed payments.`}
              </span>
            </div>
            <button
              onClick={() => navigate('/suspension-help')}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white hover:opacity-90 flex-shrink-0"
              style={{ backgroundColor: '#dc2626' }}
            >
              Learn more
            </button>
          </div>
        </div>
      )}

      {/* Suspended - can still be fixed by repaying */}
      {alerts.suspended.length > 0 && (
        <div style={{ backgroundColor: '#FFF7ED', borderBottom: '1px solid #FED7AA' }}>
          <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm" style={{ color: '#9A3412' }}>
              <ShieldAlert size={16} className="flex-shrink-0" />
              <span>
                {alerts.suspended.length === 1
                  ? `Your Tier ${alerts.suspended[0].tier} ${TIER_LABELS[alerts.suspended[0].tier]} membership is suspended. Repay to reinstate.`
                  : `${alerts.suspended.length} of your memberships are suspended. Repay to reinstate.`}
              </span>
            </div>
            <button
              onClick={() => navigate('/suspension-help')}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white hover:opacity-90 flex-shrink-0"
              style={{ backgroundColor: '#E8621A' }}
            >
              Fix this
            </button>
          </div>
        </div>
      )}

      {/* Cycle due soon and balance won't cover it */}
      {alerts.dueSoon.length > 0 && (
        <div style={{ backgroundColor: '#EFF6FF', borderBottom: '1px solid #BFDBFE' }}>
          <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm" style={{ color: '#1B2F5E' }}>
              <AlertTriangle size={16} className="flex-shrink-0" />
              <span>
                {alerts.dueSoon.length === 1
                  ? `Your Tier ${alerts.dueSoon[0].tier} ${TIER_LABELS[alerts.dueSoon[0].tier]} contribution of R${(alerts.dueSoon[0].required / 100).toFixed(2)} is due in ${alerts.dueSoon[0].daysLeft} day${alerts.dueSoon[0].daysLeft === 1 ? '' : 's'}. Your balance won't cover it, top up now to avoid suspension.`
                  : `${alerts.dueSoon.length} contributions are due within 5 days and your balance won't cover them. Top up now to avoid suspension.`}
              </span>
            </div>
            <button
              onClick={() => navigate('/wallet')}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white hover:opacity-90 flex-shrink-0"
              style={{ backgroundColor: '#1B2F5E' }}
            >
              Top up
            </button>
          </div>
        </div>
      )}

      {/* Page Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Outlet />
      </main>

      <IdVerificationModal open={idModalOpen} onClose={() => setIdModalOpen(false)} />
    </div>
  );
}
