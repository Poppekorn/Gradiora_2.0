import { useState } from "react";
import { useBoards } from "@/hooks/use-boards";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import type { Board } from "@db/schema";

interface EditBoardDialogProps {
  board: Board;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditBoardDialog({ board, open, onOpenChange }: EditBoardDialogProps) {
  const [loading, setLoading] = useState(false);
  const { updateBoard } = useBoards();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    name: board.name,
    description: board.description || "",
    professor: board.professor || "",
    schedule: board.schedule || "",
    syllabus: board.syllabus || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await updateBoard({
        ...board,
        ...formData,
      });
      toast({
        title: "Success",
        description: "Class updated successfully",
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update class",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Class</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Class Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="professor">Professor</Label>
            <Input
              id="professor"
              value={formData.professor}
              onChange={(e) => setFormData(prev => ({ ...prev, professor: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="schedule">Schedule</Label>
            <Input
              id="schedule"
              value={formData.schedule}
              onChange={(e) => setFormData(prev => ({ ...prev, schedule: e.target.value }))}
              placeholder="e.g., MWF 10:00 AM"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="syllabus">Syllabus URL</Label>
            <Input
              id="syllabus"
              type="url"
              value={formData.syllabus}
              onChange={(e) => setFormData(prev => ({ ...prev, syllabus: e.target.value }))}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
