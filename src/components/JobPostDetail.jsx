import { useState, useEffect, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { OrgContext } from '../App';
import api from '../api/api';

export default function JobPostDetail() {
  const { org } = useContext(OrgContext);
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!org?.id) return;
    Promise.all([
      api.get(`/api/organizations/${org.id}/jobs/${id}`).catch(() => null),
      api.get(`/api/organizations/${org.id}/applications`).catch(() => ({ data: [] }))
    ]).then(([jobRes, appsRes]) => {
      const jobData = jobRes?.data || jobRes;
      const appsData = appsRes?.data || appsRes || [];
      setJob(jobData);
      const apps = Array.isArray(appsData) ? appsData.filter(a => {
        const jp = a.jobPost || {};
        return String(jp.id || a.jobPostId) === String(id);
      }) : [];
      setApplications(apps);
    }).finally(() => setLoading(false));
  }, [org, id]);

  if (loading) return <div className="loading"><div className="spinner-sm"></div></div>;
  if (!job) return <div className="empty-state"><h3>Job not found</h3></div>;

  const salaryRange = job.salaryMin && job.salaryMax
    ? `$${job.salaryMin.toLocaleString()} - $${job.salaryMax.toLocaleString()}`
    : job.salaryMin ? `From $${job.salaryMin.toLocaleString()}`
    : 'Not specified';

  const skills = job.requiredSkills ? job.requiredSkills.split(',').map(s => s.trim()).filter(Boolean) : [];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>{job.title}</h1>
          <p style={{ color: 'var(--text-light)', marginTop: 4 }}>
            {job.company} &bull; {job.location} &bull; {job.employmentType}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to={`/jobs/${id}/edit`} className="btn btn-outline">Edit</Link>
          <button onClick={() => navigate(-1)} className="btn btn-secondary">Back</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        <div className="card">
          <div className="card-header"><h3>Job Details</h3></div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 4 }}>Status</div>
                <span className={`badge badge-${job.status === 'ACTIVE' ? 'success' : job.status === 'CLOSED' ? 'danger' : 'secondary'}`}>
                  {job.status}
                </span>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 4 }}>Salary</div>
                <div style={{ fontWeight: 600 }}>{salaryRange}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 4 }}>Experience</div>
                <div>{job.experienceRequired || 'Not specified'}</div>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 4 }}>Description</div>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{job.description || 'No description provided'}</div>
            </div>
            {skills.length > 0 && (
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 8 }}>Required Skills</div>
                <div className="tags">
                  {skills.map((skill, i) => (
                    <span key={i} className="tag tag-blue">{skill}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Applications ({applications.length})</h3>
          </div>
          <div className="card-body">
            {applications.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <h3>No applications yet</h3>
                <p>Candidates will appear here when they apply</p>
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Candidate</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map((app) => {
                      const cand = app.candidate || {};
                      const candName = cand.firstName ? `${cand.firstName} ${cand.lastName || ''}` : 'N/A';
                      return (
                        <tr key={app.id}>
                          <td>{candName}</td>
                          <td>
                            <span className={`badge badge-${getStatusColor(app.status)}`}>
                              {app.status || 'PENDING'}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <Link to={`/applications/${app.id}`} className="btn btn-sm btn-outline">View</Link>
                              <Link to={`/interview/setup/${app.id}`} className="btn btn-sm btn-primary">
                                Interview
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getStatusColor(status) {
  const s = (status || '').toUpperCase();
  if (s === 'HIRED') return 'success';
  if (s === 'REJECTED') return 'danger';
  if (s === 'SHORTLISTED') return 'info';
  if (s === 'SUBMITTED') return 'warning';
  return 'secondary';
}
