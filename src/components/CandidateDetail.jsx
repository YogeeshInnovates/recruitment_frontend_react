import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { OrgContext } from '../App';
import api from '../api/api';

export default function CandidateDetail() {
  const { org } = useContext(OrgContext);
  const { id } = useParams();
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!org?.id) return;
    api.get(`/api/organizations/${org.id}/candidates/${id}`)
      .then((res) => {
        const data = res.data || res;
        setCandidate(data);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [org, id]);

  if (loading) return <div className="loading"><div className="spinner-sm"></div></div>;
  if (!candidate) return <div className="empty-state"><h3>Candidate not found</h3></div>;

  const skills = candidate.skills ? candidate.skills.split(',').map(s => s.trim()).filter(Boolean) : [];
  const fullName = `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim();

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>{fullName}</h1>
          <p style={{ color: 'var(--text-light)', marginTop: 4 }}>
            {candidate.email} &bull; {candidate.phone || 'No phone'}
          </p>
        </div>
        <button onClick={() => navigate(-1)} className="btn btn-secondary">Back</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div className="card">
          <div className="card-header"><h3>Candidate Information</h3></div>
          <div className="card-body">
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 4 }}>Skills</div>
              <div className="tags">
                {skills.map((skill, i) => (
                  <span key={i} className="tag tag-blue">{skill}</span>
                ))}
                {skills.length === 0 && (
                  <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>No skills listed</span>
                )}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 4 }}>Experience</div>
              <div>{candidate.experience || 'Not specified'}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 4 }}>Education</div>
              <div>{candidate.education || 'Not specified'}</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>Resume</h3></div>
          <div className="card-body">
            <div style={{
              whiteSpace: 'pre-wrap',
              fontSize: 14,
              lineHeight: 1.7,
              color: 'var(--text)',
              maxHeight: 400,
              overflowY: 'auto'
            }}>
              {candidate.resumeText || 'No resume content available'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
