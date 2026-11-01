import { site } from '@/config/site'
import i18n from '@/i18n/config'

export type LegalName = 'privacy' | 'terms'

export const legalHead = (name: LegalName) => () => ({
  meta: [{ title: `${i18n.t(`legal:${name}.title`)} · ${site.name}` }]
})
