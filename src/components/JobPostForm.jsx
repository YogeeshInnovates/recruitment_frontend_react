import { useState, useEffect, useContext } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { OrgContext } from '../App';
import api from '../api/api';

export default function JobPostForm() {
  const { org } = useContext(OrgContext);
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [form, setForm] = useState({
    title: '',
    description: '',
    company: '',
    location: '',
    salaryMin: '',
    salaryMax: '',
    requiredSkills: '',
    experienceRequired: '',
    employmentType: 'FULL_TIME',
    status: 'ACTIVE'
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isEdit && org?.id) {
      api.get(`/api/organizations/${org.id}/jobs/${id}`)
        .then((res) => {
          const data = res.data || res;
          setForm({
            title: data.title || '',
            description: data.description || '',
            company: data.company || '',
            location: data.location || '',
            salaryMin: data.salaryMin || '',
            salaryMax: data.salaryMax || '',
            requiredSkills: data.requiredSkills || '',
            experienceRequired: data.experienceRequired || '',
            employmentType: data.employmentType || 'FULL_TIME',
            status: data.status || 'ACTIVE'
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
    if (!form.title || !form.company) {
      setError('Job title and company are required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const payload = {
        ...form,
        salaryMin: form.salaryMin ? parseFloat(form.salaryMin) : null,
        salaryMax: form.salaryMax ? parseFloat(form.salaryMax) : null
      };
      if (isEdit) {
        await api.put(`/api/organizations/${org.id}/jobs/${id}`, payload);
      } else {
        await api.post(`/api/organizations/${org.id}/jobs`, payload);
      }
      navigate('/jobs');
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
        {isEdit ? 'Edit Job Posting' : 'Create Job Posting'}
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
            <div className="form-group">
              <label>Job Title *</label>
              <input
                type="text"
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="e.g. Senior Software Engineer"
                required
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Company *</label>
                <input
                  type="text"
                  name="company"
                  value={form.company}
                  onChange={handleChange}
                  placeholder="e.g. TechCorp Inc."
                  required
                />
              </div>
              <div className="form-group">
                <label>Location</label>
                <input
                  type="text"
                  name="location"
                  value={form.location}
                  onChange={handleChange}
                  placeholder="e.g. New York, NY"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Employment Type</label>
                <select name="employmentType" value={form.employmentType} onChange={handleChange}>
                  <option value="FULL_TIME">Full Time</option>
                  <option value="PART_TIME">Part Time</option>
                  <option value="CONTRACT">Contract</option>
                  <option value="INTERNSHIP">Internship</option>
                </select>
              </div>
              <div className="form-group">
                <label>Experience Required</label>
                <select name="experienceRequired" value={form.experienceRequired} onChange={handleChange}>
                  <option value="">Select...</option>
                  <option value="0-1 years">0-1 years</option>
                  <option value="1-3 years">1-3 years</option>
                  <option value="3-5 years">3-5 years</option>
                  <option value="5-10 years">5-10 years</option>
                  <option value="10+ years">10+ years</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Salary Min</label>
                <input
                  type="number"
                  name="salaryMin"
                  value={form.salaryMin}
                  onChange={handleChange}
                  placeholder="e.g. 50000"
                />
              </div>
              <div className="form-group">
                <label>Salary Max</label>
                <input
                  type="number"
                  name="salaryMax"
                  value={form.salaryMax}
                  onChange={handleChange}
                  placeholder="e.g. 100000"
                />
              </div>
            </div>
            <div className="form-group">
              <label>Required Skills (comma separated)</label>
              <input
                type="text"
                name="requiredSkills"
                value={form.requiredSkills}
                onChange={handleChange}
                placeholder="e.g. Java, Spring Boot, PostgreSQL"
              />
            </div>
            <div className="form-group">
              <label>Job Description</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Describe the role, responsibilities, and requirements..."
                rows={6}
              />
            </div>
            <div className="form-group">
              <label>Status</label>
              <select name="status" value={form.status} onChange={handleChange}>
                <option value="ACTIVE">Active</option>
                <option value="DRAFT">Draft</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving...' : isEdit ? 'Update Job' : 'Create Job'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate('/jobs')}
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
