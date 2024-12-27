import { useState } from "react";
import { useBoards } from "@/hooks/use-boards";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
    color: board.color || "#E2E8F0",
    isArchived: board.isArchived || false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await updateBoard({
        ...board, // Keep the original board data
        ...formData, // Override with form data
        id: board.id, // Ensure ID is included
      });

      toast({
        title: "Success",
        description: "Class updated successfully",
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to update class:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update class",
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
          <DialogDescription>
            Make changes to your class here. Click save when you're done.
          </DialogDescription>
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

          <div className="space-y-2">
            <Label htmlFor="color">Color</Label>
            <div className="flex gap-2">
              <Input
                id="color"
                type="color"
                value={formData.color}
                onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                className="w-16 p-1 h-10"
              />
              <Input
                type="text"
                value={formData.color}
                onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                placeholder="#E2E8F0"
                className="font-mono"
              />
            </div>
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