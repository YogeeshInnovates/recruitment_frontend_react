import { useState, useEffect, useContext } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { OrgContext } from '../App';
import api from '../api/api';

export default function CandidateForm() {
  const { org } = useContext(OrgContext);
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    skills: '',
    experience: '',
    education: '',
    resumeText: ''
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isEdit && org?.id) {
      api.get(`/api/organizations/${org.id}/candidates/${id}`)
        .then((res) => {
          const data = res.data || res;
          setForm({
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            email: data.email || '',
            phone: data.phone || '',
            skills: data.skills || '',
            experience: data.experience || '',
            education: data.education || '',
            resumeText: data.resumeText || ''
          });
        })
        .catch((err) => setError(err.message))
        .finally(() => setFetching(false));
    }
  }, [id, org, isEdit]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.firstName || !form.email) {
      setError('First name and email are required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (isEdit) {
        await api.put(`/api/organizations/${org.id}/candidates/${id}`, form);
      } else {
        await api.post(`/api/organizations/${org.id}/candidates`, form);
      }
      navigate('/candidates');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <div className="loading"><div className="spinner-sm"></div></div>;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>
        {isEdit ? 'Edit Candidate' : 'Add Candidate'}
      </h1>
      <div className="card">
        <div className="card-body">
          {error && (
            <div style={{
              padding: '12px 16px',
              background: 'var(--danger-light)',
              color: '#dc2626',
              borderRadius: 'var(--radius)',
              marginBottom: 20,
              fontSize: 14
            }}>
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>First Name *</label>
                <input
                  type="text"
                  name="firstName"
                  value={form.firstName}
                  onChange={handleChange}
                  placeholder="e.g. John"
                  required
                />
              </div>
              <div className="form-group">
                <label>Last Name</label>
                <input
                  type="text"
                  name="lastName"
                  value={form.lastName}
                  onChange={handleChange}
                  placeholder="e.g. Doe"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="john@example.com"
                  required
                />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="+1 234 567 890"
                />
              </div>
            </div>
            <div className="form-group">
              <label>Skills (comma-separated)</label>
              <input
                type="text"
                name="skills"
                value={form.skills}
                onChange={handleChange}
                placeholder="e.g. Java, React, Spring Boot, SQL"
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Experience</label>
                <input
                  type="text"
                  name="experience"
                  value={form.experience}
                  onChange={handleChange}
                  placeholder="e.g. 5 years in backend development"
                />
              </div>
              <div className="form-group">
                <label>Education</label>
                <input
                  type="text"
                  name="education"
                  value={form.education}
                  onChange={handleChange}
                  placeholder="e.g. B.S. Computer Science"
                />
              </div>
            </div>
            <div className="form-group">
              <label>Resume / Background</label>
              <textarea
                name="resumeText"
                value={form.resumeText}
                onChange={handleChange}
                placeholder="Paste candidate's resume content or provide background summary..."
                rows={8}
              />
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving...' : isEdit ? 'Update Candidate' : 'Add Candidate'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate('/candidates')}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
