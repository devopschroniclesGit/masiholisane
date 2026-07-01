import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import logo from '../assets/logo.png';

function normalizePhoneDisplay(value) {
  return value.replace(/[^\d+]/g, '');
}

export default function Register() {
  const navigate  = useNavigate();
  const [form, setForm] = useState({ name: '', phone: '', password: '', confirmPassword: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: name === 'phone' ? normalizePhoneDisplay(value) : value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) return setError('Passwords do not match');
    if (form.password.length < 8) return setError('Password must be at least 8 characters');
    if (!/^(\+27|0)[6-8][0-9]{8}$/.test(form.phone)) {
      return setError('Enter a valid SA mobile number, e.g. 082 123 4567');
    }

    setLoading(true);
    try {
      const res = await authAPI.register(form.name, form.phone, form.password);
      const { phone, devOtp } = res.data.data;
      navigate('/verify-otp', { state: { phone, devOtp } });
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8"
         style={{ backgroundColor: '#F5F7FA' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <img src={logo} alt="Masiholisane" className="h-20 w-20 mx-auto mb-3 object-contain" />
          <h1 className="text-2xl font-bold" style={{ color: '#1B2F5E' }}>MASIHOLISANE</h1>
          <p className="text-sm" style={{ color: '#E8621A' }}>Let Us Help Each Other</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-xl font-bold mb-1" style={{ color: '#1B2F5E' }}>Create Account</h2>
          <p className="text-xs text-gray-400 mb-6">
            We will text you a code to confirm your number. You can verify your ID later, before your first deposit.
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input name="name" type="text" value={form.name} onChange={handleChange} required
                placeholder="e.g. Thabo Nkosi"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
              <input name="phone" type="tel" value={form.phone} onChange={handleChange} required
                placeholder="082 123 4567"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none" />
              <p className="text-xs text-gray-400 mt-1">We'll send a code to confirm this number</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input name="password" type="password" value={form.password} onChange={handleChange}
                required placeholder="At least 8 characters"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
              <input name="confirmPassword" type="password" value={form.confirmPassword}
                onChange={handleChange} required placeholder="Repeat your password"
                className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none ${
                  form.confirmPassword && form.password !== form.confirmPassword
                    ? 'border-red-400' : 'border-gray-200'
                }`} />
              {form.confirmPassword && form.password !== form.confirmPassword && (
                <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
              )}
            </div>

            <p className="text-xs text-gray-400 text-center">
              By registering you agree to our Terms of Service and Privacy Policy. Protected under POPIA.
            </p>

            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90 mt-1"
              style={{ backgroundColor: loading ? '#9ca3af' : '#1B2F5E' }}>
              {loading ? 'Sending code...' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-4">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold" style={{ color: '#1B2F5E' }}>Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
