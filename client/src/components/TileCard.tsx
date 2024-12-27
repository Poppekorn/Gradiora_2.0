import { type Tile } from "@db/schema";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar, Link as LinkIcon, Star, Tag, Clock, ListOrdered, MoreVertical, Edit, Trash2, Brain, GraduationCap } from "lucide-react";
import { format } from "date-fns";
import { useTiles } from "@/hooks/use-tiles";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import EditTileDialog from "./EditTileDialog";
import { useBoards } from "@/hooks/use-boards";
import { useLocation } from "wouter";

interface BoardCardProps {
  tile: Tile;
}

interface AIAnalysisResult {
  summary: string;
  explanation: string;
}

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

interface QuizResult {
  topic: string;
  questions: QuizQuestion[];
}

const priorityColors = {
  low: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-red-100 text-red-800",
};

const statusColors = {
  not_started: "bg-gray-100 text-gray-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  needs_review: "bg-yellow-100 text-yellow-800",
};

export default function TileCard({ tile }: BoardCardProps) {
  const [, setLocation] = useLocation();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const { deleteTile } = useTiles(tile.boardId!);
  const { boards } = useBoards();
  const { toast } = useToast();

  // Get parent board's color
  const parentBoard = boards?.find(board => board.id === tile.boardId);
  const parentColor = parentBoard?.color || "#E2E8F0";

  const handleDelete = async () => {
    try {
      await deleteTile(tile.id);
      toast({
        title: "Success",
        description: "Study unit deleted successfully",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete study unit",
      });
    }
  };

  // Parse external links from JSON
  const externalLinks: string[] = Array.isArray(tile.externalLinks)
    ? tile.externalLinks
    : (typeof tile.externalLinks === 'string'
      ? JSON.parse(tile.externalLinks)
      : []);

  return (
    <>
      <Card
        style={{
          backgroundColor: parentColor,
          borderColor: parentColor ? `hsl(from ${parentColor} h s calc(l - 10%))` : undefined
        }}
        className="hover:shadow-lg transition-shadow cursor-pointer"
        onClick={() => setLocation(`/boards/${tile.boardId}/tiles/${tile.id}`)}
      >
        <CardHeader>
          <div className="flex justify-between items-start gap-4">
            <div>
              <h3 className="font-semibold">{tile.title}</h3>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                className={statusColors[tile.status as keyof typeof statusColors]}
              >
                {tile.status?.replace("_", " ")}
              </Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {}} disabled>
                    <Brain className="mr-2 h-4 w-4" />
                    Analyze Content
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {}} disabled>
                    <GraduationCap className="mr-2 h-4 w-4" />
                    Generate Quiz
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-red-600" onClick={handleDelete}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {tile.description && (
            <p className="text-sm text-muted-foreground">
              {tile.description}
            </p>
          )}

          <div className="space-y-2">
            {tile.dueDate && (
              <div className="flex items-center text-sm">
                <Calendar className="mr-2 h-4 w-4" />
                {format(new Date(tile.dueDate), "PPP")}
              </div>
            )}

            {tile.priority && (
              <div className="flex items-center text-sm">
                <Star className="mr-2 h-4 w-4" />
                <Badge className={priorityColors[tile.priority as keyof typeof priorityColors]}>
                  {tile.priority}
                </Badge>
              </div>
            )}

            {tile.recommendedTimeOfDay && (
              <div className="flex items-center text-sm">
                <Clock className="mr-2 h-4 w-4" />
                Recommended: {tile.recommendedTimeOfDay}
                {tile.estimatedDuration && ` (${tile.estimatedDuration} min)`}
              </div>
            )}

            {tile.optimalStudyOrder !== null && tile.optimalStudyOrder !== undefined && (
              <div className="flex items-center text-sm">
                <ListOrdered className="mr-2 h-4 w-4" />
                Study Order: {tile.optimalStudyOrder + 1}
              </div>
            )}

            {tile.tags && tile.tags.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Tag className="h-4 w-4" />
                {tile.tags.map((tag: string, index: number) => (
                  <Badge key={index} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {externalLinks.length > 0 && (
              <div className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4" />
                <div className="flex flex-wrap gap-2">
                  {externalLinks.map((link: string, index: number) => (
                    <a
                      key={index}
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      Resource {index + 1}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
        {tile.grade && (
          <CardFooter>
            <div className="text-sm font-medium">
              Grade: {tile.grade}
            </div>
          </CardFooter>
        )}
      </Card>

      <EditTileDialog
        tile={tile}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
      />
    </>
  );
}