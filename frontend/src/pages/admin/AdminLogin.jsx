import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../../assets/logo.png';
import api from '../../services/api';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail]   = useState('');
  const [pass, setPass]     = useState('');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/admin/auth/login', { email, password: pass });
      localStorage.setItem('adminToken', res.data.data.token);
      localStorage.setItem('adminUser',  JSON.stringify(res.data.data.admin));
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
         style={{ backgroundColor: '#1B2F5E' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={logo} alt="Masiholisane" className="h-20 w-20 mx-auto mb-4 object-contain" />
          <h1 className="text-2xl font-bold text-white">MASIHOLISANE</h1>
          <p className="text-sm mt-1" style={{ color: '#E8621A' }}>Admin Portal</p>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-bold mb-6" style={{ color: '#1B2F5E' }}>Admin Sign In</h2>
          {error && (
            <div className="mb-4 p-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-200">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" value={pass} onChange={e => setPass(e.target.value)} required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm mt-2"
              style={{ backgroundColor: loading ? '#9ca3af' : '#1B2F5E' }}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
