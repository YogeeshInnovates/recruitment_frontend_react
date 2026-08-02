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
    address: '',
    city: '',
    state: '',
    postalCode: '',
    gstNumber: '',
    cinNumber: '',
    legalEntityType: '',
    companySize: '',
    foundedYear: ''
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
                placeholder="+91 98765 43210"
              />
            </div>
            <div className="form-group">
              <label>Address</label>
              <input
                type="text"
                name="address"
                value={form.address}
                onChange={handleChange}
                placeholder="123 Main St"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>City</label>
              <input
                type="text"
                name="city"
                value={form.city}
                onChange={handleChange}
                placeholder="Mumbai"
              />
            </div>
            <div className="form-group">
              <label>State</label>
              <input
                type="text"
                name="state"
                value={form.state}
                onChange={handleChange}
                placeholder="Maharashtra"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Postal Code</label>
              <input
                type="text"
                name="postalCode"
                value={form.postalCode}
                onChange={handleChange}
                placeholder="400001"
              />
            </div>
            <div className="form-group">
              <label>Founded Year</label>
              <input
                type="number"
                min="1900"
                max="2026"
                name="foundedYear"
                value={form.foundedYear}
                onChange={handleChange}
                placeholder="2015"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Legal Entity Type</label>
              <select name="legalEntityType" value={form.legalEntityType} onChange={handleChange}>
                <option value="">Select type</option>
                <option value="Private Limited">Private Limited</option>
                <option value="LLP">LLP</option>
                <option value="Public Limited">Public Limited</option>
                <option value="Proprietorship">Proprietorship</option>
                <option value="Partnership">Partnership</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label>Company Size</label>
              <select name="companySize" value={form.companySize} onChange={handleChange}>
                <option value="">Select size</option>
                <option value="1-10">1-10</option>
                <option value="11-50">11-50</option>
                <option value="51-200">51-200</option>
                <option value="201-500">201-500</option>
                <option value="500+">500+</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>GST Number</label>
              <input
                type="text"
                name="gstNumber"
                value={form.gstNumber}
                onChange={handleChange}
                placeholder="27AAACM1234F1Z5"
              />
            </div>
            <div className="form-group">
              <label>CIN / Registration Number</label>
              <input
                type="text"
                name="cinNumber"
                value={form.cinNumber}
                onChange={handleChange}
                placeholder="U12345MH2015PTC000000"
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
