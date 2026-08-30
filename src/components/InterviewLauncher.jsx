import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';

export default function InterviewLauncher() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [jobDescription, setJobDescription] = useState('');
  const [resumeFile, setResumeFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!jobDescription.trim()) {
      setError('Please enter a job description');
      return;
    }
    if (!resumeFile) {
      setError('Please upload a resume');
      return;
    }

    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('jobDescription', jobDescription);
    formData.append('resume', resumeFile);
    formData.append('mock', 'true');

    try {
      const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
      const res = await fetch(`${BASE_URL}/api/interview/setup`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to setup interview');
      }

      const data = await res.json();
      if (data?.interviewId) {
        navigate(`/interview/${data.interviewId}?mock=1`);
        return;
      }
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartInterview = () => {
    if (result?.interviewId) {
      navigate(`/interview/${result.interviewId}`);
    }
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) setResumeFile(file);
  };

  if (result) {
    const scheduledTime = new Date(result.scheduledAt);
    const now = new Date();
    const diffMs = scheduledTime.getTime() - now.getTime();
    const diffMinutes = Math.max(0, Math.ceil(diffMs / 60000));

    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}>
        <div style={{
          background: '#ffffff',
          borderRadius: 16,
          padding: 48,
          maxWidth: 560,
          width: '100%',
          boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
          textAlign: 'center',
        }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px', fontSize: 36,
          }}>✓</div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
            Interview Scheduled!
          </h2>
          <p style={{ color: '#64748b', marginBottom: 24 }}>
            Interview link has been sent to <strong>{result.candidateEmail}</strong>
          </p>

          <div style={{
            background: '#f8fafc', borderRadius: 12, padding: 20,
            textAlign: 'left', marginBottom: 24,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ color: '#64748b' }}>Candidate</span>
              <span style={{ fontWeight: 600 }}>{result.candidateName}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ color: '#64748b' }}>Email</span>
              <span style={{ fontWeight: 600 }}>{result.candidateEmail || 'Not found'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ color: '#64748b' }}>Experience</span>
              <span style={{ fontWeight: 600 }}>{result.experience}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ color: '#64748b' }}>Skills</span>
              <span style={{ fontWeight: 600, maxWidth: '60%', textAlign: 'right' }}>{result.skills}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Interview starts in</span>
              <span style={{ fontWeight: 700, color: '#7c3aed' }}>{diffMinutes} minute{diffMinutes !== 1 ? 's' : ''}</span>
            </div>
          </div>

          <button
            onClick={handleStartInterview}
            style={{
              width: '100%', padding: '14px 24px',
              background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
              color: 'white', border: 'none', borderRadius: 12,
              fontSize: 16, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Start Interview Now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: 16,
        padding: 48,
        maxWidth: 640,
        width: '100%',
        boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', fontSize: 28, color: 'white',
          }}>🤖</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
            AI Interview Setup
          </h1>
          <p style={{ color: '#64748b', fontSize: 15 }}>
            Paste the job description and upload candidate's resume to start an AI-powered interview
          </p>
        </div>

        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: 8, padding: '12px 16px', marginBottom: 20,
            color: '#dc2626', fontSize: 14,
          }}>{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontWeight: 600, color: '#0f172a', marginBottom: 8, fontSize: 14 }}>
              Job Description *
            </label>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the job description here. Include role, responsibilities, required skills, and experience..."
              rows={8}
              style={{
                width: '100%', padding: '12px 16px',
                border: '1px solid #e2e8f0', borderRadius: 10,
                fontSize: 14, resize: 'vertical',
                fontFamily: 'inherit', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: 32 }}>
            <label style={{ display: 'block', fontWeight: 600, color: '#0f172a', marginBottom: 8, fontSize: 14 }}>
              Resume (PDF, DOC, DOCX, TXT) *
            </label>
            <div
              onDrop={handleFileDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? '#7c3aed' : '#e2e8f0'}`,
                borderRadius: 10, padding: '32px 20px',
                textAlign: 'center', cursor: 'pointer',
                background: dragOver ? '#f5f3ff' : '#f8fafc',
                transition: 'all 0.2s',
              }}
            >
              {resumeFile ? (
                <div>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>📄</div>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{resumeFile.name}</div>
                  <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                    {(resumeFile.size / 1024).toFixed(1)} KB — Click to change
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>📁</div>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>Drop resume here or click to browse</div>
                  <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                    Supports PDF, DOC, DOCX, TXT
                  </div>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                onChange={(e) => setResumeFile(e.target.files[0])}
                style={{ display: 'none' }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '14px 24px',
              background: loading ? '#94a3b8' : 'linear-gradient(135deg, #7c3aed, #6366f1)',
              color: 'white', border: 'none', borderRadius: 12,
              fontSize: 16, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {loading ? 'Setting up interview...' : 'Setup Interview'}
          </button>
        </form>
      </div>
    </div>
  );
}
