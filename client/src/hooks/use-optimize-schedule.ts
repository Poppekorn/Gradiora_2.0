import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

interface OptimizedSchedule {
  tileId: number;
  recommendedTimeOfDay: string;
  optimalStudyOrder: number;
  estimatedDuration: number;
}

export function useOptimizeSchedule(boardId: number) {
  const queryClient = useQueryClient();

  const optimizeSchedule = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/boards/${boardId}/optimize`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json() as Promise<OptimizedSchedule[]>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/boards/${boardId}/tiles`] });
      toast({
        title: "Success",
        description: "Study schedule has been optimized",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to optimize schedule",
      });
    },
  });

  return {
    optimizeSchedule: optimizeSchedule.mutateAsync,
    isOptimizing: optimizeSchedule.isPending,
  };
}
