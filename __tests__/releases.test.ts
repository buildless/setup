import * as core from '@actions/core'
import * as github from '@actions/github'
import * as releases from '../src/releases'

const resolveLatestMock = jest.spyOn(releases, 'resolveLatestVersion')

let debugMock: jest.SpyInstance
let errorMock: jest.SpyInstance
let setFailedMock: jest.SpyInstance
let getOctokitMock: jest.SpyInstance

describe('release utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    debugMock = jest.spyOn(core, 'debug').mockImplementation()
    errorMock = jest.spyOn(core, 'error').mockImplementation()
    setFailedMock = jest.spyOn(core, 'setFailed').mockImplementation()
    getOctokitMock = jest.spyOn(github, 'getOctokit').mockImplementation()
  })
  it('can resolve the latest buildless release', async () => {
    const result = await releases.resolveLatestVersion()
    expect(result).not.toBeNull()
    const { name, tag_name, userProvided } = result
    expect(typeof name).toBe('string')
    expect(typeof tag_name).toBe('string')
    expect(typeof userProvided).toBe('boolean')
    expect(name === '').toBe(false)
    expect(tag_name === '').toBe(false)
    expect(userProvided).toBe(false)
    expect(resolveLatestMock).toHaveBeenCalledTimes(1)
  })
})
