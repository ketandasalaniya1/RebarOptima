import { parseCsvCutLines } from './predefined-cuts.routes';

describe('parseCsvCutLines', () => {
  it('parses standard comma-separated CSV with headers', () => {
    const csv = `Diameter, Length, Quantity, Label
12, 3500, 10, Beam-B1
16, 4200, 8, Column-C1
20, 5800, 15, Footing-F2`;

    const { items, errors } = parseCsvCutLines(csv, 'Test Schedule');
    expect(errors).toHaveLength(0);
    expect(items).toHaveLength(3);

    expect(items[0]).toEqual({
      diameter: 12,
      length: 3500,
      quantity: 10,
      label: 'Beam-B1',
      groupName: 'Test Schedule',
    });

    expect(items[1]).toEqual({
      diameter: 16,
      length: 4200,
      quantity: 8,
      label: 'Column-C1',
      groupName: 'Test Schedule',
    });
  });

  it('handles units in diameter and lengths (e.g. 12mm)', () => {
    const csv = `12mm, 2500, 5, Stirrup
16 mm, 3000 mm, 4, Link`;

    const { items, errors } = parseCsvCutLines(csv, 'My Group');
    expect(errors).toHaveLength(0);
    expect(items).toHaveLength(2);
    expect(items[0].diameter).toBe(12);
    expect(items[0].length).toBe(2500);
    expect(items[1].diameter).toBe(16);
    expect(items[1].length).toBe(3000);
  });

  it('handles tab and semicolon delimiters', () => {
    const csvTab = `12\t3500\t5\tPart A
16;4000;6;Part B`;

    const { items, errors } = parseCsvCutLines(csvTab);
    expect(errors).toHaveLength(0);
    expect(items).toHaveLength(2);
    expect(items[0].diameter).toBe(12);
    expect(items[0].length).toBe(3500);
    expect(items[1].diameter).toBe(16);
    expect(items[1].length).toBe(4000);
  });

  it('collects error for invalid rows without throwing', () => {
    const csv = `12, invalid_length, 5, Bad Part
invalid_dia, 3000, 2, Bad Dia
16, 4000, 8, Good Part`;

    const { items, errors } = parseCsvCutLines(csv);
    expect(errors.length).toBeGreaterThanOrEqual(2);
    expect(items).toHaveLength(1);
    expect(items[0].diameter).toBe(16);
    expect(items[0].length).toBe(4000);
  });

  it('returns empty array on empty input', () => {
    const { items, errors } = parseCsvCutLines('');
    expect(items).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });
});

