import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { site } from '@/config/site'
import { cn } from '@/lib/utils'

const sans = 'Space Grotesk'
const display = 'Bitcount Prop Double'
const pixel = 'Bitcount Single'
const mono = 'System monospace'

const families = [
  { name: sans, token: 'font-sans', className: 'font-sans text-xl' },
  { name: display, token: 'font-display', className: 'font-display text-2xl' },
  { name: pixel, token: 'font-pixel', className: 'font-pixel text-2xl' },
  { name: mono, token: 'font-mono', className: 'font-mono text-lg' }
]

const sansWeights = [
  { value: 300, className: 'font-light' },
  { value: 400, className: 'font-normal' },
  { value: 500, className: 'font-medium' },
  { value: 600, className: 'font-semibold' },
  { value: 700, className: 'font-bold' }
]

const bitcountWeights = [
  { value: 100, className: 'font-thin' },
  { value: 200, className: 'font-extralight' },
  ...sansWeights,
  { value: 800, className: 'font-extrabold' },
  { value: 900, className: 'font-black' }
].sort((a, b) => a.value - b.value)

const weightSets = [
  { name: sans, family: 'font-sans', weights: sansWeights },
  { name: display, family: 'font-display', weights: bitcountWeights },
  { name: pixel, family: 'font-pixel', weights: bitcountWeights }
]

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 border-t py-4 sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-6">
      <p className="font-mono text-xs text-muted-foreground sm:pt-1.5">{label}</p>
      <div className="min-w-0 wrap-break-word">{children}</div>
    </div>
  )
}

function Styles() {
  const { t } = useTranslation()
  return (
    <section>
      <Row label={`h1 · ${display} · 400`}>
        <h1 className="text-4xl">{t('home.title', { name: site.name })}</h1>
      </Row>
      <Row label={`h2 · ${pixel} · 400`}>
        <h2 className="text-3xl">{t('specimen.h2')}</h2>
      </Row>
      <Row label={`h3 · ${pixel} · 400`}>
        <h3 className="text-2xl">{t('specimen.h3')}</h3>
      </Row>
      <Row label={`h4 · ${sans} · 600`}>
        <h4 className="text-xl">{t('specimen.h4')}</h4>
      </Row>
      <Row label={`h5 · ${sans} · 600`}>
        <h5 className="text-lg">{t('specimen.h5')}</h5>
      </Row>
      <Row label={`h6 · ${sans} · 600`}>
        <h6 className="text-base">{t('specimen.h6')}</h6>
      </Row>
      <Row label={`lead · ${sans} · 400`}>
        <p className="text-lg text-muted-foreground">{t('home.description')}</p>
      </Row>
      <Row label={`p · ${sans} · 400`}>
        <p>{t('specimen.paragraph')}</p>
      </Row>
      <Row label={`small · ${sans} · 400`}>
        <small className="text-sm text-muted-foreground">{t('specimen.small')}</small>
      </Row>
      <Row label={`strong · ${sans} · 700`}>
        <p>
          <strong>{t('specimen.strong')}</strong>
        </p>
      </Row>
      <Row label={`a · ${sans} · 400`}>
        <a href="#top" className="underline underline-offset-4">
          {t('specimen.link')}
        </a>
      </Row>
      <Row label={`blockquote · ${sans} · 400`}>
        <blockquote className="border-l-2 pl-4 text-lg">{t('specimen.quote')}</blockquote>
      </Row>
      <Row label={`code · ${mono} · 400`}>
        <code className="rounded-sm bg-muted px-1.5 py-0.5 text-sm">{t('specimen.code')}</code>
      </Row>
      <Row label={`kbd · ${sans} · 500`}>
        <Kbd>{t('specimen.kbd')}</Kbd>
      </Row>
      <Row label={`button · ${sans} · 500`}>
        <div className="flex flex-wrap gap-2">
          <Button>{t('specimen.primary')}</Button>
          <Button variant="outline">{t('specimen.secondary')}</Button>
        </div>
      </Row>
    </section>
  )
}

function Families() {
  const { t } = useTranslation()
  return (
    <section className="mt-12">
      <h2 className="mb-4 text-3xl">{t('specimen.families')}</h2>
      {families.map(({ name, token, className }) => (
        <Row key={token} label={`${token} · ${name}`}>
          <p className={className}>{t('specimen.alphabet')}</p>
        </Row>
      ))}
    </section>
  )
}

function Weights() {
  const { t } = useTranslation()
  return (
    <section className="mt-12">
      <h2 className="mb-4 text-3xl">{t('specimen.weights')}</h2>
      {weightSets.map(({ name, family, weights }) => (
        <Row key={family} label={name}>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            {weights.map(({ value, className }) => (
              <li key={value}>
                <span className="block font-mono text-xs text-muted-foreground">{value}</span>
                <span className={cn(family, className, 'text-2xl')}>{site.name}</span>
              </li>
            ))}
          </ul>
        </Row>
      ))}
    </section>
  )
}

/** Every type style on one page, at /type, for reviewing the fonts in place. */
export function TypeSpecimen() {
  return (
    <div id="top" className="mx-auto max-w-4xl scroll-mt-14 p-4 sm:p-8">
      <Styles />
      <Families />
      <Weights />
    </div>
  )
}
