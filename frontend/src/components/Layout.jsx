import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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
            <img src={logo} alt="Masiholisane" className="h-10 w-10 object-contain" />
            <div>
              <div className="text-white font-bold text-lg leading-none">MASIHOLISANE</div>
              <div style={{ color: '#E8621A' }} className="text-xs leading-none">Let Us Help Each Other</div>
            </div>
          </div>

          {/* Nav Links — desktop */}
          <div className="hidden md:flex items-center gap-1">
            {[
              { to: '/dashboard', label: 'Dashboard' },
              { to: '/join',      label: 'Join Pool' },
              { to: '/wallet',    label: 'Wallet' },
              { to: '/profile',   label: 'Profile' },
            ].map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-white text-navy'
                      : 'text-white hover:bg-white hover:bg-opacity-10 hover:text-white'
                  }`
                }
                style={({ isActive }) => isActive ? { color: '#1B2F5E' } : {}}
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
            { to: '/dashboard', label: '🏠' },
            { to: '/join',      label: '➕' },
            { to: '/wallet',    label: '💰' },
            { to: '/profile',   label: '👤' },
          ].map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex-1 text-center py-2 text-lg ${
                  isActive ? 'bg-white bg-opacity-20' : ''
                }`
              }
            >
              {label}
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
