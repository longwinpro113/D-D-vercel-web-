export const formatDateInputValue = (dateString?: string | null) => {
  if (!dateString) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString;
  const parts = dateString.split("/");
  if (parts.length !== 3) return "";
  const [day, month, year] = parts;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
};

export const formatVnDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("vi-VN");
};

export const formatVnDateTime = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour12: false,
  });
};

type WithExportDate = {
  export_date?: string | null;
};

type WithRyNumber = {
  ry_number?: string | null;
  updated_at?: string | null;
  export_date?: string | null;
  created_at?: string | null;
};

export const groupByDate = <T extends WithExportDate>(rows: T[]) => {
  const map = new Map<string, T[]>();
  rows.forEach((row) => {
    const date = row.export_date || "";
    if (!map.has(date)) map.set(date, []);
    map.get(date)!.push(row);
  });
  return Array.from(map.entries()).map(([date, groupRows]) => ({ date, rows: groupRows }));
};

export const getLatestRowsByRyNumber = <T extends WithRyNumber>(rows: T[]) => {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const map = new Map<string, { row: T; score: number; index: number }>();

  rows.forEach((row, index) => {
    const ryNumber = row.ry_number || `__row_${index}`;
    const score = new Date(row.updated_at || row.export_date || row.created_at || 0).getTime();
    const safeScore = Number.isFinite(score) ? score : -1;
    const current = map.get(ryNumber);

    if (!current || safeScore > current.score || (safeScore === current.score && index > current.index)) {
      map.set(ryNumber, { row, score: safeScore, index });
    }
  });

  return Array.from(map.values())
    .sort((a, b) => b.score - a.score || b.index - a.index)
    .map(({ row }) => row);
};
