import path from 'node:path'
import fs from 'node:fs'
import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as github from '@actions/github'
import { opendir, access } from 'node:fs/promises'
import { setBinpath } from '../src/command'
import { onExit } from '../src/diagnostics'
import { httpClient } from '../src/config'
import { install as installBuildless } from '../src/main'

/**
 * Locate a test binary to use for Buildless CLI unit testing, or install one in a temporary path.
 *
 * @param name Name of the binary to locate (typically `buildless`). Automatically postfixed by platform.
 * @returns Path to the resolved binary.
 */
export async function locateOrSetupTestBinary(
  name: string = 'buildless'
): Promise<string> {
  // try to resolve from PATH
  const candidates = process.env.PATH
  const isWindows = process.platform === 'win32'
  const filename = isWindows ? `${name}.exe` : name
  const sep = isWindows ? ';' : ':'
  const prefixPaths = candidates?.split(sep) || []
  for (let candidate of prefixPaths) {
    const abspath = path.isAbsolute(candidate)
      ? path.normalize(candidate)
      : path.resolve(candidate)
    if (fs.existsSync(abspath)) {
      try {
        const dir = await opendir(abspath)
        for await (const dirent of dir) {
          if (dirent.name === filename) {
            try {
              const target = path.join(abspath, filename)
              await access(target)
              return target
            } catch (err) {
              //no access
            }
          }
        }
      } catch (err) {
        console.error(err)
      }
    }
  }

  // otherwise, make a temporary directory, install buildless within it, and return that
  const tempPath = fs.mkdtempSync('buildless-action-test')
  return await installBuildless({
    target: tempPath
  })
}

/**
 * Obtain or install a Buildless test binary, and run `fn` with it; whatever `fn` returns is
 * returned from this wrapper.
 *
 * @param fn Function to run with the test binary path.
 * @return Promise for a value from `fn`, if any.
 */
export async function withTestBinary<R>(
  fn: (binpath: string) => Promise<R>
): Promise<R> {
  const binpath = await locateOrSetupTestBinary()
  setBinpath(binpath)
  return await fn(binpath)
}

export function resetState() {
  onExit(false)
}

export function setupCoreMocks(): {
  debugMock: jest.SpyInstance
  errorMock: jest.SpyInstance
  getInputMock: jest.SpyInstance
  setFailedMock: jest.SpyInstance
  setOutputMock: jest.SpyInstance
  getJsonMock: jest.SpyInstance
  getOctokitMock: jest.SpyInstance
  execMock: jest.SpyInstance
  clearMocks: () => void
  setupMocks: () => void
  resetState: () => void
} {
  let debugMock: jest.SpyInstance = jest.spyOn(core, 'debug')
  let errorMock: jest.SpyInstance = jest.spyOn(core, 'error')
  let getInputMock: jest.SpyInstance = jest.spyOn(core, 'getInput')
  let setFailedMock: jest.SpyInstance = jest.spyOn(core, 'setFailed')
  let setOutputMock: jest.SpyInstance = jest.spyOn(core, 'setOutput')
  let execMock: jest.SpyInstance = jest.spyOn(exec, 'exec')
  let getOctokitMock: jest.SpyInstance = jest
    .spyOn(github, 'getOctokit')
    .mockImplementation()
  let getJsonMock: jest.SpyInstance = jest
    .spyOn(httpClient, 'getJson')
    .mockImplementation()

  return {
    debugMock,
    errorMock,
    getInputMock,
    setFailedMock,
    setOutputMock,
    getJsonMock,
    getOctokitMock,
    execMock,
    resetState: () => {
      resetState()
    },
    clearMocks: () => {
      // Nothing at this time.
    },
    setupMocks: () => {
      execMock = jest.spyOn(exec, 'exec').mockImplementation()
      debugMock = jest.spyOn(core, 'debug').mockImplementation()
      errorMock = jest.spyOn(core, 'error').mockImplementation()
      getInputMock = jest.spyOn(core, 'getInput').mockImplementation()
      setFailedMock = jest.spyOn(core, 'setFailed').mockImplementation()
      setOutputMock = jest.spyOn(core, 'setOutput').mockImplementation()
    }
  }
}
