import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ShieldX, FileText, Loader2 } from 'lucide-react';
import { adminVerificationAPI } from '../../services/api';

export default function AdminVerifications() {
  const navigate = useNavigate();
  const [status, setStatus]     = useState('pending');
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null);
  const [docUrl, setDocUrl]     = useState(null);
  const [docLoading, setDocLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason]   = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  function load() {
    setLoading(true);
    adminVerificationAPI.list(status)
      .then(res => setUsers(res.data.data.users || []))
      .catch(() => navigate('/admin/login'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [status]);

  useEffect(() => {
    if (!selected) { setDocUrl(null); return; }
    setDocLoading(true);
    setShowRejectForm(false);
    setRejectReason('');
    adminVerificationAPI.getDocumentBlob(selected.id)
      .then(res => setDocUrl(URL.createObjectURL(res.data)))
      .catch(() => setDocUrl(null))
      .finally(() => setDocLoading(false));

    return () => { if (docUrl) URL.revokeObjectURL(docUrl); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  async function handleApprove() {
    if (!selected) return;
    setActionLoading(true);
    try {
      await adminVerificationAPI.approve(selected.id);
      setSelected(null);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Approval failed');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject() {
    if (!selected || !rejectReason.trim()) return;
    setActionLoading(true);
    try {
      await adminVerificationAPI.reject(selected.id, rejectReason.trim());
      setSelected(null);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Rejection failed');
    } finally {
      setActionLoading(false);
    }
  }

  const isPdf = selected?.idDocumentPath?.toLowerCase().endsWith('.pdf');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1B2F5E' }}>ID Verifications</h1>
          <p className="text-gray-500 text-sm">{users.length} {status}</p>
        </div>
        <div className="flex gap-2">
          {['pending', 'approved', 'rejected'].map(s => (
            <button key={s}
              onClick={() => { setStatus(s); setSelected(null); }}
              className="px-4 py-2 rounded-xl text-sm font-medium capitalize transition-colors"
              style={{
                backgroundColor: status === s ? '#1B2F5E' : 'white',
                color: status === s ? 'white' : '#1B2F5E',
                border: '1px solid #1B2F5E',
              }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* List */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <p className="text-center py-8 text-gray-400 text-sm">Loading...</p>
          ) : users.length === 0 ? (
            <p className="text-center py-8 text-gray-400 text-sm">No {status} submissions</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {users.map(u => (
                <button key={u.id}
                  onClick={() => setSelected(u)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center justify-between gap-2"
                  style={{ backgroundColor: selected?.id === u.id ? '#EAF0FB' : 'transparent' }}>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{u.name}</p>
                    <p className="text-xs text-gray-400">{u.email || u.phone}</p>
                  </div>
                  <span className="text-xs text-gray-400">
                    {u.idSubmittedAt ? new Date(u.idSubmittedAt).toLocaleDateString('en-ZA') : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail */}
        <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          {!selected ? (
            <p className="text-center py-16 text-gray-400 text-sm">Select a submission to review</p>
          ) : (
            <div className="flex flex-col gap-4">
              <div>
                <p className="font-bold text-lg" style={{ color: '#1B2F5E' }}>{selected.name}</p>
                <p className="text-sm text-gray-500">{selected.email || selected.phone}</p>
                <p className="text-sm text-gray-500 mt-1">ID Number: <span className="font-mono">{selected.idNumber || '—'}</span></p>
              </div>

              <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center" style={{ minHeight: 320 }}>
                {docLoading ? (
                  <Loader2 size={28} className="animate-spin text-gray-400" />
                ) : !docUrl ? (
                  <div className="text-center text-gray-400 text-sm p-8">
                    <FileText size={32} className="mx-auto mb-2" />
                    No document available
                  </div>
                ) : isPdf ? (
                  <iframe src={docUrl} title="ID document" className="w-full" style={{ height: 420 }} />
                ) : (
                  <img src={docUrl} alt="ID document" className="max-w-full max-h-[420px] object-contain" />
                )}
              </div>

              {status === 'pending' && (
                showRejectForm ? (
                  <div className="flex flex-col gap-3">
                    <textarea
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      placeholder="Reason for rejection (shown to the member)"
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none"
                    />
                    <div className="flex gap-3">
                      <button onClick={() => setShowRejectForm(false)} disabled={actionLoading}
                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600">
                        Cancel
                      </button>
                      <button onClick={handleReject} disabled={actionLoading || !rejectReason.trim()}
                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
                        style={{ backgroundColor: actionLoading || !rejectReason.trim() ? '#9ca3af' : '#dc2626' }}>
                        {actionLoading ? 'Submitting...' : 'Confirm Rejection'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button onClick={() => setShowRejectForm(true)} disabled={actionLoading}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                      style={{ backgroundColor: 'transparent', color: '#dc2626', border: '2px solid #dc2626' }}>
                      <ShieldX size={16} /> Reject
                    </button>
                    <button onClick={handleApprove} disabled={actionLoading}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
                      style={{ backgroundColor: actionLoading ? '#9ca3af' : '#3A8B2F' }}>
                      <ShieldCheck size={16} /> {actionLoading ? 'Approving...' : 'Approve'}
                    </button>
                  </div>
                )
              )}

              {status === 'rejected' && selected.idRejectionReason && (
                <div className="p-3 rounded-xl text-sm bg-red-50 border border-red-200 text-red-700">
                  Rejected: {selected.idRejectionReason}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
