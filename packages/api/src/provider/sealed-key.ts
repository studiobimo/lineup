import { decodeBase64, decodeBase64Url, encodeBase64Url } from 'hono/utils/encode'

const SECRET_PREFIX = 'PROVIDER_KEY_SECRET_V'
const IV_BYTES = 12

export interface SealedKey {
  key: string
  last4: string
  expiresAt: string
  profileId: string
  canPost: boolean
}

export type SecretEnv = { [name: `${typeof SECRET_PREFIX}${number}`]: string | undefined }

const secretVersion = (env: SecretEnv) =>
  Math.max(
    ...Object.keys(env)
      .filter((name) => name.startsWith(SECRET_PREFIX))
      .map((name) => Number(name.slice(SECRET_PREFIX.length)))
  )

function cipherKey(env: SecretEnv, version: number) {
  const secret = env[`${SECRET_PREFIX}${version}`]
  if (!secret) return undefined
  return crypto.subtle.importKey('raw', decodeBase64(secret), 'AES-GCM', false, [
    'encrypt',
    'decrypt'
  ])
}

const additionalData = (version: number) => new TextEncoder().encode(`v${version}`)

export async function seal(sealed: SealedKey, env: SecretEnv) {
  const version = secretVersion(env)
  const key = await cipherKey(env, version)
  if (!key) throw new Error('No provider key secret is set')
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: additionalData(version) },
    key,
    new TextEncoder().encode(JSON.stringify(sealed))
  )
  return [version, encodeBase64Url(iv.buffer), encodeBase64Url(cipher)].join('.')
}

export async function unseal(value: string, env: SecretEnv): Promise<SealedKey | undefined> {
  const [version, iv, cipher] = value.split('.')
  const key = await cipherKey(env, Number(version))
  if (!key || !iv || !cipher) return undefined
  try {
    const plain = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: decodeBase64Url(iv),
        additionalData: additionalData(Number(version))
      },
      key,
      decodeBase64Url(cipher)
    )
    const sealed = JSON.parse(new TextDecoder().decode(plain)) as SealedKey
    return Date.parse(sealed.expiresAt) > Date.now() ? sealed : undefined
  } catch {
    return undefined
  }
}
