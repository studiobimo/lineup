// The one source of truth for the site's metadata: index.html takes it at build time,
// and the app imports it for page titles.
export const site = {
  name: 'Lineup',
  title: 'Lineup',
  description:
    'Plan your Instagram feed before it goes live: arrange, sort by colour, group into albums and schedule posts.',
  url: 'https://lineup.bimo.dev',
  ogImage: '/og.png',
  themeColor: '#ffffff',
  locale: 'en_US'
} as const
