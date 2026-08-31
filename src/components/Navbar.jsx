import { useLocation, useNavigate } from 'react-router-dom';
import { useState, useContext } from 'react';
import { OrgContext } from '../App';
import { AuthContext } from '../context/AuthContext';

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/jobs': 'Job Postings',
  '/candidates': 'Candidates',
  '/applications': 'Applications',
};

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { org } = useContext(OrgContext);
  const { user, logout } = useContext(AuthContext);
  const [showProfile, setShowProfile] = useState(false);

  const title = pageTitles[location.pathname] || 'RecruitAI';
  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
    : org?.name
      ? org.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
      : 'RA';

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  return (
    <div className="navbar">
      <div className="navbar-left">
        <button
          className="navbar-menu-btn"
          onClick={() => document.body.classList.toggle('ud-sidebar-open')}
          aria-label="Toggle menu"
        >
          ☰
        </button>
        <h2>{title}</h2>
      </div>
      <div className="navbar-actions">
        <input
          type="text"
          className="navbar-search"
          placeholder="Search..."
        />
        <div className="navbar-profile" onClick={() => setShowProfile(!showProfile)}>
          <div className="navbar-avatar">{initials}</div>
          {user?.name && <span className="navbar-name">{user.name}</span>}
          {showProfile && (
            <div className="ud-dropdown">
              <div className="ud-dropdown-item">
                <div style={{ fontWeight: 600 }}>{user?.name}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>{user?.email}</div>
              </div>
              <div className="ud-dropdown-divider" />
              <div className="ud-dropdown-item" onClick={handleLogout}>Logout</div>
            </div>
          )}
        </div>
      </div>
      <div className="ud-sidebar-backdrop" onClick={() => document.body.classList.remove('ud-sidebar-open')} />
    </div>
  );
}
