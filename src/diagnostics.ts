import { v4 as uuidv4 } from 'uuid'
import * as core from '@actions/core'
import * as Sentry from '@sentry/node'
import * as http from '@actions/http-client'
import { obtainTokenOrFailGracefully } from './auth'
import {
  BUILDLESS_CLI_ENDPOINT as cliEndpoint,
  actionEnv,
  httpClient
} from './config'

const eventEndpoint = `${cliEndpoint}/event`

/**
 * Enumerates types of events sent for analytics and build telemetry features.
 */
export enum ActionEventType {
  /** Ping event sent when the action runs an install of the Buildless CLI. */
  INSTALL = 'gha.install',

  /** Internal error reporting event. */
  ERROR = 'gha.error',

  /** Ping sent when the agent is started. */
  START_AGENT = 'gha.startAgent',

  /** Ping sent when the build is started. */
  BUILD_START = 'build.start',

  /** Ping sent when the build is finished. */
  BUILD_FINISH = 'build.finish'
}

/**
 * Specifies the structure of context data sent with an event.
 */
interface EventContext {
  actionRef?: string
  eventName?: string
  jobName?: string
  runId?: string
  runNumber?: string
  repository?: string
  sha?: string
  workflow?: string
  workflowSha?: string
  invocationId?: string
  imageOs?: string
  imageVersion?: string
  runnerArch?: string
  runnerDebug?: boolean
  runnerEnvironment?: string
  runnerName?: string
  runnerOs?: string
  apiKeyPresent?: boolean
  agentEnabled?: boolean
  version?: string
}

/**
 * Specifies arbitrary event payload data type requirements.
 */
type ActionEventData = {
  [key: string]: any
}

/**
 * Timestamps for an analytics event.
 */
export type EventTimestamps = {
  occurred: number
}

/**
 * Specifies the structure of a generic analytics event.
 */
export interface ActionEvent<T extends ActionEventData> {
  uuid: string
  event: ActionEventType
  context: Partial<EventContext>
  timestamps: EventTimestamps
  data: T
}

// Build static event context which is enclosed with all events.
function buildContext(): Partial<EventContext> {
  const {
    githubActionRef: actionRef,
    githubEventName: eventName,
    githubJobName: jobName,
    githubRunId: runId,
    githubRunNumber: runNumber,
    githubSha: sha,
    githubWorkflow: workflow,
    githubWorkflowSha: workflowSha,
    invocationId,
    imageOs,
    imageVersion,
    runnerArch,
    runnerDebug,
    runnerEnvironment,
    runnerName,
    runnerOs
  } = actionEnv

  return {
    actionRef,
    eventName,
    jobName,
    runId,
    runNumber,
    sha,
    workflow,
    workflowSha,
    invocationId,
    imageOs,
    imageVersion,
    runnerArch,
    runnerDebug,
    runnerEnvironment,
    runnerName,
    runnerOs
  }
}

// Transmit a ready event to the CLI telemetry system.
async function transmitEvent(event: ActionEvent<any>): Promise<void> {
  const encoded = JSON.stringify(event)
  const flowToken = await obtainTokenOrFailGracefully()
  const headers = {
    [http.Headers.Accept]: 'application/json',
    [http.Headers.ContentType]: 'application/json',
    Authorization: flowToken ? `Bearer ${flowToken}` : undefined
  }

  core.debug(`Transmit event to ${eventEndpoint}: ${encoded}`)
  try {
    const res: http.HttpClientResponse = await httpClient.post(
      eventEndpoint,
      encoded,
      headers
    )
    if (res.message.statusCode !== 200 && res.message.statusCode !== 204) {
      core.debug(`Event transmission failed: ${res.message.statusMessage}`)
    } else {
      core.debug(`Event transmission completed (ID: ${event.uuid})`)
    }
  } catch (err) {
    core.debug(`Event transmission encountered error: ${err}`)
  }
}

/**
 * Build an event structure for the given type and data.
 *
 * @param T Shape of detailed event payload data.
 * @param event Type of event being built.
 * @param data Event data to enclose, specific to the event type (type T).
 */
function buildEvent<T extends ActionEventData>(
  event: ActionEventType,
  data: T
): ActionEvent<T> {
  const occurred = +new Date()
  const context = buildContext()
  const uuid = uuidv4()
  return {
    uuid,
    event,
    context,
    data,
    timestamps: {
      occurred
    }
  }
}

/**
 * Build and transmit an event to the Buildless CLI/Actions telemetry system.
 *
 * @param T Shape of detailed event payload data.
 * @param type Type of event being built.
 * @param data Event data to enclose, specific to the event type (type T).
 * @return Promise for an event UUID string.
 */
export async function event<T extends ActionEventData>(
  type: ActionEventType,
  data: T
): Promise<string> {
  const event = buildEvent(type, data)
  await transmitEvent(event)
  return event.uuid
}

/**
 * Report an error to Sentry.
 *
 * @param err Error to report.
 * @param fatal Whether the error is considered fatal; defaults to `true`.
 */
export async function error(err: Error | unknown, fatal: boolean = true): Promise<void> {
  const errMessage = err instanceof Error ? err.message : String(err)
  core.debug(`Reporting error: ${errMessage}`)
  const req = event(ActionEventType.ERROR, {
    message: errMessage || 'unknown',
    fatal,
  })
  Sentry.captureException(err)
  const flush = Sentry.flush()
  await Promise.all([req, flush])
}
