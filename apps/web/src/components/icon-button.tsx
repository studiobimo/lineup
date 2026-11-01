import { Button, type ButtonProps } from '@/components/ui/button'
import {
  Tooltip,
  type TooltipCreateHandle,
  TooltipPopup,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

// The outline button's own hover is a 2% tint, which leaves one over an image see-through.
const SOLID_HOVER = 'hover:bg-control-hover data-pressed:bg-control-hover'

type SharedHandle = ReturnType<typeof TooltipCreateHandle<string>>

interface IconButtonProps extends ButtonProps {
  label: string
  /** For a button repeated hundreds of times: its tooltip is the one `SharedTooltip` draws. */
  tooltip?: SharedHandle
}

/** An icon alone says nothing to someone who has not learned it, so a label is required. */
export function IconButton({
  label,
  tooltip,
  size = 'icon',
  className,
  ...props
}: IconButtonProps) {
  const button = (
    <Button size={size} aria-label={label} className={cn(SOLID_HOVER, className)} {...props} />
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
