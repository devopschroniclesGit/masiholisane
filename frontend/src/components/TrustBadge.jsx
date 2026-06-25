export default function TrustBadge({ score, tier }) {
  const tierConfig = {
    restricted:  { label: 'Restricted',   color: '#dc2626' },
    new:         { label: 'New Member',    color: '#f59e0b' },
    trusted:     { label: 'Trusted',       color: '#3A8B2F' },
    good:        { label: 'Good Standing', color: '#1B2F5E' },
    elite:       { label: 'Elite',         color: '#E8621A' },
  };

  const config = tierConfig[tier] || tierConfig.restricted;
  const pct    = Math.min(100, score);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold" style={{ color: config.color }}>
          {config.label}
        </span>
        <span className="text-sm font-bold" style={{ color: config.color }}>
          {score}/100
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: config.color }}
        />
      </div>
    </div>
  );
}
