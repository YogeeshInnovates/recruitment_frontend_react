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
  const [reportFor, setReportFor] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  const openReport = async (interviewId, name) => {
    setReportFor(name);
    setReportData(null);
    setReportLoading(true);
    try {
      const data = await api.get(`/api/interview/${interviewId}/activity/summary`);
      setReportData(data || null);
    } catch (err) {
      setError(err.message || 'Failed to load report');
    } finally {
      setReportLoading(false);
    }
  };

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
                        <div className="bd-date">{r.scheduledAt ? new Date(r.scheduledAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : (r.scheduledDate || '')}</div>
                        <div className="bd-time">{r.scheduledAt ? new Date(r.scheduledAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : (r.scheduledTime || '')}</div>
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
                            <button className="bd-btn" onClick={() => openReport(r.interviewId, r.name)}>📋 Report</button>
                            <button className="bd-btn" onClick={() => download(r.interviewId, 'score')}>📊 Score</button>
                            <button className="bd-btn" onClick={() => download(r.interviewId, 'transcript')}>💬 Q&A</button>
                            <button className="bd-btn" onClick={() => download(r.interviewId, 'activity')}>🛡 Activity</button>
                          </div>
                        ) : st === 'processing' || st === 'due' ? (
                          <div className="bd-actions">
                            <button className="bd-btn" onClick={() => openReport(r.interviewId, r.name)}>📋 Report</button>
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

      {reportFor && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }} onClick={() => setReportFor(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: '#1e293b', border: '1px solid #334155', borderRadius: 14,
            maxWidth: 680, width: '100%', maxHeight: '90vh', overflow: 'auto',
            padding: 26, color: 'white', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <h2 style={{ fontSize: 20, margin: 0 }}>📋 Behavior Report</h2>
              <button onClick={() => setReportFor(null)} style={{
                background: 'none', border: 'none', color: '#94a3b8', fontSize: 22, cursor: 'pointer'
              }}>✕</button>
            </div>
            <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 16 }}>
              {reportFor}
              {reportData?.email ? ` · ${reportData.email}` : ''}
              {reportData?.jobTitle ? ` · ${reportData.jobTitle}` : ''}
              {reportData?.round ? ` · ${reportData.round}` : ''}
            </div>

            {reportLoading ? (
              <div className="loading" style={{ padding: 30 }}><div className="spinner" /></div>
            ) : !reportData ? (
              <p style={{ color: '#94a3b8', fontSize: 14 }}>No report data available yet.</p>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
                  {[
                    ['Turned Left', reportData.counts?.HEAD_TURN_LEFT || 0, '#f59e0b'],
                    ['Turned Right', reportData.counts?.HEAD_TURN_RIGHT || 0, '#f59e0b'],
                    ['Looked Down', reportData.counts?.LOOK_DOWN || 0, '#f59e0b'],
                    ['2+ Faces', reportData.counts?.MULTI_FACE || 0, '#ef4444'],
                    ['Laughs', reportData.counts?.LAUGHING || 0, '#22c55e'],
                    ['Tab Switches', reportData.counts?.TAB_SWITCH || 0, '#ef4444'],
                    ['Page Blurs', reportData.counts?.PAGE_BLUR || 0, '#ef4444'],
                    ['Total Flags', reportData.totalFlags || 0, '#3b82f6'],
                  ].map(([label, val, color]) => (
                    <div key={label} style={{ background: '#0f172a', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color }}>{val}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{label}</div>
                    </div>
                  ))}
                </div>

                <div style={{
                  fontSize: 13, fontWeight: 700, padding: '8px 14px', borderRadius: 8, marginBottom: 14, textAlign: 'center',
                  background: (reportData.totalFlags || 0) >= 5 ? 'rgba(220,38,38,0.18)' : 'rgba(34,197,94,0.15)',
                  color: (reportData.totalFlags || 0) >= 5 ? '#fca5a5' : '#86efac',
                  border: (reportData.totalFlags || 0) >= 5 ? '1px solid #ef4444' : '1px solid #22c55e',
                }}>
                  {(reportData.totalFlags || 0) >= 5 ? '⚠ SUSPICIOUS' : '✓ CLEAN'}
                </div>

                {reportData.events && reportData.events.length > 0 && (
                  <div>
                    <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Event Log ({reportData.events.length})
                    </div>
                    <div style={{ maxHeight: 300, overflow: 'auto', background: '#0f172a', borderRadius: 10, padding: 10, fontSize: 12 }}>
                      {reportData.events.slice(0, 100).map((e, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, padding: '4px 0', borderBottom: '1px solid #1e293b', alignItems: 'baseline' }}>
                          <span style={{ color: '#64748b', whiteSpace: 'nowrap' }}>{e.time ? e.time.substring(11, 19) : ''}</span>
                          <span style={{ color: '#e2e8f0', fontWeight: 600, whiteSpace: 'nowrap' }}>{e.type}</span>
                          <span style={{ color: '#94a3b8' }}>{e.detail}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
