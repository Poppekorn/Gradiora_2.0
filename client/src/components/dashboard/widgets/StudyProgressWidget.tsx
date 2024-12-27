import { Progress } from "@/components/ui/progress";
import { useTiles } from "@/hooks/use-tiles";
import { useBoards } from "@/hooks/use-boards";

export default function StudyProgressWidget() {
  const { boards } = useBoards();

  const boardsProgress = boards?.map(board => {
    const { tiles } = useTiles(board.id);
    const totalTiles = tiles?.length || 0;
    const completedTiles = tiles?.filter(tile => tile.status === "completed").length || 0;
    const progress = totalTiles > 0 ? (completedTiles / totalTiles) * 100 : 0;

    return {
      board,
      progress,
      completedTiles,
      totalTiles
    };
  }) || [];

  const totalCompletedTiles = boardsProgress.reduce((acc, curr) => acc + curr.completedTiles, 0);
  const totalTiles = boardsProgress.reduce((acc, curr) => acc + curr.totalTiles, 0);
  const averageProgress = totalTiles > 0 ? (totalCompletedTiles / totalTiles) * 100 : 0;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Overall Progress</h3>
        <Progress value={averageProgress} className="h-2" />
        <p className="text-sm text-muted-foreground mt-1">
          {averageProgress.toFixed(1)}% Complete
        </p>
      </div>

      <div className="space-y-2">
        {boardsProgress.map(({ board, progress }) => (
          <div key={board.id}>
            <div className="flex justify-between text-sm mb-1">
              <span>{board.name}</span>
              <span>{progress.toFixed(1)}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        ))}
      </div>
    </div>
  );
}