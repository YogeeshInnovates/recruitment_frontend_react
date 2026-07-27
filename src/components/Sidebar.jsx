import { NavLink, useLocation } from 'react-router-dom';
import { useContext } from 'react';
import { OrgContext } from '../App';

export default function Sidebar() {
  const { org, clearOrganization } = useContext(OrgContext);
  const location = useLocation();

  const links = [
    { to: '/dashboard', icon: '📊', label: 'Dashboard' },
    { to: '/jobs', icon: '💼', label: 'Jobs' },
    { to: '/candidates', icon: '👤', label: 'Candidates' },
    { to: '/applications', icon: '📋', label: 'Applications' },
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">🤖</div>
        <h1>Recruit<span>AI</span></h1>
      </div>
      <div className="sidebar-nav">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => isActive ? 'active' : ''}
          >
            <span className="nav-icon">{link.icon}</span>
            {link.label}
          </NavLink>
        ))}
        <NavLink
          to="/interview/setup/demo"
          className={({ isActive }) =>
            `sidebar-interview-link${isActive ? ' active' : ''}`
          }
        >
          <span className="nav-icon">🎤</span>
          Conduct Interview
        </NavLink>
      </div>
      <div className="sidebar-org">
        <div>Organization</div>
        <div className="org-name">{org?.name || 'My Organization'}</div>
        <button
          onClick={clearOrganization}
          style={{
            marginTop: 8,
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.2)',
            color: 'var(--text-muted)',
            padding: '4px 8px',
            borderRadius: 4,
            fontSize: 11,
            cursor: 'pointer'
          }}
        >
          Switch Org
        </button>
      </div>
    </div>
  );
}
