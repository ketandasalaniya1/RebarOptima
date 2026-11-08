import { addDays, fillTemplate, parseCsv, parseWallClock, phoneForStorage, rowToLeadInput, whatsAppUrl, zonedDayWindow } from './crm.desk.service';

describe('crm desk helpers', () => {
  it('stores a 10-digit Indian number with country code', () => {
    expect(phoneForStorage('98765 43210')).toEqual({ phone: '+919876543210', phoneKey: '9876543210' });
    expect(whatsAppUrl('+91 98765 43210', 'Hi')).toBe('https://wa.me/919876543210?text=Hi');
  });

  it('uses the project timezone for today boundaries', () => {
    const window = zonedDayWindow(new Date('2026-11-03T20:30:00.000Z'), 'Asia/Kolkata');
    expect(window.dayKey).toBe('2026-11-04');
    expect(window.start.toISOString()).toBe('2026-11-03T18:30:00.000Z');
    expect(addDays('2026-11-04', 3)).toBe('2026-11-07');
  });

  it('keeps a wall-clock appointment on the project day', () => {
    const when = parseWallClock('2026-11-03T20:30', 'Asia/Kolkata');
    if (!when) throw new Error('date');
    expect(when.toISOString()).toBe('2026-11-03T15:00:00.000Z');
    const day = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(when);
    expect(day).toBe('2026-11-03');
  });
  it('parses a lead CSV and fills a WhatsApp template', () => {
    const rows = parseCsv('Name,Phone,Interested in\n"Shah, Meera",9876543210,3BHK\n');
    expect(rowToLeadInput(rows[0])).toMatchObject({ fullName: 'Shah, Meera', phone: '9876543210', requirement: '3BHK' });
    expect(fillTemplate('Hi {{name}} at {{project}}', { customerName: 'Meera' }, 'Atria')).toBe('Hi Meera at Atria');
  });
});
