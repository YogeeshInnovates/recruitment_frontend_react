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
          <Link to="/screening" className="rd-card">
            <div className="rd-card-glow" />
            <div className="rd-card-icon-wrap" style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)' }}>
              <span className="rd-card-icon">📄</span>
            </div>
            <h3 className="rd-card-title">Resume Screening</h3>
            <p className="rd-card-desc">Upload up to 10 resumes, AI scores & ranks them, then pick the best for interviews</p>
            <span className="rd-card-action">Get Started →</span>
          </Link>
          <Link to="/interview/batch" className="rd-card">
            <div className="rd-card-glow" />
            <div className="rd-card-icon-wrap" style={{ background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)' }}>
              <span className="rd-card-icon">🤖</span>
            </div>
            <h3 className="rd-card-title">AI-Based Interview</h3>
            <p className="rd-card-desc">Upload up to 5 resumes, choose the round, auto-schedule 10-minute slots</p>
            <span className="rd-card-action">Get Started →</span>
          </Link>
          <Link to="/interview/batch/dashboard" className="rd-card">
            <div className="rd-card-glow" />
            <div className="rd-card-icon-wrap" style={{ background: 'linear-gradient(135deg, #0ea5e9, #06b6d4)' }}>
              <span className="rd-card-icon">📊</span>
            </div>
            <h3 className="rd-card-title">Live Interview Dashboard</h3>
            <p className="rd-card-desc">Track candidates live, join interviews, download score / Q&A / activity reports</p>
            <span className="rd-card-action">View Status →</span>
          </Link>
        </div>
      </div>

    </div>
  );
}
