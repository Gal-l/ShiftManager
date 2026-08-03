import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Calendar as CalendarIcon, Check, Ban, Minus, Wand2, Loader2, Save, Trash2, Lock, Unlock, Edit2 } from 'lucide-react';
import { DAYS, Preference, Shift, PreferenceStatus, generateSchedule } from '../lib/scheduler';
import { loadPreferences, saveUserPreferences, loadSchedule, saveSchedule } from '../lib/supabase';
import { getThisWeekId, getNextWeekId, getPreviousWeekId, getPassedDaysInWeek, getDateForDay } from '../lib/dateUtils';
import { EMPLOYEES } from '../lib/scheduler';
import { subscribeToPushNotifications } from '../lib/push';

type ViewMode = 'this-week' | 'next-week' | 'history' | 'overall';

export default function Dashboard() {
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [userType, setUserType] = useState<string>('User');
  const [viewMode, setViewMode] = useState<ViewMode>('next-week');
  const [mobileSubTab, setMobileSubTab] = useState<'schedule' | 'preferences'>('schedule');
  const [weekId, setWeekId] = useState<string>(getNextWeekId());
  const [draggedShift, setDraggedShift] = useState<{employee: string, originalDay: string} | null>(null);
  const [addEmployeeDay, setAddEmployeeDay] = useState<string | null>(null);
  const [isManualEditMode, setIsManualEditMode] = useState(false);

  const [lockedDays, setLockedDays] = useState<string[]>([]);
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [userPrefs, setUserPrefs] = useState<Record<string, PreferenceStatus>>({});
  const [schedule, setSchedule] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'alert' | 'confirm';
    onConfirm?: () => void;
  }>({ isOpen: false, title: '', message: '', type: 'alert' });

  const navigate = useNavigate();

  useEffect(() => {
    const user = localStorage.getItem('pickoshifts_current_user');
    const type = localStorage.getItem('pickoshifts_user_type') || 'User';
    if (!user) {
      navigate('/');
    } else {
      setCurrentUser(user);
      setUserType(type);
      subscribeToPushNotifications(user);
    }
  }, [navigate]);

  useEffect(() => {
    if (userType === 'Admin') {
      document.title = '👑 PickoShift';
      document.body.classList.add('admin-mode');
    } else {
      document.title = 'PickoShift';
      document.body.classList.remove('admin-mode');
    }
    return () => {
      document.title = 'PickoShift';
      document.body.classList.remove('admin-mode');
    };
  }, [userType]);

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

      if (targetWeek === getThisWeekId()) {
        setLockedDays(getPassedDaysInWeek());
      } else {
        setLockedDays([]);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      setModalState({ isOpen: true, title: 'Error', message: 'Failed to load data.', type: 'alert' });
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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handlePrefChange = (day: string, status: PreferenceStatus) => {
    const newStatus = userPrefs[day] === status ? 'neutral' : status;
    setUserPrefs(prev => ({ ...prev, [day]: newStatus }));

    if (newStatus === 'prefer') {
      showToast("I love you optimistic way! 💖");
    } else if (newStatus === 'can not') {
      showToast("I hope you have a good excuse! 🤨");
    } else if (newStatus === 'prefer not') {
      showToast("I have my own dreams as well 💭");
    }
  };

  const saveMyPreferences = async () => {
    setSavingPrefs(true);
    try {
      const myNewPrefs = DAYS.map(d => ({ employee: currentUser!, day: d, status: userPrefs[d] }));

      await saveUserPreferences(myNewPrefs, weekId, currentUser!);

      let updatedPreferences: Preference[] = [];
      setPreferences(prev => {
        const otherPrefs = prev.filter(p => p.employee !== currentUser);
        updatedPreferences = [...otherPrefs, ...myNewPrefs];
        return updatedPreferences;
      });
      
      const missingEmployees = EMPLOYEES.filter(emp => !updatedPreferences.some(p => p.employee === emp));
      if (missingEmployees.length === 0) {
        fetch('/api/notify-all-set', { method: 'POST' }).catch(console.error);
      }
      
      // alert("Preferences saved!");
    } catch (error) {
      console.error("Error saving prefs:", error);
      setModalState({ isOpen: true, title: 'Error', message: 'Failed to save preferences.', type: 'alert' });
    }
    setSavingPrefs(false);
  };

  const handleClearMyPreferences = () => {
    setModalState({
      isOpen: true,
      title: 'Clear Preferences',
      message: 'Are you sure you want to clear your preferences for this week?',
      type: 'confirm',
      onConfirm: async () => {
        setModalState(prev => ({ ...prev, isOpen: false }));
        setSavingPrefs(true);

        try {
          await saveUserPreferences([], weekId, currentUser!);

          setPreferences(prev => prev.filter(p => p.employee !== currentUser));

          const initialPrefs: Record<string, PreferenceStatus> = {};
          DAYS.forEach(d => initialPrefs[d] = 'neutral');
          setUserPrefs(initialPrefs);
        } catch (error) {
          console.error("Error clearing prefs:", error);
          setModalState({ isOpen: true, title: 'Error', message: 'Failed to clear preferences.', type: 'alert' });
        }
        setSavingPrefs(false);
      }
    });
  };

  const handleMakeShift = () => {
    const missingEmployees = EMPLOYEES.filter(emp => !preferences.some(p => p.employee === emp));

    const doGenerate = async () => {
      setModalState(prev => ({ ...prev, isOpen: false }));
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
        setModalState({ isOpen: true, title: 'Error', message: 'An error occurred while generating shifts.', type: 'alert' });
      }
      setGenerating(false);
    };

    if (missingEmployees.length > 0) {
      setModalState({
        isOpen: true,
        title: 'Missing Preferences',
        message: `Not all team members have set their preferences for this week.\nMissing: ${missingEmployees.join(', ')}\n\nAre you sure you want to generate the schedule?`,
        type: 'confirm',
        onConfirm: doGenerate
      });
    } else {
      doGenerate();
    }
  };

  const handleClearSchedule = () => {
    setModalState({
      isOpen: true,
      title: 'Clear Schedule',
      message: 'Are you sure you want to clear the schedule for this week? (Locked days will be preserved)',
      type: 'confirm',
      onConfirm: async () => {
        setModalState(prev => ({ ...prev, isOpen: false }));
        setGenerating(true);
        try {
          const lockedShifts = schedule.filter(s => lockedDays.includes(s.day));
          await saveSchedule(lockedShifts, weekId);
          setSchedule(lockedShifts);
        } catch (error) {
          console.error("Error clearing shift:", error);
          setModalState({ isOpen: true, title: 'Error', message: 'Failed to clear schedule.', type: 'alert' });
        }
        setGenerating(false);
      }
    });
  };

  const handleDragStart = (employee: string, originalDay: string) => {
    setDraggedShift({ employee, originalDay });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetDay: string) => {
    e.preventDefault();
    if (!draggedShift) return;
    
    const { employee, originalDay } = draggedShift;
    setDraggedShift(null);

    if (originalDay === targetDay) return;

    // Check if employee is already on target day
    const alreadyOnDay = schedule.some(s => s.employee === employee && s.day === targetDay);
    if (alreadyOnDay) {
      showToast(`${employee} is already scheduled on ${targetDay}`);
      return;
    }

    const newSchedule = schedule.filter(s => !(s.employee === employee && s.day === originalDay));
    newSchedule.push({ employee, day: targetDay });
    
    setSchedule(newSchedule);
    await saveSchedule(newSchedule, weekId);
  };

  const handleRemoveShift = async (employee: string, day: string) => {
    const newSchedule = schedule.filter(s => !(s.employee === employee && s.day === day));
    setSchedule(newSchedule);
    await saveSchedule(newSchedule, weekId);
  };

  const handleAddShift = async (employee: string, day: string) => {
    const newSchedule = [...schedule, { employee, day }];
    setSchedule(newSchedule);
    setAddEmployeeDay(null);
    await saveSchedule(newSchedule, weekId);
  };

  const mySavedPrefs = preferences.filter(p => p.employee === currentUser);
  const hasUnsavedChanges = DAYS.some(day => {
    const savedStatus = mySavedPrefs.find(p => p.day === day)?.status || 'neutral';
    return userPrefs[day] !== savedStatus;
  });

  if (!currentUser) return null;

  return (
    <div>
      <div className="dashboard-header">
        <div>
          <h2 className="page-title">Hello, {currentUser}! <span className="page-title-badge">({userType})</span></h2>
          <p className="page-subtitle">
            Manage your shifts for {viewMode === 'this-week' ? 'This Week' : viewMode === 'next-week' ? 'Next Week' : 'the week of'} ({weekId})
          </p>
        </div>

        <div className="week-selector-container">
          <button
            className={`tab-btn next-week-btn glass-panel ${viewMode === 'next-week' ? 'active' : ''}`}
            onClick={() => setViewMode('next-week')}
            style={{
              width: '100%',
              padding: '12px',
              textAlign: 'center',
              border: viewMode === 'next-week' ? '1px solid var(--accent-primary)' : '1px solid var(--glass-border)',
              background: viewMode === 'next-week' ? 'rgba(99, 102, 241, 0.2)' : 'var(--glass-bg)'
            }}
          >
            Next Week
          </button>
          <div className="week-selector glass-panel" style={{ padding: '4px', display: 'flex', justifyContent: 'center' }}>
            <button
              className={`tab-btn ${viewMode === 'this-week' ? 'active' : ''}`}
              onClick={() => setViewMode('this-week')}
            >
              This Week
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
      </div>

      {(viewMode === 'history' || viewMode === 'overall') && (
        <div className="history-toolbar">
          {viewMode === 'history' && (
            <button className="glass-button" onClick={handlePrevHistory} style={{ padding: '8px 12px' }}>
              <ChevronLeft size={16} /> Previous
            </button>
          )}
          <span style={{ fontWeight: 500, color: 'var(--text-secondary)', textAlign: 'center' }}>Viewing: {weekId}</span>
          {viewMode === 'history' && (
            <button
              className="glass-button"
              onClick={() => setViewMode('this-week')}
              style={{ padding: '8px 12px' }}
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
        <>
          {/* Mobile Subtabs */}
        {(viewMode === 'this-week' || viewMode === 'next-week') && (
          <div className="mobile-subtabs">
            <button 
              className={`mobile-subtab-btn ${mobileSubTab === 'schedule' ? 'active' : ''}`}
              onClick={() => setMobileSubTab('schedule')}
            >
              Schedule
            </button>
            <button 
              className={`mobile-subtab-btn ${mobileSubTab === 'preferences' ? 'active' : ''}`}
              onClick={() => setMobileSubTab('preferences')}
            >
              Preferences
            </button>
          </div>
        )}

        <div className="dashboard-grid">
          {/* Calendar View */}
          <div className={`glass-panel panel-padding ${viewMode !== 'history' && viewMode !== 'overall' && mobileSubTab !== 'schedule' ? 'hidden-on-mobile' : ''}`}>
            <h3 className="panel-title">
              <CalendarIcon size={24} color="var(--accent-primary)" />
              Schedule
            </h3>

            <div className="calendar" style={{ position: 'relative', zIndex: 20 }}>
              {DAYS.map(day => {
                const dayShifts = schedule.filter(s => s.day === day);
                const isPassedDay = weekId === getThisWeekId() && getPassedDaysInWeek().includes(day) && lockedDays.includes(day);
                return (
                  <div 
                    key={day} 
                    className={`day-card glass-panel ${isPassedDay ? 'passed-day' : ''}`} 
                    style={{ background: 'rgba(0,0,0,0.1)', position: 'relative', zIndex: addEmployeeDay === day ? 50 : 1 }}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, day)}
                  >
                    <div className="day-name" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span>{day}</span>
                        {(viewMode === 'this-week' || viewMode === 'next-week') && (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 'normal', marginTop: '2px' }}>
                            {getDateForDay(weekId, day)}
                          </span>
                        )}
                      </div>
                      {(viewMode === 'this-week' || viewMode === 'next-week') && (
                        userType === 'Admin' ? (
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
                        ) : (
                          lockedDays.includes(day) ? (
                            <span style={{ padding: '4px 8px', color: 'var(--accent-primary)' }} title="Locked">
                              <Lock size={14} />
                            </span>
                          ) : null
                        )
                      )}
                    </div>
                    {dayShifts.length > 0 ? (
                      dayShifts.map((s, idx) => {
                        const isPreferred = preferences.find(p => p.employee === s.employee && p.day === s.day)?.status === 'prefer';
                        const isPreferNot = preferences.find(p => p.employee === s.employee && p.day === s.day)?.status === 'prefer not';
                        const isCannot = preferences.find(p => p.employee === s.employee && p.day === s.day)?.status === 'can not';
                        return (
                          <div 
                            key={idx} 
                            className={`shift-chip ${isPreferred ? 'preferred' : ''} ${isPreferNot ? 'prefer-not-assigned' : ''} ${isCannot ? 'can-not-assigned' : ''}`}
                            draggable={userType === 'Admin' && (viewMode === 'this-week' || viewMode === 'next-week') && isManualEditMode}
                            onDragStart={() => handleDragStart(s.employee, s.day)}
                            style={{ cursor: (userType === 'Admin' && isManualEditMode) ? 'grab' : 'default', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                          >
                            <div>
                              {s.employee} {isPreferred && <span style={{ fontSize: '0.8rem' }}>✨</span>}
                            </div>
                            {userType === 'Admin' && (viewMode === 'this-week' || viewMode === 'next-week') && isManualEditMode && (
                              <button 
                                onClick={() => handleRemoveShift(s.employee, s.day)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0 4px', fontSize: '1.2rem', lineHeight: 1 }}
                                title="Remove"
                              >
                                &times;
                              </button>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontStyle: 'italic' }}>No shifts</span>
                    )}
                    {userType === 'Admin' && (viewMode === 'this-week' || viewMode === 'next-week') && isManualEditMode && (
                      <div style={{ marginTop: '12px', position: 'relative' }}>
                        {addEmployeeDay === day ? (
                          <div 
                            className="glass-panel" 
                            style={{ 
                              position: 'absolute', 
                              top: '0', 
                              left: '50%', 
                              transform: 'translateX(-50%)',
                              width: '160px', 
                              zIndex: 50, 
                              display: 'flex', 
                              flexDirection: 'column',
                              gap: '4px',
                              padding: '12px',
                              background: 'var(--bg-color)',
                              border: '1px solid var(--accent-primary)',
                              boxShadow: '0 10px 30px rgba(0,0,0,0.6)'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '6px' }}>
                              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Select Employee</span>
                              <button onClick={() => setAddEmployeeDay(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.4rem', lineHeight: 0.5, marginLeft: '8px' }}>&times;</button>
                            </div>
                            <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '4px' }}>
                              {EMPLOYEES.filter(emp => !dayShifts.some(s => s.employee === emp)).length === 0 ? (
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '8px 0' }}>All scheduled</span>
                              ) : (
                                EMPLOYEES.filter(emp => !dayShifts.some(s => s.employee === emp)).map(emp => (
                                  <button 
                                    key={emp}
                                    className="glass-button"
                                    onClick={() => handleAddShift(emp, day)}
                                    style={{ padding: '6px', fontSize: '0.9rem', width: '100%', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: 'none' }}
                                  >
                                    {emp}
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        ) : (
                          <button 
                            className="glass-button" 
                            onClick={() => setAddEmployeeDay(day)}
                            style={{ width: '100%', padding: '4px', fontSize: '0.9rem', color: 'var(--text-secondary)', borderStyle: 'dashed' }}
                          >
                            + Add
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {viewMode !== 'history' && userType === 'Admin' && (
              <div className="action-bar">
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
                  className={`glass-button ${isManualEditMode ? 'active' : ''}`}
                  onClick={() => setIsManualEditMode(!isManualEditMode)}
                  style={{ 
                    color: isManualEditMode ? 'white' : 'var(--text-primary)', 
                    background: isManualEditMode ? 'var(--accent-primary)' : 'transparent',
                    borderColor: isManualEditMode ? 'var(--accent-primary)' : 'var(--glass-border)'
                  }}
                >
                  <Edit2 size={20} />
                  {isManualEditMode ? 'Done Editing' : 'Manual Edit'}
                </button>
                <button
                  className="glass-button"
                  onClick={() => {
                    fetch('/api/notify-cron', { method: 'POST' })
                      .then(() => showToast('Push notification triggered!'))
                      .catch(() => showToast('Failed to trigger notification'));
                  }}
                  title="Test Push Notification"
                >
                  🔔 Test Push
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
            <div className="glass-panel panel-padding" style={{ gridColumn: '1 / -1' }}>
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
            <div className={`glass-panel panel-padding ${mobileSubTab !== 'preferences' ? 'hidden-on-mobile' : ''}`}>
              <h3 className="panel-title">
                Your Preferences
                {hasUnsavedChanges && (
                  <span style={{ fontSize: '1rem', color: 'var(--status-prefer-not-border)', fontWeight: 'normal' }}>
                    - don't forget to save
                  </span>
                )}
              </h3>

              <div className="glass-panel panel-padding" style={{ marginBottom: '24px', background: 'rgba(0,0,0,0.15)' }}>
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
                  <div key={day} className="pref-item glass-panel" style={{ background: 'rgba(0,0,0,0.1)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 500 }}>{day}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {getDateForDay(weekId, day)}
                      </span>
                    </div>
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

              <div className="action-bar" style={{ marginTop: '24px' }}>
                <button
                  className="glass-button"
                  onClick={handleClearMyPreferences}
                  disabled={savingPrefs}
                  style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                >
                  Clear
                </button>
                <button
                  className="glass-button save-prefs"
                  onClick={saveMyPreferences}
                  disabled={savingPrefs || !hasUnsavedChanges}
                  style={{ margin: 0, background: 'var(--accent-primary)', color: 'white', border: 'none', opacity: (!hasUnsavedChanges && !savingPrefs) ? 0.5 : 1 }}
                >
                  {savingPrefs ? <Loader2 className="lucide-spin" size={18} /> : <Save size={18} />}
                  Save Preferences
                </button>
              </div>
            </div>
          )}
        </div>
        </>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast-notification">
          {toastMessage}
        </div>
      )}

      {/* Modal */}
      {modalState.isOpen && (
        <div className="modal-overlay">
          <div className="modal-container glass-panel">
            <h3 style={{ marginBottom: '16px', fontSize: '1.25rem' }}>{modalState.title}</h3>
            <p style={{ marginBottom: '24px', color: 'var(--text-secondary)', whiteSpace: 'pre-line' }}>{modalState.message}</p>
            <div className="modal-actions">
              {modalState.type === 'confirm' && (
                <button
                  className="glass-button"
                  onClick={() => setModalState(prev => ({ ...prev, isOpen: false }))}
                >
                  Cancel
                </button>
              )}
              <button
                className="primary-button"
                onClick={() => {
                  if (modalState.type === 'confirm' && modalState.onConfirm) {
                    modalState.onConfirm();
                  } else {
                    setModalState(prev => ({ ...prev, isOpen: false }));
                  }
                }}
              >
                {modalState.type === 'confirm' ? 'Confirm' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
