import * as releases from '../src/releases'
import { setupCoreMocks } from './utils'

const { resetState, setupMocks } = setupCoreMocks()
const resolveLatestMock = jest.spyOn(releases, 'resolveLatestVersion')

describe('release utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupMocks()
  })
  afterAll(async () => {
    await resetState()
  })

  it('can resolve the latest buildless release', async () => {
    const result = await releases.resolveLatestVersion()
    expect(result).not.toBeNull()
    const { name, tag_name, userProvided } = result
    expect(typeof tag_name).toBe('string')
    expect(typeof userProvided).toBe('boolean')
    expect(name === '').toBe(false)
    expect(tag_name === '').toBe(false)
    expect(userProvided).toBe(false)
    expect(resolveLatestMock).toHaveBeenCalledTimes(1)
  })
})
