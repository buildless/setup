import * as core from '@actions/core'
import * as io from '@actions/io'
import {
  ActionOutputName,
  BuildlessSetupActionOutputs as Outputs
} from './outputs'
import { obtainVersion, setBinpath } from './command'
import wait from './wait'
import { OS } from './config'
import { agentStart, agentStop, agentInstall, agentConfig } from './agent'

import buildOptions, {
  OptionName,
  BuildlessSetupActionOptions as Options,
  defaults,
  normalizeOs,
  normalizeArch
} from './options'

import { downloadRelease } from './releases'

function stringOption(
  option: string,
  defaultValue?: string
): string | undefined {
  const value: string = core.getInput(option)
  core.debug(`Property value: ${option}=${value || defaultValue}`)
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

function booleanOption(option: string, defaultValue: boolean): boolean {
  const value: boolean = getBooleanOption(option)
  /* istanbul ignore next */
  return value !== null && value !== undefined ? value : defaultValue
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
  console.log('postinstall', bin, options)
  // nothing yet
}

export function buildEffectiveOptions(options?: Partial<Options>): Options {
  const effectiveOptions: Options = options
    ? buildOptions(options)
    : buildOptions({
        version: stringOption(OptionName.VERSION, 'latest'),
        target: stringOption(
          OptionName.TARGET,
          /* istanbul ignore next */
          process.env.BIN_HOME || defaults.target
        ),
        os: normalizeOs(
          stringOption(OptionName.OS, process.platform) as string
        ),
        arch: normalizeArch(
          stringOption(OptionName.ARCH, process.arch) as string
        ),
        agent: booleanOption(OptionName.AGENT, true),
        export_path: booleanOption(OptionName.EXPORT_PATH, true),
        token: stringOption(OptionName.TOKEN, process.env.GITHUB_TOKEN),
        custom_url: stringOption(OptionName.CUSTOM_URL)
      })

  return effectiveOptions
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
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function install(options?: Partial<Options>): Promise<void> {
  try {
    // resolve effective plugin options
    core.info('Installing Buildless with GitHub Actions')
    const effectiveOptions: Options = buildEffectiveOptions(options)

    // make sure the requested version, platform, and os triple is supported
    const targetOs = notSupported(effectiveOptions)
    if (targetOs instanceof Error) {
      core.setFailed(targetOs.message)
      return
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
          version !== effectiveOptions.version ||
          effectiveOptions.version === 'latest'
        ) {
          core.warning(
            `Existing Buildless installation at version '${version}' was preserved`
          )
          core.setOutput(ActionOutputName.PATH, existing)
          core.setOutput(ActionOutputName.VERSION, version)
          return
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
      baseArgs.push('--verbose=true')
    }

    // if instructed, add binary to the path
    if (effectiveOptions.export_path) {
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
    if (effectiveOptions.agent) {
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
      }
      core.endGroup()
    }
    let activeAgent = null
    if (agentEnabled) {
      await wait(1500) // give the agent 1.5s to start up
      try {
        activeAgent = await agentConfig(targetOs)
      } catch (err) {
        core.notice(
          "The Buildless Agent installed and started, but then didn't start up in time; please see CI logs for more info."
        )
      }
      if (activeAgent) {
        core.debug('Buildless Agent started and ready.')
        core.saveState('agentPid', activeAgent.pid)
        core.saveState('agentConfig', JSON.stringify(activeAgent))
      }
    }

    // mount outputs
    core.saveState('buildlessBinpath', outputs.path)
    core.setOutput(ActionOutputName.PATH, outputs.path)
    core.setOutput(ActionOutputName.VERSION, version)
    core.info(`Buildless installed at version ${release.version.tag_name} 🎉`)
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
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
  const agentPid = core.getState('agentPid')
  const activeAgent = await agentConfig(targetOs)
  if (agentPid) {
    setBinpath(core.getState('buildlessBinpath'))
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

/**
 * Wrapped main function with error handling.
 *
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function entry(options?: Partial<Options>): Promise<void> {
  try {
    return await install(options)
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
  try {
    return await postExecute(options)
  } catch (err) {
    core.notice(
      'Cleanup stage for the Buildless action failed. Please see CI logs for more information.'
    )
  }
}
