import { AlertCircle, Clock, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../components/ui/card';
import { Badge } from '../../../../../components/ui/badge';
import { Button } from '../../../../../components/ui/button';
import { ActionItem } from '../types/dashboardTypes';
import { useState } from 'react';
import { cn } from '../../../../../lib/utils';

interface ActionRequiredPanelProps {
  items: ActionItem[];
  onActionClick?: (item: ActionItem) => void;
  itemsPerPage?: number;
  loading?: boolean;
}

export default function ActionRequiredPanel({ items, onActionClick, itemsPerPage = 3, loading = false }: ActionRequiredPanelProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(items.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = items.slice(startIndex, endIndex);

  const calculateDaysPending = (dueString: string): string => {
    try {
      // Extract date from format: "Uploaded on 2026-05-05 by system"
      const dateMatch = dueString.match(/\d{4}-\d{2}-\d{2}/);
      if (!dateMatch) return 'submitted today';

      const [year, month, day] = dateMatch[0].split('-').map(Number);
      const uploadDate = new Date(year, month - 1, day);
      const today = new Date();

      today.setHours(0, 0, 0, 0);
      uploadDate.setHours(0, 0, 0, 0);

      const diffTime = today.getTime() - uploadDate.getTime();
      const days = Math.round(diffTime / (1000 * 60 * 60 * 24));

      if (days <= 0) return 'submitted today';
      if (days === 1) return '1 day pending';
      return `${days} days pending`;
    } catch {
      return 'submitted today';
    }
  };

  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };

  return (
    <Card className="border-l-4 border-l-[#ed1c24] shadow-sm animate-in fade-in slide-in-from-top-2">
      <CardHeader className="py-3 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-[#ed1c24]" />
            <CardTitle className="text-base">Action Required</CardTitle>
          </div>
          <Badge variant="outline" className="text-[#ed1c24] border-[#ed1c24] text-xs">
            {items.length} Items
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pb-3 pt-2">
        <div className="divide-y">
          {!loading ? (
            // Skeleton Loaders
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="py-2 flex items-center justify-between px-2 -mx-2">
                <div className="flex-1 min-w-0 space-y-2 w-full">
                  <Skeleton className="h-3 w-3/4" />
                  <div className="flex gap-1">
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
                <Skeleton className="h-7 w-7 flex-shrink-0 ml-2" />
              </div>
            ))
          ) : currentItems.length > 0 ? (
            currentItems.map(item => (
              <div
                key={item.id}
                className="py-2 flex items-center justify-between hover:bg-muted/30 px-2 -mx-2 rounded transition-colors cursor-pointer"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-xs truncate">{item.title}</p>
                  <div className="flex gap-1 mt-0.5 items-center">
                    <Badge variant="secondary" className="text-xs">{item.type}</Badge>
                    <span className="text-xs text-amber-600 font-semibold">{calculateDaysPending(item.due)}</span>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => onActionClick && onActionClick(item)} className="h-7 px-2 flex-shrink-0">
                  <ArrowRight className="w-3 h-3" />
                </Button>
              </div>
            ))
          ) : (
            <div className="py-4 text-center text-muted-foreground">
              <p className="text-xs">No action items</p>
            </div>
          )}
        </div>

        {/* Compact Pagination Controls */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t">
            <span className="text-xs text-muted-foreground">
              {currentPage} of {totalPages}
            </span>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
                className="h-6 w-6 p-0"
              >
                <ChevronLeft className="w-3 h-3" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className="h-6 w-6 p-0"
              >
                <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-slate-200 animate-pulse rounded-md", className)}
      {...props}
    />
  );
}