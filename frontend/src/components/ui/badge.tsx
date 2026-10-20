import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow",
        outline: "text-foreground border-primary/50",
        level1:
          "border-red-500/50 bg-red-500/10 text-red-400 shadow-[0_0_10px_rgba(255,0,64,0.3)]",
        level2:
          "border-orange-500/50 bg-orange-500/10 text-orange-400 shadow-[0_0_10px_rgba(255,102,0,0.3)]",
        level3:
          "border-yellow-500/50 bg-yellow-500/10 text-yellow-400 shadow-[0_0_10px_rgba(255,255,0,0.3)]",
        level4:
          "border-cyan-500/50 bg-cyan-500/10 text-cyan-400 shadow-[0_0_10px_rgba(0,212,255,0.3)]",
        level5:
          "border-purple-500/50 bg-purple-500/10 text-purple-400 shadow-[0_0_10px_rgba(189,0,255,0.3)]",
        success:
          "border-green-500/50 bg-green-500/10 text-green-400 shadow-[0_0_10px_rgba(0,255,65,0.3)]",
        processing:
          "border-yellow-500/50 bg-yellow-500/10 text-yellow-400 animate-pulse",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
