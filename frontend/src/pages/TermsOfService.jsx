import { useNavigate } from 'react-router-dom';
import { ChevronLeft, AlertTriangle } from 'lucide-react';
import Card from '../components/Card';

export default function TermsOfService() {
  const navigate = useNavigate();

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-5">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 -mb-2">
        <ChevronLeft size={16} /> Back
      </button>

      <h1 className="text-2xl font-bold" style={{ color: '#1B2F5E' }}>Terms of Service</h1>

      <div className="rounded-xl p-4 flex items-start gap-3" style={{ backgroundColor: '#FFF7ED', border: '1px solid #FED7AA' }}>
        <AlertTriangle size={18} style={{ color: '#E8621A' }} className="flex-shrink-0 mt-0.5" />
        <p className="text-sm" style={{ color: '#9A3412' }}>
          <strong>Draft, not yet legally reviewed.</strong> This content is a placeholder for development and beta
          testing only. It must be reviewed and finalised by a qualified attorney before Masiholisane is opened to
          the public or handles real funds.
        </p>
      </div>

      <Card>
        <div className="flex flex-col gap-5 text-sm text-gray-600">
          <section>
            <h2 className="font-bold text-base mb-2" style={{ color: '#1B2F5E' }}>1. What Masiholisane Is</h2>
            <p>
              Masiholisane is a digital platform operated by SLG Trading (Pty) Ltd that helps small, fixed groups of
              members run a rotating savings arrangement (a stokvel). Each group has three members. Each member
              contributes twice and receives a payout once per three-cycle group. Masiholisane facilitates and
              records these arrangements; it does not lend money, take deposits as a bank, or guarantee returns.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2" style={{ color: '#1B2F5E' }}>2. Eligibility</h2>
            <p>
              You must be 18 or older and a holder of a valid South African ID number to use Masiholisane. We verify
              identity documents before you can deposit funds or join a savings group.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2" style={{ color: '#1B2F5E' }}>3. Fees</h2>
            <p>
              A 2% platform fee applies on withdrawal of funds to your bank account. There is no fee to deposit,
              join a group, or hold a balance in your wallet.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2" style={{ color: '#1B2F5E' }}>4. Member Responsibilities</h2>
            <p>
              You agree to make your contributions on time. If a contribution is missed, the group's security fund
              may cover it on your behalf, and your membership will be suspended until repaid. Repeated or serious
              defaults, particularly after you have already received a payout, may result in permanent suspension
              from the platform.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2" style={{ color: '#1B2F5E' }}>5. No Guarantee</h2>
            <p>
              Masiholisane facilitates a member-to-member savings arrangement. While we maintain a security fund to
              cover individual missed contributions, we do not guarantee payouts under all circumstances, including
              where multiple members default in the same group.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-2" style={{ color: '#1B2F5E' }}>6. Changes</h2>
            <p>
              We may update these terms from time to time. Material changes will be communicated to you before they
              take effect.
            </p>
          </section>
        </div>
      </Card>
    </div>
  );
}
