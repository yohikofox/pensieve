import { View, type ViewProps, Platform } from "react-native";
import { cn } from "../utils";
import { shadows } from "../tokens";

interface CardProps extends ViewProps {
  variant?: "elevated" | "outlined" | "filled";
  className?: string;
  children: React.ReactNode;
}

// Using semantic theme-aware colors (CSS variables)
const variantClassNames: Record<CardProps["variant"] & string, string> = {
  elevated: "bg-bg-card",
  outlined: "bg-bg-card border border-border-default",
  filled: "bg-bg-subtle",
};

export function Card({
  variant = "elevated",
  className,
  children,
  style,
  ...props
}: CardProps) {
  return (
    <View
      className={cn("p-4 rounded-lg", variantClassNames[variant], className)}
      style={[style]}
      {...props}
    >
      {children}
    </View>
  );
}
