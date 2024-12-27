import { useTiles } from "@/hooks/use-tiles";
import { useBoards } from "@/hooks/use-boards";
import { format, isAfter, isBefore, addDays } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { CalendarDays } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Tile } from "@db/schema";
import { useLocation } from "wouter";

export default function DeadlinesWidget() {
  const { boards } = useBoards();
  const [, setLocation] = useLocation();

  // Get all tiles from all boards and filter for upcoming deadlines
  const upcomingDeadlines = boards?.flatMap(board => {
    const { tiles } = useTiles(board.id);
    return (tiles || []).filter(tile => {
      if (!tile.dueDate) return false;
      const dueDate = new Date(tile.dueDate);
      return isAfter(dueDate, new Date()) && isBefore(dueDate, addDays(new Date(), 14));
    }).map(tile => ({
      ...tile,
      boardName: board.name,
      boardColor: board.color || "#E2E8F0",
    }));
  }).sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

  const handleTileClick = (boardId: number, tileId: number) => {
    setLocation(`/boards/${boardId}/tiles/${tileId}`);
  };

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Upcoming Deadlines</h3>
        </div>

        <div className="space-y-3">
          {!upcomingDeadlines || upcomingDeadlines.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming deadlines</p>
          ) : (
            upcomingDeadlines.map(tile => (
              <div
                key={tile.id}
                className="flex items-start justify-between gap-2 p-2 rounded-lg border hover:bg-accent cursor-pointer"
                onClick={() => handleTileClick(tile.boardId!, tile.id)}
              >
                <div className="space-y-1">
                  <div className="font-medium">{tile.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {tile.boardName}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge
                    variant="secondary"
                    style={{
                      backgroundColor: tile.boardColor,
                      borderColor: `color-mix(in srgb, ${tile.boardColor} 85%, black)`,
                    }}
                  >
                    {format(new Date(tile.dueDate!), 'MMM d')}
                  </Badge>
                  {tile.priority && (
                    <Badge variant="outline" className="text-xs">
                      {tile.priority}
                    </Badge>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </ScrollArea>
  );
}