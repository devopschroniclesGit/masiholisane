import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import logo from '../assets/logo.png';

const RESEND_COOLDOWN = 30; // seconds

export default function VerifyOtp() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { verifyOtpLogin } = useAuth();

  const phone        = location.state?.phone;
  const initialDevOtp = location.state?.devOtp;

  const [code, setCode]       = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [devHint, setDevHint] = useState(initialDevOtp || '');

  useEffect(() => {
    if (!phone) navigate('/register', { replace: true });
  }, [phone, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (code.length !== 6) return setError('Enter the 6-digit code');
    setLoading(true);
    try {
      await verifyOtpLogin(phone, code);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0) return;
    setError('');
    try {
      const res = await authAPI.resendOtp(phone);
      setDevHint(res.data.data?.devOtp || '');
      setCooldown(RESEND_COOLDOWN);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not resend code');
    }
  }

  if (!phone) return null;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8"
         style={{ backgroundColor: '#F5F7FA' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <img src={logo} alt="Masiholisane" className="h-20 w-20 mx-auto mb-3 object-contain" />
          <h1 className="text-2xl font-bold" style={{ color: '#1B2F5E' }}>MASIHOLISANE</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-xl font-bold mb-1" style={{ color: '#1B2F5E' }}>Verify Your Number</h2>
          <p className="text-sm text-gray-500 mb-6">
            Enter the 6-digit code sent to <span className="font-semibold">{phone}</span>
          </p>

          {devHint && (
            <div className="mb-4 p-3 rounded-lg text-sm bg-amber-50 border border-amber-200 text-amber-800">
              Dev mode — your code is <span className="font-bold">{devHint}</span>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              autoFocus
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-center text-2xl tracking-[0.5em] font-bold focus:outline-none"
            />

            <button type="submit" disabled={loading || code.length !== 6}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90"
              style={{ backgroundColor: loading || code.length !== 6 ? '#9ca3af' : '#1B2F5E' }}>
              {loading ? 'Verifying...' : 'Verify & Continue'}
            </button>
          </form>

          <button
            onClick={handleResend}
            disabled={cooldown > 0}
            className="w-full text-center text-sm mt-4 font-semibold disabled:text-gray-400"
            style={{ color: cooldown > 0 ? undefined : '#1B2F5E' }}
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
          </button>

          <p className="text-center text-sm text-gray-500 mt-4">
            Wrong number?{' '}
            <Link to="/register" className="font-semibold" style={{ color: '#1B2F5E' }}>Start over</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
