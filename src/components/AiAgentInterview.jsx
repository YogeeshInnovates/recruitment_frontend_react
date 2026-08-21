import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { startMonitoring, stopMonitoring, warmUpModel } from '../lib/behaviorMonitor';
import { isSupportedBrowser, isIOS } from '../utils/browser';

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
  const [snapshotUrl, setSnapshotUrl] = useState(null);
  const [snapshotTime, setSnapshotTime] = useState(null);
  const [instructionsSpoken, setInstructionsSpoken] = useState(false);
  const [meshWarning, setMeshWarning] = useState(false);
  const [activitySummary, setActivitySummary] = useState(null);
  const [evidenceData, setEvidenceData] = useState(null);
  const [micBlocked, setMicBlocked] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [micLevel, setMicLevel] = useState(0);

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
  const lastEvidenceAtRef = useRef({});
  const waitTimerRef = useRef(null);
  const hasStartedRef = useRef(false);
  const beginRef = useRef(null);
  const turnCountRef = useRef(0);
  const meshWarningShownRef = useRef(false);
  const meshStartedRef = useRef(false);
  const speechFailCountRef = useRef(0);
  const audioContextRef = useRef(null);
  const audioAnalyserRef = useRef(null);
  const secondVoiceIntervalRef = useRef(null);

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

  useEffect(() => {
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (countdownDebounceRef.current) clearTimeout(countdownDebounceRef.current);
    };
  }, []);

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

  const EVIDENCE_TYPES = ['HEAD_TURN_LEFT', 'HEAD_TURN_RIGHT', 'LOOK_DOWN', 'MULTI_FACE', 'FACE_LOST', 'NO_BLINK', 'CAMERA_FROZEN', 'GAZE_OFF'];

  const uploadEvidence = useCallback((eventType) => {
    try {
      if (!EVIDENCE_TYPES.includes(eventType)) return;
      const now = Date.now();
      if (now - (lastEvidenceAtRef.current[eventType] || 0) < 5000) return;
      lastEvidenceAtRef.current[eventType] = now;
      const v = videoRef.current;
      if (!v || !v.videoWidth) return;
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const fd = new FormData();
        fd.append('eventType', eventType);
        fd.append('image', blob, `evidence_${eventType}_${Date.now()}.jpg`);
        fetch(`${API_URL}/api/interview/${interviewId}/evidence`, {
          method: 'POST',
          headers: authHeaders(),
          body: fd
        }).catch(() => {});
      }, 'image/jpeg', 0.7);
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

  useEffect(() => {
    if (!interviewId || isMonitor || phase !== 'active') return;

    const isInInput = (e) => {
      const el = e.target;
      return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
    };

    const blockCopy = (e) => { logActivity('COPY_BLOCKED', 'Candidate attempted to copy text'); };
    const blockCut = (e) => { e.preventDefault(); logActivity('CUT_BLOCKED', 'Candidate attempted to cut text'); };
    const blockPaste = (e) => { if (isInInput(e)) { e.preventDefault(); logActivity('PASTE_BLOCKED', 'Candidate attempted to paste into input'); } };
    const blockContextMenu = (e) => { e.preventDefault(); logActivity('RIGHT_CLICK', 'Candidate attempted right-click'); };

    const blockedShortcuts = [
      { ctrl: true, key: 'v', name: 'Paste' },
      { ctrl: true, key: 'x', name: 'Cut' },
      { ctrl: true, key: 'u', name: 'View Source' },
      { ctrl: true, key: 's', name: 'Save Page' },
      { ctrl: true, key: 'p', name: 'Print' },
      { ctrl: true, key: 'shift', name: 'DevTools' },
      { ctrl: true, key: 'i', name: 'DevTools' },
      { ctrl: true, key: 'j', name: 'DevTools' },
    ];
    const blockKeys = (e) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (e.key === 'F12') { e.preventDefault(); logActivity('F12_BLOCKED', 'Candidate pressed F12 (DevTools)'); return; }
      if (e.key === 'PrintScreen') { e.preventDefault(); logActivity('PRINTSCREEN', 'Candidate pressed PrintScreen'); return; }
      if (e.key === 'Escape') { e.preventDefault(); logActivity('ESC_BLOCKED', 'Candidate pressed Escape'); return; }
      if (ctrl) {
        const match = blockedShortcuts.find(s => s.ctrl && s.key.toLowerCase() === e.key.toLowerCase());
        if (match) { e.preventDefault(); logActivity('SHORTCUT_BLOCKED', `Candidate pressed Ctrl+${e.key.toUpperCase()} (${match.name})`); }
      }
    };

    let screenShareDetected = false;
    const origGetDisplayMedia = navigator.mediaDevices?.getDisplayMedia;
    if (origGetDisplayMedia) {
      navigator.mediaDevices.getDisplayMedia = function (...args) {
        if (!screenShareDetected) {
          screenShareDetected = true;
          logActivity('SCREEN_SHARE_ATTEMPT', 'Candidate attempted to share screen');
        }
        return origGetDisplayMedia.apply(this, args);
      };
    }

    let secondVoiceDetected = false;
    let audioCtx = null;
    let analyser = null;
    let micStream = null;
    const startSecondVoiceDetection = async () => {
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioCtx.createMediaStreamSource(micStream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.5;
        source.connect(analyser);
        audioContextRef.current = audioCtx;
        audioAnalyserRef.current = analyser;

        const bufLen = analyser.frequencyBinCount;
        const data = new Uint8Array(bufLen);
        let highAmplitudeCount = 0;

        secondVoiceIntervalRef.current = setInterval(() => {
          if (phaseRef.current !== 'active') return;
          analyser.getByteFrequencyData(data);
          let sum = 0;
          for (let i = 0; i < bufLen; i++) sum += data[i];
          const avg = sum / bufLen;
          if (avg > 40) {
            highAmplitudeCount++;
            if (highAmplitudeCount >= 6 && !secondVoiceDetected) {
              secondVoiceDetected = true;
              logActivity('SECOND_VOICE', 'Possible second voice or someone reading answers detected (sustained high audio)');
            }
          } else {
            highAmplitudeCount = Math.max(0, highAmplitudeCount - 1);
          }
        }, 500);
      } catch (e) {
        console.log('Second voice detection unavailable:', e.message);
      }
    };
    startSecondVoiceDetection();

    document.addEventListener('copy', blockCopy);
    document.addEventListener('cut', blockCut);
    document.addEventListener('paste', blockPaste);
    document.addEventListener('contextmenu', blockContextMenu);
    document.addEventListener('keydown', blockKeys);

    return () => {
      document.removeEventListener('copy', blockCopy);
      document.removeEventListener('cut', blockCut);
      document.removeEventListener('paste', blockPaste);
      document.removeEventListener('contextmenu', blockContextMenu);
      document.removeEventListener('keydown', blockKeys);
      if (origGetDisplayMedia) navigator.mediaDevices.getDisplayMedia = origGetDisplayMedia;
      if (secondVoiceIntervalRef.current) clearInterval(secondVoiceIntervalRef.current);
      if (micStream) micStream.getTracks().forEach(t => t.stop());
      if (audioCtx && audioCtx.state !== 'closed') audioCtx.close();
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

  const countdownCompleteRef = useRef(null);

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
    countdownCompleteRef.current = null;
  };

  const startCountdown = () => {
    setCountdown(10);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    let sec = 10;
    countdownCompleteRef.current = () => {};
    countdownIntervalRef.current = setInterval(() => {
      sec -= 1;
      setCountdown(sec);
      if (sec <= 0) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
        countdownCompleteRef.current = null;
      }
    }, 1000);
  };

  const scheduleCountdown = () => {
    if (countdownDebounceRef.current) clearTimeout(countdownDebounceRef.current);
    countdownDebounceRef.current = setTimeout(() => {
      setCountdown(10);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      let sec = 10;
      countdownIntervalRef.current = setInterval(() => {
        sec -= 1;
        setCountdown(sec);
        if (sec <= 0) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
      }, 1000);
    }, 5000);
  };

  const idleTimerCallback = useCallback(() => {
    clearCountdown();
    if (phaseRef.current === 'active' && !isProcessingRef.current && sendToAIRef.current) {
      const accumulated = accumulatedTranscriptRef.current.trim();
      if (accumulated) {
        accumulatedTranscriptRef.current = '';
        setMicBlocked(false);
        setShowTextInput(false);
        sendToAIRef.current(accumulated);
      } else if (lastSpeechRef.current.trim()) {
        const speech = lastSpeechRef.current.trim();
        lastSpeechRef.current = '';
        setMicBlocked(false);
        setShowTextInput(false);
        sendToAIRef.current(speech);
      } else {
        consecutiveSilenceRef.current += 1;
        speechFailCountRef.current += 1;
        if (consecutiveSilenceRef.current >= 3) {
          sendToAIRef.current("No answer received, end the interview");
        } else if (consecutiveSilenceRef.current >= 2) {
          setMicBlocked(true);
          setShowTextInput(true);
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
    accumulatedTranscriptRef.current = '';
    try {
      recognitionRef.current.start();
      setIsListening(true);
      setMicActive(true);
      setMicBlocked(false);
      setShowTextInput(false);
      setCountdown(null);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(idleTimerCallback, 10000);
    } catch (e) {
      console.log('Mic start error:', e);
    }
  }, []);

  const sendToAI = useCallback(async (userMessage) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    stopMic();

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

  const submitTypedAnswer = useCallback(() => {
    const text = typedAnswer.trim();
    if (!text || isProcessingRef.current || phaseRef.current !== 'active') return;
    setTypedAnswer('');
    setShowTextInput(false);
    setMicBlocked(false);
    stopMic();
    accumulatedTranscriptRef.current = '';
    lastSpeechRef.current = '';
    sendToAIRef.current(text);
  }, [typedAnswer, stopMic]);

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
        speechFailCountRef.current = 0;
        lastSpeechRef.current = '';
      } else if (interimTranscript) {
        lastSpeechRef.current = interimTranscript;
        consecutiveSilenceRef.current = 0;
        speechFailCountRef.current = 0;
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

      if (newFinal && idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = setTimeout(idleTimerCallback, 10000);
      scheduleCountdown();
    } else if (interimTranscript && idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(idleTimerCallback, 10000);
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
      } else if (event.error === 'no-speech') {
        speechFailCountRef.current += 1;
        if (speechFailCountRef.current >= 2 && phaseRef.current === 'active') {
          setMicBlocked(true);
        }
      } else if (event.error === 'not-allowed' || event.error === 'audio-capture' || event.error === 'service-not-allowed') {
        speechFailCountRef.current += 1;
        if (phaseRef.current === 'active') {
          setMicBlocked(true);
          setShowTextInput(true);
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
        if (errData.slotClosed) {
          setError(errData.error || 'Your interview slot has ended. Please contact the recruiter.');
          setPhase('error');
          return;
        }
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
  beginRef.current = beginInterview;

  useEffect(() => {
    if (phase === 'active' && elapsedSeconds >= 1800) {
      setPhase('complete');
      phaseRef.current = 'complete';
      fetch(`${API_URL}/api/interview/${interviewId}/end`, { method: 'POST', headers: { ...authHeaders() } }).catch(() => {});
    }
  }, [phase, elapsedSeconds, interviewId]);

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
        if (waitTimerRef.current) clearInterval(waitTimerRef.current);
        setTimeout(() => { if (!hasStartedRef.current) beginRef.current?.(data); }, 500);
      }
    };
    tick();
    waitTimerRef.current = setInterval(tick, 1000);
  }, []);

  useEffect(() => {
    if (isMonitor) {
      const loadSnapshot = async () => {
        try {
          const res = await fetch(`${API_URL}/api/interview/${interviewId}/snapshot`, {
            headers: { ...authHeaders() }, cache: 'no-store'
          });
          if (res.ok) {
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            setSnapshotUrl(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
            setSnapshotTime(new Date());
          } else {
            setSnapshotUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
            setSnapshotTime(null);
          }
        } catch (e) {}
      };
      const loadSummary = async () => {
        try {
          const res = await fetch(`${API_URL}/api/interview/${interviewId}/activity/summary`, {
            headers: { ...authHeaders() }, cache: 'no-store'
          });
          if (res.ok) setActivitySummary(await res.json());
        } catch (e) {}
      };
      const loadEvidence = async () => {
        try {
          const res = await fetch(`${API_URL}/api/interview/${interviewId}/evidence`, {
            headers: { ...authHeaders() }, cache: 'no-store'
          });
          if (res.ok) setEvidenceData(await res.json());
        } catch (e) {}
      };
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
        loadSummary();
        loadEvidence();
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
      loadSnapshot();
      loadSummary();
      loadEvidence();
      const snapTimer = setInterval(loadSnapshot, 3000);
      return () => {
        clearInterval(poll);
        clearInterval(snapTimer);
        setSnapshotUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
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
    if (videoStream && videoRef.current && videoRef.current.srcObject !== videoStream) {
      videoRef.current.srcObject = videoStream;
    }
  }, [videoStream, phase]);

  useEffect(() => {
    if (phase === 'complete' || phase === 'error') {
      try { if (recognitionRef.current) recognitionRef.current.stop(); } catch (e) {}
      setIsListening(false);
      setMicActive(false);
      if (videoStream) {
        videoStream.getTracks().forEach(t => t.stop());
        setVideoStream(null);
      }
    }
  }, [phase, videoStream]);

  useEffect(() => {
    if (phase !== 'active' || !videoStream) return;
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    const send = async () => {
      try {
        const v = videoRef.current;
        if (!v || !v.videoWidth) return;
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.55));
        if (!blob) return;
        await fetch(`${API_URL}/api/interview/${interviewId}/snapshot`, {
          method: 'POST',
          headers: { 'Content-Type': 'image/jpeg' },
          body: blob
        });
      } catch (e) {}
    };
    send();
    const id = setInterval(send, 4000);
    return () => clearInterval(id);
  }, [phase, videoStream]);

  useEffect(() => {
    if (isMonitor) return;
    if (phase === 'active' && videoStream && videoRef.current && !meshStartedRef.current) {
      meshStartedRef.current = true;
      startMonitoring(videoRef.current, (type, detail) => {
        logActivity(type, detail);
        uploadEvidence(type);
        if (type === 'HEAD_TURN_LEFT' || type === 'HEAD_TURN_RIGHT' || type === 'LOOK_DOWN' || type === 'GAZE_OFF' || type === 'NO_BLINK' || type === 'FACE_LOST') {
          turnCountRef.current += 1;
          if (turnCountRef.current > 5 && !meshWarningShownRef.current) {
            meshWarningShownRef.current = true;
            setMeshWarning(true);
            setTimeout(() => setMeshWarning(false), 8000);
            try {
              if (window.speechSynthesis) {
                const u = new SpeechSynthesisUtterance(
                  "Please don't turn away from the screen during the interview.");
                u.rate = 1; u.volume = 1;
                window.speechSynthesis.speak(u);
              }
            } catch (e) {}
          }
        }
      }).catch(() => {});
    }
    if ((phase === 'complete' || phase === 'error') && meshStartedRef.current) {
      meshStartedRef.current = false;
      stopMonitoring();
    }
    return () => {
      if (phase === 'complete' || phase === 'error' || phase === 'waiting') {
        stopMonitoring();
      }
    };
  }, [phase, videoStream, isMonitor, logActivity, uploadEvidence, interviewId]);

  useEffect(() => {
    return () => {
      if (meshStartedRef.current) {
        meshStartedRef.current = false;
        stopMonitoring();
      }
    };
  }, []);

  const requestMedia = async () => {
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setMicStatus('granted');
      setCamStatus('granted');
      videoStreamRef.current = stream;
      setVideoStream(stream);
      if (videoRef.current) videoRef.current.srcObject = stream;
      warmUpModel().catch(() => {});
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

  useEffect(() => {
    if (phase === 'check' && !isMonitor) {
      requestMedia();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase !== 'check' || !videoStream) return;
    let audioCtx, analyser, animFrame;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(videoStream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        setMicLevel(Math.min(100, Math.round((sum / data.length) * 1.5)));
        animFrame = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {}
    return () => {
      if (animFrame) cancelAnimationFrame(animFrame);
      if (audioCtx && audioCtx.state !== 'closed') audioCtx.close();
    };
  }, [phase, videoStream]);

  const videoStreamRef = useRef(null);

  const releaseMedia = useCallback(() => {
    const stream = videoStreamRef.current;
    if (stream) {
      stream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
      videoStreamRef.current = null;
      setVideoStream(null);
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
    stopMic();
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try { audioContextRef.current.close(); } catch (e) {}
    }
    if (secondVoiceIntervalRef.current) {
      clearInterval(secondVoiceIntervalRef.current);
    }
  }, [stopMic]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      releaseMedia();
    };
    const handlePopState = () => {
      releaseMedia();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [releaseMedia]);

  useEffect(() => {
    if (phase === 'complete' || phase === 'error') {
      releaseMedia();
    }
  }, [phase, releaseMedia]);

  useEffect(() => {
    return () => {
      releaseMedia();
    };
  }, []);

  const canContinue = () =>
    speechSupported === true &&
    speakerSupported === true &&
    micStatus === 'granted' &&
    camStatus === 'granted';

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

  /* ---------------- Browser gate (candidates only) ---------------- */
  if (!isMonitor && !isSupportedBrowser()) {
    return (
      <div className="interview-room">
        <div className="interview-video" style={{ background: '#0f172a' }}>
          <div className="waiting-room">
            <div style={{ fontSize: 56, marginBottom: 16 }}>🌐</div>
            <h2>Google Chrome (or Microsoft Edge) is required</h2>
            <p style={{ maxWidth: 520, margin: '0 auto 16px', color: '#94a3b8', fontSize: 14, lineHeight: 1.7 }}>
              This interview uses voice recognition and live monitoring, which only work in
              <b> Google Chrome</b> or <b>Microsoft Edge</b>. Your current browser is not supported.
            </p>
            {isIOS() && (
              <p style={{ color: '#fca5a5', fontSize: 14, marginBottom: 16 }}>
                Voice answers are <b>not supported on iPhone/iPad</b>. Please join from a laptop or
                desktop computer using Chrome or Edge.
              </p>
            )}
            <a
              href="https://www.google.com/chrome/"
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary"
              style={{ textDecoration: 'none', display: 'inline-block', marginTop: 8 }}
            >
              Download Chrome
            </a>
            <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 20 }}>
              After installing, open this same interview link in Chrome.
            </p>
          </div>
        </div>
        <div className="interview-chat" />
      </div>
    );
  }

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
            {snapshotUrl ? (
              <div style={{ position: 'relative' }}>
                <img src={snapshotUrl} alt="Candidate live feed" style={{ width: 320, borderRadius: 12, border: '1px solid #334155', background: '#000' }} />
                <div style={{ position: 'absolute', top: 10, left: 10, background: '#dc2626', color: 'white', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, letterSpacing: 1 }}>
                  ● LIVE
                </div>
              </div>
            ) : (
              <div style={{ width: 320, height: 200, borderRadius: 12, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                Waiting for candidate camera...
              </div>
            )}
            <div style={{ marginTop: 10, fontSize: 12, color: '#94a3b8' }}>
              {snapshotTime ? `Live feed from candidate's camera — last update ${snapshotTime.toLocaleTimeString()}` : 'Camera feed updates when the candidate starts the interview.'}
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

            {activitySummary && (
              <div style={{ marginTop: 16, width: '100%', maxWidth: 640 }}>
                <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Behavior Monitor
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
                  {[
                    ['Turned Left', activitySummary.counts?.HEAD_TURN_LEFT || 0, '#f59e0b'],
                    ['Turned Right', activitySummary.counts?.HEAD_TURN_RIGHT || 0, '#f59e0b'],
                    ['Looked Down', activitySummary.counts?.LOOK_DOWN || 0, '#f59e0b'],
                    ['Gaze Off Screen', activitySummary.counts?.GAZE_OFF || 0, '#f59e0b'],
                    ['Eyes Closed', activitySummary.counts?.NO_BLINK || 0, '#ef4444'],
                    ['Face Lost', activitySummary.counts?.FACE_LOST || 0, '#ef4444'],
                    ['2+ Faces', activitySummary.counts?.MULTI_FACE || 0, '#ef4444'],
                    ['Laughs', activitySummary.counts?.LAUGHING || 0, '#22c55e'],
                    ['Total Flags', activitySummary.totalFlags || 0, '#3b82f6'],
                  ].map(([label, val, color]) => (
                    <div key={label} style={{ background: '#1e293b', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color }}>{val}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{label}</div>
                    </div>
                  ))}
                </div>
                {activitySummary.events && activitySummary.events.length > 0 && (
                  <div style={{ maxHeight: 160, overflow: 'auto', background: '#1e293b', borderRadius: 8, padding: 10, fontSize: 12 }}>
                    {activitySummary.events.slice(0, 40).map((e, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 4, alignItems: 'baseline' }}>
                        <span style={{ color: '#64748b', whiteSpace: 'nowrap' }}>
                          {e.time ? e.time.substring(11, 19) : ''}
                        </span>
                        <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{e.type}</span>
                        <span style={{ color: '#94a3b8' }}>{e.detail}</span>
                      </div>
                    ))}
                  </div>
                )}
                {evidenceData?.items?.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      🖼 Suspicious Captures ({evidenceData.items.length}) — click to enlarge
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      {evidenceData.items.map((it) => (
                        <div key={it.id} style={{ background: '#0f172a', borderRadius: 8, overflow: 'hidden', border: '1px solid #334155' }}>
                          {it.cloudinaryUrl ? (
                            <a href={it.cloudinaryUrl} target="_blank" rel="noreferrer">
                              <img src={it.cloudinaryUrl} alt={it.eventType} style={{ width: '100%', height: 80, objectFit: 'cover', display: 'block' }} />
                            </a>
                          ) : (
                            <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#64748b', padding: 6, textAlign: 'center' }}>
                              Image not persisted
                            </div>
                          )}
                          <div style={{ padding: '5px 7px' }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b' }}>{it.eventType}</div>
                            <div style={{ fontSize: 9, color: '#94a3b8' }}>
                              {it.capturedAt ? new Date(it.capturedAt).toLocaleTimeString('en-IN') : ''}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
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
              <div className={`check-item ${micStatus === 'granted' ? 'ok' : 'fail'}`}>
                <span>{micStatus === 'granted' ? '✓' : '✕'}</span> Microphone (required)
                {micStatus === 'granted' && (
                  <div style={{ marginTop: 6, height: 8, borderRadius: 4, background: '#1e293b', overflow: 'hidden', width: '100%' }}>
                    <div style={{ height: '100%', borderRadius: 4, transition: 'width 0.1s', width: `${micLevel}%`, background: micLevel > 50 ? '#10b981' : micLevel > 10 ? '#f59e0b' : '#334155' }} />
                  </div>
                )}
                {micStatus === 'granted' && micLevel > 5 && (
                  <div className="check-sub" style={{ color: '#10b981' }}>Mic is picking up your voice</div>
                )}
                {micStatus !== 'granted' && (
                  <div className="check-sub">
                    {micStatus === 'denied'
                      ? 'Microphone access denied. Allow it in the browser, then click "Test Camera & Mic" again.'
                      : micStatus === 'missing'
                      ? 'No microphone found. Connect one and test again.'
                      : 'Waiting for access — allow the browser prompt or click "Test Camera & Mic".'}
                  </div>
                )}
              </div>
              <div className={`check-item ${camStatus === 'granted' ? 'ok' : 'fail'}`}>
                <span>{camStatus === 'granted' ? '✓' : '✕'}</span> Camera (required)
                {camStatus !== 'granted' && (
                  <div className="check-sub">
                    {camStatus === 'denied'
                      ? 'Camera access denied. Allow it in the browser, then click "Test Camera & Mic" again.'
                      : camStatus === 'missing'
                      ? 'No camera found. Connect one and test again.'
                      : 'Waiting for access — allow the browser prompt or click "Test Camera & Mic".'}
                  </div>
                )}
              </div>
            </div>
            {videoStream && (
              <video ref={videoRef} autoPlay playsInline muted style={{ width: 180, borderRadius: 10, border: '1px solid #334155', background: '#000', margin: '12px 0' }} />
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-outline" onClick={() => { releaseMedia(); navigate('/'); }}>Back</button>
              <button className="btn btn-outline" onClick={requestMedia}>Test Camera & Mic</button>
              <button className="btn btn-primary" onClick={() => setPhase('instructions')} disabled={!canContinue()}>
                Continue
              </button>
            </div>
            {!canContinue() && (
              <p style={{ color: '#fca5a5', fontSize: 13, marginTop: 10 }}>
                Camera and microphone are required. Allow both, use Chrome/Edge, then click Continue.
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

        {meshWarning && (
          <div style={{
            position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(220,38,38,0.92)', color: 'white',
            padding: '10px 22px', borderRadius: 10, fontSize: 14, fontWeight: 600,
            zIndex: 20, textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
            maxWidth: '90%',
          }}>
            ⚠ Please don't turn away from the screen during the interview.
          </div>
        )}

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
            <p style={{ color: '#94a3b8', marginBottom: 20 }}>
              Thank you for your time! We will get back to you soon.
            </p>
            <button className="btn btn-primary" onClick={() => { releaseMedia(); navigate('/'); }}>Close & Exit</button>
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

        {micBlocked && (
          <div style={{
            margin: '0 16px 8px', padding: '10px 14px', borderRadius: 10,
            background: '#451a03', border: '1px solid #b45309', color: '#fbbf24',
            fontSize: 13, lineHeight: 1.5, textAlign: 'center',
          }}>
            ⚠ Your microphone may not be working. Please check your browser mic permissions, or type your answer below.
          </div>
        )}

        <div className="chat-input-area" style={{
          justifyContent: 'center', padding: '16px 20px',
          background: 'rgba(15, 23, 42, 0.8)',
        }}>
          {showTextInput ? (
            <div style={{ display: 'flex', gap: 8, width: '100%' }}>
              <input
                type="text"
                value={typedAnswer}
                onChange={(e) => setTypedAnswer(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submitTypedAnswer(); }}
                placeholder="Type your answer here..."
                autoFocus
                style={{
                  flex: 1, padding: '12px 16px', borderRadius: 10, border: '1px solid #334155',
                  background: '#0f172a', color: 'white', fontSize: 14, outline: 'none',
                }}
              />
              <button
                onClick={submitTypedAnswer}
                disabled={!typedAnswer.trim()}
                style={{
                  padding: '12px 20px', borderRadius: 10, border: 'none',
                  background: typedAnswer.trim() ? '#10b981' : '#334155',
                  color: 'white', fontSize: 14, fontWeight: 600, cursor: typedAnswer.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Send
              </button>
            </div>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}
