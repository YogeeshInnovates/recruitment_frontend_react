import { createContext, useState, useEffect, useCallback, useMemo } from 'react';

export const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('recruit_theme');
      return saved === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('recruit_theme', theme);
    } catch { /* ignore */ }
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
