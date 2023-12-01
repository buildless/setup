import * as core from '@actions/core'
import path from 'path'
import fs from 'fs'
import { OS } from './config'
import { agentStart, agentStop, agentStatus, agentInstall } from './command'
export { agentStart, agentStop, agentStatus, agentInstall } from './command'

/**
 * Describes a single endpoint provided by the Buildless Agent.
 */
export interface AgentEndpoint {
  port: number
  socket?: string
}

/**
 * Shape of agent JSON configuration.
 */
export interface AgentConfig extends AgentEndpoint {
  pid: number
  control: AgentEndpoint
}

// Maps each OS to the expected location of the agent JSON config.
export const agentConfigPathMap = {
  [OS.WINDOWS]: 'C:\\ProgramData\\buildless\\buildless-agent.json',
  [OS.LINUX]: '/var/tmp/buildless/buildless-agent.json',
  [OS.MACOS]: '/var/tmp/buildless/buildless-agent.json'
}

let activeAgent: AgentConfig | null
let queriedForAgent = false

/**
 * Read any available agent configuration for the provided OS, or return `null`.
 *
 * @param os OS to read configuration for.
 * @return Configuration (resolved from the known location), or `null`.
 */
async function resolveAgentConfig(os: OS): Promise<AgentConfig | null> {
  const path = agentConfigPathMap[os]
  if (path && fs.existsSync(path)) {
    try {
      const data = fs.readFileSync(path, 'utf8')
      return JSON.parse(data) as AgentConfig
    } catch (err) {
      console.error('Failed to read existing agent config:', err)
      return null
    }
  }
  return null
}

/**
 * Read any available agent configuration for the provided OS, or return `null`;
 * this version memoizes the first call to read the configuration.
 *
 * @param os OS to read configuration for.
 * @return Configuration (resolved from the known location), or `null`.
 */
export async function agentConfig(os: OS): Promise<AgentConfig | null> {
  if (activeAgent === null && !queriedForAgent) {
    activeAgent = await resolveAgentConfig(os)
  }
  return activeAgent
}

export default {
  agentConfig,
  agentStart,
  agentStop,
  agentStatus,
  agentInstall
}
