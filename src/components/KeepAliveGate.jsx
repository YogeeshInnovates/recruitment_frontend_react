import { useEffect, useContext } from 'react';
import { BASE_URL } from '../api/api';
import { OrgContext } from '../context/OrgContext';
import { AuthContext } from '../context/AuthContext';

const AI_URL = import.meta.env.VITE_AI_URL || 'https://interview-agent-service.onrender.com';
const TICK_MS = 600000;
const REQUEST_TIMEOUT_MS = 25000;

function fetchWithTimeout(url, timeoutMs, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

function getToken() {
  try {
    const raw = localStorage.getItem('recruit_user');
    if (raw) {
      const user = JSON.parse(raw);
      if (user?.token) return user.token;
    }
  } catch { /* ignore */ }
  return null;
}

export default function KeepAliveGate() {
  const { org } = useContext(OrgContext);
  const { user } = useContext(AuthContext);

  useEffect(() => {
    const orgId = org?.id;
    if (!orgId || !user?.token) return undefined;

    let stopped = false;

    async function tick() {
      if (stopped) return;

      let pending = 0;
      try {
        const res = await fetchWithTimeout(
          `${BASE_URL}/api/organizations/${orgId}/ai-screening/pending`,
          REQUEST_TIMEOUT_MS,
          { headers: { 'Authorization': `Bearer ${getToken()}` } }
        );
        if (res.ok) {
          const data = await res.json();
          pending = Number(data?.pending) || 0;
        }
      } catch { /* server asleep — next person arriving will trigger WakeUpGate */ }

      if (stopped) return;

      if (pending > 0) {
        fetchWithTimeout(`${BASE_URL}/api/warmup`, REQUEST_TIMEOUT_MS).catch(() => {});
        fetchWithTimeout(`${AI_URL}/health`, REQUEST_TIMEOUT_MS).catch(() => {});
      }
    }

    tick();
    const interval = setInterval(tick, TICK_MS);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [org?.id, user?.token]);

  return null;
}