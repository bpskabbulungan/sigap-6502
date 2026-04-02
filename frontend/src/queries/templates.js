import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/apiClient";

const TEMPLATE_KEY = ["templates", "admin"];

function normalizeTemplatesPayload(payload) {
  if (!payload || !Array.isArray(payload.templates)) {
    return null;
  }

  const templates = payload.templates.map((item) => ({
    ...item,
    isActive:
      item.isActive === true ||
      item.id === payload.activeTemplateId ||
      item.id === payload.templateId,
  }));

  const activeTemplate =
    templates.find((item) => item.isActive) || templates[0] || null;

  return {
    templates,
    activeTemplateId: activeTemplate?.id || null,
    templateId: activeTemplate?.id || null,
    template: activeTemplate?.content || "",
  };
}

function updateTemplateCache(queryClient, responsePayload) {
  const normalized = normalizeTemplatesPayload(responsePayload);
  if (normalized) {
    queryClient.setQueryData(TEMPLATE_KEY, normalized);
    return;
  }

  queryClient.invalidateQueries({ queryKey: TEMPLATE_KEY });
}

export function useTemplatesCatalog() {
  return useQuery({
    queryKey: TEMPLATE_KEY,
    queryFn: async () => {
      const payload = await apiRequest("/api/admin/templates/raw");
      return normalizeTemplatesPayload(payload) || payload;
    },
    refetchOnWindowFocus: false,
  });
}

export function useUpsertTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) =>
      apiRequest("/api/admin/templates/upsert", {
        method: "POST",
        body: payload,
      }),
    onSuccess: (responsePayload) => {
      updateTemplateCache(queryClient, responsePayload);
    },
  });
}

export function useSetActiveTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (templateId) =>
      apiRequest("/api/admin/templates/active", {
        method: "PATCH",
        body: { templateId },
      }),
    onSuccess: (responsePayload) => {
      updateTemplateCache(queryClient, responsePayload);
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (templateId) =>
      apiRequest(`/api/admin/templates/${encodeURIComponent(templateId)}`, {
        method: "DELETE",
      }),
    onSuccess: (responsePayload) => {
      updateTemplateCache(queryClient, responsePayload);
    },
  });
}

// Backward-compatible exports.
export function useTemplate() {
  return useTemplatesCatalog();
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (templateOrPayload) => {
      if (typeof templateOrPayload === "string") {
        return apiRequest("/api/admin/templates", {
          method: "POST",
          body: { template: templateOrPayload },
        });
      }

      return apiRequest("/api/admin/templates/upsert", {
        method: "POST",
        body: templateOrPayload,
      });
    },
    onSuccess: (responsePayload) => {
      updateTemplateCache(queryClient, responsePayload);
    },
  });
}

