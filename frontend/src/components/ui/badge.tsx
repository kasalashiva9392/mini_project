import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-white",
        secondary:
          "border-(--border) bg-primary-light text-primary",
        success:
          "border-(--success-border) bg-(--success-bg) text-(--success)",
        outline:
          "border-(--border) bg-white text-(--text-secondary)",
        accent:
          "border-transparent bg-accent-light text-(--text-primary)",
        destructive:
          "border-(--danger-border) bg-(--danger-bg) text-(--danger)",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
