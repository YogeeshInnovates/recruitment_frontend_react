import { useState, useEffect, useContext } from 'react';
import { OrgContext } from '../App';
import { AuthContext } from '../context/AuthContext';
import api from '../api/api';

export default function TeamPage() {
  const { org } = useContext(OrgContext);
  const { user: currentUser, token } = useContext(AuthContext);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tempPassword, setTempPassword] = useState('');

  const fetchMembers = async () => {
    if (!org?.id) return;
    try {
      const res = await api.get(`/api/organizations/${org.id}/recruiters`);
      setMembers(res.data?.data || res.data || []);
    } catch (err) {
      console.error('Failed to fetch team members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org]);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setTempPassword('');
    if (!name.trim()) { setError('Enter the recruiter name'); return; }
    if (!email.trim()) { setError('Enter an email address'); return; }
    setSubmitting(true);
    try {
      const res = await api.post(`/api/organizations/${org.id}/recruiters/register`, {
        name: name.trim(),
        email: email.trim(),
      });
      const result = res.data?.data || res.data;
      if (result?.accountCreated && result.tempPassword) {
        setTempPassword(result.tempPassword);
        setSuccess('Recruiter account created successfully! Share the temporary password to log in.');
      } else {
        setSuccess('This email already had an account — recruiter access granted!');
      }
      setName('');
      setEmail('');
      fetchMembers();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to register recruiter';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="tp">
      <div className="tp-header">
        <h1 className="tp-title">Team</h1>
        <p className="tp-subtitle">Manage recruiters in {org?.name || 'your organization'}</p>
      </div>

      <div className="tp-invite-card">
        <h3 className="tp-invite-title">Invite Recruiter</h3>
        <p className="tp-invite-desc">Enter the recruiter's name and email to create their account and grant access</p>
        <form className="tp-invite-form" onSubmit={handleRegister}>
          <input
            type="text"
            className="tp-input"
            placeholder="Enter recruiter name..."
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <input
            type="email"
            className="tp-input"
            placeholder="Enter recruiter email..."
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <button type="submit" className="tp-btn" disabled={submitting}>
            {submitting ? 'Registering...' : 'Register Recruiter'}
          </button>
        </form>
        {error && <div className="tp-error">{error}</div>}
        {success && <div className="tp-success">{success}</div>}
        {tempPassword && (
          <div className="tp-success" style={{ marginTop: 8 }}>
            <strong>Temporary password:</strong> <code>{tempPassword}</code>
          </div>
        )}
      </div>

      <div className="tp-list-card">
        <h3 className="tp-list-title">Current Members ({members.length})</h3>
        {loading ? (
          <div className="loading"><div className="spinner-sm"></div></div>
        ) : members.length === 0 ? (
          <div className="empty-state" style={{ padding: 40 }}>
            <div className="empty-icon">👥</div>
            <h3>No members yet</h3>
            <p>Invite recruiters to get started</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Member Since</th>
                </tr>
              </thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.id}>
                    <td>{m.name || '—'}</td>
                    <td>{m.email || ''}</td>
                    <td><span className="badge badge-info">{m.role}</span></td>
                    <td>{m.createdAt ? new Date(m.createdAt).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
