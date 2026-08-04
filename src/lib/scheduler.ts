export const EMPLOYEES = ["Gal", "Amiel", "Kobi", "Omer", "Idan", "Lital"];
export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];

export type PreferenceStatus = "prefer" | "prefer not" | "can not" | "neutral";

export interface Preference {
  employee: string;
  day: string;
  status: PreferenceStatus;
}

export interface Shift {
  employee: string;
  day: string;
}

const DAY_WEIGHTS: Record<string, number> = {
  "Sunday": 0.01,
  "Monday": 0.02,
  "Tuesday": 0.03,
  "Wednesday": 0.04,
  "Thursday": 0.05
};

const DAY_INDEX: Record<string, number> = {
  "Sunday": 0,
  "Monday": 1,
  "Tuesday": 2,
  "Wednesday": 3,
  "Thursday": 4
};

export function generateSchedule(preferences: Preference[], lockedShifts: Shift[] = [], preventConsecutive: Record<string, boolean> = {}): Shift[] {
  // 1. Build a fast lookup for preferences
  const prefMap: Record<string, Record<string, PreferenceStatus>> = {};
  EMPLOYEES.forEach(e => {
    prefMap[e] = {};
    DAYS.forEach(d => {
      prefMap[e][d] = "neutral";
    });
  });

  preferences.forEach(p => {
    if (prefMap[p.employee] && prefMap[p.employee][p.day] !== undefined) {
      prefMap[p.employee][p.day] = p.status;
    }
  });

  let bestSchedule: Shift[] = [];
  let bestScore = -999999;

  const empCounts: Record<string, number> = {};
  const dayCounts: Record<string, number> = {};
  EMPLOYEES.forEach(e => empCounts[e] = 0);
  DAYS.forEach(d => dayCounts[d] = 0);

  const currentSchedule: Shift[] = [];
  
  // Initialize with locked shifts
  const empLockedDays: Record<string, string[]> = {};
  EMPLOYEES.forEach(e => empLockedDays[e] = []);
  
  lockedShifts.forEach(s => {
    if (EMPLOYEES.includes(s.employee) && DAYS.includes(s.day)) {
      empLockedDays[s.employee].push(s.day);
      dayCounts[s.day]++;
      currentSchedule.push(s);
    }
  });

  const allowedDaysForEmployee: Record<string, string[]> = {};
  EMPLOYEES.forEach(e => {
    allowedDaysForEmployee[e] = DAYS.filter(d => prefMap[e][d] !== "can not");
  });

  // Randomize the order of employees being processed.
  // This ensures that exact mathematical ties (like two people having "prefer not" for the same shift)
  // are broken randomly, fairly distributing the penalty when multiple schedules have the same max score.
  const randomEmployees = [...EMPLOYEES].sort(() => Math.random() - 0.5);

  function solve(empIndex: number, currentScore: number) {
    if (empIndex === randomEmployees.length) {
      for (const d of DAYS) {
        if (dayCounts[d] < 2 || dayCounts[d] > 3) return;
      }
      if (currentScore > bestScore) {
        bestScore = currentScore;
        bestSchedule = [...currentSchedule];
      }
      return;
    }

    const emp = randomEmployees[empIndex];
    const locked = empLockedDays[emp];
    const needed = 2 - locked.length;
    
    // If someone was manually locked into >=2 shifts, we skip adding more.
    if (needed <= 0) {
      solve(empIndex + 1, currentScore);
      return;
    }

    // Allowed days excluding those already locked for this employee
    const allowed = allowedDaysForEmployee[emp].filter(d => !locked.includes(d));

    if (needed === 1) {
      for (let i = 0; i < allowed.length; i++) {
        const day1 = allowed[i];
        if (dayCounts[day1] >= 3) continue;

        dayCounts[day1]++;
        currentSchedule.push({ employee: emp, day: day1 });
        const prefScore1 = prefMap[emp][day1] === "prefer" ? 1 : (prefMap[emp][day1] === "prefer not" ? -10 : 0);
        
        let consecutivePenalty = 0;
        if (preventConsecutive[emp]) {
          for (const lDay of locked) {
            if (Math.abs(DAY_INDEX[day1] - DAY_INDEX[lDay]) === 1) {
              consecutivePenalty = -0.1;
              break;
            }
          }
        }

        const score1 = prefScore1 + DAY_WEIGHTS[day1] + consecutivePenalty;
        
        solve(empIndex + 1, currentScore + score1);

        dayCounts[day1]--;
        currentSchedule.pop();
      }
    } else if (needed === 2) {
      for (let i = 0; i < allowed.length - 1; i++) {
        for (let j = i + 1; j < allowed.length; j++) {
          const day1 = allowed[i];
          const day2 = allowed[j];

          if (dayCounts[day1] >= 3 || dayCounts[day2] >= 3) continue;

          dayCounts[day1]++;
          dayCounts[day2]++;
          currentSchedule.push({ employee: emp, day: day1 });
          currentSchedule.push({ employee: emp, day: day2 });
          
          const prefScore1 = prefMap[emp][day1] === "prefer" ? 1 : (prefMap[emp][day1] === "prefer not" ? -10 : 0);
          const prefScore2 = prefMap[emp][day2] === "prefer" ? 1 : (prefMap[emp][day2] === "prefer not" ? -10 : 0);
          
          let consecutivePenalty = 0;
          if (preventConsecutive[emp]) {
            if (Math.abs(DAY_INDEX[day1] - DAY_INDEX[day2]) === 1) {
              consecutivePenalty -= 0.1;
            }
            // Check against locked days as well just in case (though needed === 2 means locked is empty, but for safety)
            for (const lDay of locked) {
              if (Math.abs(DAY_INDEX[day1] - DAY_INDEX[lDay]) === 1 || Math.abs(DAY_INDEX[day2] - DAY_INDEX[lDay]) === 1) {
                consecutivePenalty -= 0.1;
              }
            }
          }

          const score1 = prefScore1 + DAY_WEIGHTS[day1];
          const score2 = prefScore2 + DAY_WEIGHTS[day2];

          solve(empIndex + 1, currentScore + score1 + score2 + consecutivePenalty);

          dayCounts[day1]--;
          dayCounts[day2]--;
          currentSchedule.pop();
          currentSchedule.pop();
        }
      }
    }
  }

  solve(0, 0);

  if (bestSchedule.length > 0) {
    return bestSchedule;
  }
  
  // FALLBACK ALGORITHM
  // If no strict valid schedule could be found, assign greedily
  const fallbackSchedule: Shift[] = [...lockedShifts];
  const fbDayCounts: Record<string, number> = {};
  DAYS.forEach(d => fbDayCounts[d] = 0);
  lockedShifts.forEach(s => fbDayCounts[s.day]++);

  randomEmployees.forEach(emp => {
    const locked = empLockedDays[emp];
    const needed = 2 - locked.length;
    if (needed > 0) {
      let allowed = DAYS.filter(d => prefMap[emp][d] !== "can not" && !locked.includes(d));
      
      allowed.sort((a, b) => {
        if (fbDayCounts[a] !== fbDayCounts[b]) {
          return fbDayCounts[a] - fbDayCounts[b]; // Fill emptiest days first
        }
        const prefA = prefMap[emp][a] === "prefer" ? 1 : (prefMap[emp][a] === "prefer not" ? -1 : 0);
        const prefB = prefMap[emp][b] === "prefer" ? 1 : (prefMap[emp][b] === "prefer not" ? -1 : 0);
        if (prefA !== prefB) {
          return prefB - prefA; // Prefer user's selection
        }
        return DAY_WEIGHTS[b] - DAY_WEIGHTS[a]; // Push to end of week
      });

      for (let i = 0; i < Math.min(needed, allowed.length); i++) {
        const pickedDay = allowed[i];
        fallbackSchedule.push({ employee: emp, day: pickedDay });
        fbDayCounts[pickedDay]++;
      }
    }
  });

  return fallbackSchedule;
}
