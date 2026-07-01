import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronDown, ShieldCheck, Banknote, Repeat, Users } from 'lucide-react';
import Card from '../components/Card';

const SECTIONS = [
  {
    title: 'Getting Started',
    Icon: Users,
    items: [
      {
        q: 'How does the rotation system work?',
        a: 'Each Masiholisane group has 3 members. Every member receives one payout during the group\'s cycle. Each member contributes twice and receives once, so it\'s fair for everyone.',
      },
      {
        q: 'How many people are in a group?',
        a: 'Each group has exactly 3 members. Keeping groups small means faster payouts, shorter waiting periods, lower risk of defaults, and easier accountability.',
      },
      {
        q: 'How much do I contribute?',
        a: 'Your contribution depends on your tier. Starter is R500 per contribution (R1,000 total, R1,000 payout). Builder is R1,000 per contribution (R2,000 total, R2,000 payout). Wealth is R2,000 per contribution (R4,000 total, R4,000 payout).',
      },
      {
        q: 'Do I need to verify my ID?',
        a: 'Yes. You can browse the app right after signing up, but you must verify your South African ID before you can join a group or withdraw funds. This is a one-time photo upload reviewed by our team, usually within 24 to 48 hours. It\'s how we keep the platform safe for everyone\'s money.',
      },
    ],
  },
  {
    title: 'Payouts & Positions',
    Icon: Repeat,
    items: [
      {
        q: 'When do I receive my payout?',
        a: 'Each member is assigned a payout position before the group starts. For example, Member 1 receives in Month 1, Member 2 in Month 2, Member 3 in Month 3.',
      },
      {
        q: 'How is the payout order decided?',
        a: 'The payout order is assigned when the group is formed, and it\'s visible to all members before the group begins.',
      },
      {
        q: 'Can I choose my payout position?',
        a: 'Not directly, positions are assigned when the group forms. If you\'d prefer a different position, you can send another member a swap request. If they accept, your positions exchange.',
      },
      {
        q: 'Do I contribute during the month I receive my payout?',
        a: 'No. When it\'s your payout month, you don\'t contribute. The other two members\' contributions for that month form your payout.',
      },
      {
        q: 'Can I withdraw my payout immediately?',
        a: 'Yes. Once your payout lands in your wallet, you can withdraw it to your bank account at any time. A 2% withdrawal fee applies.',
      },
    ],
  },
  {
    title: 'Trust, Safety & Money',
    Icon: ShieldCheck,
    items: [
      {
        q: 'Why is my contribution reserved when I join?',
        a: 'Your contribution is reserved the moment you join to confirm your commitment, stop you over-committing across multiple groups, and make sure groups can start without funding delays.',
      },
      {
        q: 'Is my money safe?',
        a: 'Your reserved contributions are held securely until your group becomes active, and every transaction is recorded and visible in your wallet history.',
      },
      {
        q: 'What if another member doesn\'t pay?',
        a: 'Your group\'s security fund covers one missed contribution, so the rest of the group still gets paid on time, no delays for you. The member who missed payment has their membership suspended until they repay. If it happens after they\'ve already received their own payout, the suspension is permanent.',
      },
      {
        q: 'What happens if I miss a contribution?',
        a: 'It affects the whole group, so we take it seriously. Consequences can include a reduced Trust Score, suspension from joining new groups, and delayed access to higher tiers, until the missed amount is repaid.',
      },
      {
        q: 'Can I leave after receiving my payout?',
        a: 'No. Joining a group is a commitment to complete the full cycle. Leaving or stopping contributions after receiving your payout can result in your account being suspended until outstanding contributions are settled.',
      },
    ],
  },
  {
    title: 'Trust Score & Tiers',
    Icon: Banknote,
    items: [
      {
        q: 'Why do I need a Trust Score?',
        a: 'Your Trust Score helps build a reliable community. Paying on time and completing groups raises your score, which unlocks access to higher contribution tiers.',
      },
      {
        q: 'Can I move to a higher tier?',
        a: 'Yes. Starter needs a score of 10 (the ID verification floor), Builder needs 50, and Wealth needs 70. Completing a full Starter cycle on time is usually enough to unlock Builder on its own.',
      },
      {
        q: 'Why do I still contribute after receiving my payout?',
        a: 'Masiholisane is built on members helping each other. If you receive your payout early in the cycle, you continue your remaining scheduled contribution so the other members can receive theirs too.',
      },
    ],
  },
  {
    title: 'Groups',
    Icon: Users,
    items: [
      {
        q: 'Why are groups limited to three members?',
        a: 'Small groups mean faster access to payouts, shorter commitment periods, lower default risk, and better accountability between members.',
      },
      {
        q: 'How many groups can I join at once?',
        a: 'Up to 2 active or forming groups at a time, and you can\'t join two groups in the same tier simultaneously. This keeps your commitments manageable.',
      },
      {
        q: 'What happens when my group is complete?',
        a: 'Once all three members have received their payouts and completed their contributions, the group closes automatically. You can then join another group right away, subject to availability and your Trust Score.',
      },
    ],
  },
];

function AccordionItem({ q, a, isOpen, onToggle }) {
  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 py-3.5 text-left"
      >
        <span className="text-sm font-medium text-gray-800">{q}</span>
        <ChevronDown
          size={16}
          className="flex-shrink-0 text-gray-400 transition-transform"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>
      {isOpen && (
        <p className="text-sm text-gray-500 pb-4 pr-6 leading-relaxed">{a}</p>
      )}
    </div>
  );
}

export default function FAQ() {
  const navigate = useNavigate();
  const [openKey, setOpenKey] = useState(null);

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-5">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 -mb-2">
        <ChevronLeft size={16} /> Back
      </button>

      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#1B2F5E' }}>Frequently Asked Questions</h1>
        <p className="text-sm text-gray-500 mt-1">Everything about how groups, payouts and Trust Score work.</p>
      </div>

      {SECTIONS.map((section) => (
        <Card key={section.title}>
          <div className="flex items-center gap-2 mb-1">
            <section.Icon size={16} style={{ color: '#1B2F5E' }} />
            <h2 className="font-bold text-sm" style={{ color: '#1B2F5E' }}>{section.title}</h2>
          </div>
          <div>
            {section.items.map((item) => {
              const key = `${section.title}-${item.q}`;
              return (
                <AccordionItem
                  key={key}
                  q={item.q}
                  a={item.a}
                  isOpen={openKey === key}
                  onToggle={() => setOpenKey(openKey === key ? null : key)}
                />
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}
