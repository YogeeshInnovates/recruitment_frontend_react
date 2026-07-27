import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { OrgContext } from '../App';
import api from '../api/api';

export default function Dashboard() {
  const { org } = useContext(OrgContext);
  const [stats, setStats] = useState({ jobs: 0, candidates: 0, applications: 0, interviews: 0 });
  const [recentApps, setRecentApps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!org?.id) return;
    const fetchData = async () => {
      try {
        const [jobsRes, candidatesRes, applicationsRes] = await Promise.all([
          api.get(`/api/organizations/${org.id}/jobs`).catch(() => ({ data: [] })),
          api.get(`/api/organizations/${org.id}/candidates`).catch(() => ({ data: [] })),
          api.get(`/api/organizations/${org.id}/applications`).catch(() => ({ data: [] }))
        ]);
        const jobs = jobsRes.data || jobsRes || [];
        const candidates = candidatesRes.data || candidatesRes || [];
        const applications = applicationsRes.data || applicationsRes || [];
        setStats({
          jobs: Array.isArray(jobs) ? jobs.length : 0,
          candidates: Array.isArray(candidates) ? candidates.length : 0,
          applications: Array.isArray(applications) ? applications.length : 0,
          interviews: 0
        });
        const apps = Array.isArray(applications) ? applications.slice(0, 5) : [];
        setRecentApps(apps);
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [org]);

  if (loading) {
    return <div className="loading"><div className="spinner-sm"></div></div>;
  }

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)' }}>
          Welcome back, {org?.name}
        </h1>
        <p style={{ color: 'var(--text-light)', marginTop: 4 }}>
          Here's what's happening with your recruitment pipeline
        </p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">💼</div>
          <div className="stat-number">{stats.jobs}</div>
          <div className="stat-label">Open Positions</div>
        </div>
        <div className="stat-card success">
          <div className="stat-icon">👤</div>
          <div className="stat-number">{stats.candidates}</div>
          <div className="stat-label">Candidates</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-icon">📋</div>
          <div className="stat-number">{stats.applications}</div>
          <div className="stat-label">Applications</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-icon">🤖</div>
          <div className="stat-number">{stats.interviews}</div>
          <div className="stat-label">Interviews Conducted</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div className="card">
          <div className="card-header">
            <h3>Recent Applications</h3>
            <Link to="/applications" className="btn btn-sm btn-outline">View All</Link>
          </div>
          <div className="card-body">
            {recentApps.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <h3>No applications yet</h3>
                <p>Create job postings and candidates to start</p>
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Candidate</th>
                      <th>Job</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentApps.map((app) => (
                      <tr key={app.id}>
                        <td>{(() => {
                          const c = app.candidate || {};
                          return c.firstName ? `${c.firstName} ${c.lastName || ''}` : app.candidateName || 'N/A';
                        })()}</td>
                        <td>{(() => {
                          const j = app.jobPost || {};
                          return j.title || app.jobTitle || 'N/A';
                        })()}</td>
                        <td>
                          <span className={`badge badge-${getStatusColor(app.status)}`}>
                            {app.status || 'PENDING'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Quick Actions</h3>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Link to="/jobs/new" className="btn btn-primary" style={{ justifyContent: 'center' }}>
              ➕ Create Job Posting
            </Link>
            <Link to="/candidates/new" className="btn btn-success" style={{ justifyContent: 'center' }}>
              👤 Add Candidate
            </Link>
            <Link to="/applications" className="btn btn-outline" style={{ justifyContent: 'center' }}>
              📋 View Applications
            </Link>
            <Link to="/jobs" className="btn btn-outline" style={{ justifyContent: 'center' }}>
              💼 Browse Jobs
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function getStatusColor(status) {
  const s = (status || '').toUpperCase();
  if (s === 'APPROVED' || s === 'HIRED') return 'success';
  if (s === 'REJECTED') return 'danger';
  if (s === 'INTERVIEW' || s === 'INTERVIEWED') return 'info';
  if (s === 'PENDING' || s === 'SUBMITTED') return 'warning';
  return 'secondary';
}
