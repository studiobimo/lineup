import { z } from 'zod'

import { instagram } from '@/features/planner/network-profile'

export const postFormSchema = z.object({
  caption: z.string().max(instagram.captionLimit),
  when: z.string().refine((time) => Date.parse(time) > Date.now())
})

export type PostFormValues = z.infer<typeof postFormSchema>
