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

export function getPassedDaysInWeek(): string[] {
  const today = new Date().getDay();
  const passed: string[] = [];
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];
  
  for (let i = 0; i < DAYS.length; i++) {
    if (i < today) {
      passed.push(DAYS[i]);
    }
  }
  return passed;
}

export function getDateForDay(weekId: string, dayName: string): string {
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];
  const dayIndex = DAYS.indexOf(dayName);
  if (dayIndex === -1) return "";
  
  // Ensure we avoid timezone offset issues when creating a Date from a string like "2026-07-26"
  // Actually "YYYY-MM-DD" is treated as UTC in some browsers, local in others. Let's parse components manually or use a fixed timezone trick
  // new Date(weekId + 'T00:00:00') explicitly forces local time parse
  const dateObj = new Date(weekId + 'T00:00:00');
  dateObj.setDate(dateObj.getDate() + dayIndex);
  return dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
