import { useState, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { OrgContext } from '../context/OrgContext';
import api from '../api/api';

const MAX_RESUMES = 10;

const ROUNDS = [
  'Technical Interview 1',
  'Technical Interview 2',
  'Technical Interview 3',
  'HR Round'
];

const ROLE_SUGGESTIONS = [
  'Software Engineer', 'Frontend Developer', 'Backend Developer', 'Full Stack Developer',
  'Data Scientist', 'Machine Learning Engineer', 'DevOps Engineer', 'QA Engineer',
  'Product Manager', 'Project Manager', 'UX Designer', 'Business Analyst',
  'HR Executive', 'Sales Executive', 'Marketing Executive', 'Finance Analyst'
];

const STEP_LABELS = ['Upload Resumes', 'Job Description', 'Role & Round'];

export default function ResumeScreening() {
  const { org } = useContext(OrgContext);
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [step, setStep] = useState(1);
  const [files, setFiles] = useState([]);
  const [jobDescription, setJobDescription] = useState('');
  const [role, setRole] = useState('');
  const [round, setRound] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [batch, setBatch] = useState(null);
  const [confirmed, setConfirmed] = useState(false);

  const orgId = org?.id;

  const addFiles = (incoming) => {
    const list = Array.from(incoming).filter(
      f => /\.(pdf|doc|docx|txt)$/i.test(f.name)
    );
    const merged = [...files, ...list].slice(0, MAX_RESUMES);
    setFiles(merged);
    setError('');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const canNext = () => {
    if (step === 1) return files.length > 0;
    if (step === 2) return jobDescription.trim().length > 0;
    return role.trim() && round;
  };

  const handleNext = () => {
    if (!canNext()) {
      setError(step === 1 ? 'Upload at least one resume'
        : step === 2 ? 'Enter the job description'
        : 'Select the role and round');
      return;
    }
    setError('');
    setStep(step + 1);
  };

  const handleScreen = async () => {
    if (!orgId) {
      setError('Create an organization first to screen resumes');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      files.forEach(f => formData.append('files', f));
      formData.append('jobDescription', jobDescription);
      formData.append('role', role);
      formData.append('round', round);

      const res = await api.upload(`/api/organizations/${orgId}/ai-screening/screen`, formData);
      setBatch(res.data || res);
    } catch (err) {
      setError(err.message || 'Failed to screen resumes');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!batch?.batchId) return;
    setLoading(true);
    setError('');
    try {
      await api.post(`/api/organizations/${orgId}/ai-screening/confirm`, { batchId: batch.batchId });
      setConfirmed(true);
    } catch (err) {
      setError(err.message || 'Failed to confirm and schedule interviews');
    } finally {
      setLoading(false);
    }
  };

  const formatScore = (s) => {
    const n = Number(s);
    return Number.isFinite(n) ? `${Math.round(n)}` : '—';
  };

  const scoreClass = (s) => {
    const n = Number(s);
    if (!Number.isFinite(n)) return 'neutral';
    return n >= 75 ? 'high' : n >= 50 ? 'mid' : 'low';
  };

  const skillList = (arr) => {
    if (!arr || !arr.length) return '—';
    return Array.isArray(arr) ? arr.join(', ') : String(arr);
  };

  if (batch && confirmed) {
    const candidates = batch.candidates || [];
    const scheduled = (batch.schedule || []).length;
    return (
      <div className="abs-page">
        <div className="abs-card">
          <div className="abs-result-icon">✅</div>
          <h2 className="abs-title">Screening Confirmed</h2>
          <p className="abs-subtitle">
            {scheduled} candidate{scheduled !== 1 ? 's' : ''} shortlisted for the
            <strong> {batch.role}</strong> — {batch.round}
          </p>
          <p className="abs-ok">
            🗓️ Interviews scheduled on the confirmed time slots. Each candidate was emailed
            their round, date and time.
          </p>
          <div className="abs-actions">
            <button className="btn btn-primary" onClick={() => navigate('/interview/batch/dashboard')}>
              Open Live Dashboard
            </button>
            <button className="btn btn-outline" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (batch) {
    const candidates = [...(batch.candidates || [])].sort(
      (a, b) => (Number(b.score) || 0) - (Number(a.score) || 0)
    );
    const schedule = batch.schedule || [];
    return (
      <div className="abs-page">
        <div className="abs-card">
          <div className="abs-header">
            <div className="abs-logo">🧠</div>
            <h1 className="abs-title">Screening Results</h1>
            <p className="abs-subtitle">
              {batch.role} — {batch.round} · scored & ranked by AI
            </p>
          </div>

          {error && <div className="abs-error">{error}</div>}

          <div className="abs-table-wrap">
            <table className="abs-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Resume File</th>
                  <th>Candidate</th>
                  <th>Score</th>
                  <th>Matched Skills</th>
                  <th>Missing Skills</th>
                  <th>Suggested Slot</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c, i) => {
                  const bd = c.score_breakdown || {};
                  const bdTotal = (Number(bd.skills_match) || 0) + (Number(bd.experience_relevance) || 0)
                    + (Number(bd.project_quality) || 0) + (Number(bd.education) || 0);
                  return (
                    <tr key={c.candidate_id || i}>
                      <td className="abs-rank">#{i + 1}</td>
                      <td className="abs-file">{c.fileName || '—'}</td>
                      <td className="abs-name">{c.candidate_name || '—'}</td>
                      <td>
                        <span className={`abs-score ${scoreClass(c.score)}`}>{formatScore(c.score)}</span>
                        {bdTotal > 0 && (
                          <div className="abs-score-bar-wrap">
                            <div className="abs-score-bar" style={{ width: `${Math.min(100, (Number(c.score) / 100) * 100)}%` }} />
                          </div>
                        )}
                      </td>
                      <td className="abs-skills">{skillList(c.matched_skills)}</td>
                      <td className="abs-skills">{skillList(c.missing_skills)}</td>
                      <td>{slotFor(schedule, c.candidate_id)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {schedule.length > 0 && (
            <div className="abs-schedule-preview">
              <p className="abs-field-label">🗓️ Proposed Interview Schedule</p>
              <p className="abs-schedule-hint">
                {schedule.length} slot{schedule.length !== 1 ? 's' : ''}, first one starts{' '}
                <strong>~8 minutes after you confirm</strong> — each next candidate starts only
                after the previous one's allotted time, one by one.
              </p>
            </div>
          )}

          <div className="abs-meta">
            <p className="abs-ok">Ranked by score (highest first) · human confirmation required before interviews begin</p>
          </div>

          <div className="abs-actions">
            <button
              className="btn btn-primary"
              onClick={handleConfirm}
              disabled={loading || schedule.length === 0}
            >
              {loading ? 'Scheduling interviews...' : 'Confirm & Schedule Interviews'}
            </button>
            <button className="btn btn-outline" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="abs-page">
      <div className="abs-card">
        <div className="abs-header">
          <div className="abs-logo">🧠</div>
          <h1 className="abs-title">Resume Screening</h1>
          <p className="abs-subtitle">
            Upload resumes, define the job, and we will score & rank candidates with AI
          </p>
        </div>

        <div className="abs-steps">
          {STEP_LABELS.map((label, i) => {
            const n = i + 1;
            return (
              <div key={label} className={`abs-step ${step === n ? 'active' : ''} ${step > n ? 'done' : ''}`}>
                <div className="abs-step-num">{step > n ? '✓' : n}</div>
                <div className="abs-step-label">{label}</div>
              </div>
            );
          })}
        </div>

        {error && <div className="abs-error">{error}</div>}

        {step === 1 && (
          <div className="abs-body">
            <p className="abs-field-label">Upload Resumes (max {MAX_RESUMES})</p>
            <div
              className={`abs-drop ${dragOver ? 'over' : ''}`}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="abs-drop-icon">📁</div>
              <div className="abs-drop-text">Drop resumes here or click to browse</div>
              <div className="abs-drop-hint">PDF, DOC, DOCX, TXT — up to {MAX_RESUMES} files</div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                multiple
                onChange={(e) => addFiles(e.target.files)}
                style={{ display: 'none' }}
              />
            </div>

            {files.length > 0 && (
              <div className="abs-file-list">
                {files.map((f, i) => (
                  <div key={`${f.name}-${i}`} className="abs-file-item">
                    <span className="abs-file-item-icon">📄</span>
                    <span className="abs-file-item-name">{f.name}</span>
                    <span className="abs-file-item-size">{(f.size / 1024).toFixed(1)} KB</span>
                    <button className="abs-file-remove" onClick={() => removeFile(i)}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="abs-body">
            <p className="abs-field-label">Job Description *</p>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the job description. Include responsibilities, required skills, and experience..."
              rows={10}
              className="abs-textarea"
            />
          </div>
        )}

        {step === 3 && (
          <div className="abs-body">
            <p className="abs-field-label">What role are you hiring for? *</p>
            <input
              list="rs-roles"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Backend Developer"
              className="abs-input"
            />
            <datalist id="rs-roles">
              {ROLE_SUGGESTIONS.map(r => <option key={r} value={r} />)}
            </datalist>

            <p className="abs-field-label" style={{ marginTop: 20 }}>Which interview round? *</p>
            <select value={round} onChange={(e) => setRound(e.target.value)} className="abs-input">
              <option value="">Select round</option>
              {ROUNDS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        )}

        <div className="abs-actions">
          {step > 1 && (
            <button className="btn btn-outline" onClick={() => setStep(step - 1)} disabled={loading}>
              Back
            </button>
          )}
          {step < 3 ? (
            <button className="btn btn-primary" onClick={handleNext}>
              Continue
            </button>
          ) : (
            <>
              {!orgId && (
                <p className="abs-error" style={{ marginBottom: 12 }}>
                  You need to create an organization first — use "Create Organization" on your
                  dashboard, then come back here.
                </p>
              )}
              <button className="btn btn-primary" onClick={handleScreen} disabled={loading || !orgId}>
                {loading ? 'Scoring resumes...' : 'Screen Resumes'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function slotFor(schedule, cid) {
  const hit = (schedule || []).find(s => String(s.candidate_id) === String(cid));
  if (!hit) return '—';
  if (!hit.start_at) return hit.date_time || '—';
  try {
    return new Date(hit.start_at).toLocaleString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit'
    });
  } catch {
    return hit.start_at;
  }
}