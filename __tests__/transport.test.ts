import * as transport from '../src/transport'
import { RpcTransport } from '../src/config'

describe('action transport tools', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('can provide a configured rpc transport', async () => {
    const engine = transport.obtainTransport()
    expect(engine).not.toBeNull()
  })

  it('can provide a configured rpc transport (grpc)', async () => {
    const engine = transport.obtainTransport(RpcTransport.GRPC)
    expect(engine).not.toBeNull()
  })

  it('can provide a configured rpc transport (connect)', async () => {
    const engine = transport.obtainTransport(RpcTransport.CONNECT)
    expect(engine).not.toBeNull()
  })
})
