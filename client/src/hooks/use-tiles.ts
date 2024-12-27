import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Tile, NewTile } from "@db/schema";

export function useTiles(boardId: number) {
  const queryClient = useQueryClient();

  const { data: tiles, isLoading } = useQuery<Tile[]>({
    queryKey: [`/api/boards/${boardId}/tiles`],
  });

  const createTile = useMutation({
    mutationFn: async (tile: Omit<NewTile, "boardId">) => {
      const response = await fetch(`/api/boards/${boardId}/tiles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tile),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: [`/api/boards/${boardId}/tiles`] 
      });
    },
  });

  return {
    tiles,
    isLoading,
    createTile: createTile.mutateAsync,
  };
}
