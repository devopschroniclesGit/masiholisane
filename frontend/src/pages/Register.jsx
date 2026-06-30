import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import logo from '../assets/logo.png';

function validateSAID(id) {
  const cleaned = id.replace(/\s/g, '');
  if (!/^\d{13}$/.test(cleaned)) return { valid: false, message: 'Must be exactly 13 digits' };
  const month = parseInt(cleaned.slice(2, 4));
  const day   = parseInt(cleaned.slice(4, 6));
  if (month < 1 || month > 12) return { valid: false, message: 'Invalid birth month' };
  if (day < 1 || day > 31)     return { valid: false, message: 'Invalid birth day' };
  const citizenship = parseInt(cleaned[10]);
  if (citizenship !== 0 && citizenship !== 1) return { valid: false, message: 'Invalid ID format' };
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    let digit = parseInt(cleaned[i]);
    if (i % 2 === 1) { digit *= 2; if (digit > 9) digit -= 9; }
    sum += digit;
  }
  const check = (10 - (sum % 10)) % 10;
  if (check !== parseInt(cleaned[12])) return { valid: false, message: 'ID number is invalid please check and try again' };
  const year     = parseInt(cleaned.slice(0, 2));
  const fullYear = year <= 25 ? 2000 + year : 1900 + year;
  const age      = new Date().getFullYear() - fullYear;
  if (age < 18)  return { valid: false, message: 'You must be 18 or older to register' };
  if (age > 100) return { valid: false, message: 'Please check your ID number' };
  return { valid: true, age };
}

export default function Register() {
  const navigate  = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '', idNumber: '', referralCode: '',
  });
  const [idStatus, setIdStatus] = useState(null);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    if (name === 'idNumber' && value.length === 13) {
      setIdStatus(validateSAID(value));
    } else if (name === 'idNumber') {
      setIdStatus(null);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) return setError('Passwords do not match');
    if (form.password.length < 8) return setError('Password must be at least 8 characters');
    const idCheck = validateSAID(form.idNumber);
    if (!idCheck.valid) return setError(idCheck.message);
    setLoading(true);
    try {
      await authAPI.register(form.name, form.email, form.password, form.idNumber, form.referralCode || undefined);
      await login(form.email, form.password);
      navigate('/dashboard');
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
          <h2 className="text-xl font-bold mb-6" style={{ color: '#1B2F5E' }}>Create Account</h2>

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
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input name="email" type="email" value={form.email} onChange={handleChange} required
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SA ID Number</label>
              <input name="idNumber" type="text" value={form.idNumber} onChange={handleChange}
                required maxLength={13} placeholder="13-digit SA ID number"
                className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none ${
                  idStatus?.valid === true  ? 'border-green-400 bg-green-50' :
                  idStatus?.valid === false ? 'border-red-400 bg-red-50' : 'border-gray-200'
                }`} />
              {idStatus?.valid === true  && <p className="text-xs text-green-600 mt-1">✓ Valid SA ID Age: {idStatus.age}</p>}
              {idStatus?.valid === false && <p className="text-xs text-red-600 mt-1">✗ {idStatus.message}</p>}
              <p className="text-xs text-gray-400 mt-1">Your ID is encrypted and never shared</p>
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Referral Code <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input name="referralCode" type="text" value={form.referralCode}
                onChange={handleChange} placeholder="e.g. THABO2847"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none" />
              {form.referralCode && (
                <p className="text-xs text-green-600 mt-1">
                  ✓ You and your referrer each get R20 after your first contribution
                </p>
              )}
            </div>

            <p className="text-xs text-gray-400 text-center">
              By registering you agree to our Terms of Service and Privacy Policy. Protected under POPIA.
            </p>

            <button type="submit" disabled={loading || idStatus?.valid === false}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90 mt-1"
              style={{ backgroundColor: loading ? '#9ca3af' : '#1B2F5E' }}>
              {loading ? 'Creating account...' : 'Create Account'}
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
