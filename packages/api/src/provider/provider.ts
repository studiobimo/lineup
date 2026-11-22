import type {
  Account,
  NewPost,
  PostChanges,
  Profile,
  PublishedPost,
  ScheduledPost,
  Upload,
  UploadRequest
} from 'lineup-contract'

export interface Provider {
  profiles(): Promise<Profile[]>
  narrowed(profileId: string, days: number): Promise<string | undefined>
  canPost(): Promise<boolean>
  accounts(profileId: string): Promise<Account[]>
  connectUrl(profileId: string, returnTo: string): Promise<string>
  publishedPosts(accountId: string): Promise<PublishedPost[]>
  upload(request: UploadRequest): Promise<Upload>
  scheduledPosts(accountId: string): Promise<ScheduledPost[]>
  schedule(post: NewPost, idempotencyKey: string): Promise<ScheduledPost>
  update(id: string, changes: PostChanges): Promise<ScheduledPost>
  cancel(id: string): Promise<void>
}

export type ProviderFor = (key: string, baseUrl?: string) => Provider

export type ProviderFailure =
  'key' | 'forbidden' | 'missing' | 'limited' | 'refused' | 'busy' | 'down'

interface FailureDetails {
  detail?: string
  retryAfter?: number
}

export class ProviderError extends Error {
  readonly failure: ProviderFailure
  readonly details: FailureDetails

  constructor(failure: ProviderFailure, details: FailureDetails = {}) {
    super(failure)
    this.name = 'ProviderError'
    this.failure = failure
    this.details = details
  }
}
