import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

interface QuotaData {
  tokenCount: number;
  callCount: number;
  quotaLimit: number;
  resetAt: string;
}

export default function QuotaWidget() {
  const { toast } = useToast();
  
  const { data: quota, error } = useQuery<QuotaData>({
    queryKey: ["/api/quota"],
  });

  useEffect(() => {
    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load quota information",
      });
    }
  }, [error, toast]);

  if (!quota) {
    return null;
  }

  const usagePercentage = (quota.tokenCount / quota.quotaLimit) * 100;
  const resetDate = new Date(quota.resetAt).toLocaleDateString();
  const isNearLimit = usagePercentage > 80;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">API Usage</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Progress 
            value={usagePercentage} 
            className={isNearLimit ? "bg-red-100" : ""}
          />
          <div className="text-xs text-muted-foreground">
            {Math.round(usagePercentage)}% used ({quota.tokenCount.toLocaleString()} / {quota.quotaLimit.toLocaleString()} tokens)
          </div>
          <div className="text-xs text-muted-foreground">
            Resets on {resetDate}
          </div>
          {isNearLimit && (
            <div className="text-xs text-red-500 font-medium">
              Warning: Approaching quota limit
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
