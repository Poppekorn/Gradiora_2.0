import { useRoute } from "wouter";
import { Plus, ArrowLeft, Sparkles, Upload } from "lucide-react";
import { useTiles } from "@/hooks/use-tiles";
import { useBoards } from "@/hooks/use-boards";
import { useOptimizeSchedule } from "@/hooks/use-optimize-schedule";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import TileCard from "@/components/TileCard";
import CreateTileDialog from "@/components/CreateTileDialog";
import FileUpload from "@/components/FileUpload";
import FileList from "@/components/FileList";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

export default function BoardPage() {
  const [match, params] = useRoute("/boards/:id");
  const boardId = params ? parseInt(params.id) : 0;
  const { boards } = useBoards();
  const { tiles, isLoading } = useTiles(boardId);
  const { optimizeSchedule, isOptimizing } = useOptimizeSchedule(boardId);

  const board = boards?.find(b => b.id === boardId);

  if (!board) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Class not found</h1>
          <Link href="/">
            <Button>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/">
            <Button variant="ghost">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-4xl font-bold">{board.name}</h1>
            {board.professor && (
              <p className="text-muted-foreground">Prof. {board.professor}</p>
            )}
          </div>
          <Button
            variant="outline"
            onClick={() => optimizeSchedule()}
            disabled={isOptimizing || !tiles || tiles.length === 0}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {isOptimizing ? "Optimizing..." : "Optimize Schedule"}
          </Button>
          <CreateTileDialog boardId={boardId}>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Study Unit
            </Button>
          </CreateTileDialog>
        </div>

        <div className="space-y-8">
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold">Study Units</h2>
            </div>
            <ScrollArea className="h-[calc(50vh-6rem)]">
              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[...Array(6)].map((_, i) => (
                    <Skeleton key={i} className="h-48" />
                  ))}
                </div>
              ) : !tiles || tiles.length === 0 ? (
                <div className="text-center py-12">
                  <h2 className="text-2xl font-semibold text-muted-foreground mb-2">
                    No study units yet
                  </h2>
                  <p className="text-muted-foreground">
                    Create your first study unit to get started
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {tiles.map((tile) => (
                    <TileCard key={tile.id} tile={tile} />
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          <Separator />

          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold">Files</h2>
              <FileUpload boardId={boardId}>
                <Button>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload File
                </Button>
              </FileUpload>
            </div>
            <ScrollArea className="h-[calc(50vh-6rem)]">
              <FileList boardId={boardId} />
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  );
}