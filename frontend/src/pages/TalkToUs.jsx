import { useNavigate } from 'react-router-dom';
import { MessageCircle, Phone, Clock, ChevronLeft } from 'lucide-react';
import Card from '../components/Card';
import Button from '../components/Button';

// TODO: replace with the real WhatsApp Business number and support line before beta launch.
const WHATSAPP_NUMBER = '27000000000'; // placeholder — international format, no leading +
const SUPPORT_PHONE_DISPLAY = '000 000 0000'; // placeholder

export default function TalkToUs() {
  const navigate = useNavigate();

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-5">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 -mb-2">
        <ChevronLeft size={16} /> Back
      </button>

      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#1B2F5E' }}>Talk to Us</h1>
        <p className="text-sm text-gray-500 mt-1">Real humans, not a bot.</p>
      </div>

      <Card>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
          <Clock size={16} />
          <span>Monday to Sunday, 08:00 - 20:00 (including public holidays)</span>
        </div>

        <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Hi, I need help with my Masiholisane account.')}`}
           target="_blank" rel="noopener noreferrer">
          <Button variant="green" className="w-full flex items-center justify-center gap-2 mb-3">
            <MessageCircle size={18} /> Message us on WhatsApp
          </Button>
        </a>

        <a href={`tel:${WHATSAPP_NUMBER}`}>
          <Button variant="outline" className="w-full flex items-center justify-center gap-2">
            <Phone size={18} /> Call {SUPPORT_PHONE_DISPLAY}
          </Button>
        </a>
      </Card>

      <Card>
        <p className="text-sm text-gray-500">
          For payout or suspension questions, our self-help screens can usually answer it instantly —
          try those first from your Profile page before messaging us.
        </p>
      </Card>
    </div>
  );
}
