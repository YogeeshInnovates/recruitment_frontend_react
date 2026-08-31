import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { OrgContext } from '../App';
import api from '../api/api';
import KpiRow from './KpiRow';

export default function JobPostList() {
  const { org } = useContext(OrgContext);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!org?.id) return;
    api.get(`/api/organizations/${org.id}/jobs`)
      .then((res) => {
        const data = res.data || res;
        setJobs(Array.isArray(data) ? data : []);
      })
      .catch(() => setJobs([]))
      .finally(() => setLoading(false));
  }, [org]);

  const handleDelete = async (id) => {
    if (!confirm('Delete this job posting?')) return;
    try {
      await api.delete(`/api/organizations/${org.id}/jobs/${id}`);
      setJobs(jobs.filter(j => j.id !== id));
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  };

  const filtered = jobs.filter(j =>
    (j.title || '').toLowerCase().includes(search.toLowerCase()) ||
    (j.company || '').toLowerCase().includes(search.toLowerCase()) ||
    (j.location || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="loading"><div className="spinner-sm"></div></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Job Postings</h1>
          <p style={{ color: 'var(--text-light)', marginTop: 4 }}>
            Manage your open positions ({jobs.length} total)
          </p>
        </div>
        <Link to="/jobs/new" className="btn btn-primary">
          + New Job
        </Link>
      </div>

      <KpiRow
        items={[
          { label: 'Total Positions', value: jobs.length, icon: '💼', to: '/jobs', color: 'linear-gradient(135deg,#2563eb,#3b82f6)' },
          { label: 'Open', value: jobs.filter(j => (j.status || 'OPEN').toUpperCase() === 'OPEN').length, icon: '🟢', to: '/jobs', color: 'linear-gradient(135deg,#22c55e,#10b981)' },
          { label: 'Closed', value: jobs.filter(j => (j.status || '').toUpperCase() === 'CLOSED').length, icon: '🔒', to: '/jobs', color: 'linear-gradient(135deg,#64748b,#94a3b8)' },
          { label: 'Applications', value: '—', icon: '📝', to: '/applications', color: 'linear-gradient(135deg,#7c3aed,#8b5cf6)' },
        ]}
      />

      <div className="card">
        <div className="card-header">
          <input
            type="text"
            placeholder="Search jobs..."
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
              <div className="empty-icon">💼</div>
              <h3>No job postings found</h3>
              <p>Create your first job posting to start recruiting</p>
              <Link to="/jobs/new" className="btn btn-primary">Create Job</Link>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Company</th>
                    <th>Location</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((job) => (
                    <tr key={job.id}>
                      <td style={{ fontWeight: 600 }}>{job.title}</td>
                      <td>{job.company || '-'}</td>
                      <td>{job.location || '-'}</td>
                      <td>{job.employmentType || '-'}</td>
                      <td>
                        <span className={`badge badge-${job.status === 'ACTIVE' ? 'success' : job.status === 'CLOSED' ? 'danger' : 'secondary'}`}>
                          {job.status || 'ACTIVE'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <Link to={`/jobs/${job.id}`} className="btn btn-sm btn-outline">View</Link>
                          <Link to={`/jobs/${job.id}/edit`} className="btn btn-sm btn-outline">Edit</Link>
                          <button
                            onClick={() => handleDelete(job.id)}
                            className="btn btn-sm btn-danger"
                          >
                            Delete
                          </button>
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
