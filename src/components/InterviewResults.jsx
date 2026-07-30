import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export default function InterviewResults() {
  const { interviewId } = useParams();
  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/api/interview/${interviewId}`)
      .then(res => {
        if (!res.ok) throw new Error('Interview not found');
        return res.json();
      })
      .then(data => setInterview(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [interviewId]);

  if (loading) return <div className="loading"><div className="spinner-sm"></div></div>;

  if (error || !interview) {
    return (
      <div style={{ maxWidth: 800, margin: '40px auto', padding: 32 }}>
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: 48 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
            <h2>Results Not Available</h2>
            <p style={{ color: '#64748b', marginTop: 8 }}>{error || 'Interview results could not be loaded.'}</p>
            <Link to="/" className="btn btn-primary" style={{ marginTop: 24 }}>Back to Home</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700 }}>Interview Complete</h1>
          <p style={{ color: '#64748b', marginTop: 4 }}>
            {interview.candidateName || 'Candidate'} — {interview.jobTitle || 'Position'}
          </p>
        </div>
        <Link to="/" className="btn btn-primary">New Interview</Link>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-body" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
          <h2 style={{ marginBottom: 12 }}>Thank you for completing the interview!</h2>
          <p style={{ color: '#64748b', marginBottom: 8 }}>
            Candidate: <strong>{interview.candidateName || 'N/A'}</strong>
          </p>
          <p style={{ color: '#64748b', marginBottom: 8 }}>
            Status: <strong>{interview.status || 'Completed'}</strong>
          </p>
          <p style={{ color: '#64748b' }}>
            The interview results have been recorded. The recruiter will review and get back to you.
          </p>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 32 }}>
        <Link to="/" className="btn btn-primary">Start New Interview</Link>
      </div>
    </div>
  );
}
