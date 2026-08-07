import { createContext, useState, useMemo, useCallback, useEffect, useContext, useRef } from 'react';
import { AuthContext } from './AuthContext';
import api from '../api/api';

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

  const { user } = useContext(AuthContext);
  const restoredUserId = useRef(null);

  useEffect(() => {
    if (!user?.userId || restoredUserId.current === user.userId) return;
    restoredUserId.current = user.userId;
    let cancelled = false;

    if (!org) {
      const memberships = user.memberships;
      if (Array.isArray(memberships) && memberships.length > 0) {
        const first = memberships[0];
        const minimal = { id: first.orgId, name: first.orgName };
        setOrgState(minimal);
        localStorage.setItem('recruit_org', JSON.stringify(minimal));
      }
    }

    api.get(`/api/organizations/mine/${user.userId}`)
      .then(res => {
        const list = res.data?.data || res.data || res;
        if (!cancelled && Array.isArray(list) && list.length > 0) {
          setOrgState(list[0]);
          localStorage.setItem('recruit_org', JSON.stringify(list[0]));
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [user?.userId]);

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
