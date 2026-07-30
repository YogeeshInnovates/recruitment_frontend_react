import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { OrgContext } from '../App';
import { AuthContext } from '../context/AuthContext';

export default function Dashboard() {
  const { org } = useContext(OrgContext);
  const { user } = useContext(AuthContext);
  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
    : 'U';

  return (
    <div className="rd">
      <div className="rd-header">
        <div className="rd-welcome">
          <div className="rd-avatar">{initials}</div>
          <div>
            <h1 className="rd-greeting">Welcome back, {user?.name?.split(' ')[0] || 'Recruiter'}</h1>
            <p className="rd-org-name">{org?.name || 'Your Organization'}</p>
          </div>
        </div>
        <div className="rd-badge">Recruiter</div>
      </div>

      <div className="rd-hero">
        <h2 className="rd-hero-title">What would you like to do today?</h2>
        <div className="rd-hero-cards">
          <Link to="/candidates" className="rd-card">
            <div className="rd-card-glow" />
            <div className="rd-card-icon-wrap" style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)' }}>
              <span className="rd-card-icon">📄</span>
            </div>
            <h3 className="rd-card-title">Resume Screening</h3>
            <p className="rd-card-desc">Upload resumes, extract skills, and match candidates to job openings</p>
            <span className="rd-card-action">Get Started →</span>
          </Link>
          <Link to="/interview/setup/demo" className="rd-card">
            <div className="rd-card-glow" />
            <div className="rd-card-icon-wrap" style={{ background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)' }}>
              <span className="rd-card-icon">🤖</span>
            </div>
            <h3 className="rd-card-title">AI-Based Interview</h3>
            <p className="rd-card-desc">Schedule and conduct adaptive AI-powered voice interviews with candidates</p>
            <span className="rd-card-action">Get Started →</span>
          </Link>
        </div>
      </div>

    </div>
  );
}
