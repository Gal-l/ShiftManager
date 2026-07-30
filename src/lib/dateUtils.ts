export function getSunday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day; // adjust when day is sunday
  return new Date(date.setDate(diff));
}

export function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getThisWeekId(): string {
  return formatDate(getSunday(new Date()));
}

export function getNextWeekId(): string {
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  return formatDate(getSunday(nextWeek));
}

export function getPreviousWeekId(current: string): string {
  const d = new Date(current);
  d.setDate(d.getDate() - 7);
  return formatDate(d);
}

export function getNextWeekFromId(current: string): string {
  const d = new Date(current);
  d.setDate(d.getDate() + 7);
  return formatDate(d);
}
