import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';

const INDUSTRIES = [
  'Technology', 'Healthcare', 'Finance', 'Education', 'Manufacturing',
  'Retail', 'Construction', 'Real Estate', 'Transportation', 'Media',
  'Energy', 'Agriculture', 'Hospitality', 'Consulting', 'Legal',
  'Other'
];
import { AuthContext } from '../context/AuthContext';
import { OrgContext } from '../context/OrgContext';
import api from '../api/api';

export default function UserDashboard() {
  const { user, logout, refreshUser } = useContext(AuthContext);
  const { setOrg } = useContext(OrgContext);
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [orgData, setOrgData] = useState({
    name: '', description: '', industry: '', website: '', email: '', phone: '', address: '', industryOther: ''
  });

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
    : 'U';

  const handleCreateOrg = async () => {
    if (!orgData.name.trim()) return;
    setCreating(true);
    try {
      const payload = { ...orgData };
      if (payload.industry === 'Other') {
        payload.industry = payload.industryOther || 'Other';
      }
      delete payload.industryOther;
      Object.keys(payload).forEach(k => { if (!payload[k]) delete payload[k]; });
      const res = await api.post(`/api/organizations?userId=${user.userId}`, payload);
      const org = res.data || res;
      setOrg(org);
      await refreshUser();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      alert(err.message || 'Failed to create organization');
    } finally {
      setCreating(false);
    }
  };

  const updateOrgField = (field, value) => {
    setOrgData(prev => ({ ...prev, [field]: value }));
  };

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  const handlePracticeInterview = () => {
    navigate('/interview');
  };

  return (
    <div className="user-dashboard">
      {/* Top Bar */}
      <header className="ud-topbar">
        <div className="ud-topbar-left">
          <div className="ud-logo">
            <span className="ud-logo-icon">🤖</span>
            <span className="ud-logo-text">Recruit<span>AI</span></span>
          </div>
          <button className="btn btn-practice" onClick={handlePracticeInterview}>
            🎤 Practice Mock Interview
          </button>
        </div>
        <div className="ud-topbar-right">
          <div className="ud-profile" onClick={() => setShowProfile(!showProfile)}>
            <div className="ud-avatar">{initials}</div>
            <span className="ud-name">{user?.name}</span>
          </div>
          {showProfile && (
            <div className="ud-dropdown">
              <div className="ud-dropdown-item">{user?.email}</div>
              <div className="ud-dropdown-divider" />
              <div className="ud-dropdown-item" onClick={handleLogout}>Logout</div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="ud-main">
        {/* Welcome */}
        <section className="ud-welcome">
          <h1>Welcome, {user?.name?.split(' ')[0] || 'User'}!</h1>
          <p>Your AI-powered recruitment journey starts here</p>
        </section>

        {/* Create Organization */}
        <section className="ud-create-org">
          {!showForm ? (
            <button className="ud-create-btn" onClick={() => setShowForm(true)}>
              <span className="ud-create-icon">+</span>
              <span className="ud-create-label">Create Organization</span>
              <span className="ud-create-desc">Set up your recruitment workspace</span>
            </button>
          ) : (
            <div className="ud-org-form">
              <h3>Create Your Organization</h3>
              <p className="ud-org-form-subtitle">You'll become a recruiter with full access to the platform</p>
              <div className="ud-org-form-fields">
                <div className="ud-org-field">
                  <label>Company Name *</label>
                  <input type="text" value={orgData.name} onChange={e => updateOrgField('name', e.target.value)} placeholder="e.g. Acme Corp" autoFocus />
                </div>
                <div className="ud-org-row">
                  <div className="ud-org-field">
                    <label>Industry</label>
                    <select value={INDUSTRIES.includes(orgData.industry) ? orgData.industry : 'Other'} onChange={e => updateOrgField('industry', e.target.value)}>
                      <option value="" disabled>Select industry</option>
                      {INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                    </select>
                    {orgData.industry === 'Other' && (
                      <input type="text" value={orgData.industryOther || ''} onChange={e => updateOrgField('industryOther', e.target.value)} placeholder="Specify your industry" style={{ marginTop: 8 }} />
                    )}
                  </div>
                  <div className="ud-org-field">
                    <label>Website</label>
                    <input type="url" value={orgData.website} onChange={e => updateOrgField('website', e.target.value)} placeholder="https://example.com" />
                  </div>
                </div>
                <div className="ud-org-field">
                  <label>Description</label>
                  <textarea value={orgData.description} onChange={e => updateOrgField('description', e.target.value)} placeholder="Tell us about your company..." rows={3} />
                </div>
                <div className="ud-org-row">
                  <div className="ud-org-field">
                    <label>Email</label>
                    <input type="email" value={orgData.email} onChange={e => updateOrgField('email', e.target.value)} placeholder="contact@company.com" />
                  </div>
                  <div className="ud-org-field">
                    <label>Phone</label>
                    <input type="tel" value={orgData.phone} onChange={e => updateOrgField('phone', e.target.value)} placeholder="+1 234 567 890" />
                  </div>
                </div>
                <div className="ud-org-field">
                  <label>Address</label>
                  <input type="text" value={orgData.address} onChange={e => updateOrgField('address', e.target.value)} placeholder="123 Main St, City, Country" />
                </div>
                <div className="ud-org-actions">
                  <button className="btn btn-primary" onClick={handleCreateOrg} disabled={creating || !orgData.name.trim()}>
                    {creating ? 'Creating...' : 'Create Organization'}
                  </button>
                  <button className="btn btn-outline" onClick={() => { setShowForm(false); setOrgData({ name: '', description: '', industry: '', website: '', email: '', phone: '', address: '', industryOther: '' }); }}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* How It Works */}
        <section className="ud-how-it-works">
          <h2>How It Works</h2>
          <div className="ud-steps">
            <div className="ud-step">
              <div className="ud-step-number">1</div>
              <div className="ud-step-content">
                <h3>Create Organization</h3>
                <p>Set up your recruitment workspace to manage jobs, candidates, and interviews</p>
              </div>
            </div>
            <div className="ud-step-arrow">→</div>
            <div className="ud-step">
              <div className="ud-step-number">2</div>
              <div className="ud-step-content">
                <h3>Upload Resumes</h3>
                <p>Add candidates and upload resumes for AI-powered skill extraction and screening</p>
              </div>
            </div>
            <div className="ud-step-arrow">→</div>
            <div className="ud-step">
              <div className="ud-step-number">3</div>
              <div className="ud-step-content">
                <h3>Screen & Interview</h3>
                <p>Upload resumes, match candidates to jobs, and conduct AI-powered interviews</p>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="ud-features">
          <div className="ud-feature-card">
            <span className="ud-feature-icon">🤖</span>
            <h3>AI Voice Interviews</h3>
            <p>Adaptive AI interviewer that asks role-specific questions and evaluates responses</p>
          </div>
          <div className="ud-feature-card">
            <span className="ud-feature-icon">📄</span>
            <h3>Resume Screening</h3>
            <p>AI-powered resume parsing and skill extraction for quick candidate evaluation</p>
          </div>
          <div className="ud-feature-card">
            <span className="ud-feature-icon">📊</span>
            <h3>Smart Analytics</h3>
            <p>Real-time insights into your recruitment pipeline with detailed scoring</p>
          </div>
        </section>
      </main>

      {/* Click outside to close dropdown */}
      {showProfile && <div className="ud-overlay" onClick={() => setShowProfile(false)} />}
    </div>
  );
}
