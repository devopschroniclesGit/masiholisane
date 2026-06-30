import { Sprout, TrendingUp, Crown } from 'lucide-react';

const TIER_ICONS = { 1: Sprout, 2: TrendingUp, 3: Crown };
const TIER_NAMES = { 1: 'Starter', 2: 'Builder', 3: 'Wealth' };

export default function TierBadge({ tier, showName = false, size = 'normal', color = '#1B2F5E' }) {
  const Icon = TIER_ICONS[tier];
  if (!Icon) return null;

  const iconSize = size === 'small' ? 10 : 12;
  const padding  = size === 'small' ? 'px-2 py-0.5 text-xs' : 'px-2 py-1 text-xs';

  return (
    <span className={`inline-flex items-center gap-1 font-bold rounded-full text-white ${padding}`}
          style={{ backgroundColor: color }}>
      <Icon size={iconSize} />
      TIER {tier}{showName && ` ${TIER_NAMES[tier]}`}
    </span>
  );
}
