import { useState, useEffect, useRef, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { OrgContext } from '../App';
import api from '../api/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

function speak(text) {
  if (!window.speechSynthesis) return;
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
  window.speechSynthesis.speak(utterance);
}

export default function AiAgentInterview() {
  const { applicationId } = useParams();
  const { org } = useContext(OrgContext);
  const navigate = useNavigate();

  const [phase, setPhase] = useState('waiting');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [interviewId, setInterviewId] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [application, setApplication] = useState(null);
  const [roomName] = useState(`interview-${applicationId}-${Date.now()}`);
  const [questionCount, setQuestionCount] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (phase === 'active') {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(s => s + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => prev + (prev ? ' ' : '') + transcript);
        setIsRecording(false);
      };

      recognition.onerror = () => {
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  useEffect(() => {
    if (!org?.id) return;
    const init = async () => {
      try {
        const appResponse = await api.get(`/api/organizations/${org.id}/applications/${applicationId}`);
        const appData = appResponse.data || appResponse;
        setApplication(appData);

        await new Promise(r => setTimeout(r, 3000));
        setPhase('active');

        const interviewResponse = await api.post(`/api/organizations/${org.id}/interviews`, {
          applicationId: parseInt(applicationId),
          interviewType: 'AGENT'
        });
        const interviewData = interviewResponse.data || interviewResponse;
        setInterviewId(interviewData.id);

        try {
          await api.post(`/api/organizations/${org.id}/interviews/${interviewData.id}/start`);
        } catch (e) {
          console.log('Start endpoint may not exist, continuing');
        }

        const candidate = appData.candidate || {};
        const candidateName = candidate.firstName
          ? `${candidate.firstName} ${candidate.lastName || ''}`.trim()
          : appData.candidateName || 'Candidate';
        const greeting = `Hi ${candidateName}, welcome to the interview. I'm your AI interviewer today. Are you ready to begin?`;

        setMessages([{ role: 'ai', content: greeting }]);
        setQuestionCount(1);
        speak(greeting);
      } catch (err) {
        console.error('Init error:', err);
        setError('Failed to initialize interview: ' + err.message);
        setPhase('error');
      }
    };
    init();
  }, [org, applicationId]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in your browser. Please use Chrome.');
      return;
    }
    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      setIsRecording(true);
      recognitionRef.current.start();
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending || !interviewId) return;

    if (window.speechSynthesis) window.speechSynthesis.cancel();

    setMessages(prev => [...prev, { role: 'candidate', content: text }]);
    setInput('');
    setSending(true);

    try {
      const response = await api.post(
        `/api/organizations/${org.id}/interviews/${interviewId}/chat`,
        { message: text }
      );

      const responseData = response.data || response;
      const aiReply = responseData.response || responseData.reply || responseData.message || responseData.aiMessage || '';

      if (aiReply) {
        setMessages(prev => [...prev, { role: 'ai', content: aiReply }]);
        setQuestionCount(q => q + 1);
        speak(aiReply);

        const lower = aiReply.toLowerCase();
        if (
          lower.includes('interview is now complete') ||
          lower.includes('interview is complete') ||
          lower.includes('thank you for your time') ||
          lower.includes('that concludes') ||
          lower.includes('this concludes')
        ) {
          setTimeout(() => handleInterviewComplete(), 2000);
        }
      }
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, {
        role: 'ai',
        content: 'I apologize, there was an issue processing your response. Please continue with your answer.'
      }]);
    } finally {
      setSending(false);
      if (inputRef.current) inputRef.current.focus();
    }
  };

  const handleInterviewComplete = async () => {
    if (phase === 'complete') return;
    setPhase('complete');
    if (timerRef.current) clearInterval(timerRef.current);
    if (window.speechSynthesis) window.speechSynthesis.cancel();

    try {
      await api.post(`/api/organizations/${org.id}/interviews/${interviewId}/end`);
    } catch (e) {
      console.log('End endpoint error:', e);
    }

    setTimeout(() => {
      navigate(`/interview/results/${interviewId}`);
    }, 4000);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleEndInterview = async () => {
    if (confirm('Are you sure you want to end the interview early?')) {
      handleInterviewComplete();
    }
  };

  if (phase === 'waiting') {
    return (
      <div className="interview-room">
        <div className="interview-video">
          <div className="waiting-room">
            <div className="spinner"></div>
            <h2>Interview Starting...</h2>
            <p>Setting up your AI interview session</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {application?.candidate?.firstName
                ? `${application.candidate.firstName} ${application.candidate.lastName || ''}`
                : application?.candidateName || 'Candidate'}
            </p>
          </div>
        </div>
        <div className="interview-chat">
          <div className="chat-header">
            <h3>🤖 AI Interview</h3>
          </div>
          <div className="chat-messages">
            <div className="chat-message ai">
              <div className="avatar">🤖</div>
              <div className="bubble">Preparing your interview session...</div>
            </div>
          </div>
        </div>
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
            <button onClick={() => navigate(-1)} className="btn btn-primary">
              Go Back
            </button>
          </div>
        </div>
        <div className="interview-chat" />
      </div>
    );
  }

  return (
    <div className="interview-room">
      <div className="interview-video">
        <div
          className="jitsi-container"
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            color: 'white'
          }}
        >
          <div style={{
            width: 160,
            height: 160,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 64,
            marginBottom: 24,
            boxShadow: '0 0 40px rgba(139, 92, 246, 0.4)'
          }}>
            🤖
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
            AI Interviewer
          </div>
          <div style={{ fontSize: 14, color: '#94a3b8' }}>
            {application?.candidate?.firstName
              ? `${application.candidate.firstName} ${application.candidate.lastName || ''}`
              : application?.candidateName || 'Candidate'}
          </div>
        </div>

        <div className="timer">{formatTime(elapsedSeconds)}</div>

        <div className="ai-status">
          <span className="dot"></span>
          AI Interviewer Active
        </div>

        <button
          onClick={handleEndInterview}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'var(--danger)',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: 20,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            zIndex: 10
          }}
        >
          End Interview
        </button>
      </div>

      <div className="interview-chat">
        <div className="chat-header">
          <h3>🤖 AI Interview</h3>
          <span className="question-count">Question {Math.max(0, questionCount - 1)} of ~10</span>
        </div>

        <div className="chat-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`chat-message ${msg.role}`}>
              <div className="avatar">
                {msg.role === 'ai' ? '🤖' : '👤'}
              </div>
              <div className="bubble">{msg.content}</div>
            </div>
          ))}
          {sending && (
            <div className="chat-message ai">
              <div className="avatar">🤖</div>
              <div className="bubble" style={{ color: 'var(--text-muted)' }}>
                Thinking...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-area">
          {recognitionRef.current && (
            <button
              onClick={toggleRecording}
              className={`mic-btn ${isRecording ? 'recording' : ''}`}
              title={isRecording ? 'Stop recording' : 'Start voice input'}
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                flexShrink: 0,
                background: isRecording ? 'var(--danger)' : 'var(--success)',
                color: 'white'
              }}
            >
              {isRecording ? '⏹' : '🎙'}
            </button>
          )}
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isRecording ? 'Listening...' : 'Type your answer...'}
            disabled={sending}
          />
          <button onClick={sendMessage} disabled={!input.trim() || sending}>
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}
