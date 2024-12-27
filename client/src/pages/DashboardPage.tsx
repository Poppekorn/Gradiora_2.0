import { Plus, LogOut } from "lucide-react";
import { useBoards } from "@/hooks/use-boards";
import { useUser } from "@/hooks/use-user";
import BoardCard from "@/components/BoardCard";
import CreateBoardDialog from "@/components/CreateBoardDialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

export default function DashboardPage() {
  const { boards, isLoading } = useBoards();
  const { logout } = useUser();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      const result = await logout();
      if (!result.ok) {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.message,
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to logout",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold">My Classes</h1>
          <div className="flex items-center gap-4">
            <CreateBoardDialog>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Class
              </Button>
            </CreateBoardDialog>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-12rem)]">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-48" />
              ))}
            </div>
          ) : boards?.length === 0 ? (
            <div className="text-center py-12">
              <h2 className="text-2xl font-semibold text-muted-foreground mb-2">
                No classes yet
              </h2>
              <p className="text-muted-foreground">
                Create your first class to get started
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {boards?.map((board) => (
                <BoardCard key={board.id} board={board} />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}