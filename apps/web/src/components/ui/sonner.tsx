// Adapted from shadcn/ui new-york-v4 registry (MIT); see README.md.
"use client";

import customStyle from "@/lib/custom-style";
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster({ toastOptions, ...props }: ToasterProps) {
  return (
    <Sonner
      theme="light"
      toastOptions={{ closeButtonAriaLabel: "알림 닫기", ...toastOptions }}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={customStyle({
        "--normal-bg": "var(--popover)",
        "--normal-text": "var(--popover-foreground)",
        "--normal-border": "var(--border)",
        "--border-radius": "var(--radius)",
      })}
      {...props}
    />
  );
}

export default Toaster;
