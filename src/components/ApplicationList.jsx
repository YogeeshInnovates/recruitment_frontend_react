import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { OrgContext } from '../App';
import api from '../api/api';

export default function ApplicationList() {
  const { org } = useContext(OrgContext);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!org?.id) return;
    api.get(`/api/organizations/${org.id}/applications`)
      .then((res) => {
        const data = res.data || res;
        setApplications(Array.isArray(data) ? data : []);
      })
      .catch(() => setApplications([]))
      .finally(() => setLoading(false));
  }, [org]);

  const filtered = applications.filter(a => {
    const cand = a.candidate || {};
    const candName = cand.firstName ? `${cand.firstName} ${cand.lastName || ''}` : a.candidateName || '';
    const job = a.jobPost || {};
    const jobName = job.title || a.jobTitle || '';
    return candName.toLowerCase().includes(search.toLowerCase()) ||
           jobName.toLowerCase().includes(search.toLowerCase());
  });

  if (loading) return <div className="loading"><div className="spinner-sm"></div></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Applications</h1>
          <p style={{ color: 'var(--text-light)', marginTop: 4 }}>
            Track all candidate applications ({applications.length} total)
          </p>
        </div>
        <Link to="/applications/new" className="btn btn-primary" style={{ height: 'fit-content' }}>
          + Create Application
        </Link>
      </div>

      <div className="card">
        <div className="card-header">
          <input
            type="text"
            placeholder="Search applications..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: '8px 16px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              fontSize: 14,
              width: 300,
              outline: 'none'
            }}
          />
        </div>
        <div className="card-body">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <h3>No applications found</h3>
              <p>Applications will appear when candidates apply for jobs</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Job Position</th>
                    <th>Status</th>
                    <th>AI Score</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((app) => (
                    <tr key={app.id}>
                      <td style={{ fontWeight: 600 }}>
                        {(() => {
                          const c = app.candidate || {};
                          return c.firstName ? `${c.firstName} ${c.lastName || ''}` : app.candidateName || 'N/A';
                        })()}
                      </td>
                      <td>{(() => {
                        const j = app.jobPost || {};
                        return j.title || app.jobTitle || 'N/A';
                      })()}</td>
                      <td>
                        <span className={`badge badge-${getStatusColor(app.status)}`}>
                          {app.status || 'PENDING'}
                        </span>
                      </td>
                      <td>
                        {app.aiScore != null ? (
                          <span style={{
                            fontWeight: 600,
                            color: app.aiScore >= 70 ? 'var(--success)' : app.aiScore >= 40 ? 'var(--warning)' : 'var(--danger)'
                          }}>
                            {app.aiScore}%
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>-</span>
                        )}
                      </td>
                      <td>{app.createdAt ? new Date(app.createdAt).toLocaleDateString() : '-'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <Link to={`/applications/${app.id}`} className="btn btn-sm btn-outline">
                            View
                          </Link>
                          <Link to={`/interview/setup/${app.id}`} className="btn btn-sm btn-primary">
                            Interview
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
