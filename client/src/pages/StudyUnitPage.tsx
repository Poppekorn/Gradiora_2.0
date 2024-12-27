import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { useTiles } from "@/hooks/use-tiles";
import { useFiles } from "@/hooks/use-files";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Brain, GraduationCap, ArrowLeft } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";

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

const educationLevels = [
  { value: "elementary", label: "Elementary School" },
  { value: "middle", label: "Middle School" },
  { value: "high", label: "High School" },
  { value: "college", label: "College" },
  { value: "graduate", label: "Graduate Level" },
];

export default function StudyUnitPage() {
  const params = useParams();
  const boardId = parseInt(params.boardId);
  const tileId = parseInt(params.tileId);
  const { tiles } = useTiles(boardId);
  const { files } = useFiles(boardId);
  const { toast } = useToast();
  const [selectedLevel, setSelectedLevel] = useState("high");
  const [analysisResult, setAnalysisResult] = useState<AIAnalysisResult | null>(null);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);

  const tile = tiles?.find(t => t.id === tileId);
  const studyUnitFiles = files?.filter(file => 
    file.tags?.some(({ tag }) => tag.name === tile?.title && tag.isStudyUnitTag)
  );

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `/api/boards/${boardId}/tiles/${tileId}/analyze?level=${selectedLevel}`,
        {
          method: 'POST',
          credentials: 'include',
        }
      );
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
  });

  const quizMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `/api/boards/${boardId}/tiles/${tileId}/quiz?level=${selectedLevel}`,
        {
          method: 'POST',
          credentials: 'include',
        }
      );
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
  });

  const handleAnalyze = async () => {
    try {
      const result = await analyzeMutation.mutateAsync();
      setAnalysisResult(result);
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
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate quiz",
      });
    }
  };

  if (!tile) {
    return <div>Study unit not found</div>;
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center gap-4">
        <Link href={`/boards/${boardId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">{tile.title}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">AI Analysis Options</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Education Level</label>
              <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {educationLevels.map(level => (
                    <SelectItem key={level.value} value={level.value}>
                      {level.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-4">
              <Button 
                onClick={handleAnalyze} 
                disabled={analyzeMutation.isPending}
                className="flex-1"
              >
                <Brain className="mr-2 h-4 w-4" />
                Analyze Content
              </Button>
              <Button 
                onClick={handleGenerateQuiz} 
                disabled={quizMutation.isPending}
                className="flex-1"
              >
                <GraduationCap className="mr-2 h-4 w-4" />
                Generate Quiz
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Files in this Study Unit</h2>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {studyUnitFiles?.map(file => (
                  <div 
                    key={file.id} 
                    className="p-2 rounded border text-sm flex items-center gap-2"
                  >
                    {file.originalName}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {analysisResult && (
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Analysis Results</h2>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Summary</h3>
              <p className="text-muted-foreground">{analysisResult.summary}</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Detailed Explanation</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">
                {analysisResult.explanation}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {quizResult && (
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Quiz</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {quizResult.questions.map((q, i) => (
                <div key={i} className="space-y-4">
                  <h3 className="font-semibold">Question {i + 1}: {q.question}</h3>
                  <div className="space-y-2">
                    {q.options.map((option, j) => (
                      <div key={j} className="flex items-center gap-2">
                        <div className={`p-2 rounded ${
                          option === q.correctAnswer 
                            ? 'bg-green-100 dark:bg-green-900' 
                            : ''
                        }`}>
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
