import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { OrgContext } from '../App';
import api from '../api/api';

export default function ApplicationForm() {
  const { org } = useContext(OrgContext);
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [form, setForm] = useState({ jobPostId: '', candidateId: '', coverLetter: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!org?.id) return;
    api.get(`/api/organizations/${org.id}/candidates`).then(res => {
      const data = res.data || res;
      setCandidates(Array.isArray(data) ? data : []);
    });
    api.get(`/api/organizations/${org.id}/jobs`).then(res => {
      const data = res.data || res;
      setJobs(Array.isArray(data) ? data : []);
    });
  }, [org]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/api/organizations/${org.id}/applications`, {
        jobPostId: parseInt(form.jobPostId),
        candidateId: parseInt(form.candidateId),
        coverLetter: form.coverLetter
      });
      navigate('/applications');
    } catch (err) {
      alert('Failed to create application: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Create Application</h1>
      <div className="card">
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Candidate *</label>
              <select className="form-control" value={form.candidateId} onChange={e => setForm({ ...form, candidateId: e.target.value })} required>
                <option value="">Select candidate...</option>
                {candidates.map(c => (
                  <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Job Post *</label>
              <select className="form-control" value={form.jobPostId} onChange={e => setForm({ ...form, jobPostId: e.target.value })} required>
                <option value="">Select job...</option>
                {jobs.map(j => (
                  <option key={j.id} value={j.id}>{j.title}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Cover Letter</label>
              <textarea className="form-control" rows={4} value={form.coverLetter} onChange={e => setForm({ ...form, coverLetter: e.target.value })} placeholder="Optional cover letter..." />
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Creating...' : 'Create Application'}
              </button>
              <button type="button" className="btn btn-outline" onClick={() => navigate('/applications')}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
