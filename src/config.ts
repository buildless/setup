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

// Global CLI service endpoint.
export const BUILDLESS_CLI_ENDPOINT = 'https://cli.less.build'

// Azure CDN cache.
export const BUILDLESS_AZR_ENDPOINT = 'https://azr.less.build'

// Asset download endpoint.
export const BUILDLESS_DOWNLOAD_ENDPOINT = 'https://dl.less.build'

// Actions Runtime-provided environment material.
export const actionEnv = {
  idTokenRequestToken: process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN || null,
  idTokenRequestUrl: process.env.ACTIONS_ID_TOKEN_REQUEST_URL || null,
  runtimeToken: process.env.ACTIONS_RUNTIME_TOKEN || null,
  runtimeTokenUrl: process.env.ACTIONS_RUNTIME_URL || null,
  githubEnvFile: process.env.GITHUB_ENV || null,
  githubEventName: process.env.GITHUB_EVENT_NAME || null,
  githubEventPath: process.env.GITHUB_EVENT_PATH || null,
  githubJobName: process.env.GITHUB_JOB || null,
  githubActionRef: process.env.GITHUB_ACTION_REF || null,
  githubRunId: process.env.GITHUB_RUN_ID || null,
  githubRunNumber: process.env.GITHUB_RUN_NUMBER || null,
  githubSha: process.env.GITHUB_SHA || null,
  githubWorkflow: process.env.GITHUB_WORKFLOW || null,
  githubWorkflowRef: process.env.GITHUB_WORKFLOW_REF || null,
  githubWorkflowSha: process.env.GITHUB_WORKFLOW_SHA || null,
  invocationId: process.env.INVOCATION_ID || null,
  imageOs: process.env.ImageOS || null,
  imageVersion: process.env.ImageVersion || null,
  runnerArch: process.env.RUNNER_ARCH || null,
  runnerDebug: process.env.RUNNER_DEBUG || null,
  runnerEnvironment: process.env.RUNNER_ENVIRONMENT || null,
  runnerName: process.env.RUNNER_NAME || null,
  runnerOs: process.env.RUNNER_OS || null,
  runnerTemp: process.env.RUNNER_TEMP || null,
  runnerUser: process.env.RUNNER_USER || null,
  runnerWorkspace: process.env.RUNNER_WORKSPACE || null,
}

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
