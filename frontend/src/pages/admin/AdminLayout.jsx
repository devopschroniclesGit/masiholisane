import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { LayoutDashboard, Users, Layers, BarChart3, LogOut } from 'lucide-react';
import logo from '../../assets/logo.png';

export default function AdminLayout() {
  const navigate = useNavigate();
  const [admin, setAdmin] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem('adminUser');
    const token  = localStorage.getItem('adminToken');
    if (!stored || !token) { navigate('/admin/login'); return; }
    setAdmin(JSON.parse(stored));
  }, []);

  function logout() {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    navigate('/admin/login');
  }

  const navItems = [
    { to: '/admin/dashboard', label: 'Overview',  Icon: LayoutDashboard },
    { to: '/admin/members',   label: 'Members',   Icon: Users },
    { to: '/admin/groups',    label: 'Groups',    Icon: Layers },
    { to: '/admin/reports',   label: 'Reports',   Icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#F5F7FA' }}>
      <aside className="w-56 min-h-screen flex flex-col shadow-lg"
             style={{ backgroundColor: '#1B2F5E' }}>
        <div className="p-5 border-b border-white border-opacity-10">
          <div className="flex items-center gap-2">
            <img src={logo} alt="" className="h-8 w-8 object-contain" />
            <div>
              <p className="text-white text-xs font-bold">MASIHOLISANE</p>
              <p className="text-xs" style={{ color: '#E8621A' }}>Admin Portal</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 flex flex-col gap-1">
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to}
              className={({ isActive }) =>
                `px-3 py-2.5 rounded-lg text-sm transition-all flex items-center gap-2.5 ${
                  isActive ? 'bg-white font-semibold' : 'text-white hover:bg-white hover:bg-opacity-10'
                }`
              }
              style={({ isActive }) => isActive ? { color: '#1B2F5E' } : {}}>
              <item.Icon size={16} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-white border-opacity-10">
          <p className="text-white text-xs mb-1">{admin?.name}</p>
          <p className="text-xs text-gray-400 mb-3">{admin?.role}</p>
          <button onClick={logout}
            className="w-full py-2 rounded-lg text-xs font-semibold text-white"
            style={{ backgroundColor: '#E8621A' }}>
            Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-auto"><Outlet /></main>
    </div>
  );
}
