import { useState } from 'react';
import { ShieldCheck, Clock, AlertCircle, Upload } from 'lucide-react';
import Modal from './Modal';
import { authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

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
  if (check !== parseInt(cleaned[12])) return { valid: false, message: 'ID number is invalid, please check and try again' };
  const year     = parseInt(cleaned.slice(0, 2));
  const fullYear = year <= 25 ? 2000 + year : 1900 + year;
  const age      = new Date().getFullYear() - fullYear;
  if (age < 18)  return { valid: false, message: 'You must be 18 or older' };
  if (age > 100) return { valid: false, message: 'Please check your ID number' };
  return { valid: true, age };
}

export default function IdVerificationModal({ open, onClose }) {
  const { user, refreshUser } = useAuth();
  const [idNumber, setIdNumber] = useState('');
  const [idStatus, setIdStatus] = useState(null);
  const [file, setFile]         = useState(null);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);

  function handleIdChange(e) {
    const value = e.target.value;
    setIdNumber(value);
    setError('');
    if (value.length === 13) setIdStatus(validateSAID(value));
    else setIdStatus(null);
  }

  function handleFileChange(e) {
    const f = e.target.files?.[0];
    setError('');
    if (f && f.size > 5 * 1024 * 1024) {
      setError('File must be under 5MB');
      setFile(null);
      return;
    }
    setFile(f || null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const check = validateSAID(idNumber);
    if (!check.valid) return setError(check.message);
    if (!file) return setError('Please upload a photo of your ID document');

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('idNumber', idNumber);
      formData.append('idDocument', file);
      await authAPI.verifyId(formData);
      await refreshUser();
      setJustSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Submission failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setJustSubmitted(false);
    setIdNumber('');
    setIdStatus(null);
    setFile(null);
    setError('');
    onClose();
  }

  const status = user?.idVerificationStatus || 'unverified';

  return (
    <Modal open={open} onClose={handleClose}>
      {/* Already verified */}
      {status === 'approved' || user?.verified ? (
        <div className="p-8 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#F0FDF4' }}>
            <ShieldCheck size={28} style={{ color: '#3A8B2F' }} />
          </div>
          <h3 className="text-lg font-bold mb-2" style={{ color: '#1B2F5E' }}>ID Verified</h3>
          <p className="text-sm text-gray-600">Deposits and joining pools are unlocked.</p>
        </div>

      /* Just submitted, or already pending from a previous visit */
      ) : status === 'pending' || justSubmitted ? (
        <div className="p-8 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#FFF7ED' }}>
            <Clock size={28} style={{ color: '#E8621A' }} />
          </div>
          <h3 className="text-lg font-bold mb-2" style={{ color: '#1B2F5E' }}>Under Review</h3>
          <p className="text-sm text-gray-600">
            Your ID was submitted and is awaiting review. This usually takes 24-48 hours.
          </p>
        </div>

      /* Rejected — show reason, allow resubmission */
      ) : (
        <div className="p-8">
          <h3 className="text-lg font-bold mb-1" style={{ color: '#1B2F5E' }}>
            {status === 'rejected' ? 'Resubmit Your ID' : 'Verify Your ID'}
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Required once, before your first deposit or pool join. Reviewed by a real person.
          </p>

          {status === 'rejected' && user?.idRejectionReason && (
            <div className="mb-4 p-3 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700 flex items-start gap-2">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>Your previous submission was rejected: {user.idRejectionReason}</span>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SA ID Number</label>
              <input
                type="text"
                value={idNumber}
                onChange={handleIdChange}
                maxLength={13}
                placeholder="13-digit SA ID number"
                autoFocus
                className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none ${
                  idStatus?.valid === true  ? 'border-green-400 bg-green-50' :
                  idStatus?.valid === false ? 'border-red-400 bg-red-50' : 'border-gray-200'
                }`}
              />
              {idStatus?.valid === true  && <p className="text-xs text-green-600 mt-1">Valid SA ID — Age {idStatus.age}</p>}
              {idStatus?.valid === false && <p className="text-xs text-red-600 mt-1">{idStatus.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Photo of your ID document</label>
              <label className="flex items-center justify-center gap-2 w-full px-4 py-6 rounded-xl border-2 border-dashed border-gray-300 text-sm text-gray-500 cursor-pointer hover:border-gray-400 transition-colors">
                <Upload size={18} />
                {file ? file.name : 'Tap to take a photo or choose a file'}
                <input
                  type="file"
                  accept="image/*,.pdf"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              <p className="text-xs text-gray-400 mt-1">JPEG, PNG or PDF, under 5MB. Encrypted and only seen by our review team.</p>
            </div>

            <button type="submit" disabled={loading || idStatus?.valid === false || !file}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90"
              style={{ backgroundColor: loading ? '#9ca3af' : '#1B2F5E' }}>
              {loading ? 'Submitting...' : 'Submit for Review'}
            </button>
          </form>
        </div>
      )}
    </Modal>
  );
}
