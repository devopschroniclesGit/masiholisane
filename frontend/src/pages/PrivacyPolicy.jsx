import { useNavigate } from 'react-router-dom';
import { ChevronLeft, AlertTriangle } from 'lucide-react';
import Card from '../components/Card';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-5">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 -mb-2">
        <ChevronLeft size={16} /> Back
      </button>

      <h1 className="text-2xl font-bold" style={{ color: '#1B2F5E' }}>Privacy Policy</h1>

      <div className="rounded-xl p-4 flex items-start gap-3" style={{ backgroundColor: '#FFF7ED', border: '1px solid #FED7AA' }}>
        <AlertTriangle size={18} style={{ color: '#E8621A' }} className="flex-shrink-0 mt-0.5" />
        <p className="text-sm" style={{ color: '#9A3412' }}>
          <strong>Draft, not yet legally reviewed.</strong> This content is a placeholder for development and beta
          testing only. It must be reviewed against the Protection of Personal Information Act (POPIA) by a
          qualified attorney before Masiholisane is opened to the public.
        </p>
      </div>

      <Card>
        <div className="flex flex-col gap-5 text-sm text-gray-600">
          <section>
            <h2 className="font-bold text-base mb-2" style={{ color: '#1B2F5E' }}>1. What We Collect</h2>
            <p>
              Your name, phone number, SA ID number, a photo of your ID document, financial transaction records, and
              app usage data. We collect only what's needed to run your savings groups and verify your identity.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2" style={{ color: '#1B2F5E' }}>2. Why We Collect It</h2>
            <p>
              To create and run your account, verify your identity before you can deposit or join a group, process
              contributions and payouts, calculate your Trust Score, and respond to support requests.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2" style={{ color: '#1B2F5E' }}>3. Who Sees It</h2>
            <p>
              Your ID document is reviewed only by our verification team. Other group members see your name and
              contribution status, but never your ID number, ID document, or full account balance. We do not sell
              personal information to third parties.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2" style={{ color: '#1B2F5E' }}>4. How Long We Keep It</h2>
            <p>
              We retain account and transaction records for as long as your account is active, and for a period
              afterward as required by financial recordkeeping obligations.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2" style={{ color: '#1B2F5E' }}>5. Your Rights</h2>
            <p>
              You can request a copy of the personal information we hold about you, request corrections, and request
              deletion of your account via Profile. Because group savings involve obligations to other members,
              deletion requests are reviewed manually rather than processed instantly.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2" style={{ color: '#1B2F5E' }}>6. Contact</h2>
            <p>
              Questions about your data can be sent to support@masiholisane.co.za.
            </p>
          </section>
        </div>
      </Card>
    </div>
  );
}
