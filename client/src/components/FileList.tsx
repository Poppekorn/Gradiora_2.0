import { useState } from "react";
import { useFiles } from "@/hooks/use-files";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { File as FileIcon, Tag, Plus, Trash2, X, MoreVertical, BookOpen, Loader2 } from "lucide-react";
import { format } from "date-fns";
import type { File, Tag as TagType } from "@db/schema";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMutation } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FileListProps {
  boardId: number;
}

interface FileWithTags extends Omit<File, 'createdAt'> {
  createdAt: string;
  tags: {
    tag: TagType;
  }[];
}

interface SummaryResult {
  summary: string;
  explanation: string;
}

export default function FileList({ boardId }: FileListProps) {
  const [selectedFile, setSelectedFile] = useState<FileWithTags | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [showSuggestionDialog, setShowSuggestionDialog] = useState(false);
  const [similarTagSuggestions, setSimilarTagSuggestions] = useState<string[]>([]);
  const { files, isLoading, tags, createTag, addTagToFile, removeTagFromFile, deleteFile } = useFiles(boardId);
  const { toast } = useToast();
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);
  const [summaryResult, setSummaryResult] = useState<SummaryResult | null>(null);
  const [educationLevel, setEducationLevel] = useState("high_school");

  const summaryMutation = useMutation({
    mutationFn: async (fileId: number) => {
      const response = await fetch(`/api/boards/${boardId}/files/${fileId}/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ educationLevel }),
        credentials: 'include',
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
  });

  const handleSummarize = async (fileId: number) => {
    try {
      const result = await summaryMutation.mutateAsync(fileId);
      setSummaryResult(result);
      setShowSummaryDialog(true);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to summarize file",
      });
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    try {
      const normalizedNewTag = normalizeTagName(newTagName);

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

      const similarTags = tags
        ? findSimilarTags(newTagName, tags.map(t => t.name))
        : [];

      if (similarTags.length > 0) {
        setShowSuggestionDialog(true);
        setSimilarTagSuggestions(similarTags);
        return;
      }

      const tag = await createTag({
        name: newTagName.trim(),
        isStudyUnitTag: false,
      });

      setNewTagName("");
      toast({
        title: "Success",
        description: "Tag created successfully",
      });
    } catch (error) {
      console.error("Error creating tag:", error);
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
        toast({
          title: "Success",
          description: "Tag removed successfully",
        });
      } else {
        await addTagToFile({ fileId, tagId });
        toast({
          title: "Success",
          description: "Tag added successfully",
        });
      }
    } catch (error) {
      console.error("Error toggling tag:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: hasTag ? "Failed to remove tag" : "Failed to add tag",
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
      console.error("Error deleting file:", error);
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
      <div className="space-y-4">
        <div className="flex items-center justify-end mb-4">
          <Select value={educationLevel} onValueChange={setEducationLevel}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select education level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="elementary">Elementary School</SelectItem>
              <SelectItem value="middle">Middle School</SelectItem>
              <SelectItem value="high_school">High School</SelectItem>
              <SelectItem value="college">College</SelectItem>
              <SelectItem value="graduate">Graduate Level</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {files.map((file: FileWithTags) => (
            <Card
              key={file.id}
              className="hover:shadow-lg transition-shadow"
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
                  <div className="flex items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={() => handleSummarize(file.id)}
                          disabled={summaryMutation.isPending}
                        >
                          {summaryMutation.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <BookOpen className="mr-2 h-4 w-4" />
                          )}
                          Summarize
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDeleteFile(file.id)} className="text-red-500">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-2">
                  <Tag className="h-4 w-4 mt-1" />
                  <div className="flex flex-wrap gap-2">
                    {file.tags?.map(({ tag }) => (
                      <Badge
                        key={tag.id}
                        variant={tag.isStudyUnitTag ? "secondary" : "default"}
                        className="flex items-center gap-1"
                      >
                        {tag.name}
                        {tag.isStudyUnitTag && " (Study Unit)"}
                        {!tag.isStudyUnitTag && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleTag(file.id, tag.id, true);
                            }}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={showSummaryDialog} onOpenChange={setShowSummaryDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Content Summary ({educationLevel.replace('_', ' ')})</DialogTitle>
            <DialogDescription>
              Here's a summary of the content
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh] py-4">
            {summaryMutation.isPending ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Generating summary...</span>
              </div>
            ) : summaryResult ? (
              <div className="space-y-6">
                <div className="p-4 bg-muted rounded-lg">
                  <h3 className="text-lg font-semibold mb-2">Summary</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">{summaryResult.summary}</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <h3 className="text-lg font-semibold mb-2">Detailed Explanation</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">{summaryResult.explanation}</p>
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground">
                No summary available
              </div>
            )}
          </ScrollArea>
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