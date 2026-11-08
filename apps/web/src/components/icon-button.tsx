import { Button, type ButtonProps } from '@/components/ui/button'
import {
  Tooltip,
  type TooltipCreateHandle,
  TooltipPopup,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const SOLID_HOVER = 'hover:bg-control-hover data-pressed:bg-control-hover'

type SharedHandle = ReturnType<typeof TooltipCreateHandle<string>>

interface IconButtonProps extends ButtonProps {
  label: string
  tooltip?: SharedHandle
}

export function IconButton({
  label,
  tooltip,
  size = 'icon',
  variant,
  className,
  ...props
}: IconButtonProps) {
  const button = (
    <Button
      size={size}
      variant={variant}
      aria-label={label}
      className={cn(variant === 'outline' && SOLID_HOVER, className)}
      {...props}
    />
  )
  if (tooltip) return <TooltipTrigger handle={tooltip} payload={label} render={button} />
  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipPopup>{label}</TooltipPopup>
    </Tooltip>
  )
}

export function SharedTooltip({ handle }: { handle: SharedHandle }) {
  return (
    <Tooltip handle={handle}>{({ payload }) => <TooltipPopup>{payload}</TooltipPopup>}</Tooltip>
  )
}
