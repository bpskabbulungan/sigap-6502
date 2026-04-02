import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/apiClient';

const ADMIN_SCHEDULE_KEY = ['schedule', 'admin'];
const PUBLIC_SCHEDULE_KEY = ['schedule', 'public'];
const NEXT_RUN_KEY = ['schedule', 'next-run'];

export function usePublicSchedule() {
  return useQuery({
    queryKey: PUBLIC_SCHEDULE_KEY,
    queryFn: () => apiRequest('/api/schedule'),
    staleTime: 1000 * 60,
  });
}

export function usePublicNextRun() {
  return useQuery({
    queryKey: NEXT_RUN_KEY,
    queryFn: () => apiRequest('/api/schedule/next-run'),
    staleTime: 1000 * 30,
  });
}

export function useAdminSchedule() {
  return useQuery({
    queryKey: ADMIN_SCHEDULE_KEY,
    queryFn: () => apiRequest('/api/admin/schedule'),
  });
}

export function useUpdateSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) =>
      apiRequest('/api/admin/schedule', {
        method: 'PUT',
        body: payload,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_SCHEDULE_KEY });
      queryClient.invalidateQueries({ queryKey: NEXT_RUN_KEY });
      queryClient.invalidateQueries({ queryKey: PUBLIC_SCHEDULE_KEY });
    },
  });
}

export function useAddManualAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) =>
      apiRequest('/api/admin/schedule/announcements', {
        method: 'POST',
        body: payload,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_SCHEDULE_KEY });
      queryClient.invalidateQueries({ queryKey: NEXT_RUN_KEY });
      queryClient.invalidateQueries({ queryKey: PUBLIC_SCHEDULE_KEY });
    },
  });
}

export function useRemoveManualAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (identifier) =>
      apiRequest(
        `/api/admin/schedule/announcements/${encodeURIComponent(identifier)}`,
        {
        method: 'DELETE',
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_SCHEDULE_KEY });
      queryClient.invalidateQueries({ queryKey: NEXT_RUN_KEY });
      queryClient.invalidateQueries({ queryKey: PUBLIC_SCHEDULE_KEY });
    },
  });
}

// Backward-compatible hook names for existing imports.
export const useAddOverride = useAddManualAnnouncement;
export const useRemoveOverride = useRemoveManualAnnouncement;

export function useAdminNextRun() {
  return useQuery({
    queryKey: ['schedule', 'admin', 'next-run'],
    queryFn: () => apiRequest('/api/admin/schedule/next-run'),
    refetchInterval: 60_000,
  });
}
