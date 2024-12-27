import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Board, NewBoard } from "@db/schema";

export function useBoards() {
  const queryClient = useQueryClient();

  const { data: boards, isLoading } = useQuery<Board[]>({
    queryKey: ["/api/boards"],
  });

  const createBoard = useMutation({
    mutationFn: async (board: Omit<NewBoard, "organizationId">) => {
      const response = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(board),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
    },
  });

  return {
    boards,
    isLoading,
    createBoard: createBoard.mutateAsync,
  };
}
