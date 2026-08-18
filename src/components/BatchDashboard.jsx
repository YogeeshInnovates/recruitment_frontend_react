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

function MultiLiveGrid({ rows, now }) {
  const [snapshots, setSnapshots] = useState({});
  const [activityCounts, setActivityCounts] = useState({});
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!rows.length) return;
    const loadAll = async () => {
      rows.forEach(async (r) => {
        try {
          const [snapRes, actRes] = await Promise.all([
            api.get(`/api/interview/${r.interviewId}/snapshot`),
            api.get(`/api/interview/${r.interviewId}/activity/summary`),
          ]);
          setSnapshots(prev => ({ ...prev, [r.interviewId]: snapRes.data?.[0] || null }));
          setActivityCounts(prev => ({ ...prev, [r.interviewId]: actRes.data?.counts || {} }));
        } catch (e) {
          setErrors(prev => ({ ...prev, [r.interviewId]: e.message }));
        }
      });
    };
    loadAll();
    const t = setInterval(loadAll, 6000);
    return () => clearInterval(t);
  }, [rows]);

  const cols = Math.min(rows.length, 2);
  const gridCols = cols === 1 ? '1fr' : 'repeat(2, 1fr)';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 12 }}>
      {rows.map(r => {
        const snap = snapshots[r.interviewId];
        const counts = activityCounts[r.interviewId] || {};
        const totalFlags = Object.values(counts).reduce((s, v) => s + v, 0);
        const hasFlags = totalFlags > 0;
        return (
          <div key={r.interviewId} style={{
            background: '#1e293b', borderRadius: 12, overflow: 'hidden', border: hasFlags ? '2px solid #ef4444' : '1px solid #334155',
          }}>
            <div style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{r.name}</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{r.candidateEmail}</div>
              </div>
              {hasFlags && (
                <div style={{ background: '#ef4444', color: 'white', borderRadius: 8, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                  {totalFlags} flags
                </div>
              )}
            </div>
            <div style={{ background: '#0f172a', minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              {snap?.imageUrl ? (
                <img src={snap.imageUrl} alt="" style={{ width: '100%', height: 200, objectFit: 'cover' }} />
              ) : errors[r.interviewId] ? (
                <span style={{ color: '#ef4444', fontSize: 12 }}>⚠ {errors[r.interviewId]}</span>
              ) : (
                <span style={{ color: '#64748b', fontSize: 12 }}>Waiting for snapshot…</span>
              )}
            </div>
            <div style={{ padding: '8px 12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {[
                  ['TAB', 'TAB_SWITCH', counts.TAB_SWITCH],
                  ['BLUR', 'PAGE_BLUR', counts.PAGE_BLUR],
                  ['PASTE', 'PASTE', (counts.PASTE_BLOCKED || 0) + (counts.COPY_BLOCKED || 0)],
                  ['KEYS', 'SHORTCUT', counts.SHORTCUT_BLOCKED],
                  ['SCR', 'SCREEN_SHARE', counts.SCREEN_SHARE_ATTEMPT],
                  ['VOICE', '2ND_VOICE', counts.SECOND_VOICE],
                  ['FACE', 'MULTI_FACE', counts.MULTI_FACE],
                  ['DOWN', 'LOOK_DOWN', counts.LOOK_DOWN],
                  ['LOST', 'FACE_LOST', counts.FACE_LOST],
                ].map(([icon, key, val]) => (
                  <div key={key} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: (val || 0) > 0 ? '#ef4444' : '#22c55e' }}>{val || 0}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>{icon}</div>
                  </div>
                ))}
              </div>
              <a href={`/interview/${r.interviewId}?monitor=1`} target="_blank" rel="noreferrer" style={{
                display: 'block', textAlign: 'center', marginTop: 10, padding: '6px 10px', borderRadius: 8,
                background: '#3b82f6', color: 'white', fontSize: 12, fontWeight: 700, textDecoration: 'none',
              }}>Open Full Monitor →</a>
            </div>
          </div>
        );
      })}
    </div>
  );
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
  const [evidenceData, setEvidenceData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [capturesFor, setCapturesFor] = useState(null);
  const [capturesData, setCapturesData] = useState(null);
  const [capturesLoading, setCapturesLoading] = useState(false);
  const [multiLive, setMultiLive] = useState(false);

  const openCaptures = async (interviewId, name) => {
    setCapturesFor(name);
    setCapturesData(null);
    setCapturesLoading(true);
    try {
      const evidence = await api.get(`/api/interview/${interviewId}/evidence`);
      setCapturesData(evidence || { count: 0, items: [] });
    } catch (err) {
      setError(err.message || 'Failed to load captures');
      setCapturesData({ count: 0, items: [] });
    } finally {
      setCapturesLoading(false);
    }
  };

  const openReport = async (interviewId, name) => {
    setReportFor(name);
    setReportData(null);
    setEvidenceData(null);
    setReportLoading(true);
    try {
      const [data, evidence] = await Promise.all([
        api.get(`/api/interview/${interviewId}/activity/summary`),
        api.get(`/api/interview/${interviewId}/evidence`).catch(() => null),
      ]);
      setReportData(data || null);
      setEvidenceData(evidence || null);
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
          {(stats.due + stats.processing) > 0 && (
            <div className="bd-stat" style={{ cursor: 'pointer' }} onClick={() => setMultiLive(true)}>
              <span className="bd-stat-num" style={{ color: '#ef4444' }}>👁</span>
              <span style={{ color: '#ef4444', fontWeight: 700 }}>Watch Live</span>
            </div>
          )}
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
                            <button className="bd-btn" onClick={() => openCaptures(r.interviewId, r.name)}>🖼 Captures</button>
                            <button className="bd-btn" onClick={() => download(r.interviewId, 'score')}>📊 Score</button>
                            <button className="bd-btn" onClick={() => download(r.interviewId, 'transcript')}>💬 Q&A</button>
                            <button className="bd-btn" onClick={() => download(r.interviewId, 'activity')}>🛡 Activity</button>
                          </div>
                        ) : st === 'processing' || st === 'due' ? (
                          <div className="bd-actions">
                            <button className="bd-btn" onClick={() => openReport(r.interviewId, r.name)}>📋 Report</button>
                            <button className="bd-btn" onClick={() => openCaptures(r.interviewId, r.name)}>🖼 Captures</button>
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
                    ['Gaze Off Screen', reportData.counts?.GAZE_OFF || 0, '#f59e0b'],
                    ['Eyes Closed', reportData.counts?.NO_BLINK || 0, '#ef4444'],
                    ['Face Lost', reportData.counts?.FACE_LOST || 0, '#ef4444'],
                    ['2+ Faces', reportData.counts?.MULTI_FACE || 0, '#ef4444'],
                    ['Laughs', reportData.counts?.LAUGHING || 0, '#22c55e'],
                    ['Tab Switches', reportData.counts?.TAB_SWITCH || 0, '#ef4444'],
                    ['Page Blurs', reportData.counts?.PAGE_BLUR || 0, '#ef4444'],
                    ['Paste Attempts', (reportData.counts?.PASTE_BLOCKED || 0) + (reportData.counts?.COPY_BLOCKED || 0) + (reportData.counts?.CUT_BLOCKED || 0), '#ef4444'],
                    ['Shortcut Blocks', reportData.counts?.SHORTCUT_BLOCKED || 0, '#ef4444'],
                    ['Right-Clicks', reportData.counts?.RIGHT_CLICK || 0, '#f59e0b'],
                    ['Screen Share', reportData.counts?.SCREEN_SHARE_ATTEMPT || 0, '#ef4444'],
                    ['2nd Voice', reportData.counts?.SECOND_VOICE || 0, '#ef4444'],
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

                <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.6, marginBottom: 14, padding: '8px 12px', background: '#0f172a', borderRadius: 8 }}>
                  Smart 3D monitor (on-device, matrix head pose + iris gaze) · Head turn: safe ±20° / suspicious ±35° ·
                  Pitch down 15°/25° · Pitch up 12°/20° · Iris off-screen &gt; 0.60 · Eyes closed EAR &lt; 0.20 ·
                  Sustain before capture: turn / head-down 4s · gaze off 3s · eyes closed 6s · face lost 5s · attention score 0–100
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

                {evidenceData?.items?.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      🖼 Suspicious Captures ({evidenceData.items.length})
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
                      {evidenceData.items.map((it) => (
                        <div key={it.id} style={{ background: '#0f172a', borderRadius: 10, overflow: 'hidden', border: '1px solid #334155' }}>
                          {it.cloudinaryUrl ? (
                            <img src={it.cloudinaryUrl} alt={it.eventType} style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block' }} />
                          ) : (
                            <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#64748b', padding: 8, textAlign: 'center' }}>
                              Image not persisted (Cloudinary not configured)
                            </div>
                          )}
                          <div style={{ padding: '6px 8px' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b' }}>{it.eventType}</div>
                            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                              {it.capturedAt ? new Date(it.capturedAt).toLocaleString('en-IN') : ''}
                            </div>
                          </div>
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

      {capturesFor && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }} onClick={() => setCapturesFor(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: '#1e293b', border: '1px solid #334155', borderRadius: 14,
            maxWidth: 720, width: '100%', maxHeight: '90vh', overflow: 'auto',
            padding: 26, color: 'white', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <h2 style={{ fontSize: 20, margin: 0 }}>🖼 Suspicious Captures</h2>
              <button onClick={() => setCapturesFor(null)} style={{
                background: 'none', border: 'none', color: '#94a3b8', fontSize: 22, cursor: 'pointer'
              }}>✕</button>
            </div>
            <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 16 }}>
              {capturesFor} — captured during the interview when sustained suspicious behavior was detected
            </div>

            {capturesLoading ? (
              <div className="loading" style={{ padding: 30 }}><div className="spinner" /></div>
            ) : !capturesData?.items?.length ? (
              <p style={{ color: '#94a3b8', fontSize: 14, padding: '20px 0', textAlign: 'center' }}>
                No suspicious captures for this interview yet.
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                {capturesData.items.map((it) => (
                  <div key={it.id} style={{ background: '#0f172a', borderRadius: 10, overflow: 'hidden', border: '1px solid #334155' }}>
                    {it.cloudinaryUrl ? (
                      <a href={it.cloudinaryUrl} target="_blank" rel="noreferrer">
                        <img src={it.cloudinaryUrl} alt={it.eventType} style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} />
                      </a>
                    ) : (
                      <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#64748b', padding: 8, textAlign: 'center' }}>
                        Image not persisted (Cloudinary not configured)
                      </div>
                    )}
                    <div style={{ padding: '8px 10px' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b' }}>{it.eventType}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                        {it.capturedAt ? new Date(it.capturedAt).toLocaleString('en-IN') : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {multiLive && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(15, 23, 42, 0.88)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14,
        }} onClick={() => setMultiLive(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: '#0f172a', border: '1px solid #1e293b', borderRadius: 14,
            maxWidth: 1100, width: '100%', maxHeight: '94vh', overflow: 'auto',
            padding: 22, color: 'white', boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ fontSize: 18, margin: 0 }}>👁 Live Monitor — {rows.filter(r => computeStatus(r, now) === 'processing' || computeStatus(r, now) === 'due').length} Active Candidate(s)</h2>
              <button onClick={() => setMultiLive(false)} style={{
                background: 'none', border: 'none', color: '#94a3b8', fontSize: 22, cursor: 'pointer'
              }}>✕</button>
            </div>
            <MultiLiveGrid rows={rows.filter(r => computeStatus(r, now) === 'processing' || computeStatus(r, now) === 'due')} now={now} />
          </div>
        </div>
      )}
    </div>
  );
}
