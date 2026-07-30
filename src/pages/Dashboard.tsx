import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Calendar as CalendarIcon, Check, Ban, Minus, Wand2, Loader2, Save, Trash2, Lock, Unlock } from 'lucide-react';
import { DAYS, Preference, Shift, PreferenceStatus, generateSchedule } from '../lib/scheduler';
import { loadPreferences, savePreferences, loadSchedule, saveSchedule } from '../lib/supabase';
import { getThisWeekId, getNextWeekId, getPreviousWeekId } from '../lib/dateUtils';
import { EMPLOYEES } from '../lib/scheduler';

type ViewMode = 'this-week' | 'next-week' | 'history' | 'overall';

export default function Dashboard() {
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('this-week');
  const [weekId, setWeekId] = useState<string>(getThisWeekId());
  
  const [lockedDays, setLockedDays] = useState<string[]>([]);
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [userPrefs, setUserPrefs] = useState<Record<string, PreferenceStatus>>({});
  const [schedule, setSchedule] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [generating, setGenerating] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const user = localStorage.getItem('pickoshifts_current_user');
    if (!user) {
      navigate('/');
    } else {
      setCurrentUser(user);
    }
  }, [navigate]);

  useEffect(() => {
    if (!currentUser) return;
    
    // Set week ID based on view mode
    let targetWeekId = weekId;
    if (viewMode === 'this-week') targetWeekId = getThisWeekId();
    else if (viewMode === 'next-week') targetWeekId = getNextWeekId();
    // if history, keep the current weekId which can be changed by arrows
    
    setWeekId(targetWeekId);
    fetchData(targetWeekId);
  }, [viewMode, currentUser]);

  const fetchData = async (targetWeek: string) => {
    setLoading(true);
    try {
      const prefs = await loadPreferences(targetWeek);
      const sched = await loadSchedule(targetWeek);
      setPreferences(prefs);
      setSchedule(sched);
      
      // Initialize local user prefs state
      const myPrefs = prefs.filter(p => p.employee === currentUser);
      const initialPrefs: Record<string, PreferenceStatus> = {};
      DAYS.forEach(d => {
        const existing = myPrefs.find(p => p.day === d);
        initialPrefs[d] = existing ? existing.status : 'neutral';
      });
      setUserPrefs(initialPrefs);
    } catch (error) {
      console.error("Error fetching data:", error);
      alert("Failed to load data.");
    }
    setLoading(false);
  };

  const handlePrevHistory = () => {
    const prev = getPreviousWeekId(weekId);
    setWeekId(prev);
    fetchData(prev);
  };

  const jumpToThisWeek = () => {
    const thisWeek = getThisWeekId();
    setWeekId(thisWeek);
    fetchData(thisWeek);
  };

  const jumpToNextWeek = () => {
    const nextWeek = getNextWeekId();
    setWeekId(nextWeek);
    fetchData(nextWeek);
  };

  const handlePrefChange = (day: string, status: PreferenceStatus) => {
    setUserPrefs(prev => ({ ...prev, [day]: prev[day] === status ? 'neutral' : status }));
  };

  const saveMyPreferences = async () => {
    setSavingPrefs(true);
    try {
      // Create a new preference array, removing old ones for this user and adding new ones
      const otherPrefs = preferences.filter(p => p.employee !== currentUser);
      const myNewPrefs = DAYS.map(d => ({ employee: currentUser!, day: d, status: userPrefs[d] }));
      const updatedPrefs = [...otherPrefs, ...myNewPrefs];
      
      await savePreferences(updatedPrefs, weekId);
      setPreferences(updatedPrefs);
      // alert("Preferences saved!");
    } catch (error) {
      console.error("Error saving prefs:", error);
      alert("Failed to save preferences.");
    }
    setSavingPrefs(false);
  };

  const handleClearMyPreferences = async () => {
    if (!confirm("Are you sure you want to clear your preferences for this week?")) return;
    setSavingPrefs(true);
    
    try {
      const otherPrefs = preferences.filter(p => p.employee !== currentUser);
      await savePreferences(otherPrefs, weekId);
      setPreferences(otherPrefs);
      
      const initialPrefs: Record<string, PreferenceStatus> = {};
      DAYS.forEach(d => initialPrefs[d] = 'neutral');
      setUserPrefs(initialPrefs);
    } catch (error) {
      console.error("Error clearing prefs:", error);
      alert("Failed to clear preferences.");
    }
    setSavingPrefs(false);
  };

  const handleMakeShift = async () => {
    const missingEmployees = EMPLOYEES.filter(emp => !preferences.some(p => p.employee === emp));
    if (missingEmployees.length > 0) {
      const proceed = window.confirm(`Not all team members have set their preferences for this week.\nMissing: ${missingEmployees.join(', ')}\n\nAre you sure you want to generate the schedule?`);
      if (!proceed) return;
    }

    setGenerating(true);
    try {
      // Small artificial delay for visual effect
      await new Promise(r => setTimeout(r, 600));
      
      const lockedShifts = schedule.filter(s => lockedDays.includes(s.day));
      const newSchedule = generateSchedule(preferences, lockedShifts);
      
      await saveSchedule(newSchedule, weekId);
      setSchedule(newSchedule);
    } catch (error) {
      console.error("Error generating shift:", error);
      alert("An error occurred while generating shifts.");
    }
    setGenerating(false);
  };

  const handleClearSchedule = async () => {
    if (!confirm("Are you sure you want to clear the schedule for this week?")) return;
    setGenerating(true);
    try {
      await saveSchedule([], weekId);
      setSchedule([]);
    } catch (error) {
      console.error("Error clearing shift:", error);
      alert("Failed to clear schedule.");
    }
    setGenerating(false);
  };

  if (!currentUser) return null;

  return (
    <div>
      <div className="dashboard-header">
        <div>
          <h2 style={{ fontSize: '2rem', marginBottom: '8px' }}>Hello, {currentUser}!</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Manage your shifts for the week of {weekId}</p>
        </div>
        
        <div className="week-selector glass-panel" style={{ padding: '4px' }}>
          <button 
            className={`tab-btn ${viewMode === 'this-week' ? 'active' : ''}`}
            onClick={() => setViewMode('this-week')}
          >
            This Week
          </button>
          <button 
            className={`tab-btn ${viewMode === 'next-week' ? 'active' : ''}`}
            onClick={() => setViewMode('next-week')}
          >
            Next Week
          </button>
          <button 
            className={`tab-btn ${viewMode === 'history' ? 'active' : ''}`}
            onClick={() => setViewMode('history')}
          >
            History
          </button>
          <button 
            className={`tab-btn ${viewMode === 'overall' ? 'active' : ''}`}
            onClick={() => setViewMode('overall')}
          >
            Overall
          </button>
        </div>
      </div>

      {(viewMode === 'history' || viewMode === 'overall') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          {viewMode === 'history' && (
            <button className="glass-button" onClick={handlePrevHistory} style={{ padding: '8px 12px' }}>
              <ChevronLeft size={16} /> Previous
            </button>
          )}
          <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>Viewing: {weekId}</span>
          {viewMode === 'history' && (
            <button 
              className="glass-button" 
              onClick={() => setViewMode('this-week')} 
              style={{ padding: '8px 12px', marginLeft: 'auto' }}
            >
              Return to This Week
            </button>
          )}
          {viewMode === 'overall' && (
            <>
              <button className="glass-button" onClick={jumpToThisWeek} style={{ padding: '8px 12px' }}>
                This Week
              </button>
              <button className="glass-button" onClick={jumpToNextWeek} style={{ padding: '8px 12px' }}>
                Next Week
              </button>
            </>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
          <Loader2 className="lucide-spin" size={48} color="var(--accent-primary)" />
        </div>
      ) : (
        <div className="dashboard-grid">
          {/* Calendar View */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 className="panel-title">
              <CalendarIcon size={24} color="var(--accent-primary)" /> 
              Schedule
            </h3>
            
            <div className="calendar">
              {DAYS.map(day => {
                const dayShifts = schedule.filter(s => s.day === day);
                return (
                  <div key={day} className="day-card glass-panel" style={{ background: 'rgba(0,0,0,0.1)' }}>
                    <div className="day-name" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {day}
                      {(viewMode === 'this-week' || viewMode === 'next-week') && (
                        <button 
                          className="glass-button"
                          onClick={() => {
                            if (lockedDays.includes(day)) {
                              setLockedDays(lockedDays.filter(d => d !== day));
                            } else {
                              setLockedDays([...lockedDays, day]);
                            }
                          }}
                          style={{ padding: '4px 8px', background: 'transparent', border: 'none', color: lockedDays.includes(day) ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
                          title={lockedDays.includes(day) ? "Unlock this day" : "Lock this day"}
                        >
                          {lockedDays.includes(day) ? <Lock size={14} /> : <Unlock size={14} />}
                        </button>
                      )}
                    </div>
                    {dayShifts.length > 0 ? (
                      dayShifts.map((s, idx) => {
                        const isPreferred = preferences.find(p => p.employee === s.employee && p.day === s.day)?.status === 'prefer';
                        const isPreferNot = preferences.find(p => p.employee === s.employee && p.day === s.day)?.status === 'prefer not';
                        return (
                          <div key={idx} className={`shift-chip ${isPreferred ? 'preferred' : ''} ${isPreferNot ? 'prefer-not-assigned' : ''}`}>
                            {s.employee} {isPreferred && <span style={{fontSize:'0.8rem'}}>✨</span>}
                          </div>
                        );
                      })
                    ) : (
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontStyle: 'italic' }}>No shifts</span>
                    )}
                  </div>
                );
              })}
            </div>

            {viewMode !== 'history' && (
              <div className="action-bar" style={{ gap: '12px' }}>
                <button 
                  className="glass-button" 
                  onClick={handleClearSchedule} 
                  disabled={generating}
                  style={{ color: '#ef4444', borderColor: '#ef4444' }}
                >
                  <Trash2 size={20} />
                  Clear
                </button>
                <button 
                  className="primary-button" 
                  onClick={handleMakeShift} 
                  disabled={generating}
                >
                  {generating ? <Loader2 className="lucide-spin" size={20} /> : <Wand2 size={20} />}
                  {generating ? 'Generating...' : 'Make Shift'}
                </button>
              </div>
            )}
          </div>

          {/* Overall Preferences View */}
          {viewMode === 'overall' && (
            <div className="glass-panel" style={{ padding: '24px', gridColumn: '1 / -1' }}>
              <h3 className="panel-title">Overall Employee Preferences</h3>
              <div style={{ overflowX: 'auto' }}>
                <table className="overall-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      {DAYS.map(day => <th key={day}>{day}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {EMPLOYEES.map(emp => (
                      <tr key={emp}>
                        <td style={{ fontWeight: 600 }}>{emp}</td>
                        {DAYS.map(day => {
                          const status = preferences.find(p => p.employee === emp && p.day === day)?.status || 'neutral';
                          return (
                            <td key={day}>
                              {status === 'prefer' && <span className="status-badge prefer">Prefer</span>}
                              {status === 'prefer not' && <span className="status-badge not-prefer">Prefer Not</span>}
                              {status === 'can not' && <span className="status-badge can-not">Can Not</span>}
                              {status === 'neutral' && <span className="status-badge neutral">-</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* User Preferences (Hidden in overall and history view) */}
          {viewMode !== 'overall' && viewMode !== 'history' && (
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 className="panel-title">Your Preferences</h3>
              
              <div className="glass-panel" style={{ padding: '16px', marginBottom: '24px', background: 'rgba(0,0,0,0.15)' }}>
                <h4 style={{ fontSize: '1rem', marginBottom: '12px', color: 'var(--text-primary)' }}>Legend</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '50%', background: 'var(--status-prefer)', color: 'var(--status-prefer-border)' }}>
                      <Check size={14} />
                    </div>
                    <span><strong>Prefer:</strong> Prioritize me for a shift on this day.</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '50%', background: 'var(--status-prefer-not)', color: 'var(--status-prefer-not-border)' }}>
                      <Minus size={14} />
                    </div>
                    <span><strong>Prefer Not:</strong> Try to avoid, but assign me if absolutely necessary.</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '50%', background: 'var(--status-can-not)', color: 'var(--status-can-not-border)' }}>
                      <Ban size={14} />
                    </div>
                    <span><strong>Can Not:</strong> Strictly do not assign me a shift on this day.</span>
                  </div>
                </div>
              </div>
            
            <div className="prefs-list">
              {DAYS.map(day => (
                <div key={day} className="pref-item glass-panel" style={{ background: 'rgba(0,0,0,0.1)', padding: '12px 16px' }}>
                  <span style={{ fontWeight: 500 }}>{day}</span>
                  <div className="pref-actions">
                    <button 
                      className={`pref-btn prefer ${userPrefs[day] === 'prefer' ? 'active' : ''}`}
                      onClick={() => handlePrefChange(day, 'prefer')}
                      title="Prefer this day"
                    >
                      <Check size={18} />
                    </button>
                    <button 
                      className={`pref-btn not-prefer ${userPrefs[day] === 'prefer not' ? 'active' : ''}`}
                      onClick={() => handlePrefChange(day, 'prefer not')}
                      title="Prefer NOT this day"
                    >
                      <Minus size={18} />
                    </button>
                    <button 
                      className={`pref-btn can-not ${userPrefs[day] === 'can not' ? 'active' : ''}`}
                      onClick={() => handlePrefChange(day, 'can not')}
                      title="CAN NOT work this day"
                    >
                      <Ban size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button 
                className="glass-button"
                onClick={handleClearMyPreferences}
                disabled={savingPrefs}
                style={{ flex: 1, color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
              >
                Clear
              </button>
              <button 
                className="glass-button save-prefs"
                onClick={saveMyPreferences}
                disabled={savingPrefs}
                style={{ flex: 2, margin: 0, background: 'var(--accent-primary)', color: 'white', border: 'none' }}
              >
                {savingPrefs ? <Loader2 className="lucide-spin" size={18} /> : <Save size={18} />}
                Save Preferences
              </button>
            </div>
          </div>
          )}
        </div>
      )}
    </div>
  );
}
