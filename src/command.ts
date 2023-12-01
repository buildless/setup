import * as core from '@actions/core'
import * as exec from '@actions/exec'

// async function execBuildless(bin: string, args?: string[]): Promise<void> {
//   core.debug(`Executing: bin=${bin}, args=${args}`)
//   await exec.exec(`"${bin}"`, args)
// }

/**
 * Enumerates available commands which can be run with the Buildless CLI tool.
 */
export enum BuildlessCommand {
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
