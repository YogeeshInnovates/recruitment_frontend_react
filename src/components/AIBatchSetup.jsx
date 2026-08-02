import { useState, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { OrgContext } from '../context/OrgContext';
import api from '../api/api';

const MAX_RESUMES = 5;

const ROUNDS = [
  'HR Round',
  'Technical Round 1',
  'Technical Round 2',
  'Technical Round 3',
  'Managerial Round',
  'Final HR / Fitment'
];

const ROLE_SUGGESTIONS = [
  'Software Engineer', 'Frontend Developer', 'Backend Developer', 'Full Stack Developer',
  'Data Scientist', 'Machine Learning Engineer', 'DevOps Engineer', 'QA Engineer',
  'Product Manager', 'Project Manager', 'UX Designer', 'Business Analyst',
  'HR Executive', 'Sales Executive', 'Marketing Executive', 'Finance Analyst'
];

const STEP_LABELS = ['Upload Resumes', 'Job Description', 'Role & Round'];

export default function AIBatchSetup() {
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
  const [result, setResult] = useState(null);

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

  const handleSubmit = async () => {
    if (!orgId) {
      setError('Create an organization first to start AI interviews');
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

      const res = await api.upload(`/api/organizations/${orgId}/ai-batch/setup`, formData);
      setResult(res.data || res);
    } catch (err) {
      setError(err.message || 'Failed to setup AI interviews');
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    const candidates = result.candidates || [];
    return (
      <div className="abs-page">
        <div className="abs-card">
          <div className="abs-result-icon">✅</div>
          <h2 className="abs-title">Resumes Processed</h2>
          <p className="abs-subtitle">
            {candidates.length} candidate{candidates.length !== 1 ? 's' : ''} extracted for the
            <strong> {result.role}</strong> — {result.round}
          </p>
          {result.vectorIndexed ? (
            <p className="abs-ok">Stored in vector database for AI interviews</p>
          ) : (
            <p className="abs-warn">Resumes saved, but vector indexing is still warming up</p>
          )}
          {result.interviewsScheduled > 0 && (
            <p className="abs-ok">
              🗓️ {result.interviewsScheduled} interview slot{result.interviewsScheduled !== 1 ? 's' : ''} scheduled automatically,
              10 minutes apart (one by one). Each candidate was emailed their round, date and time.
            </p>
          )}

          <div className="abs-table-wrap">
            <table className="abs-table">
              <thead>
                <tr>
                  <th>Resume File</th>
                  <th>Candidate</th>
                  <th>Email</th>
                  <th>Experience</th>
                  <th>Skills</th>
                  <th>Slot</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c, i) => (
                  <tr key={c.candidateId || i}>
                    <td className="abs-file">{c.fileName}</td>
                    <td className="abs-name">{c.name}</td>
                    <td>{c.email || '—'}</td>
                    <td>{c.experience || '—'}</td>
                    <td className="abs-skills">{c.skills || '—'}</td>
                    <td>
                      {c.scheduledAt ? (
                        <span className="abs-slot">
                          {new Date(c.scheduledAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                          <br />
                          {new Date(c.scheduledAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                        </span>
                      ) : c.scheduledDate && c.scheduledTime ? (
                        <span className="abs-slot">{c.scheduledDate}<br />{c.scheduledTime}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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

  return (
    <div className="abs-page">
      <div className="abs-card">
        <div className="abs-header">
          <div className="abs-logo">🤖</div>
          <h1 className="abs-title">AI Interview Setup</h1>
          <p className="abs-subtitle">
            Upload resumes, define the job, and we will index candidates for AI interviews
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
              list="abs-roles"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Backend Developer"
              className="abs-input"
            />
            <datalist id="abs-roles">
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
            <button className="btn btn-primary" onClick={handleSubmit} disabled={loading || !orgId}>
              {loading ? 'Processing resumes...' : 'Setup AI Interviews'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
