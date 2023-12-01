import * as command from '../src/command'
import { withTestBinary } from './utils'

describe('action transport tools', () => {
  beforeEach(() => {
    jest.clearAllMocks()
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
