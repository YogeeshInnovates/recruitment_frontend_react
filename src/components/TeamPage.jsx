import { useState, useEffect, useContext } from 'react';
import { OrgContext } from '../App';
import { AuthContext } from '../context/AuthContext';
import api from '../api/api';

export default function TeamPage() {
  const { org } = useContext(OrgContext);
  const { user: currentUser, token } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!org?.id) return;
    const fetchMembers = async () => {
      try {
        const res = await api.get(`/api/organizations/${org.id}/recruiters`);
        setMembers(res.data?.data || res.data || []);
      } catch (err) {
        console.error('Failed to fetch team members');
      } finally {
        setLoading(false);
      }
    };
    fetchMembers();
  }, [org]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!email.trim()) { setError('Enter an email address'); return; }
    setSubmitting(true);
    try {
      const res = await api.post(`/api/organizations/${org.id}/recruiters`, { email: email.trim() });
      const newMember = res.data?.data || res.data;
      setMembers(prev => [...prev, newMember]);
      setEmail('');
      setSuccess('Recruiter added successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to add recruiter';
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
        <p className="tp-invite-desc">Enter the email of an existing user to grant them recruiter access</p>
        <form className="tp-invite-form" onSubmit={handleAdd}>
          <input
            type="email"
            className="tp-input"
            placeholder="Enter user email..."
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <button type="submit" className="tp-btn" disabled={submitting}>
            {submitting ? 'Adding...' : 'Add Recruiter'}
          </button>
        </form>
        {error && <div className="tp-error">{error}</div>}
        {success && <div className="tp-success">{success}</div>}
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
                  <th>User ID</th>
                  <th>Role</th>
                  <th>Member Since</th>
                </tr>
              </thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.id}>
                    <td>#{m.userId}</td>
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
