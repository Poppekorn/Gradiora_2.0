import { useTiles } from "@/hooks/use-tiles";
import { useBoards } from "@/hooks/use-boards";
import { format, isAfter, isBefore, addDays } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { CalendarDays } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function DeadlinesWidget() {
  const { boards } = useBoards();
  
  // Get all tiles from all boards and filter for upcoming deadlines
  const upcomingDeadlines = boards?.flatMap(board => {
    const tiles = []; // TODO: Get tiles for each board
    return tiles.filter(tile => {
      if (!tile.dueDate) return false;
      const dueDate = new Date(tile.dueDate);
      return isAfter(dueDate, new Date()) && isBefore(dueDate, addDays(new Date(), 14));
    }).map(tile => ({
      ...tile,
      boardName: board.name,
      boardColor: board.color,
    }));
  }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Upcoming Deadlines</h3>
        </div>

        <div className="space-y-3">
          {upcomingDeadlines?.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming deadlines</p>
          ) : (
            upcomingDeadlines?.map(tile => (
              <div
                key={tile.id}
                className="flex items-start justify-between gap-2 p-2 rounded-lg border"
              >
                <div className="space-y-1">
                  <div className="font-medium">{tile.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {tile.boardName}
                  </div>
                </div>
                <Badge
                  style={{
                    backgroundColor: tile.boardColor,
                    color: 'white'
                  }}
                >
                  {format(new Date(tile.dueDate), 'MMM d')}
                </Badge>
              </div>
            ))
          )}
        </div>
      </div>
    </ScrollArea>
  );
}
