import { useState, useRef, useEffect } from 'react';

function isChrome() {
  const ua = navigator.userAgent;
  return /Chrome|Edg\//.test(ua) && !/OPR/.test(ua) && !/Firefox/.test(ua);
}

export default function SystemCheck() {
  const [chromeOk] = useState(isChrome());
  const [speaker, setSpeaker] = useState('idle');
  const [mic, setMic] = useState('idle');
  const [cam, setCam] = useState('idle');
  const [voice, setVoice] = useState('idle');
  const [micLevel, setMicLevel] = useState(0);
  const [camPreview, setCamPreview] = useState(null);
  const [micStream, setMicStream] = useState(null);

  const camRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const micRafRef = useRef(null);
  const micOkRef = useRef(false);
  const camStreamRef = useRef(null);

  useEffect(() => {
    return () => {
      if (micStream) micStream.getTracks().forEach(t => t.stop());
      if (camStreamRef.current) camStreamRef.current.getTracks().forEach(t => t.stop());
      if (micRafRef.current) cancelAnimationFrame(micRafRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close();
    };
  }, [micStream]);

  const testSpeaker = async () => {
    setSpeaker('testing');
    const ok = await new Promise((resolve) => {
      if (!window.speechSynthesis) { resolve(false); return; }
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance('Can you hear this clearly? Your speaker or earphones are working properly. This is a system test before your interview.');
      u.rate = 1;
      u.onend = () => resolve(true);
      u.onerror = () => resolve(false);
      window.speechSynthesis.speak(u);
      setTimeout(() => resolve(true), 20000);
    });
    setSpeaker(ok ? 'passed' : 'failed');
  };

  const testMic = async () => {
    setMic('testing');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicStream(stream);
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      micOkRef.current = false;
      let ticks = 0;
      const loop = () => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / data.length;
        setMicLevel(Math.round(avg));
        if (avg > 12) micOkRef.current = true;
        ticks++;
        if (ticks > 120) {
          setMic(micOkRef.current ? 'passed' : 'failed');
          return;
        }
        micRafRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch (e) {
      setMic('failed');
    }
  };

  const testCam = async () => {
    setCam('testing');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      camStreamRef.current = stream;
      setCamPreview(stream);
      if (camRef.current) camRef.current.srcObject = stream;
      setTimeout(() => setCam('passed'), 1200);
    } catch (e) {
      setCam('failed');
    }
  };

  const testVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setVoice(SpeechRecognition ? 'passed' : 'failed');
  };

  useEffect(() => {
    if (camPreview && camRef.current) camRef.current.srcObject = camPreview;
  }, [camPreview]);

  const allPassed = speaker === 'passed' && mic === 'passed' && cam === 'passed' && voice === 'passed';

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a, #1e293b)', padding: '30px 16px', fontFamily: 'inherit', color: '#e2e8f0' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', background: 'rgba(255,255,255,0.04)', border: '1px solid #334155', borderRadius: 16, padding: '28px 30px' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 44, marginBottom: 6 }}>🖥️</div>
          <h1 style={{ margin: 0, fontSize: 24, color: 'white' }}>System Compatibility Check</h1>
          <p style={{ color: '#94a3b8', fontSize: 14, marginTop: 6 }}>
            Test your speaker / earphones, microphone and camera before your interview.
          </p>
        </div>

        {!chromeOk && (
          <div style={{ background: '#450a0a', border: '1px solid #dc2626', color: '#fca5a5', padding: '12px 16px', borderRadius: 10, fontSize: 14, marginBottom: 18, textAlign: 'center' }}>
            ⚠️ <b>Google Chrome is required.</b> Please download Chrome first, then re-open this page.{' '}
            <a href="https://www.google.com/chrome/" target="_blank" rel="noreferrer" style={{ color: '#fecaca', fontWeight: 700 }}>Download Chrome →</a>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid #334155', borderRadius: 12, padding: '14px 16px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 22 }}>🔊</span>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontWeight: 700 }}>Speaker / Earphones</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>Use earphones for the best clarity</div>
            </div>
            <button onClick={testSpeaker} style={btnStyle}>Play Test Sound</button>
            {speaker === 'passed' && <span style={passBadge}>✓ Working</span>}
            {speaker === 'failed' && <span style={failBadge}>✕ Not heard</span>}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid #334155', borderRadius: 12, padding: '14px 16px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 22 }}>🎙️</span>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontWeight: 700 }}>Microphone</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>Speak after pressing the button</div>
              {mic === 'testing' && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ height: 6, width: 200, maxWidth: '100%', background: '#334155', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, micLevel)}%`, background: micLevel > 12 ? '#22c55e' : '#f59e0b', transition: 'width 80ms' }} />
                  </div>
                </div>
              )}
            </div>
            <button onClick={testMic} style={btnStyle}>Test Microphone</button>
            {mic === 'passed' && <span style={passBadge}>✓ Working</span>}
            {mic === 'failed' && <span style={failBadge}>✕ No sound</span>}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid #334155', borderRadius: 12, padding: '14px 16px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 22 }}>📷</span>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontWeight: 700 }}>Camera</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>Keep it pointed at your face</div>
              {cam === 'testing' && camPreview && (
                <video ref={camRef} autoPlay playsInline muted style={{ width: 160, borderRadius: 8, marginTop: 8, background: '#000' }} />
              )}
            </div>
            <button onClick={testCam} style={btnStyle}>Test Camera</button>
            {cam === 'passed' && <span style={passBadge}>✓ Working</span>}
            {cam === 'failed' && <span style={failBadge}>✕ Not detected</span>}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid #334155', borderRadius: 12, padding: '14px 16px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 22 }}>🗣️</span>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontWeight: 700 }}>Voice Input (Speech Recognition)</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>Required to answer by speaking</div>
            </div>
            <button onClick={testVoice} style={btnStyle}>Check Voice</button>
            {voice === 'passed' && <span style={passBadge}>✓ Supported</span>}
            {voice === 'failed' && <span style={failBadge}>✕ Use Chrome</span>}
          </div>
        </div>

        <div style={{ marginTop: 22, textAlign: 'center' }}>
          {allPassed ? (
            <div style={{ background: '#052e16', border: '1px solid #22c55e', color: '#86efac', borderRadius: 10, padding: '14px 18px', fontSize: 15, fontWeight: 700 }}>
              ✅ Your system is ready! You will receive the "Get Ready" email with your room link 2 minutes before your interview.
            </div>
          ) : (
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '12px 18px', fontSize: 13, color: '#94a3b8' }}>
              Complete all four checks to make sure your interview goes smoothly.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const btnStyle = {
  padding: '9px 16px', borderRadius: 8, border: 'none',
  background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)',
  color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer',
};

const passBadge = {
  background: '#052e16', color: '#86efac', border: '1px solid #22c55e',
  padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700,
};

const failBadge = {
  background: '#450a0a', color: '#fca5a5', border: '1px solid #dc2626',
  padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700,
};
