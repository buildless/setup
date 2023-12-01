import * as core from '@actions/core'
import * as io from '@actions/io'
import {
  ActionOutputName,
  BuildlessSetupActionOutputs as Outputs
} from './outputs'
import { BuildlessArgument, obtainVersion, setBinpath } from './command'
import wait from './wait'
import { OS } from './config'
import {
  agentStart,
  agentStop,
  agentStatus,
  agentInstall,
  agentConfig
} from './agent'

import buildOptions, {
  OptionName,
  BuildlessSetupActionOptions as Options,
  defaults,
  normalizeOs,
  normalizeArch
} from './options'

import { downloadRelease } from './releases'

enum AgentManagementMode {
  MANAGED = 'manaved',
  UNMANAGED = 'unmanaged',
  INACTIVE = 'inactive'
}

enum ActionState {
  AGENT_PID = 'agentPid',
  AGENT_CONFIG = 'agentConfig',
  AGENT_MODE = 'agentMode',
  BINPATH = 'buildlessBinpath'
}

let actionEffectiveOptions: Options | null

export function setActionEffectiveOptions(options: Options): Options {
  if (actionEffectiveOptions !== null) {
    throw new Error('Cannot set effective options twice in one execution.')
  }
  const stringified = JSON.stringify(options, null, '  ')
  core.debug(`Effective options: ${stringified}`)
  actionEffectiveOptions = options
  return options
}

function stringOption(
  option: string,
  overrideValue: string | null | undefined,
  defaultValue?: string
): string | undefined {
  const value: string = core.getInput(option)
  let valueSrc: string
  if (overrideValue) {
    valueSrc = 'override'
  } else if (value) {
    valueSrc = 'input'
  } else {
    valueSrc = 'default'
  }
  core.debug(
    `Property value: ${option}=${
      overrideValue || value || defaultValue
    } (from: ${valueSrc})`
  )
  return value || defaultValue || undefined
}

function getBooleanOption(booleanInputName: string): boolean {
  const trueValue = [
    'true',
    'True',
    'TRUE',
    'yes',
    'Yes',
    'YES',
    'y',
    'Y',
    'on',
    'On',
    'ON'
  ]
  const falseValue = [
    'false',
    'False',
    'FALSE',
    'no',
    'No',
    'NO',
    'n',
    'N',
    'off',
    'Off',
    'OFF'
  ]
  const stringInput = core.getInput(booleanInputName)
  /* istanbul ignore next */
  if (trueValue.includes(stringInput)) return true
  /* istanbul ignore next */
  if (falseValue.includes(stringInput)) return false
  return false // default to `false`
}

function booleanOption(
  option: string,
  overrideValue: boolean | null | undefined,
  defaultValue: boolean
): boolean {
  const value: boolean = getBooleanOption(option)
  /* istanbul ignore next */
  return typeof overrideValue === 'boolean'
    ? overrideValue
    : value !== null && value !== undefined
      ? value
      : defaultValue
}

export function notSupported(options: Options): OS | Error {
  const spec = `${options.os}-${options.arch}`
  switch (spec) {
    case 'linux-amd64':
      return OS.LINUX
    case 'darwin-aarch64':
      return OS.MACOS
    case 'windows-amd64':
      return OS.WINDOWS
    default:
      core.error(`Platform is not supported: ${spec}`)
      return new Error(`Platform not supported: ${spec}`)
  }
}

export async function postInstall(
  bin: string,
  options: Options
): Promise<void> {
  const opts = JSON.stringify(options)
  core.debug(`Installation completed at path: '${bin}' (options: ${opts})`)
  // nothing yet
}

export function buildEffectiveOptions(options?: Partial<Options>): Options {
  return setActionEffectiveOptions(
    buildOptions({
      version: stringOption(OptionName.VERSION, options?.version, 'latest'),
      target: stringOption(
        OptionName.TARGET,
        options?.target,
        /* istanbul ignore next */
        process.env.BIN_HOME || defaults.target
      ),
      os: normalizeOs(
        stringOption(OptionName.OS, options?.os, process.platform) as string
      ),
      arch: normalizeArch(
        stringOption(OptionName.ARCH, options?.arch, process.arch) as string
      ),
      agent: booleanOption(OptionName.AGENT, options?.agent, true),
      force: booleanOption(OptionName.FORCE, options?.force, false),
      skip_cache: booleanOption(
        OptionName.SKIP_CACHE,
        options?.skip_cache,
        false
      ),
      export_path: booleanOption(
        OptionName.EXPORT_PATH,
        options?.export_path,
        true
      ),
      token: stringOption(
        OptionName.TOKEN,
        options?.token,
        process.env.GITHUB_TOKEN
      ),
      custom_url: stringOption(OptionName.CUSTOM_URL, options?.custom_url)
    })
  )
}

export async function resolveExistingBinary(): Promise<string | null> {
  try {
    return await io.which('buildless', true)
  } catch (err) {
    // ignore: no existing copy
    return null
  }
}

/**
 * The install function for the action.
 *
 * @param options Options to apply to the install process.
 * @param withinAction Lets this code know it is not being installed from an action, but rather dispatched directly.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function install(
  options: Partial<Options>,
  withinAction = true
): Promise<string> {
  try {
    // resolve effective plugin options
    core.info('Installing Buildless with GitHub Actions')
    const effectiveOptions: Options = buildEffectiveOptions(options)

    // make sure the requested version, platform, and os triple is supported
    const targetOs = notSupported(effectiveOptions)
    if (targetOs instanceof Error) {
      core.setFailed(targetOs.message)
      throw targetOs
    }

    // if the tool is already installed and the user didn't set `force`, we can bail
    if (!effectiveOptions.force) {
      const existing: string | null = await resolveExistingBinary()
      if (existing) {
        core.debug(
          `Located existing Buildless binary at: '${existing}'. Obtaining version...`
        )
        await postInstall(existing, effectiveOptions)
        const version = await obtainVersion(existing)

        /* istanbul ignore next */
        if (
          (version !== effectiveOptions.version ||
            effectiveOptions.version === 'latest') &&
          !effectiveOptions.force
        ) {
          core.warning(
            `Existing Buildless installation at version '${version}' was preserved`
          )
          if (withinAction) {
            core.setOutput(ActionOutputName.PATH, existing)
            core.setOutput(ActionOutputName.VERSION, version)
          }
          return existing
        }
      }
    }

    // download the release tarball (resolving version if needed)
    const release = await downloadRelease(effectiveOptions)

    core.startGroup(
      `Setting up Buildless (version '${release.version.tag_name}')...`
    )
    core.debug(`Release version: '${release.version.tag_name}'`)

    const baseArgs = []
    if (core.isDebug()) {
      baseArgs.push(BuildlessArgument.VERBOSE)
    }

    // if instructed, add binary to the path
    if (effectiveOptions.export_path && withinAction) {
      core.info(`Adding '${release.path}' to PATH`)
      core.addPath(release.home)
    } else {
      core.debug('Skipping add-binary-to-path step (turned off)')
    }

    // begin preparing outputs
    const outputs: Outputs = {
      path: release.path,
      version: effectiveOptions.version
    }

    // verify installed version
    await postInstall(release.path, effectiveOptions)
    const version = await obtainVersion(release.path)

    /* istanbul ignore next */
    if (version !== release.version.tag_name) {
      core.warning(
        `Buildless version mismatch: expected '${release.version.tag_name}', but got '${version}'`
      )
    }
    core.endGroup()

    const binpath = outputs.path
    setBinpath(binpath)

    // set up agent, if directed
    let agentEnabled = false
    let agentManaged = false // set to true if `agentEnabled` is `true` and *we* started it in this run
    if (effectiveOptions.agent && withinAction) {
      const currentAgentStatus = await agentStatus()
      if (currentAgentStatus) {
        // agent is already installed and running
        core.debug(
          'Buildless Agent is already installed and running; skipping installation.'
        )
      } else {
        core.startGroup('Setting up Buildless Agent...')
        core.debug('Triggering agent installation...')
        let installFailed = false
        let startFailed = false
        try {
          await agentInstall()
        } catch (err) {
          core.notice(
            'The Buildless Agent failed to install; please see CI logs for more info.'
          )
          installFailed = true
        }
        if (!installFailed) {
          core.debug('Agent installation complete. Starting agent...')
          try {
            await agentStart()
          } catch (err) {
            core.notice(
              'The Buildless Agent installed, but failed to start; please see CI logs for more info.'
            )
            startFailed = true
          }
        }
        if (!installFailed && !startFailed) {
          core.debug('Agent installed and started.')
          agentEnabled = true
          agentManaged = true
        }
        core.endGroup()
      }
    }

    let activeAgent = null
    if (agentEnabled && agentManaged) {
      if (agentManaged) {
        await wait(1500) // give the agent 1.5s to start up
      }
      try {
        activeAgent = await agentConfig(targetOs)
      } catch (err) {
        if (agentManaged) {
          core.notice(
            "The Buildless Agent installed and started, but then didn't start up in time; please see CI logs for more info."
          )
        } else {
          core.notice(
            'Existing Buildless Agent could not be contacted; please see CI logs for more info.'
          )
        }
      }
      if (activeAgent) {
        if (agentManaged) {
          core.debug(
            `Buildless Agent started and ready (PID: ${activeAgent.pid}).`
          )
        } else {
          core.debug(
            `Using existing Buildless Agent (already running at PID ${activeAgent.pid}).`
          )
        }
        core.saveState(ActionState.AGENT_PID, activeAgent.pid)
        core.saveState(ActionState.AGENT_CONFIG, JSON.stringify(activeAgent))
      }
    }

    if (withinAction) {
      // mount outputs
      core.saveState(ActionState.BINPATH, outputs.path)
      core.saveState(
        ActionState.AGENT_MODE,
        activeAgent
          ? agentManaged
            ? AgentManagementMode.MANAGED
            : AgentManagementMode.UNMANAGED
          : AgentManagementMode.INACTIVE
      )
      core.setOutput(ActionOutputName.PATH, outputs.path)
      core.setOutput(ActionOutputName.VERSION, version)
    }
    core.info(`Buildless installed at version ${release.version.tag_name} 🎉`)
    return binpath
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
    throw error
  }
}

/**
 * The cleanup function for the action.
 *
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function postExecute(options?: Partial<Options>): Promise<void> {
  const effectiveOptions: Options = buildEffectiveOptions(options)
  const targetOs = notSupported(effectiveOptions)
  if (targetOs instanceof Error) {
    return // not supported, nothing to do
  }
  core.info(`Cleaning up Buildless Agent and resources...`)

  const agentMode = core.getState(ActionState.AGENT_MODE) as
    | AgentManagementMode
    | null
    | undefined
  if (agentMode) {
    const agentPid = core.getState(ActionState.AGENT_PID)
    const cachedBinpath = core.getState(ActionState.BINPATH)
    if (!cachedBinpath) {
      core.error(
        'Failed to resolve Buildless binpath in cleanup script. Please report this as a bug.'
      )
      return
    }
    if (agentMode === AgentManagementMode.UNMANAGED) {
      core.debug('Agent was running when we got here; skipping agent cleanup.')
      return
    }

    setBinpath(cachedBinpath)
    const activeAgent = await agentConfig(targetOs)

    if (agentPid) {
      let errMessage = 'unknown'
      try {
        await agentStop()
      } catch (err) {
        core.debug(
          `Agent failed to halt in time; killing at PID: '${agentPid}'...`
        )
        let killFailed = false
        try {
          process.kill(activeAgent?.pid || parseInt(agentPid, 10))
        } catch (err) {
          killFailed = true
          if (err instanceof Error) {
            errMessage = err.message
          }
        }
        if (killFailed) {
          core.debug(
            `Killing agent PID also failed. Giving up. Message: ${errMessage}`
          )
        } else {
          core.debug('Agent process killed.')
        }
      }
    } else {
      core.debug('No active agent; no cleanup to do.')
    }
  }
}

/**
 * Wrapped main function with error handling.
 *
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function entry(options?: Partial<Options>): Promise<void> {
  actionEffectiveOptions = null

  try {
    await install(options || {}, true)
  } catch (err) {
    core.warning(
      'Buildless failed to install; this build may not be accelerated. Please see CI logs for more information.'
    )
  }
}

/**
 * Wrapped cleanup entry function with error handling.
 *
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function cleanup(options?: Partial<Options>): Promise<void> {
  actionEffectiveOptions = null

  try {
    await postExecute(options)
  } catch (err) {
    core.notice(
      'Cleanup stage for the Buildless action failed. Please see CI logs for more information.'
    )
  }
}
