import * as core from '@actions/core'
import * as io from '@actions/io'
import {
  ActionOutputName,
  BuildlessSetupActionOutputs as Outputs
} from './outputs'
import { obtainVersion } from './command'

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

export function notSupported(options: Options): null | Error {
  const spec = `${options.os}-${options.arch}`
  switch (spec) {
    case 'linux-amd64':
      return null
    case 'darwin-aarch64':
      return null
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

export async function resolveExistingBinary(): Promise<string | null> {
  try {
    return await io.which('buildless', true)
  } catch (err) {
    // ignore: no existing copy
    return null
  }
}

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(options?: Partial<Options>): Promise<void> {
  try {
    // resolve effective plugin options
    core.info('Installing Buildless with GitHub Actions')
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
          export_path: booleanOption(OptionName.EXPORT_PATH, true),
          token: stringOption(OptionName.TOKEN, process.env.GITHUB_TOKEN),
          custom_url: stringOption(OptionName.CUSTOM_URL)
        })

    // make sure the requested version, platform, and os triple is supported
    const supportErr = notSupported(effectiveOptions)
    if (supportErr) {
      core.setFailed(supportErr.message)
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
    core.debug(`Release version: '${release.version.tag_name}'`)

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

    // mount outputs
    core.setOutput(ActionOutputName.PATH, outputs.path)
    core.setOutput(ActionOutputName.VERSION, version)
    core.info(`Buildless installed at version ${release.version.tag_name} 🎉`)
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
