import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { AppProviders } from './components/app-providers'
import './i18n/config'
import { startTheme } from './lib/theme'
import { updateOnDeploy } from './lib/update-on-deploy'
import { createAppRouter } from './router'
import './index.css'

startTheme()
updateOnDeploy()

const router = createAppRouter()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>
)
