
'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { ChevronLeft, ChevronsLeftRight, ChevronsRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const collapsibleSidebarVariants = cva('relative flex flex-col',
  {
    variants: {
      orientation: {
        horizontal: 'h-full',
        vertical: 'w-full',
      },
      collapsed: {
        true: 'transition-all duration-200 ease-in-out',
        false: 'transition-all duration-200 ease-in-out',
      },
    },
    defaultVariants: {
      orientation: 'horizontal',
      collapsed: false,
    },
  }
);

interface CollapsibleSidebarProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof collapsibleSidebarVariants> {
  collapsed: boolean;
  collapsible?: boolean;
  onCollapse?: () => void;
  orientation?: 'horizontal' | 'vertical';
  asChild?: boolean;
}

const CollapsibleSidebar = React.forwardRef<HTMLDivElement, CollapsibleSidebarProps>(
  ({ className, children, collapsed, collapsible = true, onCollapse, orientation = 'horizontal', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(collapsibleSidebarVariants({ collapsed, orientation }), className)}
        {...props}
      >
        {children}
        {collapsible && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/2 rounded-full bg-background hover:bg-muted-foreground/20 border border-border"
            onClick={onCollapse}
          >
            <ChevronLeft className={cn('h-4 w-4', collapsed ? 'transform rotate-180' : '')} />
          </Button>
        )}
      </div>
    );
  }
);

CollapsibleSidebar.displayName = 'CollapsibleSidebar';

export { CollapsibleSidebar };
