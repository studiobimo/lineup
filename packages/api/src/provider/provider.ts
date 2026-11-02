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

/** Everything Lineup asks of a provider, so that a second one means no change above this line. */
export interface Provider {
  profiles(): Promise<Profile[]>
  /** A key limited to one profile and to what Lineup uses. Nothing, if this key cannot make one. */
  narrowed(profileId: string, days: number): Promise<string | undefined>
  /** Whether this key can post, asked in a way that changes nothing at the provider. */
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

export type ProviderFor = (key: string) => Provider

export type ProviderFailure =
  'key' | 'forbidden' | 'missing' | 'limited' | 'refused' | 'busy' | 'down'

interface FailureDetails {
  /** In the provider's words. Shown only for a refusal, which a person has to act on. */
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
