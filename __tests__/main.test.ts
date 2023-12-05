import { setupCoreMocks } from './utils'
import * as main from '../src/main'
import { ActionOutputName } from '../src/outputs'

const { setupMocks, clearMocks, resetState, errorMock, getInputMock, setFailedMock, setOutputMock } = setupCoreMocks()
const runMock = jest.spyOn(main, 'entry')

describe('action entry', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupMocks()
  })
  afterEach(() => {
    clearMocks()
  })
  afterAll(async () => {
    await resetState()
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
  })

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
