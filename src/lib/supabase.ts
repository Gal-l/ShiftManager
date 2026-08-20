import { createClient } from '@supabase/supabase-js';
import { Preference, Shift } from './scheduler';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

// Helper for local storage if Supabase is not configured yet
const isLocal = !supabase;

export async function saveUserPreferences(userPreferences: Preference[], week: string, employee: string) {
  if (isLocal) {
    const key = `pickoshifts_prefs_${week}`;
    const data = localStorage.getItem(key);
    const existing = data ? JSON.parse(data) : [];
    const otherPrefs = existing.filter((p: Preference) => p.employee !== employee);
    const updated = [...otherPrefs, ...userPreferences];
    localStorage.setItem(key, JSON.stringify(updated));
    return;
  }
  
  // Real Supabase implementation
  // 1. Delete existing preferences for THIS user for this week
  await supabase!.from('preferences').delete().eq('week', week).eq('employee', employee);
  
  // 2. Insert new preferences
  if (userPreferences.length > 0) {
    const { error } = await supabase!.from('preferences').insert(
      userPreferences.map(p => ({ ...p, week }))
    );
    if (error) throw new Error(error.message);
  }
}

export async function loadPreferences(week: string): Promise<Preference[]> {
  if (isLocal) {
    const key = `pickoshifts_prefs_${week}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  }

  const { data, error } = await supabase!.from('preferences').select('*').eq('week', week);
  if (error) throw new Error(error.message);
  return data as Preference[];
}

export async function saveSchedule(shifts: Shift[], week: string) {
  if (isLocal) {
    const key = `pickoshifts_schedule_${week}`;
    localStorage.setItem(key, JSON.stringify(shifts));
    return;
  }

  // Real Supabase implementation
  await supabase!.from('shifts').delete().eq('week', week);
  
  const { error } = await supabase!.from('shifts').insert(
    shifts.map(s => ({ ...s, week }))
  );
  if (error) throw new Error(error.message);
}

export async function loadSchedule(week: string): Promise<Shift[]> {
  if (isLocal) {
    const key = `pickoshifts_schedule_${week}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  }

  const { data, error } = await supabase!.from('shifts').select('*').eq('week', week);
  if (error) throw new Error(error.message);
  return data as Shift[];
}

export async function setScheduleReleased(week: string, isReleased: boolean) {
  if (isLocal) {
    const key = `pickoshifts_released_${week}`;
    localStorage.setItem(key, JSON.stringify(isReleased));
    return;
  }

  const employee = '_SYSTEM_';
  const day = 'RELEASED';
  
  await supabase!.from('preferences').delete().eq('week', week).eq('employee', employee).eq('day', day);
  
  if (isReleased) {
    const { error } = await supabase!.from('preferences').insert([{
      employee,
      day,
      status: 'prefer',
      week
    }]);
    if (error) throw new Error(error.message);
  }
}

export async function isScheduleReleased(week: string): Promise<boolean> {
  if (isLocal) {
    const key = `pickoshifts_released_${week}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : false;
  }

  const { data, error } = await supabase!
    .from('preferences')
    .select('*')
    .eq('week', week)
    .eq('employee', '_SYSTEM_')
    .eq('day', 'RELEASED');
    
  if (error) throw new Error(error.message);
  return data && data.length > 0;
}

