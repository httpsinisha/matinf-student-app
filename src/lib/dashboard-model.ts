type Lesson = { day: number; start: string; end: string };
const minutes = (value: string) => { const [hour, minute] = value.split(':').map(Number); return hour * 60 + minute; };

export function dailyAgenda<T extends Lesson>(items: T[], now: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Sarajevo', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const part = (name: string) => parts.find(p => p.type === name)?.value || '';
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(part('weekday'));
  const current = Number(part('hour')) * 60 + Number(part('minute'));
  const today = items.filter(item => item.day === weekday).sort((a, b) => a.start.localeCompare(b.start));
  const next = items.map(item => {
    let offset = (item.day - weekday + 7) % 7;
    if (!offset && minutes(item.end) <= current) offset = 7;
    return { ...item, offset };
  }).sort((a, b) => a.offset - b.offset || a.start.localeCompare(b.start))[0];
  return { today, next, running: !!next && next.offset === 0 && minutes(next.start) <= current };
}
