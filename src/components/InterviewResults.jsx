import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { OrgContext } from '../App';
import api from '../api/api';

export default function InterviewResults() {
  const { interviewId } = useParams();
  const { org } = useContext(OrgContext);
  const navigate = useNavigate();
  const [interview, setInterview] = useState(null);
  const [transcript, setTranscript] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!org?.id) return;
    Promise.all([
      api.get(`/api/organizations/${org.id}/interviews/${interviewId}`).catch(() => null),
      api.get(`/api/organizations/${org.id}/interviews/${interviewId}/transcript`).catch(() => ({ data: [] }))
    ]).then(([interviewRes, transcriptRes]) => {
      const intData = interviewRes?.data || interviewRes;
      const transData = transcriptRes?.data || transcriptRes || [];
      setInterview(intData);
      setTranscript(Array.isArray(transData) ? transData : []);
    }).catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [org, interviewId]);

  if (loading) return <div className="loading"><div className="spinner-sm"></div></div>;
  if (error || !interview) {
    return (
      <div style={{ maxWidth: 800, margin: '40px auto', padding: 32 }}>
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: 48 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
            <h2>Results Not Available</h2>
            <p style={{ color: 'var(--text-light)', marginTop: 8 }}>
              {error || 'Interview results could not be loaded.'}
            </p>
            <Link to="/dashboard" className="btn btn-primary" style={{ marginTop: 24 }}>
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const overall = interview.aiScore || 0;
  const recommendation = interview.aiRecommendation || 'N/A';

  const application = interview.application || {};
  const candidate = application.candidate || {};
  const jobPost = application.jobPost || {};
  const candidateName = candidate.firstName
    ? `${candidate.firstName} ${candidate.lastName || ''}`.trim()
    : 'Candidate';
  const jobTitle = jobPost.title || 'Position';

  const getScoreColor = (score) => {
    if (score >= 70) return 'green';
    if (score >= 50) return 'blue';
    if (score >= 30) return 'yellow';
    return 'red';
  };

  const getRecommendationBadge = (rec) => {
    const r = (rec || '').toUpperCase();
    if (r.includes('HIRE') || r.includes('STRONG')) return 'success';
    if (r.includes('MAYBE') || r.includes('CONSIDER')) return 'warning';
    return 'danger';
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700 }}>Interview Results</h1>
          <p style={{ color: 'var(--text-light)', marginTop: 4 }}>
            {candidateName} — {jobTitle}
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>
            {interview.startedAt ? `Started: ${new Date(interview.startedAt).toLocaleString()}` : ''}
            {interview.endedAt ? ` | Ended: ${new Date(interview.endedAt).toLocaleString()}` : ''}
          </p>
        </div>
        <Link to="/dashboard" className="btn btn-primary">
          Back to Dashboard
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h3>Score Overview</h3>
        </div>
        <div className="card-body">
          <div className="score-grid">
            <div className="score-item">
              <div className="score-value">{overall > 0 ? `${overall}` : 'N/A'}</div>
              <div className="score-label">AI Score</div>
              {overall > 0 && (
                <div className="progress-bar">
                  <div
                    className={`fill ${getScoreColor(overall)}`}
                    style={{ width: `${overall}%` }}
                  />
                </div>
              )}
            </div>
            <div className="score-item">
              <div className="score-value" style={{ fontSize: 20 }}>
                {interview.status || 'N/A'}
              </div>
              <div className="score-label">Status</div>
            </div>
            <div className="score-item">
              <div className="score-value" style={{ fontSize: 20 }}>
                {transcript.length}
              </div>
              <div className="score-label">Messages Exchanged</div>
            </div>
          </div>
        </div>
      </div>

      {recommendation && recommendation !== 'N/A' && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-body" style={{ textAlign: 'center', padding: 32 }}>
            <div style={{ fontSize: 14, color: 'var(--text-light)', marginBottom: 8 }}>
              AI Recommendation
            </div>
            <span className={`badge badge-${getRecommendationBadge(recommendation)}`} style={{ fontSize: 16, padding: '8px 24px' }}>
              {recommendation}
            </span>
          </div>
        </div>
      )}

      {transcript.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3>Full Transcript</h3>
            <span style={{ fontSize: 13, color: 'var(--text-light)' }}>
              {transcript.length} messages
            </span>
          </div>
          <div className="card-body">
            <div className="transcript-container">
              {transcript.map((entry, i) => (
                <div key={i} className="transcript-entry">
                  <div className={`speaker ${entry.speaker === 'ai_agent' ? 'ai' : entry.speaker || 'ai'}`}>
                    {entry.speaker === 'ai_agent' ? 'AI Interviewer'
                      : entry.speaker === 'candidate' ? 'Candidate'
                      : entry.speaker === 'recruiter' ? 'Recruiter'
                      : entry.speaker || 'Unknown'}
                  </div>
                  <div className="content">
                    {entry.content || ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {transcript.length === 0 && (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: 48 }}>
            <p style={{ color: 'var(--text-muted)' }}>No transcript available for this interview.</p>
          </div>
        </div>
      )}

      <div style={{ marginTop: 32, textAlign: 'center' }}>
        <Link to="/dashboard" className="btn btn-primary btn-lg">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
