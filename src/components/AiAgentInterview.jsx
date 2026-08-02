import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

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

export default function AiAgentInterview() {
  const { interviewId } = useParams();
  const navigate = useNavigate();

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

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (phase === 'active') {
      timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

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
      if (sec <= 0) {
        clearCountdown();
      }
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
        if (sec <= 0) {
          clearCountdown();
        }
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

    // Filter out echo: if user message is too similar to last AI message, discard
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
          setTimeout(() => navigate('/'), 30000);
          return;
        }

        if (phaseRef.current === 'active') {
          setTimeout(() => {
            if (phaseRef.current === 'active' && !isProcessingRef.current) {
              startMic();
            }
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
  }, [interviewId, stopMic, startMic, navigate]);
  sendToAIRef.current = sendToAI;

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Speech recognition not supported. Please use Chrome browser.');
      return;
    }

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

      // Clear countdown + debounce on speech (user is still talking)
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

      // Reset idle timer on any speech (final or interim)
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
  }, [sendToAI, startMic]);

  useEffect(() => {
    const init = async () => {
      try {
        setConnectionStatus('Connecting to interview...');
        const res = await fetch(`${API_URL}/api/interview/${interviewId}`, { headers: { ...authHeaders() } });
        if (!res.ok) throw new Error('Interview not found');
        const data = await res.json();
        setInterviewData(data);

        setConnectionStatus('Starting interview session...');
        await fetch(`${API_URL}/api/interview/${interviewId}/start`, { method: 'POST', headers: { ...authHeaders() } });

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
        setError('Failed to load interview: ' + err.message);
        setPhase('error');
      }
    };
    init();
  }, [interviewId, startMic]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

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
            <div style={{ fontSize: 48, marginBottom: 16 }}>&#9888;&#65039;</div>
            <h2>Interview Error</h2>
            <p>{error}</p>
            <button onClick={() => navigate('/')} className="btn btn-primary">Go Back</button>
          </div>
        </div>
        <div className="interview-chat" />
      </div>
    );
  }

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
            {interviewData?.candidateName || 'Candidate'}
          </div>
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
            <div style={{ fontSize: 64, marginBottom: 16 }}>&#10003;</div>
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
              const blob = new Blob([`Interview Transcript\n\nDifficulty: ${currentDifficulty}\nQuestions: ${questionCount}\n\n${conv}`], {type: 'text/plain'});
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
