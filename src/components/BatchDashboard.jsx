import { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { OrgContext } from '../context/OrgContext';
import api from '../api/api';

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function computeStatus(row, now) {
  if (row.status === 'COMPLETED') return 'over';
  if (row.status === 'IN_PROGRESS') return 'processing';
  if (row.scheduledAt) {
    const sched = new Date(row.scheduledAt);
    const diffMin = (sched.getTime() - now.getTime()) / 60000;
    if (diffMin <= 10) return 'due';
  }
  return 'scheduled';
}

export default function BatchDashboard() {
  const { org } = useContext(OrgContext);
  const { jobId } = useParams();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(new Date());

  const load = useCallback(async () => {
    if (!org?.id) { setLoading(false); return; }
    try {
      const path = jobId
        ? `/api/organizations/${org.id}/ai-batch/interviews?jobId=${jobId}`
        : `/api/organizations/${org.id}/ai-batch/interviews`;
      const data = await api.get(path);
      setRows(data || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load interviews');
    } finally {
      setLoading(false);
    }
  }, [org?.id, jobId]);

  useEffect(() => {
    load();
    const t = setInterval(() => { setNow(new Date()); load(); }, 30000);
    return () => clearInterval(t);
  }, [load]);

  const download = async (interviewId, type) => {
    try {
      const blob = await api.download(`/api/interview/${interviewId}/report/${type}`);
      const ext = type === 'score' ? 'csv' : type === 'activity' ? 'csv' : 'txt';
      saveBlob(blob, `interview-${interviewId}-${type}.${ext}`);
    } catch (err) {
      setError(err.message || 'Download failed');
    }
  };

  const stats = {
    total: rows.length,
    due: rows.filter(r => computeStatus(r, now) === 'due').length,
    processing: rows.filter(r => computeStatus(r, now) === 'processing').length,
    over: rows.filter(r => computeStatus(r, now) === 'over').length,
  };

  return (
    <div className="abs-page">
      <div className="abs-card" style={{ maxWidth: 1100 }}>
        <div className="abs-header">
          <div className="abs-logo">📊</div>
          <h1 className="abs-title">AI Interview Dashboard</h1>
          <p className="abs-subtitle">
            {jobId ? 'Live status for this batch' : 'Live status for all AI interview batches'} — updates automatically
          </p>
        </div>

        <div className="bd-stats">
          <div className="bd-stat"><span className="bd-stat-num">{stats.total}</span><span>Total</span></div>
          <div className="bd-stat bd-stat-red"><span className="bd-stat-num">{stats.due}</span><span>Due Now</span></div>
          <div className="bd-stat bd-stat-orange"><span className="bd-stat-num">{stats.processing}</span><span>Processing</span></div>
          <div className="bd-stat bd-stat-green"><span className="bd-stat-num">{stats.over}</span><span>Completed</span></div>
        </div>

        {error && <div className="abs-error">{error}</div>}
        {loading ? (
          <div className="loading" style={{ padding: 40 }}><div className="spinner" /></div>
        ) : rows.length === 0 ? (
          <p className="abs-warn" style={{ textAlign: 'center', padding: 30 }}>
            No AI interviews scheduled yet. Create a batch from the AI-Based Interview setup first.
          </p>
        ) : (
          <div className="bd-table-wrap">
            <table className="bd-table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Job / Round</th>
                  <th>Scheduled Slot</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const st = computeStatus(r, now);
                  return (
                    <tr key={r.interviewId}>
                      <td>
                        <div className="bd-name">{r.name}</div>
                        <div className="bd-mail">{r.email}</div>
                      </td>
                      <td>
                        <div className="bd-job">{r.jobTitle}</div>
                        <div className="bd-round">{r.round}</div>
                      </td>
                      <td>
                        <div className="bd-date">{r.scheduledDate}</div>
                        <div className="bd-time">{r.scheduledTime}</div>
                      </td>
                      <td>
                        <span className={`bd-status bd-${st}`}>
                          {st === 'over' && <span className="bd-dot-green" />}
                          {st === 'processing' && <span className="bd-dot-orange" />}
                          {st === 'due' && <span className="bd-dot-red twinkle" />}
                          {st === 'scheduled' && <span className="bd-dot-gray" />}
                          {st === 'due' ? 'Due Now' : st === 'processing' ? 'Processing' : st === 'over' ? 'Over' : 'Upcoming'}
                        </span>
                      </td>
                      <td>
                        {r.aiScore != null ? (
                          <span className={`bd-score ${r.aiScore >= 60 ? 'good' : r.aiScore >= 40 ? 'mid' : 'low'}`}>
                            {Math.round(r.aiScore)}/100
                          </span>
                        ) : (
                          <span className="bd-na">—</span>
                        )}
                      </td>
                      <td>
                        {st === 'over' ? (
                          <div className="bd-actions">
                            <button className="bd-btn" onClick={() => download(r.interviewId, 'score')}>📊 Score</button>
                            <button className="bd-btn" onClick={() => download(r.interviewId, 'transcript')}>💬 Q&A</button>
                            <button className="bd-btn" onClick={() => download(r.interviewId, 'activity')}>🛡 Activity</button>
                          </div>
                        ) : st === 'processing' || st === 'due' ? (
                          <div className="bd-actions">
                            <a className="bd-btn bd-join" href={`/interview/${r.interviewId}?monitor=1`} target="_blank" rel="noreferrer">
                              👁 Join Monitor
                            </a>
                          </div>
                        ) : (
                          <span className="bd-mail">Scheduled — link auto-emailed</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="abs-actions">
          <button className="btn btn-outline" onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
        </div>
      </div>
    </div>
  );
}
