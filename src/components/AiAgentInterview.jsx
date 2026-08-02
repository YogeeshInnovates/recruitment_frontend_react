import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

function authHeaders() {
  try {
    const raw = localStorage.getItem('recruit_user');
    if (raw) {
      const user = JSON.parse(raw);
      if (user?.token) return { 'Authorization': `Bearer ${user.token}` };
    }
  } catch { /* ignore */ }
  return {};
}

function speak(text) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) { resolve(); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Microsoft')
    );
    if (preferred) utterance.voice = preferred;
    let resolved = false;
    const safeResolve = () => { if (!resolved) { resolved = true; resolve(); } };
    utterance.onend = safeResolve;
    utterance.onerror = safeResolve;
    window.speechSynthesis.speak(utterance);
    setTimeout(safeResolve, 30000);
  });
}

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const INSTRUCTIONS_TEXT =
  'Please stay in a quiet, well-lit place. Keep your camera on and look into the camera while answering. ' +
  'Do not switch tabs or open any other application during the interview. ' +
  'Do not take help from any person or device. Switching tabs will be recorded and flagged. ' +
  'Answer naturally, in your own words. Good luck!';

export default function AiAgentInterview() {
  const { interviewId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isMonitor = searchParams.get('monitor') === '1';

  const [phase, setPhase] = useState('loading');
  const [messages, setMessages] = useState([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [interviewData, setInterviewData] = useState(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState('');
  const [candidateSpeech, setCandidateSpeech] = useState('');
  const [showSubtitle, setShowSubtitle] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('Initializing...');
  const [currentDifficulty, setCurrentDifficulty] = useState('Medium');
  const [isFinished, setIsFinished] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const [speechSupported, setSpeechSupported] = useState(null);
  const [speakerSupported, setSpeakerSupported] = useState(null);
  const [micStatus, setMicStatus] = useState('unchecked');
  const [camStatus, setCamStatus] = useState('unchecked');
  const [videoStream, setVideoStream] = useState(null);
  const [monitorTranscript, setMonitorTranscript] = useState([]);
  const [monitorStatus, setMonitorStatus] = useState('');
  const [instructionsSpoken, setInstructionsSpoken] = useState(false);

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);
  const idleTimerRef = useRef(null);
  const conversationHistoryRef = useRef([]);
  const questionCountRef = useRef(0);
  const phaseRef = useRef('loading');
  const isProcessingRef = useRef(false);
  const noSpeechCountRef = useRef(0);
  const consecutiveSilenceRef = useRef(0);
  const accumulatedTranscriptRef = useRef('');
  const lastSpeechRef = useRef('');
  const sendToAIRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const countdownDebounceRef = useRef(null);
  const videoRef = useRef(null);
  const lastActivityEventRef = useRef({});
  const waitTimerRef = useRef(null);
  const hasStartedRef = useRef(false);

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, monitorTranscript]);

  useEffect(() => {
    if (phase === 'active') {
      timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  const logActivity = useCallback((eventType, detail) => {
    try {
      const key = `${eventType}:${Math.floor(Date.now() / 3000)}`;
      if (lastActivityEventRef.current[key]) return;
      lastActivityEventRef.current[key] = true;
      fetch(`${API_URL}/api/interview/${interviewId}/activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ eventType, detail })
      }).catch(() => {});
    } catch { /* ignore */ }
  }, [interviewId]);

  useEffect(() => {
    if (!interviewId || isMonitor || phase !== 'active') return;
    const onVis = () => {
      if (document.hidden) logActivity('TAB_SWITCH', 'Candidate left the interview tab');
    };
    const onBlur = () => {
      if (!document.hidden) logActivity('PAGE_BLUR', 'Candidate window lost focus');
    };
    const onFocus = () => logActivity('RETURN_TO_TAB', 'Candidate returned to the interview tab');
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
    };
  }, [interviewId, isMonitor, phase, logActivity]);

  const stopMic = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
    setIsListening(false);
    setMicActive(false);
    clearCountdown();
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const clearCountdown = () => {
    setCountdown(null);
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (countdownDebounceRef.current) {
      clearTimeout(countdownDebounceRef.current);
      countdownDebounceRef.current = null;
    }
  };

  const startCountdown = () => {
    setCountdown(15);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    let sec = 15;
    countdownIntervalRef.current = setInterval(() => {
      sec -= 1;
      setCountdown(sec);
      if (sec <= 0) clearCountdown();
    }, 1000);
  };

  const scheduleCountdown = () => {
    if (countdownDebounceRef.current) clearTimeout(countdownDebounceRef.current);
    countdownDebounceRef.current = setTimeout(() => {
      setCountdown(13);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      let sec = 13;
      countdownIntervalRef.current = setInterval(() => {
        sec -= 1;
        setCountdown(sec);
        if (sec <= 0) clearCountdown();
      }, 1000);
    }, 2000);
  };

  const idleTimerCallback = useCallback(() => {
    clearCountdown();
    if (phaseRef.current === 'active' && !isProcessingRef.current && sendToAIRef.current) {
      const accumulated = accumulatedTranscriptRef.current.trim();
      if (accumulated) {
        accumulatedTranscriptRef.current = '';
        sendToAIRef.current(accumulated);
      } else if (lastSpeechRef.current.trim()) {
        const speech = lastSpeechRef.current.trim();
        lastSpeechRef.current = '';
        sendToAIRef.current(speech);
      } else {
        consecutiveSilenceRef.current += 1;
        if (consecutiveSilenceRef.current >= 3) {
          sendToAIRef.current("No answer received, end the interview");
        } else if (consecutiveSilenceRef.current >= 2) {
          sendToAIRef.current("No answer received, let me ask something else");
        } else {
          sendToAIRef.current("No answer received, ask me to repeat");
        }
      }
    }
  }, []);

  const startMic = useCallback(() => {
    if (!recognitionRef.current || isProcessingRef.current) return;
    setCandidateSpeech('');
    setShowSubtitle('');
    lastSpeechRef.current = '';
    try {
      recognitionRef.current.start();
      setIsListening(true);
      setMicActive(true);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(idleTimerCallback, 15000);
      startCountdown();
    } catch (e) {
      console.log('Mic start error:', e);
    }
  }, []);

  const sendToAI = useCallback(async (userMessage) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    stopMic();

    const lastAiMsg = conversationHistoryRef.current
      .filter(m => m.role === 'assistant').pop();
    if (lastAiMsg) {
      const aiWords = new Set(lastAiMsg.content.toLowerCase().split(/\s+/));
      const userWords = userMessage.toLowerCase().split(/\s+/);
      const common = userWords.filter(w => aiWords.has(w)).length;
      if (userWords.length > 3 && common / userWords.length > 0.5) {
        isProcessingRef.current = false;
        setTimeout(() => startMic(), 1000);
        return;
      }
    }

    const stopPhrases = ["stop the interview", "not interested", "end the interview", "i want to stop", "please stop", "i'm done", "i am done", "cancel interview"];
    if (stopPhrases.some(p => userMessage.toLowerCase().includes(p))) {
      setMessages(prev => [...prev, { role: 'candidate', content: userMessage }]);
      const endMsg = "Thank you for your time. We'll review your responses and get back to you.";
      setMessages(prev => [...prev, { role: 'ai', content: endMsg }]);
      setAiSpeaking(true);
      setShowSubtitle(endMsg);
      await speak(endMsg);
      setAiSpeaking(false);
      setShowSubtitle('');
      setPhase('complete');
      phaseRef.current = 'complete';
      try { await fetch(`${API_URL}/api/interview/${interviewId}/end`, { method: 'POST', headers: { ...authHeaders() } }); } catch (e) {}
      return;
    }

    const newHistory = [...conversationHistoryRef.current, { role: 'user', content: userMessage }];
    conversationHistoryRef.current = newHistory;
    questionCountRef.current += 1;

    setMessages(prev => [...prev, { role: 'candidate', content: userMessage }]);

    try {
      const res = await fetch(`${API_URL}/api/interview/${interviewId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory: newHistory,
          questionNumber: questionCountRef.current,
        }),
      });

      if (!res.ok) throw new Error('Chat failed');
      const data = await res.json();
      const aiReply = data.response || '';
      if (data.current_difficulty) setCurrentDifficulty(data.current_difficulty);
      if (data.is_finished) setIsFinished(true);

      if (aiReply) {
        conversationHistoryRef.current = [...newHistory, { role: 'assistant', content: aiReply }];
        setMessages(prev => [...prev, { role: 'ai', content: aiReply }]);
        setQuestionCount(questionCountRef.current);

        setAiSpeaking(true);
        setShowSubtitle(aiReply);
        await speak(aiReply);
        setAiSpeaking(false);
        setShowSubtitle('');

        if (data.is_finished ||
            aiReply.toLowerCase().includes('interview is now complete') ||
            aiReply.toLowerCase().includes('thank you for your time') ||
            aiReply.toLowerCase().includes("we'll review") ||
            aiReply.toLowerCase().includes("we'll let you know") ||
            aiReply.toLowerCase().includes("get back to you")) {
          setPhase('complete');
          phaseRef.current = 'complete';
          try {
            await fetch(`${API_URL}/api/interview/${interviewId}/end`, { method: 'POST', headers: { ...authHeaders() } });
          } catch (e) {}
          return;
        }

        if (phaseRef.current === 'active') {
          setTimeout(() => {
            if (phaseRef.current === 'active' && !isProcessingRef.current) startMic();
          }, 3000);
        }
      }
    } catch (err) {
      console.error('AI error:', err);
      const fallback = 'I apologize for the technical issue. Could you please repeat your answer?';
      setMessages(prev => [...prev, { role: 'ai', content: fallback }]);
      setAiSpeaking(true);
      setShowSubtitle(fallback);
      await speak(fallback);
      setAiSpeaking(false);
      setShowSubtitle('');
      setTimeout(() => { if (phaseRef.current === 'active') startMic(); }, 3000);
    } finally {
      isProcessingRef.current = false;
    }
  }, [interviewId, stopMic, startMic]);

  sendToAIRef.current = sendToAI;

  useEffect(() => {
    if (isMonitor) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }
    setSpeechSupported(true);

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let newFinal = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          newFinal += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (newFinal) {
        accumulatedTranscriptRef.current += newFinal + ' ';
        noSpeechCountRef.current = 0;
        consecutiveSilenceRef.current = 0;
        lastSpeechRef.current = '';
      } else if (interimTranscript) {
        lastSpeechRef.current = interimTranscript;
        consecutiveSilenceRef.current = 0;
      }

      if (newFinal || interimTranscript) {
        if (countdownDebounceRef.current) {
          clearTimeout(countdownDebounceRef.current);
          countdownDebounceRef.current = null;
        }
        setCountdown(null);
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
      }

      if ((newFinal || interimTranscript) && idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = setTimeout(idleTimerCallback, 15000);
        scheduleCountdown();
      }

      const displayText = accumulatedTranscriptRef.current.trim() || interimTranscript;
      setCandidateSpeech(displayText);
      setShowSubtitle(displayText);
    };

    recognition.onerror = (event) => {
      console.log('Speech recognition error:', event.error);
      if (event.error === 'aborted') {
        if (!isProcessingRef.current && phaseRef.current === 'active') {
          setTimeout(() => startMic(), 500);
        }
      }
    };

    recognition.onend = () => {
      if (phaseRef.current === 'active' && !isProcessingRef.current) {
        setTimeout(() => {
          if (phaseRef.current === 'active' && !isProcessingRef.current) startMic();
        }, 300);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      try { recognition.stop(); } catch (e) {}
    };
  }, [sendToAI, startMic, isMonitor]);

  const beginInterview = useCallback(async (data) => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    try {
      setConnectionStatus('Starting interview session...');
      const startRes = await fetch(`${API_URL}/api/interview/${interviewId}/start`, {
        method: 'POST', headers: { ...authHeaders() }
      });
      if (!startRes.ok) {
        const errData = await startRes.json().catch(() => ({}));
        hasStartedRef.current = false;
        setError(errData.error || 'Interview cannot start yet');
        setPhase('waiting');
        startWaitTimer(data);
        return;
      }

      await new Promise(r => setTimeout(r, 2000));

      const candidateName = data.candidateName || 'Candidate';
      const greeting = `${getTimeGreeting()}, ${candidateName}! Welcome to your interview. Am I speaking with ${candidateName}?`;

      setMessages([{ role: 'ai', content: greeting }]);
      conversationHistoryRef.current = [{ role: 'assistant', content: greeting }];
      setPhase('active');
      phaseRef.current = 'active';
      setConnectionStatus('');

      setAiSpeaking(true);
      setShowSubtitle(greeting);
      await speak(greeting);
      setAiSpeaking(false);
      setShowSubtitle('');

      setTimeout(() => startMic(), 3000);
    } catch (err) {
      hasStartedRef.current = false;
      setError('Failed to start interview: ' + err.message);
      setPhase('error');
    }
  }, [interviewId, startMic]);

  const startWaitTimer = useCallback((data) => {
    if (waitTimerRef.current) clearInterval(waitTimerRef.current);
    const tick = () => {
      const sched = data?.scheduledAt ? new Date(data.scheduledAt) : null;
      if (!sched || isNaN(sched.getTime())) {
        setWaitSeconds(0);
        setPhase('check');
        if (waitTimerRef.current) clearInterval(waitTimerRef.current);
        return;
      }
      const diff = Math.floor((sched.getTime() - Date.now()) / 1000);
      setWaitSeconds(Math.max(0, diff));
      if (diff <= 0) {
        setWaitSeconds(0);
        setPhase('check');
        if (waitTimerRef.current) clearInterval(waitTimerRef.current);
      }
    };
    tick();
    waitTimerRef.current = setInterval(tick, 1000);
  }, []);

  useEffect(() => {
    if (isMonitor) {
      let stream = null;
      (async () => {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          setVideoStream(stream);
          if (videoRef.current) videoRef.current.srcObject = stream;
        } catch (e) { /* recruiter camera optional */ }
      })();
      const poll = setInterval(async () => {
        try {
          const data = await fetch(`${API_URL}/api/interview/${interviewId}`, { headers: { ...authHeaders() } }).then(r => r.json());
          setMonitorStatus(data?.status || '');
          setInterviewData(data);
        } catch (e) {}
        try {
          const list = await fetch(`${API_URL}/api/interview/${interviewId}/transcript`, { headers: { ...authHeaders() } }).then(r => r.json());
          setMonitorTranscript(list || []);
        } catch (e) {}
      }, 5000);
      const initial = async () => {
        try {
          const data = await fetch(`${API_URL}/api/interview/${interviewId}`, { headers: { ...authHeaders() } }).then(r => r.json());
          setInterviewData(data);
          setMonitorStatus(data?.status || '');
        } catch (e) {}
        try {
          const list = await fetch(`${API_URL}/api/interview/${interviewId}/transcript`, { headers: { ...authHeaders() } }).then(r => r.json());
          setMonitorTranscript(list || []);
        } catch (e) {}
      };
      initial();
      return () => {
        clearInterval(poll);
        if (stream) stream.getTracks().forEach(t => t.stop());
      };
    }

    const init = async () => {
      try {
        setConnectionStatus('Connecting to interview...');
        const res = await fetch(`${API_URL}/api/interview/${interviewId}`, { headers: { ...authHeaders() } });
        if (!res.ok) throw new Error('Interview not found');
        const data = await res.json();
        setInterviewData(data);

        if (!window.speechSynthesis) setSpeakerSupported(false);
        else setSpeakerSupported(true);

        if (data.status === 'COMPLETED') {
          setPhase('complete');
          return;
        }

        const sched = data.scheduledAt ? new Date(data.scheduledAt) : null;
        if (sched && !isNaN(sched.getTime()) && sched.getTime() > Date.now()) {
          setPhase('waiting');
          startWaitTimer(data);
          return;
        }

        setPhase('check');
      } catch (err) {
        setError('Failed to load interview: ' + err.message);
        setPhase('error');
      }
    };
    init();
    return () => { if (waitTimerRef.current) clearInterval(waitTimerRef.current); };
  }, [interviewId, isMonitor, startWaitTimer]);

  useEffect(() => {
    if (videoStream && videoRef.current) {
      videoRef.current.srcObject = videoStream;
    }
  }, [videoStream]);

  const requestMedia = async () => {
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setMicStatus('granted');
      setCamStatus('granted');
      setVideoStream(stream);
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (e) {
      if (e && e.name === 'NotAllowedError') {
        setMicStatus('denied');
        setCamStatus('denied');
        logActivity('MEDIA_DENIED', 'Candidate denied camera/mic access during compatibility check');
      } else if (e && e.name === 'NotFoundError') {
        setMicStatus('missing');
        setCamStatus('missing');
        logActivity('MEDIA_MISSING', 'No camera/mic device found during compatibility check');
      } else {
        setMicStatus('error');
        setCamStatus('error');
      }
    }
  };

  const canContinue = () =>
    speechSupported === true &&
    speakerSupported === true &&
    (micStatus === 'granted' || micStatus === 'unchecked') &&
    (camStatus === 'granted' || camStatus === 'unchecked');

  const speakInstructions = async () => {
    const intro = `Welcome ${interviewData?.candidateName || 'Candidate'}. Before your ${interviewData?.round || 'interview'} begins, please listen to these important instructions.`;
    setInstructionsSpoken(true);
    await speak(intro + ' ' + INSTRUCTIONS_TEXT);
  };

  const formatWait = (sec) => {
    if (sec <= 0) return '00:00';
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  /* ---------------- Monitor view ---------------- */
  if (isMonitor) {
    return (
      <div className="interview-room">
        <div className="interview-video" style={{ background: '#0f172a' }}>
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexDirection: 'column', padding: 20 }}>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
              {interviewData?.candidateName || 'Candidate'} — Live Monitor
            </div>
            <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>
              {interviewData?.jobTitle || 'Interview'} · {interviewData?.round || ''} ·{' '}
              <span className={`bd-status ${monitorStatus === 'IN_PROGRESS' ? 'bd-processing' : monitorStatus === 'COMPLETED' ? 'bd-over' : 'bd-scheduled'}`}>
                {monitorStatus || 'Loading...'}
              </span>
            </div>
            {videoStream ? (
              <video ref={videoRef} autoPlay playsInline muted style={{ width: 240, borderRadius: 12, border: '1px solid #334155', background: '#000' }} />
            ) : (
              <div style={{ width: 240, height: 160, borderRadius: 12, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                Recruiter camera off
              </div>
            )}
            <div style={{ marginTop: 20, fontSize: 13, color: '#94a3b8' }}>
              Candidate video is not streamed yet — transcript feed below updates live every 5 seconds.
            </div>
            <div style={{ marginTop: 20, width: '100%', maxWidth: 640, maxHeight: '45vh', overflow: 'auto', background: '#1e293b', borderRadius: 12, padding: 16 }}>
              {monitorTranscript.length === 0 ? (
                <div style={{ color: '#64748b', fontSize: 14, textAlign: 'center', padding: 20 }}>
                  Waiting for the candidate to start the interview...
                </div>
              ) : monitorTranscript.map((t, i) => (
                <div key={i} style={{ marginBottom: 10, fontSize: 14 }}>
                  <span style={{ fontWeight: 700, color: t.speaker === 'ai_agent' ? '#22d3ee' : '#a78bfa' }}>
                    {t.speaker === 'ai_agent' ? '🤖 AI' : '👤 Candidate'}:
                  </span>{' '}
                  <span style={{ color: '#e2e8f0' }}>{t.content}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="interview-chat" style={{ alignItems: 'center', justifyContent: 'center', display: 'flex' }}>
          <button onClick={() => navigate('/interview/batch/dashboard')} className="btn btn-primary">Back to Dashboard</button>
        </div>
      </div>
    );
  }

  if (phase === 'loading') {
    return (
      <div className="interview-room">
        <div className="interview-video">
          <div className="waiting-room">
            <div className="spinner"></div>
            <h2>Preparing Interview...</h2>
            <p>{connectionStatus}</p>
          </div>
        </div>
        <div className="interview-chat" />
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="interview-room">
        <div className="interview-video">
          <div className="waiting-room">
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h2>Interview Error</h2>
            <p>{error}</p>
            <button onClick={() => navigate('/')} className="btn btn-primary">Go Back</button>
          </div>
        </div>
        <div className="interview-chat" />
      </div>
    );
  }

  /* ---------------- Waiting (exact time enforcement) ---------------- */
  if (phase === 'waiting') {
    return (
      <div className="interview-room">
        <div className="interview-video">
          <div className="waiting-room">
            <div style={{ fontSize: 56, marginBottom: 16 }}>⏳</div>
            <h2>Please Wait</h2>
            <p>Your interview is scheduled for <b>{interviewData?.scheduledAt ? new Date(interviewData.scheduledAt).toLocaleString() : ''}</b></p>
            <div className="wait-timer">{formatWait(waitSeconds)}</div>
            <p style={{ color: '#94a3b8', fontSize: 14 }}>
              {waitSeconds > 0
                ? `Your interview starts in ${waitSeconds} seconds. It cannot start before your allocated time.`
                : 'Your interview time has arrived. Setting up...'}
            </p>
            {error && <p style={{ color: '#fca5a5' }}>{error}</p>}
            <button className="btn btn-outline" onClick={() => navigate('/')}>Go Back</button>
          </div>
        </div>
        <div className="interview-chat" />
      </div>
    );
  }

  /* ---------------- Compatibility check ---------------- */
  if (phase === 'check') {
    return (
      <div className="interview-room">
        <div className="interview-video">
          <div className="waiting-room">
            <h2>System Compatibility Check</h2>
            <p>Please verify your device before your interview starts.</p>
            <div className="check-list">
              <div className={`check-item ${speechSupported === false ? 'fail' : 'ok'}`}>
                <span>{speechSupported === false ? '✕' : '✓'}</span> Browser supports voice (Chrome / Edge)
                {speechSupported === false && <div className="check-sub">Please use Google Chrome or Microsoft Edge.</div>}
              </div>
              <div className={`check-item ${speakerSupported === false ? 'fail' : 'ok'}`}>
                <span>{speakerSupported === false ? '✕' : '✓'}</span> Speaker / audio output
              </div>
              <div className={`check-item ${micStatus === 'denied' ? 'fail' : 'ok'}`}>
                <span>{micStatus === 'denied' ? '✕' : micStatus === 'granted' ? '✓' : '?'}</span> Microphone
                {micStatus === 'denied' && <div className="check-sub">Microphone access denied. Please allow it in the browser.</div>}
              </div>
              <div className={`check-item ${camStatus === 'denied' ? 'fail' : 'ok'}`}>
                <span>{camStatus === 'denied' ? '✕' : camStatus === 'granted' ? '✓' : '?'}</span> Camera
                {camStatus === 'denied' && <div className="check-sub">Camera access denied. Please allow it in the browser.</div>}
              </div>
            </div>
            {videoStream && (
              <video ref={videoRef} autoPlay playsInline muted style={{ width: 180, borderRadius: 10, border: '1px solid #334155', background: '#000', margin: '12px 0' }} />
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-outline" onClick={requestMedia}>Test Camera & Mic</button>
              <button className="btn btn-primary" onClick={() => setPhase('instructions')} disabled={!canContinue()}>
                Continue
              </button>
            </div>
            {!canContinue() && (
              <p style={{ color: '#fca5a5', fontSize: 13, marginTop: 10 }}>
                Complete the checks above to continue (allow camera & mic, use Chrome/Edge).
              </p>
            )}
          </div>
        </div>
        <div className="interview-chat" />
      </div>
    );
  }

  /* ---------------- Instructions (TTS, no AI) ---------------- */
  if (phase === 'instructions') {
    return (
      <div className="interview-room">
        <div className="interview-video">
          <div className="waiting-room">
            <h2>Important Instructions</h2>
            <p>Please listen carefully. We will read the instructions aloud.</p>
            <div className="instructions-box">{INSTRUCTIONS_TEXT}</div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
              {!instructionsSpoken && (
                <button className="btn btn-outline" onClick={speakInstructions}>🔊 Play Instructions</button>
              )}
              <button className="btn btn-primary" onClick={() => beginInterview(interviewData)}>
                🎤 Start Interview
              </button>
            </div>
            {error && <p style={{ color: '#fca5a5', marginTop: 10 }}>{error}</p>}
          </div>
        </div>
        <div className="interview-chat" />
      </div>
    );
  }

  /* ---------------- Active interview ---------------- */
  return (
    <div className="interview-room">
      <div className="interview-video">
        <div style={{
          width: '100%', height: '100%', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', color: 'white',
        }}>
          <div style={{
            width: 160, height: 160, borderRadius: '50%',
            background: aiSpeaking
              ? 'linear-gradient(135deg, #10b981, #059669)'
              : isListening
                ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                : 'linear-gradient(135deg, #8b5cf6, #6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 64, marginBottom: 24,
            boxShadow: aiSpeaking
              ? '0 0 60px rgba(16, 185, 129, 0.6)'
              : isListening
                ? '0 0 60px rgba(239, 68, 68, 0.6)'
                : '0 0 40px rgba(139, 92, 246, 0.4)',
            transition: 'all 0.3s ease',
            animation: aiSpeaking ? 'pulse 1s infinite' : isListening ? 'pulse 1s infinite' : 'none',
          }}>
            {aiSpeaking ? '🔊' : isListening ? '🎙' : '🤖'}
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
            {aiSpeaking ? 'AI is speaking...' : isListening ? 'Listening to you...' : 'AI Interviewer'}
          </div>
          <div style={{ fontSize: 14, color: '#94a3b8' }}>
            {interviewData?.candidateName || 'Candidate'} · {interviewData?.round || ''}
          </div>
          {videoStream && (
            <video ref={videoRef} autoPlay playsInline muted style={{ width: 140, borderRadius: 10, border: '1px solid #334155', background: '#000', marginTop: 14 }} />
          )}
        </div>

        {showSubtitle && (
          <div style={{
            position: 'absolute', bottom: 80, left: 20, right: 20,
            background: 'rgba(0,0,0,0.8)', borderRadius: 12,
            padding: '12px 20px', color: 'white', fontSize: 15,
            textAlign: 'center', lineHeight: 1.5,
            maxHeight: 120, overflow: 'auto',
          }}>
            {showSubtitle}
          </div>
        )}

        <div className="timer">{formatTime(elapsedSeconds)}</div>

        <div className="ai-status">
          <span className="dot" style={{
            background: isListening ? '#ef4444' : aiSpeaking ? '#10b981' : '#8b5cf6'
          }}></span>
          {aiSpeaking ? 'AI Speaking' : isListening ? (countdown !== null ? `Auto-advancing in ${countdown}s` : 'Your Turn - Speak Now') : 'Connecting...'}
        </div>

        {phase === 'complete' && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', color: 'white', padding: 20,
          }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>✓</div>
            <h2 style={{ marginBottom: 8 }}>Interview Complete</h2>
            <p style={{ color: '#94a3b8', marginBottom: 20 }}>Thank you for your time!</p>
            <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 32, fontWeight: 700, color: '#8b5cf6' }}>{currentDifficulty}</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>Level</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 32, fontWeight: 700, color: '#f59e0b' }}>{questionCount}</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>Questions</div>
              </div>
            </div>
            <button onClick={() => {
              const conv = messages.filter(m => m.role === 'ai' || m.role === 'candidate')
                .map(m => `${m.role === 'ai' ? '🤖' : '👤'}: ${m.content}`).join('\n\n');
              const blob = new Blob([`Interview Transcript\n\nRound: ${interviewData?.round || ''}\nDifficulty: ${currentDifficulty}\nQuestions: ${questionCount}\n\n${conv}`], {type: 'text/plain'});
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = `interview-${interviewId}.txt`; a.click();
              URL.revokeObjectURL(url);
            }} style={{
              padding: '10px 24px', background: '#1e293b', color: 'white',
              border: '1px solid #334155', borderRadius: 8, cursor: 'pointer',
              fontSize: 14, marginBottom: 12,
            }}>
              Download Report
            </button>
          </div>
        )}

        <style>{`
          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
          }
        `}</style>
      </div>

      <div className="interview-chat">
        <div className="chat-header">
          <h3>AI Interview</h3>
          <span className="question-count">Q {Math.max(0, questionCount)}</span>
        </div>

        <div className="chat-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`chat-message ${msg.role}`}>
              <div className="avatar">{msg.role === 'ai' ? '🤖' : '👤'}</div>
              <div className="bubble">{msg.content}</div>
            </div>
          ))}
          {isListening && candidateSpeech && (
            <div className="chat-message candidate">
              <div className="avatar">👤</div>
              <div className="bubble" style={{ opacity: 0.7, fontStyle: 'italic' }}>
                {candidateSpeech}...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-area" style={{
          justifyContent: 'center', padding: '16px 20px',
          background: 'rgba(15, 23, 42, 0.8)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, width: '100%', justifyContent: 'center',
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: isListening ? '#ef4444' : '#10b981',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, color: 'white', cursor: 'pointer',
              boxShadow: isListening ? '0 0 20px rgba(239, 68, 68, 0.5)' : '0 0 20px rgba(16, 185, 129, 0.5)',
              animation: isListening ? 'pulse 1s infinite' : 'none',
            }}>
              {isListening ? '🎙' : '🔇'}
            </div>
            <div style={{ color: '#94a3b8', fontSize: 14 }}>
              {isListening ? 'Speak now - auto-submits after silence' : aiSpeaking ? 'AI is speaking...' : 'Connecting...'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
