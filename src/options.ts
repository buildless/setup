import os from 'node:os'
import path from 'node:path'

/**
 * Enumerates options and maps them to their well-known option names.
 */
export enum OptionName {
  VERSION = 'version',
  OS = 'os',
  ARCH = 'arch',
  EXPORT_PATH = 'export_path',
  SKIP_CACHE = 'skip_cache',
  CUSTOM_URL = 'custom_url',
  TOKEN = 'token',
  TENANT = 'tenant',
  TARGET = 'target',
  PROJECT = 'project',
  APIKEY = 'apikey',
  AGENT = 'agent',
  FORCE = 'force'
}

/**
 * Describes the interface provided by setup action configuration, once interpreted and once
 * defaults are applied.
 */
export interface BuildlessSetupActionOptions {
  // Desired version of Buildless; the special token `latest` resolves the latest version.
  version: string | 'latest'

  // Whether to setup Buildless on the PATH; defaults to `true`.
  export_path: boolean

  // Whether to enable the Buildless Agent.
  agent: boolean

  // Resolved API key to use for Buildless Cloud services.
  apikey?: string

  // Tenant ID to apply to cache traffic; optional.
  tenant?: string

  // Project ID to apply to cache traffic; optional.
  project?: string

  // Desired OS for the downloaded binary. If not provided, the current OS is resolved.
  os: 'darwin' | 'windows' | 'linux'

  // Desired arch for the downloaded binary. If not provided, the current arch is resolved.
  arch: 'amd64' | 'aarch64'

  // Directory path where Buildless should be installed; if none is provided, `~/buildless` is used.
  target: string

  // Skips the tool cache (defaults to `false`, meaning the cache is enabled by default).
  skip_cache: boolean

  // Whether to force installation if a copy of Buildless is already installed.
  force: boolean

  // Custom download URL to use in place of interpreted download URLs.
  custom_url?: string

  // Custom GitHub token to use, or the workflow's default token, if any.
  token?: string
}

/**
 * Default install prefix on Windows.
 */
export const windowsDefaultPath = 'C:\\Buildless'

/**
 * Default install prefix on macOS and Linux.
 */
export const nixDefaultPath = path.resolve(os.homedir(), 'buildless')

/**
 * Default Buildless configurations path on all platforms.
 */
export const configPath = path.resolve(os.homedir(), '.config', 'buildless')

/* istanbul ignore next */
const defaultTarget =
  process.platform === 'win32' ? windowsDefaultPath : nixDefaultPath

/**
 * Defaults to apply to all instances of the Buildless setup action.
 */
export const defaults: BuildlessSetupActionOptions = {
  version: 'latest',
  skip_cache: false,
  export_path: true,
  force: false,
  agent: true,
  apikey: undefined,
  tenant: undefined,
  project: undefined,
  os: normalizeOs(process.platform),
  arch: normalizeArch(process.arch),
  target: defaultTarget,
}

/**
 * Normalize the provided OS name or token into a recognized token.
 *
 * @param os Operating system name or token.
 * @return Normalized OS name.
 */
export function normalizeOs(os: string): 'darwin' | 'windows' | 'linux' {
  switch (os.trim().toLowerCase()) {
    case 'macos':
      return 'darwin'
    case 'mac':
      return 'darwin'
    case 'darwin':
      return 'darwin'
    case 'windows':
      return 'windows'
    case 'win':
      return 'windows'
    case 'win32':
      return 'windows'
    case 'linux':
      return 'linux'
  }
  /* istanbul ignore next */
  throw new Error(`Unrecognized OS: ${os}`)
}

/**
 * Normalize the provided architecture name or token into a recognized token.
 *
 * @param arch Architecture name or token.
 * @return Normalized architecture.
 */
export function normalizeArch(arch: string): 'amd64' | 'aarch64' {
  switch (arch.trim().toLowerCase()) {
    case 'x64':
      return 'amd64'
    case 'amd64':
      return 'amd64'
    case 'x86_64':
      return 'amd64'
    case 'aarch64':
      return 'aarch64'
    case 'arm64':
      return 'aarch64'
  }
  /* istanbul ignore next */
  throw new Error(`Unrecognized architecture: ${arch}`)
}

/**
 * Build a suite of action options from defaults and overrides provided by the user.
 *
 * @param opts Override options provided by the user.
 * @return Merged set of applicable options.
 */
export default function buildOptions(
  opts?: Partial<BuildlessSetupActionOptions>
): BuildlessSetupActionOptions {
  return {
    ...defaults,
    ...(opts || {}),
    ...{
      // force-normalize the OS and arch
      os: normalizeOs(opts?.os || defaults.os),
      arch: normalizeArch(opts?.arch || defaults.arch),
      apikey: opts?.apikey || process.env.BUILDLESS_API_KEY || undefined,
    }
  } satisfies BuildlessSetupActionOptions
}
