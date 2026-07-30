import { createContext, useState, useMemo, useCallback } from 'react';

export const OrgContext = createContext(null);

export function OrgProvider({ children }) {
  const [org, setOrgState] = useState(() => {
    try {
      const saved = localStorage.getItem('recruit_org');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const setOrg = useCallback((newOrg) => {
    setOrgState(newOrg);
    if (newOrg) {
      localStorage.setItem('recruit_org', JSON.stringify(newOrg));
    } else {
      localStorage.removeItem('recruit_org');
    }
  }, []);

  const clearOrganization = useCallback(() => {
    localStorage.removeItem('recruit_org');
    setOrgState(null);
  }, []);

  const value = useMemo(() => ({ org, setOrg, clearOrganization }), [org]);

  return (
    <OrgContext.Provider value={value}>
      {children}
    </OrgContext.Provider>
  );
}
