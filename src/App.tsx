import { Routes, Route, useNavigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

function App() {
  const navigate = useNavigate();

  return (
    <>
      <header className="app-header">
        <a href="/" className="logo-container" onClick={(e) => { e.preventDefault(); navigate('/'); }}>
          <img src="/logo.png" alt="PickoShifts Logo" className="logo-image" />
          <h1 className="gradient-text">PickoShifts</h1>
        </a>
      </header>
      
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </main>
    </>
  );
}

export default App;
