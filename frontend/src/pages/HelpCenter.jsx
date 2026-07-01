import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Wallet, ShieldAlert, MessageCircle } from 'lucide-react';
import Card from '../components/Card';

const OPTIONS = [
  {
    to: '/payout-help',
    label: 'I Didn\u2019t Receive My Payout',
    Icon: Wallet,
    color: '#1B2F5E',
    bg: '#EAF0FB',
  },
  {
    to: '/suspension-help',
    label: 'Why Am I Suspended?',
    Icon: ShieldAlert,
    color: '#E8621A',
    bg: '#FFF7ED',
  },
  {
    to: '/talk-to-us',
    label: 'Talk to Us',
    Icon: MessageCircle,
    color: '#3A8B2F',
    bg: '#F0FDF4',
  },
];

export default function HelpCenter() {
  const navigate = useNavigate();

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-5">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 -mb-2">
        <ChevronLeft size={16} /> Back
      </button>

      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#1B2F5E' }}>How Can We Help?</h1>
        <p className="text-sm text-gray-500 mt-1">Pick the one that matches what's going on.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {OPTIONS.map(({ to, label, Icon, color, bg }) => (
          <button
            key={to}
            onClick={() => navigate(to)}
            className="text-left"
          >
            <Card className="flex flex-col items-center text-center gap-3 py-8 hover:shadow-md transition-shadow">
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: bg }}>
                <Icon size={26} style={{ color }} />
              </div>
              <p className="text-sm font-semibold" style={{ color: '#1B2F5E' }}>{label}</p>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}
