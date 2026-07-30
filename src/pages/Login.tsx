import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EMPLOYEES } from '../lib/scheduler';
import { LogIn, Unlock } from 'lucide-react';

export default function Login() {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  const handleUnlock = () => {
    if (password === '2727') {
      setIsUnlocked(true);
      setError(false);
    } else {
      setError(true);
    }
  };

  const handleLogin = () => {
    if (selectedUser) {
      localStorage.setItem('pickoshifts_current_user', selectedUser);
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
              disabled={!password}
              onClick={handleUnlock}
            >
              <Unlock size={20} />
              Unlock
            </button>
          </>
        ) : (
          <>
            <h2>Who are you?</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
              Select your name to manage your shifts
            </p>

            <div className="employee-grid">
              {EMPLOYEES.map((emp) => (
                <button
                  key={emp}
                  className={`glass-button employee-btn ${selectedUser === emp ? 'active' : ''}`}
                  onClick={() => setSelectedUser(emp)}
                >
                  {emp}
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
