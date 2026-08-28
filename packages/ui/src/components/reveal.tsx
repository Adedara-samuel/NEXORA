"use client";

import * as React from "react";
import { cn } from "../lib/cn";

export interface RevealProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Stagger this reveal after others — useful for lists of cards. */
  delayMs?: number;
  as?: keyof JSX.IntrinsicElements;
}

/**
 * Fades + slides children in the first time they scroll into view.
 * Pure IntersectionObserver — no animation library dependency.
 */
export function Reveal({ className, delayMs = 0, style, children, as = "div", ...props }: RevealProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [visible, setVisible] = React.useState(false);
  const Tag = as as React.ElementType;

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={cn("transition-all duration-700 ease-out-expo", visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4", className)}
      style={{ transitionDelay: visible ? `${delayMs}ms` : "0ms", ...style }}
      {...props}
    >
      {children}
    </Tag>
  );
}
