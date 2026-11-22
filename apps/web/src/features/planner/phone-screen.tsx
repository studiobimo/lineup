import {
  BatteryFull,
  ChevronDown,
  CircleUser,
  Clapperboard,
  Grid3x3,
  House,
  Layers,
  Menu,
  Search,
  Signal,
  SquarePlus,
  SquareUser,
  Wifi
} from 'lucide-react'
import { type RefObject, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PublishedPicture } from '@/features/provider/published-picture'
import { useConnectedAccount } from '@/features/provider/use-connected-account'
import { dateTimeFormat } from '@/i18n/format'
import { cn } from '@/lib/utils'

import { cellShape, gridColumns, instagram } from './network-profile'
import { usePlanner } from './planner'
import { useProfile } from './profile-store'
import { CellThumbnail } from './thumbnail'
import { useNearViewport } from './use-near-viewport'

const MINIMUM_SLOTS = instagram.columns * 3

function phoneTime() {
  return dateTimeFormat({ hour: 'numeric', minute: '2-digit' })
    .formatToParts(new Date())
    .filter(({ type }) => type !== 'dayPeriod')
    .map(({ value }) => value)
    .join('')
    .trim()
}

function useClock() {
  const [time, setTime] = useState(phoneTime)
  useEffect(() => {
    const tick = setInterval(() => setTime(phoneTime()), 1000)
    return () => clearInterval(tick)
  }, [])
  return time
}

function StatusBar() {
  const time = useClock()
  return (
    <div className="flex h-[3.375rem] shrink-0 items-center justify-between px-8 pt-3 text-[0.9375rem] font-semibold">
      <span>{time}</span>
      <span className="flex items-center gap-1 [&_svg]:size-[1.0625rem]">
        <Signal />
        <Wifi />
        <BatteryFull />
      </span>
    </div>
  )
}

function NavBar({ handle }: { handle?: string }) {
  const { t } = useTranslation('planner')
  return (
    <div className="flex h-11 shrink-0 items-center justify-between gap-4 px-4">
      <span className="flex min-w-0 items-center gap-1 text-xl font-bold">
        <span className="truncate">{handle || t('phone.username')}</span>
        <ChevronDown className="size-4 shrink-0" />
      </span>
      <span className="flex items-center gap-5 [&_svg]:size-6">
        <SquarePlus />
        <Menu />
      </span>
    </div>
  )
}

function Blank({ className }: { className: string }) {
  return <span className={cn('block rounded-full bg-foreground/10', className)} />
}

function Stat({ value, label }: { value?: number; label: string }) {
  return (
    <span className="flex flex-col gap-0.5">
      <span className="flex h-6 items-center font-semibold">
        {value ?? <Blank className="h-3.5 w-8" />}
      </span>
      <span className="text-[0.8125rem]">{label}</span>
    </span>
  )
}

interface ProfileProps {
  name?: string
  avatarUrl?: string
  posts: number
  followers?: number
}

function Profile({ name, avatarUrl, posts, followers }: ProfileProps) {
  const { t } = useTranslation('planner')
  return (
    <div className="flex flex-col gap-3 px-4 pt-2 pb-4">
      <div className="flex items-center gap-7">
        <span className="size-[5.375rem] shrink-0 overflow-hidden rounded-full bg-foreground/10">
          {avatarUrl && (
            <img
              src={avatarUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="size-full object-cover"
            />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-sm font-semibold">{name || t('phone.displayName')}</span>
          <span className="flex justify-between">
            <Stat value={posts} label={t('phone.posts', { count: posts })} />
            <Stat value={followers} label={t('phone.followers')} />
            <Stat label={t('phone.following')} />
          </span>
        </span>
      </div>
      <span className="flex flex-col gap-2">
        <Blank className="h-3 w-4/5" />
        <Blank className="h-3 w-1/2" />
      </span>
      <span className="grid grid-cols-2 gap-1.5 text-sm font-semibold">
        <span className="rounded-lg bg-foreground/10 py-1.5 text-center">
          {t('phone.editProfile')}
        </span>
        <span className="rounded-lg bg-foreground/10 py-1.5 text-center">
          {t('phone.shareProfile')}
        </span>
      </span>
    </div>
  )
}

function ProfileTabs() {
  return (
    <div className="sticky top-0 z-10 grid grid-cols-3 border-b bg-feed">
      <span className="-mb-px flex justify-center border-b border-foreground py-2.5">
        <Grid3x3 className="size-6" />
      </span>
      <span className="flex justify-center py-2.5 text-muted-foreground">
        <Clapperboard className="size-6" />
      </span>
      <span className="flex justify-center py-2.5 text-muted-foreground">
        <SquareUser className="size-6" />
      </span>
    </div>
  )
}

function TabBar() {
  return (
    <div className="relative flex h-[5.1875rem] shrink-0 justify-around border-t bg-feed pt-3 [&_svg]:size-6">
      <House />
      <Search />
      <SquarePlus />
      <Clapperboard />
      <CircleUser />
      <span className="absolute bottom-2 left-1/2 h-[0.3125rem] w-[8.375rem] -translate-x-1/2 rounded-full bg-foreground" />
    </div>
  )
}

function PreviewCell({ id, position }: { id: string; position: number }) {
  const { t } = useTranslation('planner')
  const cell = useRef<HTMLDivElement>(null)
  const near = useNearViewport(cell)
  const album = usePlanner(({ board }) => board.albums?.[id] !== undefined)
  return (
    <div ref={cell} className="relative bg-foreground/5" style={cellShape}>
      {near && <CellThumbnail id={id} label={t('cell', { position })} />}
      {album && (
        <Layers aria-hidden className="absolute top-2 right-2 size-4 text-on-photo drop-shadow" />
      )}
    </div>
  )
}

export function PhoneScreen({ feed }: { feed: RefObject<HTMLDivElement | null> }) {
  const { t } = useTranslation('planner')
  const grid = usePlanner(({ board }) => board.grid)
  const typed = useProfile()
  const { account, published } = useConnectedAccount()
  const posts = grid.length + published.length
  const emptySlots = Math.max(0, MINIMUM_SLOTS - posts)
  return (
    <div className="flex h-full flex-col bg-feed font-[system-ui] text-foreground">
      <div aria-hidden className="contents">
        <StatusBar />
        <NavBar handle={account?.username ?? typed.handle} />
      </div>
      <div
        ref={feed}
        data-scroll-root
        role="region"
        aria-label={t('phoneFeed')}
        tabIndex={0}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain outline-none [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <div aria-hidden className="contents">
          <Profile
            name={account?.displayName ?? typed.name}
            avatarUrl={account?.avatarUrl}
            posts={posts}
            followers={account?.followers}
          />
          <ProfileTabs />
        </div>
        <div className="grid gap-0.5" style={gridColumns}>
          {grid.map((id, index) => (
            <PreviewCell key={id} id={id} position={index + 1} />
          ))}
          {published.map((post, index) => (
            <div key={post.id} className="bg-foreground/5" style={cellShape}>
              <PublishedPicture
                post={post}
                label={t('cell', { position: grid.length + index + 1 })}
              />
            </div>
          ))}
          {Array.from({ length: emptySlots }, (_, slot) => (
            <div key={slot} data-empty-slot className="bg-foreground/5" style={cellShape} />
          ))}
        </div>
      </div>
      <div aria-hidden className="contents">
        <TabBar />
      </div>
    </div>
  )
}
