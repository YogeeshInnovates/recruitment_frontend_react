import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { OrgContext } from '../App';
import api from '../api/api';

export default function CandidateList() {
  const { org } = useContext(OrgContext);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!org?.id) return;
    api.get(`/api/organizations/${org.id}/candidates`)
      .then((res) => {
        const data = res.data || res;
        setCandidates(Array.isArray(data) ? data : []);
      })
      .catch(() => setCandidates([]))
      .finally(() => setLoading(false));
  }, [org]);

  const handleDelete = async (id) => {
    if (!confirm('Delete this candidate?')) return;
    try {
      await api.delete(`/api/organizations/${org.id}/candidates/${id}`);
      setCandidates(candidates.filter(c => c.id !== id));
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  };

  const filtered = candidates.filter(c => {
    const fullName = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase();
    return fullName.includes(search.toLowerCase()) ||
      (c.email || '').toLowerCase().includes(search.toLowerCase());
  });

  if (loading) return <div className="loading"><div className="spinner-sm"></div></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Candidates</h1>
          <p style={{ color: 'var(--text-light)', marginTop: 4 }}>
            Manage your candidate pool ({candidates.length} total)
          </p>
        </div>
        <Link to="/candidates/new" className="btn btn-primary">
          + Add Candidate
        </Link>
      </div>

      <div className="card">
        <div className="card-header">
          <input
            type="text"
            placeholder="Search candidates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: '8px 16px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              fontSize: 14,
              width: 300,
              outline: 'none'
            }}
          />
        </div>
        <div className="card-body">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👤</div>
              <h3>No candidates found</h3>
              <p>Add your first candidate to get started</p>
              <Link to="/candidates/new" className="btn btn-primary">Add Candidate</Link>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Skills</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((candidate) => {
                    const skills = candidate.skills ? candidate.skills.split(',').map(s => s.trim()).filter(Boolean) : [];
                    return (
                      <tr key={candidate.id}>
                        <td style={{ fontWeight: 600 }}>{candidate.firstName} {candidate.lastName}</td>
                        <td>{candidate.email || '-'}</td>
                        <td>{candidate.phone || '-'}</td>
                        <td>
                          <div className="tags">
                            {skills.slice(0, 3).map((skill, i) => (
                              <span key={i} className="tag tag-blue">{skill}</span>
                            ))}
                            {skills.length > 3 && (
                              <span className="tag tag-blue">+{skills.length - 3}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <Link to={`/candidates/${candidate.id}`} className="btn btn-sm btn-outline">View</Link>
                            <button
                              onClick={() => handleDelete(candidate.id)}
                              className="btn btn-sm btn-danger"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
