import { type Board } from "@db/schema";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Link } from "wouter";
import { BookOpen, Calendar, GraduationCap, MoreVertical, Edit, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBoards } from "@/hooks/use-boards";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import EditBoardDialog from "./EditBoardDialog";

interface BoardCardProps {
  board: Board;
}

export default function BoardCard({ board }: BoardCardProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { deleteBoard } = useBoards();
  const { toast } = useToast();

  const handleDelete = async () => {
    try {
      await deleteBoard(board.id);
      toast({
        title: "Success",
        description: "Class deleted successfully",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete class",
      });
    }
  };

  return (
    <>
      <Card 
        className="hover:shadow-lg transition-shadow"
        style={{ 
          backgroundColor: board.color || "#E2E8F0",
          borderColor: board.color ? `hsl(from ${board.color} h s calc(l - 10%))` : undefined
        }}
      >
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <Link href={`/board/${board.id}`} className="hover:underline">
                <h3 className="text-lg font-bold">{board.name}</h3>
              </Link>
              {board.professor && (
                <div className="flex items-center text-sm text-muted-foreground">
                  <GraduationCap className="mr-2 h-4 w-4" />
                  Prof. {board.professor}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {board.isArchived && (
                <Badge variant="secondary">Archived</Badge>
              )}
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
                  <DropdownMenuItem 
                    className="text-red-600" 
                    onClick={() => setIsDeleteDialogOpen(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
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

      <EditBoardDialog
        board={board}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the class
              and all associated study units.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDelete}
            >
              Delete Class
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}