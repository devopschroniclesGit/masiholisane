import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.png';

export default function Login() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const { login }               = useAuth();
  const navigate                = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
         style={{ backgroundColor: '#F5F7FA' }}>
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <img src={logo} alt="Masiholisane" className="h-24 w-24 mx-auto mb-4 object-contain" />
          <h1 className="text-3xl font-bold" style={{ color: '#1B2F5E' }}>MASIHOLISANE</h1>
          <p className="text-sm mt-1" style={{ color: '#E8621A' }}>Let Us Help Each Other</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-xl font-bold mb-6" style={{ color: '#1B2F5E' }}>Sign In</h2>

          {error && (
            <div className="mb-4 p-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': '#1B2F5E' }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-opacity hover:opacity-90 mt-2"
              style={{ backgroundColor: loading ? '#9ca3af' : '#1B2F5E' }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 p-4 rounded-xl" style={{ backgroundColor: '#F5F7FA' }}>
            <p className="text-xs text-gray-500 font-medium mb-2">Test Accounts:</p>
            {[
              { email: 'thabo@masiholisane.co.za', note: 'Trust 65' },
              { email: 'nomsa@masiholisane.co.za', note: 'Trust 75' },
              { email: 'zanele@masiholisane.co.za', note: 'Trust 55' },
            ].map(u => (
              <button
                key={u.email}
                onClick={() => { setEmail(u.email); setPassword('Password123!'); }}
                className="block w-full text-left text-xs py-1 hover:underline"
                style={{ color: '#1B2F5E' }}
              >
                {u.email} ({u.note})
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
