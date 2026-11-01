import { Button, type ButtonProps } from '@/components/ui/button'
import {
  Tooltip,
  type TooltipCreateHandle,
  TooltipPopup,
  TooltipTrigger
} from '@/components/ui/tooltip'

type SharedHandle = ReturnType<typeof TooltipCreateHandle<string>>

interface IconButtonProps extends ButtonProps {
  label: string
  /** For a button repeated hundreds of times: its tooltip is the one `SharedTooltip` draws. */
  tooltip?: SharedHandle
}

/** An icon alone says nothing to someone who has not learned it, so a label is required. */
export function IconButton({ label, tooltip, size = 'icon', ...props }: IconButtonProps) {
  const button = <Button size={size} aria-label={label} {...props} />
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
