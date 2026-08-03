import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { EMPLOYEES } from '../lib/scheduler';
import { LogIn, Unlock, Crown } from 'lucide-react';

import { subscribeToPushNotifications } from '../lib/push';

export default function Login() {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [error, setError] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    document.body.classList.remove('admin-mode');
    document.title = 'PickoShift';
  }, []);

  const handleUnlock = async () => {
    if (!password) return;
    setIsAuthenticating(true);
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await response.json();
      
      if (data.success) {
        setIsUnlocked(true);
        setError(false);
        setIsAdmin(data.isAdmin);
        localStorage.setItem('pickoshifts_user_type', data.isAdmin ? 'Admin' : 'User');
        if (data.isAdmin) {
          document.body.classList.add('admin-mode');
          document.title = '👑 PickoShift';
        }
      } else {
        setError(true);
      }
    } catch (err) {
      console.error('Authentication error:', err);
      setError(true);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogin = async () => {
    if (selectedUser) {
      localStorage.setItem('pickoshifts_current_user', selectedUser);
      // Call this BEFORE navigating so iOS Safari registers the user gesture
      subscribeToPushNotifications(selectedUser);
      navigate('/dashboard');
    }
  };

  return (
    <div className="auth-container">
      <div className="glass-panel auth-card">
        {!isUnlocked ? (
          <>
            <h2>Enter Password</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
              Please enter the access code to continue
            </p>
            <div style={{ marginTop: '24px' }}>
              <input 
                type="password"
                placeholder="Enter Password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleUnlock();
                }}
                style={{ 
                  width: '100%', 
                  padding: '12px 16px', 
                  borderRadius: '12px', 
                  border: `1px solid ${error ? '#ef4444' : 'var(--glass-border)'}`, 
                  background: 'rgba(0,0,0,0.2)',
                  color: 'var(--text-primary)',
                  fontFamily: 'inherit',
                  fontSize: '1rem',
                  outline: 'none',
                  boxShadow: error ? '0 0 0 1px #ef4444' : 'none',
                  transition: 'all 0.2s'
                }}
              />
              {error && <p style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '6px', textAlign: 'left' }}>Incorrect password. Hint: Operator</p>}
            </div>
            <button
              className="primary-button"
              style={{ width: '100%', marginTop: '24px' }}
              disabled={!password || isAuthenticating}
              onClick={handleUnlock}
            >
              <Unlock size={20} />
              {isAuthenticating ? 'Unlocking...' : 'Unlock'}
            </button>
          </>
        ) : (
          <>
            <h2>Who are you?</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
              Select your name to manage your shifts
            </p>

            <div className="employee-grid">
              {(isAdmin ? ['Gal'] : EMPLOYEES).map((emp) => (
                <button
                  key={emp}
                  className={`glass-button employee-btn ${selectedUser === emp ? 'active' : ''}`}
                  onClick={() => setSelectedUser(emp)}
                >
                  {emp}
                  {isAdmin && selectedUser === emp && (
                    <Crown size={18} color="#fbbf24" fill="#fbbf24" style={{ marginLeft: '8px' }} />
                  )}
                </button>
              ))}
            </div>

            <button
              className="primary-button"
              style={{ width: '100%', marginTop: '24px' }}
              disabled={!selectedUser}
              onClick={handleLogin}
            >
              <LogIn size={20} />
              Continue
            </button>
          </>
        )}
      </div>
    </div>
  );
}
