import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../lib/apiClient';
import { getSocket } from '../lib/socket';

export const LOGS_POLL_INTERVAL_MS = 15_000;

export function useSystemHealth() {
  return useQuery({
    queryKey: ['system', 'health'],
    queryFn: () => apiRequest('/api/system/health'),
    refetchInterval: 30_000,
  });
}

export function useLogs(limit = 100, audience = 'public') {
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(() => {
    try {
      return Boolean(getSocket().connected);
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let socket = null;

    try {
      socket = getSocket();
    } catch {
      setIsRealtimeConnected(false);
      return undefined;
    }

    const handleConnect = () => setIsRealtimeConnected(true);
    const handleDisconnect = () => setIsRealtimeConnected(false);

    setIsRealtimeConnected(Boolean(socket.connected));
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, []);

  const safeAudience = audience === 'admin' ? 'admin' : 'public';

  const query = useQuery({
    queryKey: ['system', 'logs', safeAudience, limit],
    queryFn: () =>
      apiRequest(`/api/system/logs?limit=${limit}&audience=${safeAudience}`),
    // Use polling only as a fallback when realtime socket is disconnected.
    refetchInterval: isRealtimeConnected ? false : LOGS_POLL_INTERVAL_MS,
  });

  return {
    ...query,
    isRealtimeConnected,
    logsPollIntervalMs: LOGS_POLL_INTERVAL_MS,
  };
}

export function useSystemStats() {
  return {
    ...useQuery({
      queryKey: ['system', 'stats'],
      queryFn: () => apiRequest('/api/system/stats'),
      refetchInterval: 60_000,
    }),
  };
}

export function useQr() {
  return useQuery({
    queryKey: ['system', 'qr'],
    queryFn: () => apiRequest('/api/system/qr'),
    // QR berubah cepat saat sesi baru; polling cepat saat belum aktif
    refetchInterval: 3000,
  });
}
