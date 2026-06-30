import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

export default function AdminMembers() {
  const navigate = useNavigate();
  const [users, setUsers]     = useState([]);
  const [total, setTotal]     = useState(0);
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState(true);

  function load(q = '') {
    setLoading(true);
    const token = localStorage.getItem('adminToken');
    api.get(`/admin/dashboard/members?limit=50&search=${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(res => {
      setUsers(res.data.data.users || []);
      setTotal(res.data.data.total || 0);
    }).catch(() => navigate('/admin/login'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1B2F5E' }}>Members</h1>
          <p className="text-gray-500 text-sm">{total} total registered</p>
        </div>
        <input type="text" placeholder="Search name or email..." value={search}
          onChange={e => { setSearch(e.target.value); load(e.target.value); }}
          className="px-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none w-64" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: '#1B2F5E' }}>
              {['Name', 'Email', 'Balance', 'Trust Score', 'Groups', 'Joined'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-white text-xs font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">No members found</td></tr>
            ) : users.map((u, i) => {
              const activeGroups = u.stokvelMembers?.filter(
                m => ['active','forming'].includes(m.group?.status)
              ).length || 0;
              return (
                <tr key={u.id} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#F9FAFB' }}>
                  <td className="px-4 py-3 font-medium text-gray-800">{u.name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{u.email}</td>
                  <td className="px-4 py-3 font-semibold" style={{ color: '#1B2F5E' }}>
                    R{((u.account?.balance || 0) / 100).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold" style={{ color: '#3A8B2F' }}>
                      {u.trustScore?.score || 0}
                    </span>
                    <span className="text-gray-400 text-xs ml-1">({u.trustScore?.tier || 'restricted'})</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${activeGroups > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {activeGroups}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(u.createdAt).toLocaleDateString('en-ZA')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
