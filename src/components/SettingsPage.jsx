import { useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';

export default function SettingsPage() {
  const { theme, toggleTheme } = useContext(ThemeContext);

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Settings</h1>
        <p style={{ color: 'var(--text-light)', margin: '4px 0 0' }}>Customize how RecruitAI looks and feels</p>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Appearance</h3>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Dark mode</div>
              <div style={{ fontSize: 13, color: 'var(--text-light)' }}>
                Choose between a dark, easy-on-the-eyes theme and a bright light theme.
              </div>
            </div>
            <button
              onClick={toggleTheme}
              className={`theme-toggle ${theme === 'dark' ? 'on' : ''}`}
              aria-label="Toggle dark mode"
            >
              <span className="theme-toggle-track">
                <span className="theme-toggle-thumb">🌙</span>
              </span>
            </button>
          </div>

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)', fontSize: 13, color: 'var(--text-light)' }}>
            Current theme: <strong style={{ textTransform: 'capitalize' }}>{theme}</strong> mode
          </div>
        </div>
      </div>
    </div>
  );
}
