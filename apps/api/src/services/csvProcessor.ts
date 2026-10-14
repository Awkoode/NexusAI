import Papa from 'papaparse';

export type ColumnType = 'integer' | 'float' | 'boolean' | 'date' | 'datetime' | 'string';

export interface ColumnProfile {
  name: string;
  index: number;
  type: ColumnType;
  nonNullCount: number;
  nullCount: number;
  distinctCount: number;
  // Numeric stats
  numericStats?: {
    count: number;
    mean: number;
    median: number;
    stdDev: number;
    min: number;
    max: number;
    q1: number;
    q3: number;
    distinctCount: number;
  };
  // Categorical stats
  categoricalStats?: {
    count: number;
    distinctCount: number;
    topValues: { value: string; count: number; frequency: number }[];
  };
}

export interface DatasetProfile {
  rowCount: number;
  columnCount: number;
  totalCells: number;
  missingCells: number;
  missingPercentage: number;
  numericColumnCount: number;
  categoricalColumnCount: number;
  columns: ColumnProfile[];
}

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  columnCount: number;
  rowCount: number;
}

export interface ParseResult {
  success: boolean;
  data?: ParsedCsv;
  error?: string;
}

const MAX_ROWS = 1_000_000;
const MAX_COLUMNS = 500;
const MAX_FIELD_LENGTH = 10_000;
const MAX_PREVIEW_ROWS = 100;
const MAX_TOP_CATEGORIES = 50;

/**
 * Parse CSV buffer with validation and safety limits
 */
export function parseCsv(buffer: Buffer): ParseResult {
  try {
    const content = buffer.toString('utf-8');

    // Check for BOM and remove it
    const cleanContent = content.replace(/^\uFEFF/, '');

    const result = Papa.parse<string[]>(cleanContent, {
      header: false,
      skipEmptyLines: 'greedy',
      transformHeader: (h: string) => h.trim(),
    });

    if (result.errors.length > 0 && result.data.length === 0) {
      return { success: false, error: 'Failed to parse CSV: ' + result.errors[0]!.message };
    }

    if (result.data.length === 0) {
      return { success: false, error: 'CSV file is empty or contains no data' };
    }

    const [headers, ...rows] = result.data;

    if (!headers || headers.length === 0) {
      return { success: false, error: 'CSV has no header row' };
    }

    // Validate column count
    if (headers.length > MAX_COLUMNS) {
      return { success: false, error: `CSV exceeds maximum of ${MAX_COLUMNS} columns` };
    }

    // Validate row count
    if (rows.length > MAX_ROWS) {
      return { success: false, error: `CSV exceeds maximum of ${MAX_ROWS} rows` };
    }

    // Check for empty or duplicate headers
    const headerSet = new Set<string>();
    for (const h of headers) {
      const trimmed = h.trim();
      if (!trimmed) {
        return { success: false, error: 'CSV contains empty column names in header' };
      }
      if (headerSet.has(trimmed)) {
        return { success: false, error: `Duplicate column name in header: "${trimmed}"` };
      }
      headerSet.add(trimmed);
    }

    // Validate row lengths
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      if (row.length !== headers.length) {
        return {
          success: false,
          error: `Row ${i + 2} has ${row.length} fields but header has ${headers.length} columns`,
        };
      }

      // Check field lengths
      for (const field of row) {
        if (field && field.length > MAX_FIELD_LENGTH) {
          return { success: false, error: `Field exceeds maximum length of ${MAX_FIELD_LENGTH} characters` };
        }
      }
    }

    return {
      success: true,
      data: {
        headers,
        rows,
        columnCount: headers.length,
        rowCount: rows.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: 'Failed to parse CSV: ' + (error instanceof Error ? error.message : 'Unknown error'),
    };
  }
}

/**
 * Detect column type based on values
 */
function detectColumnType(values: string[]): ColumnType {
  const nonEmpty = values.filter((v) => v !== '' && v !== null && v !== undefined);
  if (nonEmpty.length === 0) return 'string';

  // Check if all values are valid integers
  const allIntegers = nonEmpty.every((v) => /^-?\d+$/.test(v));
  if (allIntegers) return 'integer';

  // Check if all values are valid floats
  const allFloats = nonEmpty.every((v) => /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(v));
  if (allFloats) return 'float';

  // Check if all values are booleans
  const boolValues = new Set(['true', 'false', '0', '1', 'yes', 'no']);
  const allBooleans = nonEmpty.every((v) => boolValues.has(v.toLowerCase()));
  if (allBooleans) return 'boolean';

  // Check if all values are dates
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const allDates = nonEmpty.every((v) => dateRegex.test(v));
  if (allDates) return 'date';

  // Check if all values are datetimes
  const datetimeRegex = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;
  const allDatetimes = nonEmpty.every((v) => datetimeRegex.test(v));
  if (allDatetimes) return 'datetime';

  return 'string';
}

/**
 * Calculate descriptive statistics for parsed CSV data
 */
export function computeProfile(parsed: ParsedCsv): DatasetProfile {
  const { headers, rows } = parsed;
  const rowCount = rows.length;
  const columnCount = headers.length;
  const totalCells = rowCount * columnCount;

  let missingCells = 0;
  const columns: ColumnProfile[] = [];

  for (let colIdx = 0; colIdx < columnCount; colIdx++) {
    const columnName = headers[colIdx]!;
    const values: string[] = [];
    const valueCounts = new Map<string, number>();
    let nullCount = 0;

    for (const row of rows) {
      const val = row[colIdx] ?? '';
      values.push(val);
      if (val === '') {
        nullCount++;
      } else {
        valueCounts.set(val, (valueCounts.get(val) ?? 0) + 1);
      }
    }

    const nonNullCount = rowCount - nullCount;
    const distinctCount = valueCounts.size;
    const type = detectColumnType(values);

    if (type === 'integer' || type === 'float') {
      const numericValues = values
        .filter((v) => v !== '')
        .map((v) => Number(v))
        .filter((v) => !Number.isNaN(v) && Number.isFinite(v));

      if (numericValues.length > 0) {
        numericValues.sort((a, b) => a - b);
        const count = numericValues.length;
        const sum = numericValues.reduce((acc, v) => acc + v, 0);
        const mean = sum / count;
        const median = count % 2 === 0
          ? (numericValues[count / 2 - 1]! + numericValues[count / 2]!) / 2
          : numericValues[Math.floor(count / 2)]!;
        const variance = numericValues.reduce((acc, v) => acc + (v - mean) ** 2, 0) / count;
        const stdDev = Math.sqrt(variance);
        const min = numericValues[0]!;
        const max = numericValues[count - 1]!;
        const q1 = numericValues[Math.floor(count * 0.25)]!;
        const q3 = numericValues[Math.floor(count * 0.75)]!;

        columns.push({
          name: columnName,
          index: colIdx,
          type,
          nonNullCount,
          nullCount,
          distinctCount,
          numericStats: {
            count,
            mean: Number.isFinite(mean) ? mean : 0,
            median: Number.isFinite(median) ? median : 0,
            stdDev: Number.isFinite(stdDev) ? stdDev : 0,
            min,
            max,
            q1,
            q3,
            distinctCount: new Set(numericValues).size,
          },
        });
      } else {
        columns.push({
          name: columnName,
          index: colIdx,
          type,
          nonNullCount,
          nullCount,
          distinctCount,
        });
      }
    } else {
      // Categorical column
      const sortedEntries = [...valueCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_TOP_CATEGORIES);

      const totalNonNull = [...valueCounts.values()].reduce((acc, v) => acc + v, 0);

      columns.push({
        name: columnName,
        index: colIdx,
        type,
        nonNullCount,
        nullCount,
        distinctCount,
        categoricalStats: {
          count: nonNullCount,
          distinctCount,
          topValues: sortedEntries.map(([value, count]) => ({
            value,
            count,
            frequency: totalNonNull > 0 ? count / totalNonNull : 0,
          })),
        },
      });
    }

    missingCells += nullCount;
  }

  const numericColumnCount = columns.filter((c) => c.numericStats).length;
  const categoricalColumnCount = columns.length - numericColumnCount;

  return {
    rowCount,
    columnCount,
    totalCells,
    missingCells,
    missingPercentage: totalCells > 0 ? (missingCells / totalCells) * 100 : 0,
    numericColumnCount,
    categoricalColumnCount,
    columns,
  };
}

/**
 * Get a preview of rows from parsed CSV
 */
export function getPreview(parsed: ParsedCsv, limit = MAX_PREVIEW_ROWS, offset = 0): {
  headers: string[];
  rows: string[][];
  totalRows: number;
  previewRowCount: number;
} {
  const rows = parsed.rows.slice(offset, offset + limit);
  return {
    headers: parsed.headers,
    rows,
    totalRows: parsed.rows.length,
    previewRowCount: rows.length,
  };
}

export const LIMITS = {
  MAX_ROWS,
  MAX_COLUMNS,
  MAX_FIELD_LENGTH,
  MAX_PREVIEW_ROWS,
  MAX_TOP_CATEGORIES,
} as const;