import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Smartphone } from 'lucide-react';
import { Home, Plus, Wallet, User, LogOut } from 'lucide-react';
import logo from '../assets/logo.png';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
                    isActive
                      ? 'bg-white'
                      : 'text-white hover:bg-white hover:bg-opacity-20'
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
        <div className="md:hidden flex border-t border-white border-opacity-20">
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
                  isActive ? 'bg-white bg-opacity-20' : ''
                }`
              }
            >
              <Icon size={20} className="text-white" />
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Page Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
