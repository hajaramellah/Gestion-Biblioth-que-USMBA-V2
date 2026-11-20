export function getDaysDifference(fromDateStr: string, toDateStr: string): number {
  const from = new Date(fromDateStr + 'T00:00:00');
  const to = new Date(toDateStr + 'T00:00:00');
  const diffMs = to.getTime() - from.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function getOverdueDays(dueDateStr: string, currentDateStr: string): number {
  const diff = getDaysDifference(dueDateStr, currentDateStr);
  return diff > 0 ? diff : 0;
}

export function formatCurrentTimestamp(): {
  date: string;
  time: string;
  display: string;
  iso: string;
  dayKey: string;
} {
  const now = new Date();
  const date = now.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const time = now.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const iso = now.toISOString();
  const dayKey = iso.split('T')[0];

  return {
    date,
    time,
    display: `${date} · ${time}`,
    iso,
    dayKey,
  };
}
