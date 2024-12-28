import { useState } from "react";
import { useFiles } from "@/hooks/use-files";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { File as FileIcon, Tag, Trash2, X, MoreVertical, Loader2, ChevronDown, ChevronUp, Eye, EyeOff } from "lucide-react";
import { format } from "date-fns";
import type { File, Tag as TagType } from "@db/schema";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
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
import { Image } from "@/components/ui/image";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentLayout } from "@/components/ui/document-layout";

interface FileListProps {
  boardId: number;
}

interface FileWithTags extends File {
  tags: {
    tag: TagType;
  }[];
}

export default function FileList({ boardId }: FileListProps) {
  const [expandedFileId, setExpandedFileId] = useState<number | null>(null);
  const [educationLevel, setEducationLevel] = useState("high_school");
  const { files, isLoading, tags, removeTagFromFile, deleteFile } = useFiles(boardId);
  const { toast } = useToast();
  const [summaryLoading, setSummaryLoading] = useState<Record<number, boolean>>({});
  const [previewLoading, setPreviewLoading] = useState<Record<number, boolean>>({});
  const [previewVisible, setPreviewVisible] = useState<Record<number, boolean>>({});
  const [filePreview, setFilePreview] = useState<Record<number, any>>({});

  const getSummary = useMutation({
    mutationFn: async (fileId: number) => {
      const response = await fetch(`/api/boards/${boardId}/files/${fileId}/summary`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
  });

  const handleViewSummary = async (fileId: number) => {
    try {
      setSummaryLoading(prev => ({ ...prev, [fileId]: true }));
      const summary = await getSummary.mutateAsync(fileId);
      setExpandedFileId(fileId === expandedFileId ? null : fileId);
    } catch (error) {
      handleError(error as Error);
    } finally {
      setSummaryLoading(prev => ({ ...prev, [fileId]: false }));
    }
  };

  const fetchFilePreview = async (fileId: number) => {
    try {
      setPreviewLoading(prev => ({ ...prev, [fileId]: true }));
      const response = await fetch(`/api/boards/${boardId}/files/${fileId}/preview`, {
        credentials: 'include'
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to load preview");
      }

      const contentType = response.headers.get('content-type');
      if (contentType?.startsWith('image/')) {
        const blob = await response.blob();
        setFilePreview(prev => ({ 
          ...prev, 
          [fileId]: { 
            type: 'image',
            url: URL.createObjectURL(blob),
            isProcessing: true
          }
        }));

        // After setting image preview, fetch the extracted text
        const textResponse = await fetch(`/api/boards/${boardId}/files/${fileId}/extract-text`, {
          credentials: 'include'
        });

        if (textResponse.ok) {
          const textData = await textResponse.json();
          setFilePreview(prev => ({
            ...prev,
            [fileId]: {
              ...prev[fileId],
              extractedText: textData.text,
              isProcessing: false
            }
          }));
        }
      } else {
        const preview = await response.json();
        setFilePreview(prev => ({ ...prev, [fileId]: preview }));
      }
      setPreviewVisible(prev => ({ ...prev, [fileId]: true }));
    } catch (error) {
      console.error("Error fetching preview:", error);
      toast({
        variant: "destructive",
        title: "Preview Error",
        description: error instanceof Error ? error.message : "Failed to load file preview",
      });
    } finally {
      setPreviewLoading(prev => ({ ...prev, [fileId]: false }));
    }
  };

  const togglePreview = (fileId: number) => {
    setPreviewVisible(prev => {
      const currentValue = prev[fileId];
      if (!currentValue && !filePreview[fileId]) {
        fetchFilePreview(fileId);
      }
      return { ...prev, [fileId]: !currentValue };
    });
  };

  const handleDeleteFile = async (fileId: number) => {
    try {
      await deleteFile(fileId);
      toast({
        title: "Success",
        description: "File deleted successfully",
      });
      setExpandedFileId(null);
      setPreviewVisible(prev => {
        const { [fileId]: _, ...rest } = prev;
        return rest;
      });
      setFilePreview(prev => {
        const { [fileId]: _, ...rest } = prev;
        return rest;
      });
    } catch (error) {
      console.error("Error deleting file:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete file",
      });
    }
  };

  const handleError = (error: Error) => {
    if (error.message?.includes('quota exceeded')) {
      toast({
        variant: "destructive",
        title: "API Quota Exceeded",
        description: "The AI service is temporarily unavailable. Please try again later.",
      });
    } else {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "An error occurred. Please try again.",
      });
    }
  };

  const isImageFile = (mimeType: string) => {
    return mimeType.startsWith('image/');
  };

  const renderImagePreview = (preview: any, file: FileWithTags) => {
    return (
      <div className="space-y-4">
        <Image
          src={preview.url}
          alt={file.originalName}
          className="max-h-48 mx-auto object-contain"
        />
        {preview.isProcessing ? (
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Extracting text...</span>
          </div>
        ) : preview.extractedText ? (
          <div className="mt-4">
            <h4 className="font-semibold mb-2">Extracted Text</h4>
            <ScrollArea className="h-48 rounded-md border p-4">
              <pre className="text-sm whitespace-pre-wrap">
                {preview.extractedText}
              </pre>
            </ScrollArea>
          </div>
        ) : null}
      </div>
    );
  };

  const renderPreview = (preview: any, file: FileWithTags) => {
    const isImage = isImageFile(file.mimeType);

    return (
      <div className="space-y-4">
        {isImage ? (
          renderImagePreview(preview, file)
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <h4 className="font-semibold">Content</h4>
              <ScrollArea className="h-[600px] rounded-md border p-4">
                <pre className="whitespace-pre-wrap text-sm">
                  {preview.content?.text || preview.preview}
                </pre>
              </ScrollArea>
            </div>
            {preview.content?.layout && (
              <div className="space-y-4">
                <h4 className="font-semibold">Document Structure</h4>
                <DocumentLayout sections={preview.content.layout} />
              </div>
            )}
          </div>
        )}
      </div>
    );
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

      <div className="grid grid-cols-1 gap-4">
        {files?.map((file: FileWithTags) => {
          const isExpanded = expandedFileId === file.id;
          const isLoading = summaryLoading[file.id];
          const isImage = isImageFile(file.mimeType);
          const preview = filePreview[file.id];
          const isPreviewLoading = previewLoading[file.id];
          const isPreviewVisible = previewVisible[file.id];

          return (
            <Card key={file.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <FileIcon className="h-5 w-5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{file.originalName}</h3>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(file.createdAt || ''), "PPp")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => togglePreview(file.id)}
                      className="relative"
                      disabled={isPreviewLoading}
                    >
                      {isPreviewLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isPreviewVisible ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-2"
                      onClick={() => handleViewSummary(file.id)}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={() => handleDeleteFile(file.id)} 
                          className="text-red-500"
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
                <div className="space-y-4">
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
                                removeTagFromFile({ fileId: file.id, tagId: tag.id });
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

                  {!preview && !isPreviewLoading && !isPreviewVisible && (
                    <Button 
                      variant="ghost" 
                      onClick={() => fetchFilePreview(file.id)}
                      className="w-full"
                    >
                      Load Preview
                    </Button>
                  )}

                  {isPreviewLoading && (
                    <Skeleton className="w-full h-48" />
                  )}

                  {preview && isPreviewVisible && (
                    renderPreview(preview, file)
                  )}

                  {isExpanded && (
                    <div className="mt-4 space-y-4 bg-muted p-4 rounded-lg">
                      {getSummary.data && getSummary.data.fileId === file.id ? (
                        <>
                          <div>
                            <h4 className="font-semibold mb-2">Summary</h4>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {getSummary.data.summary}
                            </p>
                          </div>
                          <div>
                            <h4 className="font-semibold mb-2">Detailed Explanation</h4>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {getSummary.data.explanation}
                            </p>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                          <span className="ml-2 text-muted-foreground">
                            Loading summary...
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}