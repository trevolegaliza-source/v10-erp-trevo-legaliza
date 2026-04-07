import * as React from "react";
import { cn } from "@/lib/utils";

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  glowColor?: string;
  variant?: "default" | "sm" | "service";
}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, children, glowColor = "rgba(34, 197, 94, 0.15)", variant = "default", ...props }, ref) => {
    const variantClass = variant === "sm" ? "glass-sm" : variant === "service" ? "glass-service" : "";
    return (
      <div
        ref={ref}
        className={cn(
          "glass-card-wrapper group relative cursor-pointer",
          variantClass,
          className
        )}
        {...props}
      >
        <div className={cn("glass-card-inner", variantClass === "glass-sm" ? "glass-sm" : variantClass === "glass-service" ? "glass-service" : "")}>
          {children}
        </div>
        <div
          className="glass-card-glow"
          style={{ background: glowColor }}
        />
        <div className="glass-card-shine" />
      </div>
    );
  }
);
GlassCard.displayName = "GlassCard";

export { GlassCard };
