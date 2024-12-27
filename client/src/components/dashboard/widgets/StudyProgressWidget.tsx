import { Progress } from "@/components/ui/progress";
import { useTiles } from "@/hooks/use-tiles";
import { useBoards } from "@/hooks/use-boards";

export default function StudyProgressWidget() {
  const { boards } = useBoards();
  
  const totalProgress = boards?.reduce((acc, board) => {
    const completedTiles = 0; // TODO: Calculate from tiles
    const totalTiles = 0; // TODO: Get total tiles
    return acc + (completedTiles / totalTiles) || 0;
  }, 0);

  const averageProgress = (totalProgress || 0) / (boards?.length || 1) * 100;

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
        {boards?.map(board => {
          const completedTiles = 0; // TODO: Calculate from tiles
          const totalTiles = 0; // TODO: Get total tiles
          const progress = (completedTiles / totalTiles) * 100 || 0;
          
          return (
            <div key={board.id}>
              <div className="flex justify-between text-sm mb-1">
                <span>{board.name}</span>
                <span>{progress.toFixed(1)}%</span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
