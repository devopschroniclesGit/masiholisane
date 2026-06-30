import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

function StatCard({ label, value, sub, color = '#1B2F5E' }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-3xl font-bold" style={{ color }}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [data, setData]         = useState(null);
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [fundUserId, setFundUserId]   = useState('');
  const [fundAmount, setFundAmount]   = useState('');
  const [fundMsg, setFundMsg]         = useState('');
  const [fundLoading, setFundLoading] = useState(false);
  const [pin, setPin] = useState('');
  const ADMIN_PIN = '123456'; // Change this move to env in production

  function aGet(url) {
    const token = localStorage.getItem('adminToken');
    return api.get(url, { headers: { Authorization: `Bearer ${token}` } });
  }
  function aPost(url, body) {
    const token = localStorage.getItem('adminToken');
    return api.post(url, body, { headers: { Authorization: `Bearer ${token}` } });
  }

  useEffect(() => {
    Promise.all([
      aGet('/admin/dashboard/overview'),
      aGet('/admin/dashboard/members?limit=100'),
    ]).then(([ov, mb]) => {
      setData(ov.data.data);
      setUsers(mb.data.data.users || []);
    }).catch(() => navigate('/admin/login'))
      .finally(() => setLoading(false));
  }, []);

  async function addFunds() {
    if (!fundUserId || !fundAmount) return;
    if (pin !== ADMIN_PIN) {
      setFundMsg('✗ Incorrect PIN action blocked and logged');
      return;
    }
    setFundLoading(true);
    setFundMsg('');
    try {
      const res = await aPost('/admin/dashboard/test-funds', {
        userId: fundUserId, amount: parseFloat(fundAmount),
      });
      setFundMsg('✓ ' + res.data.message + ' New balance: ' + res.data.data.newBalanceFormatted);
      setFundAmount('');
    } catch (err) {
      setFundMsg('✗ ' + (err.response?.data?.message || 'Failed'));
    } finally { setFundLoading(false); }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-gray-400 animate-pulse">Loading...</p>
    </div>
  );

  const f   = data?.financial || {};
  const fmt = (c) => 'R' + ((c || 0) / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2 });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#1B2F5E' }}>Overview</h1>
        <p className="text-gray-500 text-sm">{new Date().toLocaleDateString('en-ZA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Members"   value={data?.members?.total || 0}      color="#1B2F5E" />
        <StatCard label="New This Week"   value={data?.members?.newThisWeek || 0} color="#3A8B2F" />
        <StatCard label="Active Groups"   value={data?.groups?.active || 0}       color="#3A8B2F" />
        <StatCard label="Completed"       value={data?.groups?.completed || 0}    color="#1B2F5E" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Contributions" value={fmt(f.totalContributions)}   color="#1B2F5E"
          sub={`${f.totalContributionCount || 0} transactions`} />
        <StatCard label="Total Payouts"       value={fmt(f.totalPayouts)}          color="#3A8B2F"
          sub={`${f.totalPayoutCount || 0} payouts`} />
        <StatCard label="Platform Revenue"    value={fmt(f.platformFeesCollected)} color="#E8621A" />
      </div>

      {/* Test Funds */}
      <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
        <h2 className="font-bold mb-1" style={{ color: '#1B2F5E' }}>Add Test Funds</h2>
        <p className="text-xs text-gray-400 mb-4">Beta testing only adds wallet credit to any user</p>
        <div className="flex flex-col gap-3">
          <select value={fundUserId} onChange={e => setFundUserId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none">
            <option value="">Choose a member...</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.name} {u.email} (R{((u.account?.balance || 0) / 100).toFixed(2)})
              </option>
            ))}
          </select>
          <input type="number" value={fundAmount} onChange={e => setFundAmount(e.target.value)}
            placeholder="Amount in Rands e.g. 2000" min="1" max="10000"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none" />
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Admin PIN (required)</label>
            <input type="password" value={pin} onChange={e => setPin(e.target.value)}
              placeholder="6-digit PIN" maxLength={6}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none" />
          </div>
          {fundMsg && (
            <p className={`text-sm p-3 rounded-xl ${fundMsg.startsWith('✓') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {fundMsg}
            </p>
          )}
          <button onClick={addFunds} disabled={fundLoading || !fundUserId || !fundAmount}
            className="py-3 rounded-xl text-white font-semibold text-sm"
            style={{ backgroundColor: fundLoading || !fundUserId || !fundAmount ? '#9ca3af' : '#3A8B2F' }}>
            {fundLoading ? 'Adding...' : `Add R${fundAmount || '0'} to Wallet`}
          </button>
        </div>
      </div>

      {/* Revenue by Month */}
      {Object.keys(f.revenueByMonth || {}).length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
          <h2 className="font-bold mb-4" style={{ color: '#1B2F5E' }}>Revenue by Month</h2>
          {Object.entries(f.revenueByMonth).sort().map(([month, amount]) => (
            <div key={month} className="flex items-center justify-between p-3 rounded-xl mb-2"
                 style={{ backgroundColor: '#F5F7FA' }}>
              <span className="text-sm text-gray-600">{month}</span>
              <span className="font-bold text-sm" style={{ color: '#E8621A' }}>{fmt(amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
