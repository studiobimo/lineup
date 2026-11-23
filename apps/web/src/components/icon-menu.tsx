import type { ComponentProps, ReactNode, Ref } from 'react'

import { IconButton } from '@/components/icon-button'
import { Menu, MenuItem, MenuPopup, MenuTrigger } from '@/components/ui/menu'

interface IconMenuItem {
  label: string
  onClick: () => void
  disabled?: boolean
  variant?: ComponentProps<typeof MenuItem>['variant']
}

interface IconMenuProps {
  label: string
  icon: ReactNode
  items: IconMenuItem[]
  disabled?: boolean
  align?: ComponentProps<typeof MenuPopup>['align']
  triggerRef?: Ref<HTMLButtonElement>
  triggerProps?: Pick<ComponentProps<typeof IconButton>, 'variant' | 'size'>
}

export function IconMenu({
  label,
  icon,
  items,
  disabled,
  align,
  triggerRef,
  triggerProps
}: IconMenuProps) {
  return (
    <Menu>
      <MenuTrigger
        disabled={disabled}
        render={
          <IconButton ref={triggerRef} label={label} {...triggerProps}>
            {icon}
          </IconButton>
        }
      />
      <MenuPopup align={align}>
        {items.map(({ label: itemLabel, ...item }) => (
          <MenuItem key={itemLabel} {...item}>
            {itemLabel}
          </MenuItem>
        ))}
      </MenuPopup>
    </Menu>
  )
}
