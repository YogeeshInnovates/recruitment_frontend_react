import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/api';

export default function HomePage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ jobs: 0, candidates: 0, applications: 0, interviews: 0 });
  const [loading, setLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [jobsRes, candidatesRes, applicationsRes] = await Promise.all([
          api.get('/api/organizations/1/jobs').catch(() => ({ data: [] })),
          api.get('/api/organizations/1/candidates').catch(() => ({ data: [] })),
          api.get('/api/organizations/1/applications').catch(() => ({ data: [] }))
        ]);
        setStats({
          jobs: (jobsRes.data || jobsRes || []).length,
          candidates: (candidatesRes.data || candidatesRes || []).length,
          applications: (applicationsRes.data || applicationsRes || []).length,
          interviews: 0,
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const features = [
    { icon: '🎯', title: 'Smart Job Matching', desc: 'AI-powered matching between candidates and job descriptions with intelligent skill extraction.' },
    { icon: '🤖', title: 'AI Voice Interviews', desc: 'Automated voice interviews using adaptive AI that asks role-specific questions.' },
    { icon: '📊', title: 'Real-time Analytics', desc: 'Track your recruitment pipeline with live stats and detailed candidate scoring.' },
    { icon: '📝', title: 'Resume Screening', desc: 'Auto-extract skills, experience, and education from resumes with high accuracy.' },
    { icon: '✉️', title: 'Automated Emails', desc: 'Send interview invitations and updates to candidates automatically.' },
    { icon: '🔒', title: 'Secure Platform', desc: 'Enterprise-grade security with role-based access and data encryption.' },
  ];

  const statCards = [
    { label: 'Open Positions', value: stats.jobs, icon: '💼', color: '#2563eb', bg: '#eff6ff' },
    { label: 'Candidates', value: stats.candidates, icon: '👤', color: '#22c55e', bg: '#f0fdf4' },
    { label: 'Applications', value: stats.applications, icon: '📋', color: '#f59e0b', bg: '#fffbeb' },
    { label: 'Interviews', value: stats.interviews, icon: '🎤', color: '#8b5cf6', bg: '#f5f3ff' },
  ];

  return (
    <div className="homepage">
      {/* Nav */}
      <nav className={`home-nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="home-nav-inner">
          <div className="home-logo">
            <span className="home-logo-icon">🤖</span>
            <span className="home-logo-text">Recruit<span>AI</span></span>
          </div>
          <div className="home-nav-links">
            <a href="#features">Features</a>
            <a href="#stats">Stats</a>
            <button className="btn btn-primary" onClick={() => navigate('/login')}>
              Sign In
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="home-hero">
        <div className="home-hero-bg" />
        <div className="home-hero-content">
          <div className="home-hero-badge">🚀 AI-Powered Recruitment Platform</div>
          <h1 className="home-hero-title">
            Hire Smarter <br />
            <span className="gradient-text">with Artificial Intelligence</span>
          </h1>
          <p className="home-hero-subtitle">
            Automate resume screening, conduct adaptive voice interviews, 
            and find the perfect candidate — all powered by cutting-edge AI.
          </p>
          <div className="home-hero-actions">
            <button className="btn btn-primary btn-lg" onClick={() => navigate('/signup')}>
              🚀 Get Started Free
            </button>
            <button className="btn btn-outline btn-lg" onClick={() => navigate('/login')}>
              Sign In →
            </button>
          </div>
          <div className="home-hero-stats">
            <div className="hero-stat">
              <span className="hero-stat-value">100+</span>
              <span className="hero-stat-label">Interviews Conducted</span>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-value">95%</span>
              <span className="hero-stat-label">Accuracy Rate</span>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-value">10x</span>
              <span className="hero-stat-label">Faster Screening</span>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section id="stats" className="home-section">
        <div className="home-section-header">
          <h2>Platform Overview</h2>
          <p>Real-time snapshot of your recruitment pipeline</p>
        </div>
        <div className="home-stats-grid">
          {statCards.map((card, i) => (
            <div key={i} className="home-stat-card" style={{ '--card-color': card.color, '--card-bg': card.bg }}>
              <div className="home-stat-icon">{card.icon}</div>
              <div className="home-stat-number">
                {loading ? <span className="home-stat-skeleton" /> : card.value}
              </div>
              <div className="home-stat-label">{card.label}</div>
              <div className="home-stat-bar">
                <div className="home-stat-bar-fill" style={{ width: loading ? '0%' : `${Math.min(100, card.value * 10)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="home-section home-section-alt">
        <div className="home-section-header">
          <h2>Powerful Features</h2>
          <p>Everything you need to streamline your hiring process</p>
        </div>
        <div className="home-features-grid">
          {features.map((f, i) => (
            <div key={i} className="home-feature-card">
              <div className="home-feature-icon">{f.icon}</div>
              <h3 className="home-feature-title">{f.title}</h3>
              <p className="home-feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="home-cta">
        <div className="home-cta-content">
          <h2>Ready to transform your hiring?</h2>
          <p>Start an AI-powered interview in seconds — no setup required.</p>
          <div className="home-cta-actions">
            <button className="btn btn-primary btn-lg" onClick={() => navigate('/signup')}>
              🚀 Get Started Free
            </button>
            <button className="btn btn-outline btn-lg" onClick={() => navigate('/login')}>
              Sign In →
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="home-footer">
        <div className="home-footer-inner">
          <div className="home-footer-brand">
            <span className="home-logo-icon">🤖</span>
            <span className="home-logo-text">Recruit<span>AI</span></span>
          </div>
          <p className="home-footer-text">
            AI-powered recruitment platform. &copy; {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}
