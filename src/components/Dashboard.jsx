import { useContext, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { OrgContext } from '../App';
import { AuthContext } from '../context/AuthContext';
import api from '../api/api';

export default function Dashboard() {
  const { org } = useContext(OrgContext);
  const { user } = useContext(AuthContext);
  const [stats, setStats] = useState({ candidates: 0, jobs: 0, applications: 0 });
  const [loadingStats, setLoadingStats] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!org?.id) return;
    setLoadingStats(true);
    try {
      const [c, j, a] = await Promise.all([
        api.get(`/api/organizations/${org.id}/candidates`),
        api.get(`/api/organizations/${org.id}/jobs`),
        api.get(`/api/organizations/${org.id}/applications`),
      ]);
      const cands = Array.isArray(c.data || c) ? (c.data || c) : [];
      const jobs = Array.isArray(j.data || j) ? (j.data || j) : [];
      const apps = Array.isArray(a.data || a) ? (a.data || a) : [];
      setStats({ candidates: cands.length, jobs: jobs.length, applications: apps.length });
    } catch {
      setStats({ candidates: 0, jobs: 0, applications: 0 });
    } finally {
      setLoadingStats(false);
    }
  }, [org]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
    : 'U';

  const statsData = [
    { label: 'Candidates', value: stats.candidates, icon: '👥', to: '/candidates', color: 'linear-gradient(135deg,#2563eb,#3b82f6)' },
    { label: 'Open Jobs', value: stats.jobs, icon: '💼', to: '/jobs', color: 'linear-gradient(135deg,#7c3aed,#8b5cf6)' },
    { label: 'Applications', value: stats.applications, icon: '📝', to: '/applications', color: 'linear-gradient(135deg,#0ea5e9,#06b6d4)' },
    { label: 'Interviews', value: '—', icon: '🎤', to: '/interview/batch/dashboard', color: 'linear-gradient(135deg,#22c55e,#10b981)' },
  ];

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

      {/* KPI stat cards */}
      <div className="rd-stats">
        {statsData.map((s) => (
          <Link to={s.to} className="rd-stat-card" key={s.label}>
            <div className="rd-stat-icon" style={{ background: s.color }}>{s.icon}</div>
            <div className="rd-stat-body">
              <div className="rd-stat-value">{loadingStats ? '…' : s.value}</div>
              <div className="rd-stat-label">{s.label}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="rd-hero">
        <h2 className="rd-hero-title">Quick actions</h2>
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
