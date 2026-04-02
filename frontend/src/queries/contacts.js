import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/apiClient';

const CONTACTS_QUERY_KEY = ['admin', 'contacts'];

export function useAdminContacts() {
  return useQuery({
    queryKey: CONTACTS_QUERY_KEY,
    queryFn: () => apiRequest('/api/admin/contacts'),
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, number, status }) =>
      apiRequest('/api/admin/contacts', {
        method: 'POST',
        body: { name, number, status },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACTS_QUERY_KEY });
    },
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name, number, status }) =>
      apiRequest(`/api/admin/contacts/${id}`, {
        method: 'PUT',
        body: { name, number, status },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACTS_QUERY_KEY });
    },
  });
}

export function useUpdateContactStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }) =>
      apiRequest(`/api/admin/contacts/${id}/status`, {
        method: 'PATCH',
        body: { status },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACTS_QUERY_KEY });
    },
  });
}

export function useBulkUpdateContactStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status }) =>
      apiRequest('/api/admin/contacts/bulk-status', {
        method: 'PATCH',
        body: { ids, status },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACTS_QUERY_KEY });
    },
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) =>
      apiRequest(`/api/admin/contacts/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACTS_QUERY_KEY });
    },
  });
}

export function useBulkDeleteContacts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids) =>
      apiRequest('/api/admin/contacts/bulk-delete', {
        method: 'POST',
        body: { ids },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACTS_QUERY_KEY });
    },
  });
}
