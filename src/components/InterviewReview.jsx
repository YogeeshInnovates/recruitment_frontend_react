import { useState } from 'react';
import api from '../api/api';

const SEVERITY_STYLES = {
  HIGH: { color: '#b91c1c', background: '#fee2e2' },
  MEDIUM: { color: '#b45309', background: '#fef3c7' },
  LOW: { color: '#92400e', background: '#ffedd5' },
  NONE: { color: '#166534', background: '#dcfce7' },
};

const EVENT_LABELS = {
  HEAD_TURN_LEFT: 'Head turned left',
  HEAD_TURN_RIGHT: 'Head turned right',
  LOOK_DOWN: 'Looking down',
  MULTI_FACE: 'Multiple faces detected',
  FACE_LOST: 'Face left the camera',
  NO_BLINK: 'No blinking (possible photo)',
  CAMERA_FROZEN: 'Camera frozen / static frame',
  GAZE_OFF: 'Gaze away from screen',
  TAB_SWITCH: 'Switched tab',
  PAGE_BLUR: 'Window lost focus',
  DEVTOOLS: 'Developer tools opened',
  ANSWER_PASTED: 'Answer pasted',
  SUSPICIOUS_FAST_ANSWER: 'Suspiciously fast answer',
  WINDOW_BLUR: 'Window blurred',
  COPY_BLOCKED: 'Attempted to copy text',
  CUT_BLOCKED: 'Attempted to cut text',
  PASTE_BLOCKED: 'Attempted to paste text',
  RIGHT_CLICK: 'Right-click attempted',
  F12_BLOCKED: 'Pressed F12 (DevTools)',
  PRINTSCREEN: 'Pressed PrintScreen',
  ESC_BLOCKED: 'Pressed Escape',
  SHORTCUT_BLOCKED: 'Blocked keyboard shortcut',
  SCREEN_SHARE_ATTEMPT: 'Attempted screen share',
  SECOND_VOICE: 'Possible second voice detected',
};

export default function InterviewReview({ interview, candidateName, jobTitle, jobDescription, resumeText }) {
  const [suspiciousOpen, setSuspiciousOpen] = useState(false);
  const [loadingSuspicious, setLoadingSuspicious] = useState(false);
  const [evidence, setEvidence] = useState(null);
  const [malpractice, setMalpractice] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [aiReport, setAiReport] = useState(null);
  const [reportNotice, setReportNotice] = useState('');

  const interviewId = interview?.id;

  const loadSuspicious = async () => {
    if (suspiciousOpen) { setSuspiciousOpen(false); return; }
    setSuspiciousOpen(true);
    setLoadingSuspicious(true);
    setReportNotice('');
    try {
      const [ev, mp] = await Promise.all([
        api.get(`/api/interview/${interviewId}/evidence`),
        api.get(`/api/interview/${interviewId}/malpractice-report`),
      ]);
      setEvidence(ev);
      setMalpractice(mp);
    } catch (e) {
      setReportNotice(`Could not load suspicious details: ${e.message}`);
    } finally {
      setLoadingSuspicious(false);
    }
  };

  const esc = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const buildReportHtml = (ev, mp, ai, transcript) => {
    const rows = (transcript || []).map((t) => `
      <div class="qa">
        <div class="speaker ${esc(t.speaker === 'candidate' ? 'candidate' : 'ai')}">
          ${esc(t.speaker === 'candidate' ? 'Candidate' : 'Interviewer')}
          ${t.questionNumber ? `&nbsp;· Q${esc(t.questionNumber)}` : ''}
        </div>
        <div class="qa-content">${esc(t.content)}</div>
      </div>`).join('');

    const breakdown = mp?.eventBreakdown || {};
    const events = Object.entries(breakdown)
      .map(([k, v]) => `
        <tr>
          <td>${esc(EVENT_LABELS[k] || k)}</td>
          <td style="text-align:center">${esc(String(v))}</td>
        </tr>`).join('');

    const evidenceItems = (ev?.items || []).filter((i) => i.cloudinaryUrl)
      .map((i) => `
        <div class="ev">
          <img src="${esc(i.cloudinaryUrl)}" alt="${esc(i.eventType)}" />
          <div class="ev-label">${esc(EVENT_LABELS[i.eventType] || i.eventType)}</div>
          <div class="ev-time">${esc(i.capturedAt || '')}</div>
        </div>`).join('') || '<p class="muted">No images were captured for this candidate.</p>';

    const sev = mp?.severity || 'NONE';
    const report = ai || {};
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Interview Report</title>
<style>
  body { font-family: Arial, sans-serif; color: #1e293b; margin: 0; padding: 24px; background: #f8fafc; }
  .page { max-width: 860px; margin: 0 auto; background: #fff; padding: 32px; border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
  h1 { margin: 0 0 4px; font-size: 22px; } h2 { font-size: 16px; margin-top: 28px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; }
  .sub { color: #64748b; font-size: 13px; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; }
  .scores { display: flex; gap: 12px; margin: 16px 0; }
  .score { flex: 1; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; text-align: center; }
  .score .num { font-size: 26px; font-weight: 700; }
  .score .lbl { font-size: 12px; color: #64748b; }
  .sev-NONE { background:#dcfce7; color:#166534; } .sev-LOW { background:#ffedd5; color:#92400e; }
  .sev-MEDIUM { background:#fef3c7; color:#b45309; } .sev-HIGH { background:#fee2e2; color:#b91c1c; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  td, th { border: 1px solid #e2e8f0; padding: 8px 10px; font-size: 13px; text-align: left; }
  th { background: #f1f5f9; }
  .qa { margin: 8px 0; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fbfcfe; }
  .speaker { font-size: 12px; font-weight: 700; margin-bottom: 4px; }
  .speaker.ai { color: #1d4ed8; } .speaker.candidate { color: #15803d; }
  .qa-content { font-size: 14px; white-space: pre-wrap; }
  .ev { display: inline-block; margin: 8px; text-align: center; }
  .ev img { width: 200px; height: 150px; object-fit: cover; border-radius: 8px; border: 1px solid #e2e8f0; }
  .ev-label { font-size: 12px; font-weight: 600; margin-top: 4px; }
  .ev-time { font-size: 11px; color: #94a3b8; }
  .muted { color: #94a3b8; font-size: 13px; }
  .summary-box { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px 16px; font-size:14px; }
  .footer { margin-top: 28px; font-size: 11px; color: #94a3b8; text-align: center; }
</style></head><body><div class="page">
  <h1>Interview Report — ${esc(candidateName || 'Candidate')}</h1>
  <div class="sub">${esc(jobTitle || '')} &nbsp;·&nbsp; Interview #${esc(interviewId)} &nbsp;·&nbsp; ${esc(interview?.round || '')}
    &nbsp;·&nbsp; Status: ${esc(interview?.status || '')}</div>

  <h2>Overall Performance</h2>
  <div style="margin: 10px 0">
    <span class="badge sev-${esc(sev)}">Severity: ${esc(sev)}</span>
    &nbsp;<span class="badge" style="background:#e0e7ff;color:#3730a3">Recommendation: ${esc(report.recommendation || malpractice?.severity || 'N/A')}</span>
  </div>
  <div class="scores">
    <div class="score"><div class="num">${esc(report.overall_score ?? 'N/A')}</div><div class="lbl">Overall</div></div>
    <div class="score"><div class="num">${esc(report.technical_score ?? 'N/A')}</div><div class="lbl">Technical</div></div>
    <div class="score"><div class="num">${esc(report.communication_score ?? 'N/A')}</div><div class="lbl">Communication</div></div>
    <div class="score"><div class="num">${esc(report.suspicious_event_count ?? 'N/A')}</div><div class="lbl">Suspicious events</div></div>
  </div>
  <div class="summary-box">${esc(report.verdict_summary || malpractice?.summary || 'No analysis available.')}</div>
  ${report.final_note ? `<p class="muted">${esc(report.final_note)}</p>` : ''}

  ${(report.strengths && report.strengths.length) || (report.weaknesses && report.weaknesses.length) ? `
  <h2>Strengths & Weaknesses</h2>
  <table><tr><th style="width:50%">Strengths</th><th>Weaknesses</th></tr>
  <tr><td><ul>${(report.strengths || []).map(s => `<li>${esc(s)}</li>`).join('')}</ul></td>
      <td><ul>${(report.weaknesses || []).map(s => `<li>${esc(s)}</li>`).join('')}</ul></td></tr></table>` : ''}

  <h2>Questions & Answers</h2>
  ${rows || '<p class="muted">No Q&A transcript recorded.</p>'}

  <h2>Suspicious Activity Analysis</h2>
  <div class="summary-box">${esc(mp?.summary || 'No suspicious activity was detected during this interview.')}</div>
  <table>
    <tr><th>Behavior</th><th style="width:100px;text-align:center">Count</th></tr>
    ${events || '<tr><td colspan="2" class="muted">No suspicious behavior recorded.</td></tr>'}
  </table>

  <h2>Evidence Snapshots (Cloudinary)</h2>
  ${evidenceItems}

  <div class="footer">Generated by Recruitment Platform · Report #${esc(interviewId)} · ${esc(new Date().toLocaleString())}</div>
</div></body></html>`;
  };

  const downloadFile = (html, filename) => {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadReport = async () => {
    setLoadingReport(true);
    setReportNotice('');
    try {
      const [ev, mp, tr] = await Promise.all([
        api.get(`/api/interview/${interviewId}/evidence`),
        api.get(`/api/interview/${interviewId}/malpractice-report`),
        api.get(`/api/interview/${interviewId}/transcript`),
      ]);
      const transcript = tr?.data || [];
      const questions = [];
      const answers = [];
      transcript.forEach((t) => {
        if (t.speaker === 'ai_agent' || t.speaker === 'assistant') questions.push(t.content || '');
        else if (t.speaker === 'candidate' || t.speaker === 'user') answers.push(t.content || '');
      });
      const ai = await api.post(`/api/interview/${interviewId}/report`, {
        interview_id: String(interviewId),
        job_description: jobDescription || '',
        candidate_resume: resumeText || '',
        questions,
        answers,
        behavior_events: mp?.eventBreakdown || {},
        evidence_count: ev?.count || 0,
      }).catch(() => null);

      setAiReport(ai);
      setEvidence(ev);
      setMalpractice(mp);
      const safeName = (candidateName || 'candidate').replace(/[^a-zA-Z0-9]+/g, '_');
      downloadFile(buildReportHtml(ev, mp, ai, transcript), `Interview_Report_${safeName}_${interviewId}.html`);
      setReportNotice('Full report downloaded. Open the HTML file in a browser to view everything.');
    } catch (e) {
      setReportNotice(`Report download failed: ${e.message}`);
    } finally {
      setLoadingReport(false);
    }
  };

  const events = malpractice?.eventBreakdown || {};
  const evidenceItems = (evidence?.items || []).filter((i) => i.cloudinaryUrl);
  const totalSuspicious = (malpractice?.suspiciousEventCount ?? 0) + (malpractice?.evidenceCount ?? 0);

  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <h3 style={{ margin: 0 }}>Interview #{interviewId}</h3>
          <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 2 }}>
            {interview?.round || 'AI Interview'} &bull; {interview?.status || ''}
            {interview?.aiScore != null ? ` &bull; Score: ${interview.aiScore}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={`btn ${suspiciousOpen ? 'btn-secondary' : 'btn-danger'}`}
            onClick={loadSuspicious}
            disabled={loadingSuspicious}
          >
            {loadingSuspicious ? 'Loading...' : (suspiciousOpen ? 'Hide Details' : `Suspicious Detected${totalSuspicious > 0 ? ` (${totalSuspicious})` : ''}`)}
          </button>
          <button className="btn btn-primary" onClick={downloadReport} disabled={loadingReport}>
            {loadingReport ? 'Generating...' : 'Download Full Report'}
          </button>
        </div>
      </div>

      {suspiciousOpen && (
        <div className="card-body" style={{ borderTop: '1px solid var(--border)', background: '#fbfcfe' }}>
          {reportNotice && <p style={{ color: '#b45309', fontSize: 13 }}>{reportNotice}</p>}

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
            <div className="badge" style={SEVERITY_STYLES[malpractice?.severity] || SEVERITY_STYLES.NONE}>
              {malpractice?.severity || 'NONE'} RISK
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-light)' }}>
              {malpractice?.suspiciousEventCount ?? 0} suspicious events &bull; {malpractice?.evidenceCount ?? 0} evidence snapshots
            </div>
          </div>

          {malpractice?.summary && (
            <p style={{ fontSize: 14, lineHeight: 1.6 }}>{malpractice.summary}</p>
          )}

          {Object.keys(events).length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>What happened during the interview</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {Object.entries(events).map(([k, v]) => (
                  <span key={k} className="tag tag-danger" title={k}>
                    {EVENT_LABELS[k] || k}: {v}
                  </span>
                ))}
              </div>
            </div>
          )}

          {evidenceItems.length > 0 ? (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Captured evidence (Cloudinary)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {evidenceItems.map((item, i) => (
                  <div key={i} style={{ width: 180 }}>
                    <img
                      src={item.cloudinaryUrl}
                      alt={item.eventType}
                      style={{ width: '100%', height: 130, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }}
                    />
                    <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>
                      {EVENT_LABELS[item.eventType] || item.eventType}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {item.capturedAt ? new Date(item.capturedAt).toLocaleString() : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              No captured images found. Evidence may be offline or Cloudinary is not configured.
            </p>
          )}

          {aiReport && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>AI Analysis</div>
              <p style={{ fontSize: 14 }}>{aiReport.verdict_summary}</p>
              {aiReport.recommendation && (
                <div style={{ fontSize: 13 }}>
                  Recommendation: <strong>{aiReport.recommendation}</strong>
                  {aiReport.overall_score != null ? ` (overall ${aiReport.overall_score}/100)` : ''}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
