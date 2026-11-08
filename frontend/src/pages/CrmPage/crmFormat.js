export function formatWhen(value, timeZone) {
  if (!value) return 'No date';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'No date';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: timeZone || 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

export function formatClock(value, timeZone) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: timeZone || 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

export function stageTone(stage) {
  const s = String(stage || '').toLowerCase();
  if (s.includes('negot')) return 'neg';
  if (s.includes('visit')) return 'visit';
  if (s === 'booked') return 'won';
  if (s === 'lost') return 'lost';
  if (s === 'new') return 'new';
  return 'follow';
}

export function formatDay(value, timeZone) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone || 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function fillTemplate(body, lead, projectName) {
  return String(body || '')
    .replaceAll('{{name}}', lead?.customerName || '')
    .replaceAll('{{project}}', projectName || lead?.projectName || '')
    .replaceAll('{{interest}}', lead?.requirement || lead?.unitCode || 'your requirement');
}

export function whatsAppUrl(phone, text) {
  const digits = String(phone || '').replace(/\D/g, '');
  const num = digits.length === 10 ? `91${digits}` : (digits.startsWith('0') ? digits.slice(1) : digits);
  return `https://wa.me/${num}?text=${encodeURIComponent(text || '')}`;
}
