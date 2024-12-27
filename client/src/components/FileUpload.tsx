import { useState, useEffect } from "react";
import { useFiles } from "@/hooks/use-files";
import { useTiles } from "@/hooks/use-tiles";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Tag } from "@db/schema";

interface FileUploadProps {
  boardId: number;
  children: React.ReactNode;
}

export default function FileUpload({ boardId, children }: FileUploadProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);

  const { uploadFile, createTag, tags } = useFiles(boardId);
  const { tiles } = useTiles(boardId);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("tags", JSON.stringify(selectedTags));

      await uploadFile(formData);

      toast({
        title: "Success",
        description: "File uploaded successfully",
      });
      setOpen(false);
      setSelectedFile(null);
      setSelectedTags([]);
    } catch (error) {
      console.error("Failed to upload file:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload file",
      });
    } finally {
      setLoading(false);
    }
  };

  // Ensure each study unit has a corresponding tag
  const ensureStudyUnitTags = async () => {
    if (!tiles) return;

    for (const tile of tiles) {
      const tagExists = tags?.some(
        tag => tag.name === tile.title && tag.isStudyUnitTag
      );

      if (!tagExists) {
        try {
          await createTag({
            name: tile.title,
            isStudyUnitTag: true,
          });
        } catch (error) {
          console.error(`Failed to create tag for study unit ${tile.title}:`, error);
        }
      }
    }
  };

  const toggleTag = (tagId: number) => {
    setSelectedTags(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  // Ensure study unit tags exist when the component mounts or tiles change
  useEffect(() => {
    ensureStudyUnitTags();
  }, [tiles, tags]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload File</DialogTitle>
          <DialogDescription>
            Upload a file and assign it to specific study units or add custom tags.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file">File *</Label>
            <Input
              id="file"
              type="file"
              onChange={handleFileChange}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2">
              {tags?.map((tag: Tag) => (
                <Badge
                  key={tag.id}
                  variant={selectedTags.includes(tag.id) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleTag(tag.id)}
                >
                  {tag.name}
                  {tag.isStudyUnitTag && " (Study Unit)"}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !selectedFile}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}