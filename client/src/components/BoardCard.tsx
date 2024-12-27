import { type Board } from "@db/schema";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Link } from "wouter";
import { BookOpen, Calendar, GraduationCap } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface BoardCardProps {
  board: Board;
}

export default function BoardCard({ board }: BoardCardProps) {
  return (
    <Link href={`/board/${board.id}`}>
      <Card className="hover:shadow-lg transition-shadow cursor-pointer">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-bold">{board.name}</h3>
              {board.professor && (
                <div className="flex items-center text-sm text-muted-foreground">
                  <GraduationCap className="mr-2 h-4 w-4" />
                  Prof. {board.professor}
                </div>
              )}
            </div>
            {board.isArchived && (
              <Badge variant="secondary">Archived</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {board.description && (
            <p className="text-sm text-muted-foreground mb-4">
              {board.description}
            </p>
          )}
          <div className="space-y-2">
            {board.schedule && (
              <div className="flex items-center text-sm">
                <Calendar className="mr-2 h-4 w-4" />
                {board.schedule}
              </div>
            )}
            {board.syllabus && (
              <div className="flex items-center text-sm">
                <BookOpen className="mr-2 h-4 w-4" />
                <a 
                  href={board.syllabus}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  View Syllabus
                </a>
              </div>
            )}
          </div>
        </CardContent>
        {board.overallGrade && (
          <CardFooter>
            <div className="text-sm font-medium">
              Overall Grade: {board.overallGrade}
            </div>
          </CardFooter>
        )}
      </Card>
    </Link>
  );
}
