import { useState, useEffect } from "react";
import GridLayout from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { Card } from "@/components/ui/card";
import StudyProgressWidget from "./widgets/StudyProgressWidget";
import { useToast } from "@/hooks/use-toast";
import QuotaWidget from "./widgets/QuotaWidget";

interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

// Default layout configuration for new users
const defaultLayout: LayoutItem[] = [
  { i: "progress", x: 0, y: 0, w: 6, h: 4, minW: 4, minH: 3 },
  { i: "deadlines", x: 6, y: 0, w: 6, h: 4, minW: 4, minH: 3 },
  { i: "activities", x: 0, y: 4, w: 8, h: 4, minW: 4, minH: 3 },
  { i: "quickActions", x: 8, y: 4, w: 4, h: 4, minW: 3, minH: 3 },
  { i: "quota", x: 0, y: 8, w: 6, h: 3, minW: 3, minH: 2 }, // Add quota widget
];

export default function DashboardLayout() {
  const [layout, setLayout] = useState<LayoutItem[]>(defaultLayout);
  const [mounted, setMounted] = useState(false);
  const { toast } = useToast();

  // Load saved layout from localStorage on mount
  useEffect(() => {
    setMounted(true);
    const savedLayout = localStorage.getItem("dashboardLayout");
    if (savedLayout) {
      try {
        const parsedLayout = JSON.parse(savedLayout);
        setLayout(parsedLayout);
      } catch (error) {
        console.error("Failed to parse saved layout:", error);
        // Reset to default layout if saved layout is invalid
        setLayout(defaultLayout);
      }
    }
  }, []);

  const handleLayoutChange = (newLayout: LayoutItem[]) => {
    setLayout(newLayout);
    // Save layout to localStorage
    try {
      localStorage.setItem("dashboardLayout", JSON.stringify(newLayout));
      // Show success toast occasionally (not on every minor change)
      if (Math.random() < 0.1) {
        toast({
          title: "Layout saved",
          description: "Your dashboard layout has been saved",
        });
      }
    } catch (error) {
      console.error("Failed to save layout:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save dashboard layout",
      });
    }
  };

  // Don't render layout until mounted to prevent hydration issues
  if (!mounted) return null;

  return (
    <div className="p-6">
      <GridLayout
        className="layout"
        layout={layout}
        cols={12}
        rowHeight={100}
        width={1200}
        onLayoutChange={handleLayoutChange}
        draggableHandle=".widget-header"
        margin={[16, 16]}
        isBounded
        useCSSTransforms
      >
        <Card key="progress" className="overflow-hidden">
          <div className="widget-header p-4 bg-background border-b cursor-move">
            Study Progress
          </div>
          <div className="p-4">
            <StudyProgressWidget />
          </div>
        </Card>

        <Card key="deadlines" className="overflow-hidden">
          <div className="widget-header p-4 bg-background border-b cursor-move">
            Upcoming Deadlines
          </div>
          <div className="p-4">
            <h3 className="text-lg font-semibold mb-4">Due Soon</h3>
            {/* Add DeadlinesWidget component here */}
            <p className="text-muted-foreground">No upcoming deadlines</p>
          </div>
        </Card>

        <Card key="activities" className="overflow-hidden">
          <div className="widget-header p-4 bg-background border-b cursor-move">
            Recent Activities
          </div>
          <div className="p-4">
            <h3 className="text-lg font-semibold mb-4">Latest Updates</h3>
            {/* Add ActivitiesWidget component here */}
            <p className="text-muted-foreground">No recent activities</p>
          </div>
        </Card>

        <Card key="quickActions" className="overflow-hidden">
          <div className="widget-header p-4 bg-background border-b cursor-move">
            Quick Actions
          </div>
          <div className="p-4">
            <h3 className="text-lg font-semibold mb-4">Common Tasks</h3>
            {/* Add QuickActionsWidget component here */}
            <p className="text-muted-foreground">No quick actions available</p>
          </div>
        </Card>
        <Card key="quota" className="overflow-hidden">
          <div className="widget-header p-4 bg-background border-b cursor-move">
            API Usage
          </div>
          <div className="p-4">
            <QuotaWidget />
          </div>
        </Card>
      </GridLayout>
    </div>
  );
}