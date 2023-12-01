// Version of the GitHub API to use.
export const GITHUB_API_VERSION = '2022-11-28'

// Default headers to send on GitHub API requests.
export const GITHUB_DEFAULT_HEADERS = {
  'X-GitHub-Api-Version': GITHUB_API_VERSION
}

// Global LB endpoint.
export const BUILDLESS_GLOBAL_ENDPOINT = 'https://global.less.build'

// Global Edge service endpoint.
export const BUILDLESS_EDGE_ENDPOINT = 'https://edge.less.build'

// Global Agent service endpoint.
export const BUILDLESS_AGENT_ENDPOINT = 'https://agent.less.build'

// Azure CDN cache.
export const BUILDLESS_AZR_ENDPOINT = 'https://azr.less.build'

// Transport modes.
export enum RpcTransport {
  CONNECT = 'CONNECT',
  GRPC = 'GRPC'
}

/**
 * Enumerates operating systems recognized by the action; presence in this enum does not
 * guarantee support.
 */
export enum OS {
  // Darwin/macOS.
  MACOS = 'darwin',

  // Linux.
  LINUX = 'linux',

  // Windows.
  WINDOWS = 'windows'
}

/**
 * Enumerates architectures recognized by the action; presence in this enum does not
 * guarantee support.
 */
export enum Arch {
  // AMD64 and x86_64.
  AMD64 = 'amd64',

  // ARM64 and aarch64.
  ARM64 = 'aarch64'
}

// Default transport mode.
export const TRANSPORT: RpcTransport = RpcTransport.GRPC

/**
 * Resolve the OS instance for the current (host) operating system.
 *
 * @returns Current OS enum instance.
 */
export function currentOs(): OS {
  switch (process.platform) {
    case 'darwin':
      return OS.MACOS
    case 'win32':
      return OS.WINDOWS
    default:
      return OS.LINUX
  }
}

export default {
  githubApiVersion: GITHUB_API_VERSION,
  githubDefaultHeaders: GITHUB_DEFAULT_HEADERS,
  endpointGlobal: BUILDLESS_GLOBAL_ENDPOINT,
  endpointAgent: BUILDLESS_AGENT_ENDPOINT,
  endpointEdge: BUILDLESS_EDGE_ENDPOINT,
  endpointGlobalAzr: BUILDLESS_AZR_ENDPOINT,
  transport: TRANSPORT
}
