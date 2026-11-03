import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { usePageTitle } from '@/hooks/use-page-title'

type LegalName = 'privacy' | 'terms'

interface Section {
  heading: string
  paragraphs: string[]
}

const other = {
  privacy: { name: 'terms', to: '/terms' },
  terms: { name: 'privacy', to: '/privacy' }
} as const

export function LegalPage({ name }: { name: LegalName }) {
  const { t } = useTranslation('legal')
  const sections = t(`${name}.sections`, { returnObjects: true }) as Section[]
  const title = t(`${name}.title`)
  usePageTitle(title)
  return (
    <article className="mx-auto max-w-prose px-gutter py-10">
      <h1 className="font-heading text-3xl">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t('updated')}</p>
      <p className="mt-6">{t(`${name}.summary`)}</p>
      {sections.map(({ heading, paragraphs }) => (
        <section key={heading} className="mt-8">
          <h2 className="font-heading text-xl">{heading}</h2>
          {paragraphs.map((paragraph) => (
            <p key={paragraph} className="mt-3 text-muted-foreground">
              {paragraph}
            </p>
          ))}
        </section>
      ))}
      <footer className="mt-10 border-t pt-4 text-sm">
        <Link to={other[name].to} className="underline underline-offset-4">
          {t(`${other[name].name}.title`)}
        </Link>
      </footer>
    </article>
  )
}
