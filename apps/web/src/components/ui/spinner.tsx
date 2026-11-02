import { Loader2Icon } from "lucide-react";
import type React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export function Spinner({
  className,
  ...props
}: React.ComponentProps<typeof Loader2Icon>): React.ReactElement {
  const { t } = useTranslation();
  return (
    <Loader2Icon
      aria-label={t("loading")}
      className={cn("animate-spin", className)}
      role="status"
      {...props}
    />
  );
}
