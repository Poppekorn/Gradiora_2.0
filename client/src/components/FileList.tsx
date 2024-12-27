import { useState } from "react";
import { useFiles } from "@/hooks/use-files";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { File as FileIcon, Tag, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import type { FileTag, Tag as TagType } from "@db/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
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
import { findSimilarTags, normalizeTagName } from "@/lib/tag-utils";

interface FileListProps {
  boardId: number;
}

interface FileWithTags extends File {
  tags: {
    tag: TagType;
  }[];
}

export default function FileList({ boardId }: FileListProps) {
  const [selectedFile, setSelectedFile] = useState<FileWithTags | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [showSuggestionDialog, setShowSuggestionDialog] = useState(false);
  const [similarTagSuggestions, setSimilarTagSuggestions] = useState<string[]>([]);
  const { files, isLoading, tags, createTag, addTagToFile, removeTagFromFile, deleteFile } = useFiles(boardId);
  const { toast } = useToast();

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    try {
      const normalizedNewTag = normalizeTagName(newTagName);

      // Check for exact matches
      const exactMatchExists = tags?.some(
        tag => normalizeTagName(tag.name) === normalizedNewTag
      );

      if (exactMatchExists) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "A tag with this name already exists",
        });
        return;
      }

      // Find similar tags
      const similarTags = tags
        ? findSimilarTags(newTagName, tags.map(t => t.name))
        : [];

      if (similarTags.length > 0) {
        // Show suggestion dialog
        setShowSuggestionDialog(true);
        setSimilarTagSuggestions(similarTags);
        return;
      }

      // If no similar tags found, create the new tag
      await createTag({
        name: newTagName.trim(),
        isStudyUnitTag: false,
      });
      setNewTagName("");
      toast({
        title: "Success",
        description: "Tag created successfully",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create tag",
      });
    }
  };

  const toggleTag = async (fileId: number, tagId: number, hasTag: boolean) => {
    try {
      if (hasTag) {
        await removeTagFromFile({ fileId, tagId });
      } else {
        await addTagToFile({ fileId, tagId });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update file tags",
      });
    }
  };

  const handleDeleteFile = async (fileId: number) => {
    try {
      await deleteFile(fileId);
      toast({
        title: "Success",
        description: "File deleted successfully",
      });
      setSelectedFile(null);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete file",
      });
    }
  };

  if (isLoading) {
    return <div>Loading files...</div>;
  }

  if (!files?.length) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold text-muted-foreground mb-2">
          No files uploaded
        </h2>
        <p className="text-muted-foreground">
          Upload files and tag them with study units
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {files.map((file: FileWithTags) => (
          <Card
            key={file.id}
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => setSelectedFile(file)}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <FileIcon className="h-5 w-5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{file.originalName}</h3>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(file.createdAt), "PPp")}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex-shrink-0 text-red-500 hover:text-red-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteFile(file.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-2">
                <Tag className="h-4 w-4 mt-1" />
                <div className="flex flex-wrap gap-2">
                  {file.tags?.map(({ tag }) => (
                    <Badge key={tag.id} variant="secondary">
                      {tag.name}
                      {tag.isStudyUnitTag && " (Study Unit)"}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!selectedFile} onOpenChange={(open) => !open && setSelectedFile(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage File Tags</DialogTitle>
            <DialogDescription>
              {selectedFile?.originalName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Input
                placeholder="New tag name"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCreateTag}
                disabled={!newTagName.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Available Tags</h4>
              <div className="flex flex-wrap gap-2">
                {tags?.map((tag) => {
                  const hasTag = selectedFile?.tags?.some(t => t.tag.id === tag.id);
                  return (
                    <Badge
                      key={tag.id}
                      variant={hasTag ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => selectedFile && toggleTag(selectedFile.id, tag.id, !!hasTag)}
                    >
                      {tag.name}
                      {tag.isStudyUnitTag && " (Study Unit)"}
                    </Badge>
                  );
                })}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showSuggestionDialog} onOpenChange={setShowSuggestionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Similar Tags Found</AlertDialogTitle>
            <AlertDialogDescription>
              We found similar existing tags. Would you like to use one of these instead?
              <div className="mt-4 space-y-2">
                {similarTagSuggestions.map((tagName) => (
                  <div
                    key={tagName}
                    className="p-2 border rounded hover:bg-accent cursor-pointer"
                    onClick={() => {
                      setNewTagName(tagName);
                      setShowSuggestionDialog(false);
                    }}
                  >
                    {tagName}
                  </div>
                ))}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setShowSuggestionDialog(false);
                await createTag({
                  name: newTagName.trim(),
                  isStudyUnitTag: false,
                });
                setNewTagName("");
                toast({
                  title: "Success",
                  description: "Tag created successfully",
                });
              }}
            >
              Create New Tag Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}