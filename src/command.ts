import * as core from '@actions/core'
import * as exec from '@actions/exec'

interface ExecResult {
  exitCode: number
  stderr: string
  stdout: string
}

type CliArgument = BuildlessArgument | string

class CliError extends Error {
  result: ExecResult
  bin: string
  cmd: BuildlessCommand
  args: CliArgument[]
  mainArgs: BuildlessArgument[]

  constructor(
    result: ExecResult,
    bin: string,
    cmd: BuildlessCommand,
    args: CliArgument[],
    mainArgs: BuildlessArgument[]
  ) {
    super('CLI call failed')
    this.result = result
    this.bin = bin
    this.cmd = cmd
    this.args = args
    this.mainArgs = mainArgs
  }
}

async function execBuildless(
  bin: string,
  cmd: BuildlessCommand,
  args: CliArgument[] = [],
  mainArgs: BuildlessArgument[] = []
): Promise<ExecResult> {
  const subcommand = cmd.split(' ')
  if (core.isDebug() && !mainArgs.includes(BuildlessArgument.VERBOSE)) {
    mainArgs.push(BuildlessArgument.VERBOSE)
  }
  const effectiveArgs = ((mainArgs as string[]) || [])
    .concat(subcommand)
    .concat(args)
  core.debug(`Executing: bin=${bin}, args=${effectiveArgs}`)
  const result = await exec.getExecOutput(`"${bin}"`, effectiveArgs)
  if (result.exitCode !== 0) {
    throw new CliError(result, bin, cmd, args, mainArgs)
  }
  return result
}

/**
 * Enumerates available commands which can be run with the Buildless CLI tool.
 */
export enum BuildlessCommand {
  // Install the agent.
  AGENT_INSTALL = 'agent install',

  // Start the agent.
  AGENT_START = 'agent start',

  // Stop the agent.
  AGENT_STOP = 'agent stop',

  // Get current agent status.
  AGENT_STATUS = 'agent status',

  // Print version and exit.
  VERSION = '--version'
}

/**
 * Enumerates well-known arguments that can be passed to the Buildless CLI tool.
 */
export enum BuildlessArgument {
  DEBUG = '--debug=true',
  VERBOSE = '--verbose=true'
}

/**
 * Ask the Buildless CLI to install the Buildless Agent.
 *
 * @param bin Path to the Buildless CLI tools binary.
 * @return Promise which resolves to an answer about whether the agent installed.
 */
export async function agentInstall(bin: string): Promise<boolean> {
  core.debug(`Triggering agent install via CLI`)
  return (
    (
      await execBuildless(bin, BuildlessCommand.AGENT_INSTALL, [
        '--background=true'
      ])
    ).exitCode === 0
  )
}

/**
 * Ask the Buildless CLI for agent status.
 *
 * @param bin Path to the Buildless CLI tools binary.
 * @return Promise which resolves to an answer about whether the agent installed.
 */
export async function agentStatus(bin: string): Promise<boolean> {
  core.debug(`Obtaining agent status via CLI`)
  const result = (
    await execBuildless(bin, BuildlessCommand.AGENT_STATUS)
  ).stdout
    .trim()
    .replaceAll('%0A', '')
    .includes('installed, running, and ready')
  if (result) {
    core.debug('Agent is currently running')
  } else {
    core.debug('Agent is not currently running')
  }
  return result
}

/**
 * Ask the Buildless CLI to start the agent.
 *
 * @param bin Path to the Buildless CLI tools binary.
 * @return Promise which resolves to an answer about whether the agent installed.
 */
export async function agentStart(bin: string): Promise<boolean> {
  core.debug(`Starting agent via CLI`)
  return (await execBuildless(bin, BuildlessCommand.AGENT_START)).exitCode === 0
}

/**
 * Ask the Buildless CLI to stop the agent.
 *
 * @param bin Path to the Buildless CLI tools binary.
 * @return Promise which resolves to an answer about whether the agent installed.
 */
export async function agentStop(bin: string): Promise<boolean> {
  core.debug(`Stopping agent via CLI`)
  return (await execBuildless(bin, BuildlessCommand.AGENT_STOP)).exitCode === 0
}

/**
 * Interrogate the specified binary to obtain the version.
 *
 * @param bin Path to the Buildless CLI tools binary.
 * @return Promise which resolves to the obtained version.
 */
export async function obtainVersion(bin: string): Promise<string> {
  core.debug(`Obtaining version of Buildless binary at: ${bin}`)
  return (
    await exec.getExecOutput(`"${bin}"`, [BuildlessCommand.VERSION])
  ).stdout
    .trim()
    .replaceAll('%0A', '')
    .replaceAll('Buildless ', '')
}
