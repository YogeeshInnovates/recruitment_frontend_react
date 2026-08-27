import { NavLink } from 'react-router-dom';
import { useContext } from 'react';
import { OrgContext } from '../App';

export default function Sidebar() {
  const { org } = useContext(OrgContext);

  const links = [
    { to: '/dashboard', icon: '📊', label: 'Dashboard' },
    { to: '/screening', icon: '📄', label: 'Resume Screening' },
    { to: '/candidates', icon: '👤', label: 'Candidates' },
    { to: '/interview/setup/demo', icon: '🎤', label: 'Mock Interview' },
    { to: '/team', icon: '👥', label: 'Add Recruiter' },
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

      </div>
    </div>
  );
}
