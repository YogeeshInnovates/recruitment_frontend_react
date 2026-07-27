import { useLocation } from 'react-router-dom';
import { useContext } from 'react';
import { OrgContext } from '../App';

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/jobs': 'Job Postings',
  '/candidates': 'Candidates',
  '/applications': 'Applications',
};

export default function Navbar() {
  const location = useLocation();
  const { org } = useContext(OrgContext);

  const title = pageTitles[location.pathname] || 'RecruitAI';
  const initials = org?.name
    ? org.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
    : 'RA';

  return (
    <div className="navbar">
      <h2>{title}</h2>
      <div className="navbar-actions">
        <input
          type="text"
          className="navbar-search"
          placeholder="Search..."
        />
        <div className="navbar-avatar">{initials}</div>
      </div>
    </div>
  );
}
