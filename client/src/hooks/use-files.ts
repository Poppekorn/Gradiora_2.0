import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { File, NewFile, Tag, NewTag } from "@db/schema";

export function useFiles(boardId: number) {
  const queryClient = useQueryClient();

  const { data: files, isLoading } = useQuery<File[]>({
    queryKey: [`/api/boards/${boardId}/files`],
  });

  const { data: tags } = useQuery<Tag[]>({
    queryKey: [`/api/boards/${boardId}/tags`],
  });

  const uploadFile = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch(`/api/boards/${boardId}/files`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: [`/api/boards/${boardId}/files`] 
      });
    },
  });

  const deleteFile = useMutation({
    mutationFn: async (fileId: number) => {
      const response = await fetch(`/api/boards/${boardId}/files/${fileId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: [`/api/boards/${boardId}/files`] 
      });
    },
  });

  const createTag = useMutation({
    mutationFn: async (tag: Omit<NewTag, "boardId">) => {
      const response = await fetch(`/api/boards/${boardId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tag),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: [`/api/boards/${boardId}/tags`] 
      });
    },
  });

  const addTagToFile = useMutation({
    mutationFn: async ({ fileId, tagId }: { fileId: number; tagId: number }) => {
      const response = await fetch(
        `/api/boards/${boardId}/files/${fileId}/tags/${tagId}`,
        {
          method: "POST",
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: [`/api/boards/${boardId}/files`] 
      });
    },
  });

  const removeTagFromFile = useMutation({
    mutationFn: async ({ fileId, tagId }: { fileId: number; tagId: number }) => {
      const response = await fetch(
        `/api/boards/${boardId}/files/${fileId}/tags/${tagId}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: [`/api/boards/${boardId}/files`] 
      });
    },
  });

  return {
    files,
    tags,
    isLoading,
    uploadFile: uploadFile.mutateAsync,
    deleteFile: deleteFile.mutateAsync,
    createTag: createTag.mutateAsync,
    addTagToFile: addTagToFile.mutateAsync,
    removeTagFromFile: removeTagFromFile.mutateAsync,
  };
}