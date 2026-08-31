import { useState, useEffect, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { OrgContext } from '../App';
import api from '../api/api';
import InterviewReview from './InterviewReview';

export default function ApplicationDetail() {
  const { org } = useContext(OrgContext);
  const { id } = useParams();
  const navigate = useNavigate();
  const [application, setApplication] = useState(null);
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!org?.id) return;
    Promise.all([
      api.get(`/api/organizations/${org.id}/applications/${id}`),
      api.get(`/api/organizations/${org.id}/interviews/application/${id}`).catch(() => null),
    ])
      .then(([appRes, intRes]) => {
        const data = appRes.data || appRes;
        setApplication(data);
        const list = (intRes && intRes.data) || data.interviews || [];
        setInterviews(list);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [org, id]);

  if (loading) return <div className="loading"><div className="spinner-sm"></div></div>;
  if (!application) return <div className="empty-state"><h3>Application not found</h3></div>;

  const candidate = application?.candidate || {};
  const candidateName = candidate.firstName
    ? `${candidate.firstName} ${candidate.lastName || ''}`.trim()
    : application?.candidateName || 'N/A';
  const jobPost = application?.jobPost || {};
  const jobTitle = jobPost.title || application?.jobTitle || 'N/A';

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Application Details</h1>
          <p style={{ color: 'var(--text-light)', marginTop: 4 }}>
            {candidateName} applying for {jobTitle}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to={`/interview/setup/${id}`} className="btn btn-primary">
            🤖 Schedule AI Interview
          </Link>
          <button onClick={() => navigate(-1)} className="btn btn-secondary">Back</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div className="card">
          <div className="card-header"><h3>Application Info</h3></div>
          <div className="card-body">
            <div className="detail-grid">
              <div className="detail-item">
                <div className="label">Status</div>
                <div className="value">
                  <span className={`badge badge-${getStatusColor(application.status)}`}>
                    {application.status || 'PENDING'}
                  </span>
                </div>
              </div>
              <div className="detail-item">
                <div className="label">AI Score</div>
                <div className="value" style={{
                  fontWeight: 700,
                  color: application.aiScore >= 70 ? 'var(--success)' : 'var(--text-main)',
                  fontSize: 20
                }}>
                  {application.aiScore != null ? `${application.aiScore}%` : 'N/A'}
                </div>
              </div>
              <div className="detail-item">
                <div className="label">Applied Date</div>
                <div className="value">
                  {application.createdAt ? new Date(application.createdAt).toLocaleDateString() : 'N/A'}
                </div>
              </div>
              <div className="detail-item">
                <div className="label">Cover Letter</div>
                <div className="value" style={{ whiteSpace: 'pre-wrap' }}>
                  {application.coverLetter || 'No cover letter'}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>Candidate & Job</h3></div>
          <div className="card-body">
            <div className="detail-item">
              <div className="label">Candidate</div>
              <div className="value">{candidateName}</div>
            </div>
            <div className="detail-item">
              <div className="label">Job Position</div>
              <div className="value">{jobTitle}</div>
            </div>
            <div className="actions-row">
              <Link to={`/interview/setup/${id}`} className="btn btn-primary">
                ðŸŽ¤ Start Interview
              </Link>
            </div>
          </div>
        </div>
      </div>

      {interviews.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h3 style={{ marginBottom: 12 }}>Interview Reviews</h3>
          <div style={{ display: 'grid', gap: 16 }}>
            {interviews.map((iv) => (
              <InterviewReview
                key={iv.id}
                interview={iv}
                candidateName={candidateName}
                jobTitle={jobTitle}
                jobDescription={jobPost.description || application.jobDescription || ''}
                resumeText={candidate.resumeText || ''}
              />
            ))}
          </div>
        </div>
      )}
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
