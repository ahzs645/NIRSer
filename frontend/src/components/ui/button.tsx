import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "icon";
};

export function Button({ className, variant = "secondary", size = "md", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md border font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" && "h-8 px-2.5 text-sm",
        size === "md" && "h-10 px-3 text-sm",
        size === "icon" && "h-9 w-9",
        variant === "primary" && "border-teal-700 bg-teal-700 text-white hover:bg-teal-800",
        variant === "secondary" && "border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
        variant === "ghost" && "border-transparent bg-transparent text-slate-700 hover:bg-slate-100",
        variant === "danger" && "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
        className,
      )}
      {...props}
    />
  );
}
