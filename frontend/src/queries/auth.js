import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/apiClient';

const SESSION_QUERY_KEY = ['auth', 'session'];
const SESSION_STALE_TIME_MS = 1000 * 15;

export function useSession() {
  return useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: () => apiRequest('/api/auth/session'),
    staleTime: SESSION_STALE_TIME_MS,
    retry: false,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ username, password, remember }) =>
      apiRequest('/api/auth/login', {
        method: 'POST',
        body: { username, password, remember: Boolean(remember) },
      }),
    onSuccess: (payload) => {
      queryClient.setQueryData(SESSION_QUERY_KEY, {
        authenticated: true,
        user: payload?.user ?? null,
      });
      queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest('/api/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      queryClient.setQueryData(SESSION_QUERY_KEY, {
        authenticated: false,
        user: null,
      });
      queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    },
  });
}
