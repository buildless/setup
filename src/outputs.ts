/**
 * Models the shape of outputs provided by the setup action.
 */
export type BuildlessSetupActionOutputs = {
  // Path to the binary.
  path: string

  // Version number for the binary.
  version: string
}

/**
 * Enumerates outputs and maps them to their well-known names.
 */
export enum ActionOutputName {
  // Path to the binary.
  PATH = 'path',

  // Version for binary.
  VERSION = 'version'
}
