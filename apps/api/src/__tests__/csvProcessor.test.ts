import { parseCsv, computeProfile, getPreview } from '../services/csvProcessor';

describe('csvProcessor', () => {
  describe('parseCsv', () => {
    it('parses a valid CSV', () => {
      const result = parseCsv(Buffer.from('name,age\nAlice,30\nBob,25\n', 'utf-8'));
      expect(result.success).toBe(true);
      expect(result.data?.headers).toEqual(['name', 'age']);
      expect(result.data?.rowCount).toBe(2);
      expect(result.data?.columnCount).toBe(2);
    });

    it('handles quoted fields with embedded delimiters and newlines', () => {
      const csv = 'id,note\n1,"hello, world"\n2,"line one\nline two"\n';
      const result = parseCsv(Buffer.from(csv, 'utf-8'));
      expect(result.success).toBe(true);
      expect(result.data?.rows[0]?.[1]).toBe('hello, world');
      expect(result.data?.rows[1]?.[1]).toBe('line one\nline two');
    });

    it('handles escaped quotes', () => {
      const csv = 'id,quote\n1,"she said ""hi"""\n';
      const result = parseCsv(Buffer.from(csv, 'utf-8'));
      expect(result.success).toBe(true);
      expect(result.data?.rows[0]?.[1]).toBe('she said "hi"');
    });

    it('rejects empty files', () => {
      const result = parseCsv(Buffer.from('', 'utf-8'));
      expect(result.success).toBe(false);
    });

    it('rejects duplicate headers', () => {
      const result = parseCsv(Buffer.from('a,a\n1,2\n', 'utf-8'));
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Duplicate column/);
    });

    it('rejects empty headers', () => {
      const result = parseCsv(Buffer.from('a,,c\n1,2,3\n', 'utf-8'));
      expect(result.success).toBe(false);
    });

    it('rejects inconsistent row lengths', () => {
      const result = parseCsv(Buffer.from('a,b\n1,2,3\n', 'utf-8'));
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Row 2/);
    });

    it('keeps empty values as empty strings', () => {
      const result = parseCsv(Buffer.from('a,b\n1,\n,2\n', 'utf-8'));
      expect(result.success).toBe(true);
      expect(result.data?.rows[0]?.[1]).toBe('');
      expect(result.data?.rows[1]?.[0]).toBe('');
    });
  });

  describe('computeProfile', () => {
    it('computes numeric stats for an integer column', () => {
      const parsed = parseCsv(Buffer.from('n\n1\n2\n3\n4\n', 'utf-8'));
      expect(parsed.success).toBe(true);
      const profile = computeProfile(parsed.data!);
      const col = profile.columns[0]!;
      expect(col.type).toBe('integer');
      expect(col.numericStats?.count).toBe(4);
      expect(col.numericStats?.mean).toBeCloseTo(2.5);
      expect(col.numericStats?.median).toBeCloseTo(2.5);
      expect(col.numericStats?.min).toBe(1);
      expect(col.numericStats?.max).toBe(4);
    });

    it('computes categorical top values', () => {
      const parsed = parseCsv(Buffer.from('color\nred\nblue\nred\nred\n', 'utf-8'));
      expect(parsed.success).toBe(true);
      const profile = computeProfile(parsed.data!);
      const col = profile.columns[0]!;
      expect(col.type).toBe('string');
      expect(col.categoricalStats?.distinctCount).toBe(2);
      expect(col.categoricalStats?.topValues[0]).toMatchObject({ value: 'red', count: 3 });
    });

    it('handles fully-empty columns without NaN', () => {
      const parsed = parseCsv(Buffer.from('a,b\n,x\n,y\n', 'utf-8'));
      expect(parsed.success).toBe(true);
      const profile = computeProfile(parsed.data!);
      expect(profile.columns[0]!.nullCount).toBe(2);
      expect(profile.columns[0]!.nonNullCount).toBe(0);
      const serialized = JSON.parse(JSON.stringify(profile)) as typeof profile;
      expect(JSON.stringify(serialized)).not.toMatch(/NaN/);
    });

    it('handles datasets with multiple columns and missing values', () => {
      const parsed = parseCsv(Buffer.from('a,b,c\n1,x,\n2,,3\n, y,4\n', 'utf-8'));
      expect(parsed.success).toBe(true);
      const profile = computeProfile(parsed.data!);
      expect(profile.rowCount).toBe(3);
      expect(profile.columnCount).toBe(3);
      expect(profile.totalCells).toBe(9);
      expect(profile.missingCells).toBeGreaterThan(0);
      expect(profile.missingPercentage).toBeGreaterThan(0);
    });

    it('never produces NaN or Infinity in JSON output', () => {
      const parsed = parseCsv(Buffer.from('x\n0\n0\n0\n', 'utf-8'));
      const profile = computeProfile(parsed.data!);
      const json = JSON.stringify(profile);
      expect(json).not.toMatch(/NaN/);
      expect(json).not.toMatch(/Infinity/);
    });
  });

  describe('getPreview', () => {
    it('respects limit and offset', () => {
      const parsed = parseCsv(Buffer.from('a\n1\n2\n3\n4\n5\n', 'utf-8'));
      const preview = getPreview(parsed.data!, 2, 1);
      expect(preview.rows).toEqual([['2'], ['3']]);
      expect(preview.totalRows).toBe(5);
      expect(preview.previewRowCount).toBe(2);
    });
  });
});
