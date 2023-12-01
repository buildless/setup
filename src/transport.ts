import { Transport } from '@connectrpc/connect'
import {
  createConnectTransport,
  createGrpcTransport
} from '@connectrpc/connect-node'
import { Empty } from '@bufbuild/protobuf'

import { ClientConfig } from '@api/buildless/service/v1/buildless-v1_connect'
import { AuthorizeRequest } from '@api/buildless/service/v1/buildless-v1_pb'

import {
  RpcTransport,
  TRANSPORT as activeTransport,
  BUILDLESS_AGENT_ENDPOINT as endpoint
} from './config'

const transportSettings = {
  baseUrl: endpoint,
  httpVersion: '2',
  interceptors: []
}

const grpcTransport = createGrpcTransport(transportSettings as any)
const connectTransport = createConnectTransport(transportSettings as any)

/**
 * Obtain an RPC transport configured for use in a Node environment.
 *
 * @returns RPC transport to use.
 */
export function obtainTransport(): Transport {
  switch (activeTransport) {
    case RpcTransport.CONNECT:
      return connectTransport
    case RpcTransport.GRPC:
      return grpcTransport
  }
}

export { type Empty, type ClientConfig, type AuthorizeRequest }
