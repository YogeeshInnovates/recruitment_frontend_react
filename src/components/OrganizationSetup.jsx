import { useState, useContext } from 'react';
import { OrgContext } from '../App';
import api from '../api/api';

const industries = [
  'Technology', 'Healthcare', 'Finance', 'Education', 'Manufacturing',
  'Retail', 'Marketing', 'Legal', 'Construction', 'Energy',
  'Transportation', 'Hospitality', 'Media', 'Agriculture', 'Other'
];

export default function OrganizationSetup() {
  const { setOrganization } = useContext(OrgContext);
  const [form, setForm] = useState({
    name: '',
    industry: '',
    description: '',
    website: '',
    email: '',
    phone: '',
    address: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.industry) {
      setError('Organization name and industry are required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await api.post('/api/organizations', form);
      const orgData = result.data || result;
      setOrganization(orgData);
    } catch (err) {
      setError(err.message || 'Failed to create organization');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="org-setup-page">
      <div className="org-setup-card">
        <div className="logo-section">
          <div className="logo-icon">🤖</div>
          <h1>RecruitAI</h1>
          <p>Set up your organization to get started</p>
        </div>
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
            <label>Organization Name *</label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="e.g. Acme Corp"
              required
            />
          </div>
          <div className="form-group">
            <label>Industry *</label>
            <select name="industry" value={form.industry} onChange={handleChange} required>
              <option value="">Select industry</option>
              {industries.map((ind) => (
                <option key={ind} value={ind}>{ind}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Brief description of your organization..."
              rows={3}
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Website</label>
              <input
                type="url"
                name="website"
                value={form.website}
                onChange={handleChange}
                placeholder="https://example.com"
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="hr@example.com"
              />
            </div>
          </div>
          <div className="form-row">
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
            <div className="form-group">
              <label>Address</label>
              <input
                type="text"
                name="address"
                value={form.address}
                onChange={handleChange}
                placeholder="123 Main St, City"
              />
            </div>
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Organization'}
          </button>
        </form>
      </div>
    </div>
  );
}
