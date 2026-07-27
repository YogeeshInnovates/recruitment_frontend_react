import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { OrgContext } from '../App';
import api from '../api/api';

export default function InterviewSetup() {
  const { org } = useContext(OrgContext);
  const { applicationId } = useParams();
  const navigate = useNavigate();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [scheduling, setScheduling] = useState(false);

  useEffect(() => {
    if (!org?.id) return;
    api.get(`/api/organizations/${org.id}/applications/${applicationId}`)
      .then((res) => {
        const data = res.data || res;
        setApplication(data);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [org, applicationId]);

  const startAiInterview = () => {
    navigate(`/interview/agent/${applicationId}`);
  };

  const handleScheduleLater = async () => {
    if (!scheduledAt) return;
    setScheduling(true);
    try {
      const isoDateTime = scheduledAt.replace('T', 'T') + ':00';
      await api.post(`/api/organizations/${org.id}/interviews`, {
        applicationId: parseInt(applicationId),
        interviewType: 'AGENT',
        scheduledAt: isoDateTime
      });
      alert('Interview scheduled successfully!');
      navigate('/applications');
    } catch (err) {
      alert('Failed to schedule: ' + err.message);
    } finally {
      setScheduling(false);
    }
  };

  if (loading) return <div className="loading"><div className="spinner-sm"></div></div>;

  const candidate = application?.candidate || {};
  const candidateName = candidate.firstName
    ? `${candidate.firstName} ${candidate.lastName || ''}`.trim()
    : application?.candidateName || 'Candidate';
  const jobPost = application?.jobPost || {};
  const jobTitle = jobPost.title || application?.jobTitle || 'Position';

  return (
    <div className="interview-setup">
      <h2>Set Up Interview</h2>
      <p className="subtitle">
        Scheduling interview for <strong>{candidateName}</strong> — <strong>{jobTitle}</strong>
      </p>

      <div className="interview-options">
        <div className="interview-option-card agent selected">
          <div className="option-icon">🤖</div>
          <div className="option-content">
            <h3>AI Agent Interview</h3>
            <p>Our AI will conduct the interview automatically using the candidate's resume and job requirements.</p>
            <ul className="option-features">
              <li>Available 24/7 — no scheduling conflicts</li>
              <li>Instant scheduling — start immediately</li>
              <li>Consistent, unbiased evaluation</li>
              <li>Questions based on resume &amp; job description</li>
              <li>Full transcript and scoring report</li>
            </ul>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 32, textAlign: 'center' }}>
        <button
          onClick={startAiInterview}
          className="btn btn-primary btn-lg"
          style={{ fontSize: 16, padding: '16px 40px' }}
        >
          🚀 Start AI Interview Now
        </button>
      </div>

      <div style={{ marginTop: 32, textAlign: 'center' }}>
        {!scheduleMode ? (
          <button
            onClick={() => setScheduleMode(true)}
            className="btn btn-outline"
          >
            📅 Schedule for Later
          </button>
        ) : (
          <div className="schedule-section" style={{ textAlign: 'left' }}>
            <h3>Schedule for Later</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Date & Time</label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>&nbsp;</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleScheduleLater}
                    className="btn btn-primary"
                    disabled={!scheduledAt || scheduling}
                  >
                    {scheduling ? 'Scheduling...' : 'Confirm'}
                  </button>
                  <button
                    onClick={() => setScheduleMode(false)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
