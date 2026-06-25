import { useState, useEffect } from 'react';

export default function Countdown({ targetDate, label }) {
  const [days, setDays] = useState(0);

  useEffect(() => {
    function update() {
      const diff = new Date(targetDate) - new Date();
      setDays(Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24))));
    }
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [targetDate]);

  const color = days <= 3 ? '#E8621A' : days <= 7 ? '#f59e0b' : '#3A8B2F';

  return (
    <div className="text-center">
      <div className="text-3xl font-bold" style={{ color }}>
        {days}
      </div>
      <div className="text-xs text-gray-500">{label || 'days'}</div>
    </div>
  );
}
