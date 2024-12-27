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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMutation } from "@tanstack/react-query";

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
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [showAnalysisDialog, setShowAnalysisDialog] = useState(false);
  const [showQuizDialog, setShowQuizDialog] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AIAnalysisResult | null>(null);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const { deleteTile } = useTiles(tile.boardId!);
  const { boards } = useBoards();
  const { toast } = useToast();

  // Get parent board's color
  const parentBoard = boards?.find(board => board.id === tile.boardId);
  const parentColor = parentBoard?.color || "#E2E8F0";

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/boards/${tile.boardId}/tiles/${tile.id}/analyze`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
  });

  const quizMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/boards/${tile.boardId}/tiles/${tile.id}/quiz`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
  });

  const handleAnalyze = async () => {
    try {
      const result = await analyzeMutation.mutateAsync();
      setAnalysisResult(result);
      setShowAnalysisDialog(true);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to analyze study unit content",
      });
    }
  };

  const handleGenerateQuiz = async () => {
    try {
      const result = await quizMutation.mutateAsync();
      setQuizResult(result);
      setShowQuizDialog(true);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate quiz",
      });
    }
  };

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
                  <DropdownMenuItem onClick={handleAnalyze} disabled={analyzeMutation.isPending}>
                    <Brain className="mr-2 h-4 w-4" />
                    Analyze Content
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleGenerateQuiz} disabled={quizMutation.isPending}>
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

      <Dialog open={showAnalysisDialog} onOpenChange={setShowAnalysisDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>AI Analysis</DialogTitle>
            <DialogDescription>
              Analysis of content in study unit: {tile.title}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {analysisResult && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Summary</h3>
                  <p className="text-muted-foreground">{analysisResult.summary}</p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">Detailed Explanation</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">{analysisResult.explanation}</p>
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={showQuizDialog} onOpenChange={setShowQuizDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Quiz</DialogTitle>
            <DialogDescription>
              Test your knowledge about {quizResult?.topic || tile.title}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {quizResult && (
              <div className="space-y-8">
                {quizResult.questions.map((q, i) => (
                  <div key={i} className="space-y-4">
                    <h3 className="font-semibold">Question {i + 1}: {q.question}</h3>
                    <div className="space-y-2">
                      {q.options.map((option, j) => (
                        <div key={j} className="flex items-center gap-2">
                          <div className={`p-2 rounded ${option === q.correctAnswer ? 'bg-green-100 dark:bg-green-900' : ''}`}>
                            {option}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">Explanation:</span> {q.explanation}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}