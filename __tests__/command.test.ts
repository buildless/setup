import * as command from '../src/command'
import { setupCoreMocks, withTestBinary } from './utils'

const { clearMocks, resetState } = setupCoreMocks()

describe('action transport tools', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })
  afterEach(() => {
    clearMocks()
  })
  afterAll(async () => {
    await resetState()
  })

  it('can obtain the current buildless cli version', async () => {
    withTestBinary(async () => {
      const version = await command.obtainVersion()
      expect(version).not.toBeNull()
    })
  })

  it('can obtain the current buildless agent status', async () => {
    withTestBinary(async () => {
      const status = await command.agentStatus()
      expect(status).not.toBeNull()
    })
  })
})
