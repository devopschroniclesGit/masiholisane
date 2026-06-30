import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import * as XLSX from 'xlsx';
import { Download } from 'lucide-react';

export default function AdminReports() {
  const navigate = useNavigate();
  const [report, setReport]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    api.get('/admin/dashboard/reports/revenue', {
      headers: { Authorization: `Bearer ${token}` },
    }).then(res => setReport(res.data.data))
      .catch(() => navigate('/admin/login'))
      .finally(() => setLoading(false));
  }, []);

  const fmt = (c) => 'R' + ((c || 0) / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2 });

  function downloadExcel() {
    if (!report) return;
    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summaryData = [
      ['Metric', 'Amount (Rands)'],
      ['Total Contributions', (report.summary.totalContributions / 100).toFixed(2)],
      ['Total Payouts',        (report.summary.totalPayouts / 100).toFixed(2)],
      ['Platform Revenue',     (report.summary.platformFeesCollected / 100).toFixed(2)],
      ['Security Deposits Held', (report.summary.securityDepositsHeld / 100).toFixed(2)],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), 'Summary');

    // Monthly breakdown
    const monthlyData = [
      ['Month', 'Contributions (R)', 'Platform Fees (R)', 'Payouts (R)'],
      ...Object.entries(report.monthly).sort().reverse().map(([month, d]) => [
        month,
        (d.contributions / 100).toFixed(2),
        (d.fees / 100).toFixed(2),
        (d.payouts / 100).toFixed(2),
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(monthlyData), 'Monthly Breakdown');

    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `masiholisane-report-${today}.xlsx`);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-gray-400 animate-pulse">Loading reports...</p>
    </div>
  );

  const s = report?.summary || {};

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: '#1B2F5E' }}>Revenue Reports</h1>
        <button onClick={downloadExcel}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold hover:opacity-90"
          style={{ backgroundColor: '#3A8B2F' }}>
          <Download size={16} />
          Download Excel
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Contributions', value: fmt(s.totalContributions),    color: '#1B2F5E' },
          { label: 'Total Payouts',        value: fmt(s.totalPayouts),          color: '#3A8B2F' },
          { label: 'Platform Revenue',     value: fmt(s.platformFeesCollected), color: '#E8621A' },
          { label: 'Security Deposits',    value: fmt(s.securityDepositsHeld),  color: '#1B2F5E' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
            <p className="text-xs text-gray-500 mb-1">{card.label}</p>
            <p className="text-xl font-bold" style={{ color: card.color }}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-bold" style={{ color: '#1B2F5E' }}>Monthly Breakdown</h2>
        </div>
        {Object.keys(report?.monthly || {}).length === 0 ? (
          <p className="text-center py-8 text-gray-400 text-sm">No transaction data yet</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#F5F7FA' }}>
                {['Month', 'Contributions', 'Platform Fees', 'Payouts'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(report.monthly).sort().reverse().map(([month, d]) => (
                <tr key={month} className="border-t border-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-700">{month}</td>
                  <td className="px-5 py-3 text-gray-600">{fmt(d.contributions)}</td>
                  <td className="px-5 py-3 font-semibold" style={{ color: '#E8621A' }}>{fmt(d.fees)}</td>
                  <td className="px-5 py-3 font-semibold" style={{ color: '#3A8B2F' }}>{fmt(d.payouts)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
