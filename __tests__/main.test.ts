import * as core from '@actions/core'
import * as main from '../src/main'
import { ActionOutputName } from '../src/outputs'

const runMock = jest.spyOn(main, 'entry')

let debugMock: jest.SpyInstance
let errorMock: jest.SpyInstance
let getInputMock: jest.SpyInstance
let setFailedMock: jest.SpyInstance
let setOutputMock: jest.SpyInstance

describe('action entry', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    debugMock = jest.spyOn(core, 'debug').mockImplementation()
    errorMock = jest.spyOn(core, 'error').mockImplementation()
    getInputMock = jest.spyOn(core, 'getInput').mockImplementation()
    setFailedMock = jest.spyOn(core, 'setFailed').mockImplementation()
    setOutputMock = jest.spyOn(core, 'setOutput').mockImplementation()
  })

  it('sets the path and version outputs', async () => {
    // Set the action's inputs as return values from core.getInput()
    getInputMock.mockImplementation((name: string): string => {
      // nothing set
      return ''
    })

    await main.entry({ agent: false })
    expect(runMock).toHaveReturned()

    expect(setFailedMock).not.toHaveBeenCalled()
    expect(errorMock).not.toHaveBeenCalled()
    expect(setOutputMock).toHaveBeenCalledWith(
      ActionOutputName.PATH,
      expect.anything()
    )
    expect(setOutputMock).toHaveBeenCalledWith(
      ActionOutputName.VERSION,
      expect.anything()
    )
  }, 30000)

  it('sets a failed status', async () => {
    // Set the action's inputs as return values from core.getInput()
    getInputMock.mockImplementation((name: string): string => {
      switch (name) {
        case 'agent':
          return 'false'
        case 'version':
          return '9999.0.0.0'
        case 'force':
          return 'true'
        default:
          return ''
      }
    })

    await main.entry({ agent: false })
    expect(getInputMock).toHaveBeenCalledWith('force')
    expect(runMock).toHaveReturned()

    expect(setFailedMock).toHaveBeenNthCalledWith(
      1,
      'Failed to download Buildless release at specified version'
    )
  })
})
