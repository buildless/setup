import * as transport from '../src/transport'

describe('action transport tools', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('can provide a configured rpc transport', async () => {
    const engine = transport.obtainTransport()
    expect(engine).not.toBeNull()
  })
})
