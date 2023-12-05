import fs from 'node:fs'
import path from 'node:path'
import * as io from '@actions/io'
import childProcess, { StdioOptions } from 'node:child_process'
import { v4 as uuidv4 } from 'uuid'

import * as core from '@actions/core'
import * as exec from '@actions/exec'
import { agentConfig } from './agent'
import { error as sendError } from './diagnostics'
import wait from './wait'

// Whether to spawn the agent directly (in Node), or through the CLI.
const SPAWN_DIRECT = true

interface RunResult {
  success: boolean
}

interface ExecResult extends RunResult {
  exitCode: number
  stderr: string
  stdout: string
}

interface BackgroundExecResult extends RunResult {
  pid: number
}

interface LowLevelSpawnOptions {
  stdio?: StdioOptions
  shell?: boolean
}

interface SpawnOptions {
  sudo?: boolean
  background?: boolean
  spawnOptions?: LowLevelSpawnOptions
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

async function execBin(
  cmd: BuildlessCommand,
  args: CliArgument[] = [],
  mainArgs: BuildlessArgument[] = [],
  spawnOptions: Partial<SpawnOptions> = {}
): Promise<ExecResult | BackgroundExecResult> {
  const bin = buildlessBin()
  const subcommand = cmd.split(' ')
  if (core.isDebug() && !mainArgs.includes(BuildlessArgument.VERBOSE)) {
    mainArgs.push(BuildlessArgument.VERBOSE)
  }
  const effectiveArgs = ((mainArgs as string[]) || [])
    .concat(subcommand)
    .concat(args)

  if (spawnOptions && spawnOptions.background) {
    core.debug(`Background spawn: bin=${bin} args=${effectiveArgs}`)
    const spawned = childProcess.spawn(bin, effectiveArgs, {
      detached: true,
      windowsHide: true,
      stdio: spawnOptions?.spawnOptions?.stdio || 'ignore',
      ...(spawnOptions?.spawnOptions || {})
    })
    spawned.on('error', err => {
      console.error('Failed to start subprocess: ', err)
    })
    const pid = spawned.pid
    if (!spawned || pid === undefined) {
      throw new Error('Failed to launch child process, or PID was undefined')
    }
    spawned.unref()
    return {
      success: true,
      pid
    }
  } else {
    if (spawnOptions.sudo) {
      core.debug(`Executing with sudo rights: bin=${bin} args=${effectiveArgs}`)
      const sudobin = await io.which('sudo')
      if (!sudobin) {
        core.notice(
          'Buildless cannot execute the agent service without sudo rights.'
        )
      }
      const sudoargs = ['${bin}']
      const result = await exec.getExecOutput(
        sudobin,
        sudoargs.concat(effectiveArgs)
      )
      if (result.exitCode !== 0) {
        throw new CliError(
          { ...result, success: false },
          bin,
          cmd,
          args,
          mainArgs
        )
      }
      return { ...result, success: true }
    } else {
      core.debug(`Executing: bin=${bin}, args=${effectiveArgs}`)
      const result = await exec.getExecOutput(`"${bin}"`, effectiveArgs)
      if (result.exitCode !== 0) {
        throw new CliError(
          { ...result, success: false },
          bin,
          cmd,
          args,
          mainArgs
        )
      }
      return { ...result, success: true }
    }
  }
}

export async function execBuildless(
  cmd: BuildlessCommand,
  args: CliArgument[] = [],
  mainArgs: BuildlessArgument[] = [],
  sudo = false
): Promise<ExecResult> {
  // execute and return directly
  return (await execBin(cmd, args, mainArgs, { sudo })) as ExecResult
}

export async function spawnInBackground(
  cmd: BuildlessCommand,
  args: CliArgument[] = [],
  mainArgs: BuildlessArgument[] = [],
  spawnOptions: object = {}
): Promise<BackgroundExecResult> {
  return (await execBin(cmd, args, mainArgs, {
    background: true,
    spawnOptions
  })) as BackgroundExecResult
}

let cachedBin: string | null = null

function buildlessBin(): string {
  if (!cachedBin) throw new Error('cannot run command before binary is ready')
  return cachedBin
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

  // Run the agent directly.
  AGENT_RUN = 'agent run',

  // Print version and exit.
  VERSION = '--version'
}

/**
 * Enumerates well-known arguments that can be passed to the Buildless CLI tool.
 */
export enum BuildlessArgument {
  DEBUG = '--debug=true',
  VERBOSE = '--verbose=true',
  BACKGROUND = '--background'
}

function ensureTempParentExists(filepath: string): string {
  const parent = path.dirname(filepath)
  if (!fs.existsSync(parent)) {
    core.debug(`Creating temporary directory: ${parent}`)
    fs.mkdirSync(parent, {
      recursive: true
    })
  }
  return filepath
}

function tempPathForOs(filename: string, prefix?: string): string {
  if (process.platform === 'win32') {
    const pathPrefix = prefix || 'C:\\ProgramData\\buildless'
    return ensureTempParentExists(`${pathPrefix}\\${filename}`)
  }
  const pathPrefix = prefix || '/var/tmp'
  return ensureTempParentExists(`${pathPrefix}/${filename}`)
}

/**
 * Ask the Buildless CLI to install the Buildless Agent.
 *
 * @return Promise which resolves to an answer about whether the agent installed.
 */
export async function agentInstall(): Promise<boolean> {
  try {
    // make sure temporary paths exist
    tempPathForOs('agent.json')
  } catch (err) {
    await sendError(err)
    console.warn('Failed to query temp path for agent', err)
  }
  // if we are running on linux, we need sudo rights
  const isLinux = process.platform !== 'win32' && process.platform !== 'darwin'
  if (isLinux) {
    // @TODO fix: write a service ID which is temporary
    fs.writeFileSync('/var/tmp/buildless/buildless-service.id', uuidv4())
    return true
  } else {
    return (
      (await execBuildless(BuildlessCommand.AGENT_INSTALL, [], [], isLinux))
        .exitCode === 0
    )
  }
}

/**
 * Ask the Buildless CLI for agent status.
 *
 * @return Promise which resolves to an answer about whether the agent installed.
 */
export async function agentStatus(): Promise<boolean> {
  core.debug(`Obtaining agent status via CLI`)
  try {
    const result = (await execBuildless(BuildlessCommand.AGENT_STATUS)).stdout
      .trim()
      .replaceAll('%0A', '')
      .includes('installed, running, and ready')

    if (result) {
      core.debug('Agent is currently running')
    } else {
      core.debug('Agent is not currently running')
    }
    return result
  } catch (err) {
    await sendError(err)
    core.debug(`Failed to obtain agent status: ${err}`)
    return false
  }
}

async function spawnDirect(): Promise<number> {
  core.debug('Starting Buildless Agent via background spawn')
  try {
    const outpath = tempPathForOs('buildless-agent.out')
    const errpath = tempPathForOs('buildless-agent.err')
    core.debug(`Agent outfiles: out=${outpath} err=${errpath}`)

    const out = fs.openSync(outpath, 'a')
    const err = fs.openSync(errpath, 'a')

    const spawnedAgent = await spawnInBackground(
      BuildlessCommand.AGENT_RUN,
      [BuildlessArgument.BACKGROUND],
      [
        BuildlessArgument.VERBOSE // always spawn with verbose mode active
      ],
      {
        shell: true,
        stdio: ['ignore', out, err]
      }
    )
    if (!spawnedAgent.success) {
      console.error(
        `Agent spawn completed but reported failure. Please see logs in debug mode.`
      )
    }
    await wait(500) // give the agent time to start up
    return spawnedAgent.pid
  } catch (err) {
    await sendError(err)
    console.error(`Failed to start agent (direct: ${SPAWN_DIRECT})`, err)
    return -1
  }
}

async function spawnViaCli(): Promise<number> {
  core.debug('Starting Buildless Agent via CLI')
  const started = await execBuildless(BuildlessCommand.AGENT_START)
  if (started.exitCode === 0) {
    await wait(500) // give the agent time to start up

    // then resolve config
    const config = await agentConfig()
    if (!config) {
      console.error(
        `CLI reported that agent started, but could not resolve config.`
      )
      throw new Error('Agent started but could not resolve configuration')
    } else {
      core.debug(`Started agent via CLI at PID ${config.pid}`)
      return config.pid
    }
  } else {
    console.error(
      `CLI reported that agent failed to start (exit code: ${started.exitCode})`
    )
    throw new Error('Agent failed to start via CLI')
  }
}

/**
 * Ask the Buildless CLI to start the agent.
 *
 * @return Promise which resolves to the agent PID.
 */
export async function agentStart(): Promise<number> {
  try {
    if (SPAWN_DIRECT) {
      return await spawnDirect()
    } else {
      return await spawnViaCli()
    }
  } catch (err) {
    await sendError(err)
    console.error(`Failed to start agent (direct: ${SPAWN_DIRECT})`, err)
    return -1
  }
}

/**
 * Ask the Buildless CLI to stop the agent.
 *
 * @return Promise which resolves to an answer about whether the agent installed.
 */
export async function agentStop(): Promise<boolean> {
  core.debug(`Stopping agent via CLI`)
  return (await execBuildless(BuildlessCommand.AGENT_STOP)).exitCode === 0
}

/**
 * Interrogate the specified binary to obtain the version.
 *
 * @param pathOverride Specific binary to run.
 * @return Promise which resolves to the obtained version.
 */
export async function obtainVersion(pathOverride?: string): Promise<string> {
  const bin = pathOverride || buildlessBin()
  core.debug(`Obtaining version of Buildless binary at: ${bin}`)
  return (
    await exec.getExecOutput(`"${bin}"`, [BuildlessCommand.VERSION])
  ).stdout
    .trim()
    .replaceAll('%0A', '')
    .replaceAll('Buildless ', '')
}

/**
 * Set the path to the Buildless binary for all subsequent commands.
 *
 * @param bin Binary path.
 */
export function setBinpath(bin: string): void {
  cachedBin = bin
}
