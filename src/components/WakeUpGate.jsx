import { useEffect, useState } from 'react';
import { BASE_URL } from '../api/api';

const SLOW_THRESHOLD_SECONDS = 5;
const ATTEMPT_TIMEOUT_MS = 60000;
const RETRY_DELAY_MS = 4000;

export default function WakeUpGate({ children }) {
  const [phase, setPhase] = useState('warming');
  const [elapsed, setElapsed] = useState(0);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const start = Date.now();

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);

    async function run() {
      while (!cancelled) {
        const controller = new AbortController();
        const abortTimer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);

        try {
          const res = await fetch(`${BASE_URL}/api/warmup`, { signal: controller.signal });
          if (res.ok) {
            if (!cancelled) setPhase('ready');
            return;
          }
        } catch {
          // Network error or timeout while the free-tier server was sleeping.
          // It's not a real failure — just retry automatically.
        } finally {
          clearTimeout(abortTimer);
        }

        if (cancelled) return;
        setAttempt(a => a + 1);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }

    run();

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (phase === 'ready') {
    return children;
  }

  const showPopup = elapsed > SLOW_THRESHOLD_SECONDS;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'not-allowed',
    }}>
      {showPopup ? (
        <div style={{
          background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 28,
          maxWidth: 460, textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}>
          <div className="spinner" style={{ margin: '0 auto 20px', borderTopColor: '#f59e0b' }} />
          <h2 style={{ fontSize: 18, marginBottom: 12, color: '#f8fafc' }}>
            We're sorry for the inconvenience
          </h2>
          <p style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 1.6 }}>
            Our platform runs on a free hosting tier, so after about <b>15 minutes</b> of inactivity
            the servers go to sleep. It may take up to <b>~50 seconds</b> to wake them up.
          </p>
          <p style={{ color: '#f59e0b', fontSize: 14, fontWeight: 600, marginTop: 12 }}>
            Please wait — this is not an error.
          </p>
          <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 8 }}>
            Sorry for the wasted time. Waking up... ({elapsed}s){attempt > 0 ? ` · retry ${attempt}` : ''}
          </p>
        </div>
      ) : (
        <div style={{ textAlign: 'center', color: '#e2e8f0' }}>
          <div className="spinner" style={{ margin: '0 auto 20px' }} />
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Waking up our servers...</h2>
          <p style={{ color: '#94a3b8', fontSize: 14 }}>Connecting securely. This takes a few seconds.</p>
        </div>
      )}
    </div>
  );
}
