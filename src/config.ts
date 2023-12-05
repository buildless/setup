import * as http from '@actions/http-client'

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
  idTokenRequestToken: process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN || undefined,
  idTokenRequestUrl: process.env.ACTIONS_ID_TOKEN_REQUEST_URL || undefined,
  runtimeToken: process.env.ACTIONS_RUNTIME_TOKEN || undefined,
  runtimeTokenUrl: process.env.ACTIONS_RUNTIME_URL || undefined,
  githubEnvFile: process.env.GITHUB_ENV || undefined,
  githubEventName: process.env.GITHUB_EVENT_NAME || undefined,
  githubEventPath: process.env.GITHUB_EVENT_PATH || undefined,
  githubJobName: process.env.GITHUB_JOB || undefined,
  githubActionRef: process.env.GITHUB_ACTION_REF || undefined,
  githubRunId: process.env.GITHUB_RUN_ID || undefined,
  githubRunNumber: process.env.GITHUB_RUN_NUMBER || undefined,
  githubSha: process.env.GITHUB_SHA || undefined,
  githubWorkflow: process.env.GITHUB_WORKFLOW || undefined,
  githubWorkflowRef: process.env.GITHUB_WORKFLOW_REF || undefined,
  githubWorkflowSha: process.env.GITHUB_WORKFLOW_SHA || undefined,
  invocationId: process.env.INVOCATION_ID || undefined,
  imageOs: process.env.ImageOS || undefined,
  imageVersion: process.env.ImageVersion || undefined,
  runnerArch: process.env.RUNNER_ARCH || undefined,
  runnerDebug: process.env.RUNNER_DEBUG === '1',
  runnerEnvironment: process.env.RUNNER_ENVIRONMENT || undefined,
  runnerName: process.env.RUNNER_NAME || undefined,
  runnerOs: process.env.RUNNER_OS || undefined,
  runnerTemp: process.env.RUNNER_TEMP || undefined,
  runnerUser: process.env.RUNNER_USER || undefined,
  runnerWorkspace: process.env.RUNNER_WORKSPACE || undefined
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

const userAgentSegments = [
  `Buildless/GithubActions/${process.env.GITHUB_ACTION_REF || 'v1'}`,
  process.env.GITHUB_REPOSITORY || 'unknown-repo'
]

const userAgent = userAgentSegments.join(' ')

export const httpClient = new http.HttpClient(userAgent, [], {
  allowRetries: true,
  maxRetries: 3
})

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
