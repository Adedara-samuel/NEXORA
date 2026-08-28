import * as React from "react";
import { cn } from "../lib/cn";

export interface LogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** Path to the NEXORA mark, e.g. "/nexora-logo.png" — each app serves its own copy from /public. */
  src: string;
  glow?: boolean;
}

/** The NEXORA mark. `glow` adds the brand's signature pulsing cyan/blue glow (used on the splash screen). */
export const Logo = React.forwardRef<HTMLImageElement, LogoProps>(
  ({ className, src, glow = false, alt = "NEXORA", ...props }, ref) => (
    <img
      ref={ref}
      src={src}
      alt={alt}
      className={cn("select-none", glow && "animate-pulse-glow", className)}
      draggable={false}
      {...props}
    />
  ),
);
Logo.displayName = "Logo";
