import * as core from '@actions/core'

let cachedToken: string | null = null

/**
 * Obtain an ID token from the Actions runtime, or return `null`.
 *
 * @return Promise which resolves to the identity token or `null`.
 */
export async function obtainTokenOrFailGracefully(): Promise<string | null> {
  if (cachedToken) {
    return cachedToken
  }
  try {
    cachedToken = (await core.getIDToken()) || null
    return cachedToken
  } catch (err) {
    core.debug(`Failed to obtain ID token: ${err}`)
  }
  return null
}
