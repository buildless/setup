import * as main from '../src/main'
import { setupCoreMocks } from './utils'

const { clearMocks, resetState } = setupCoreMocks()
const runMock = jest
  .spyOn(main, 'entry')
  .mockImplementation(() => Promise.resolve())
const cleanupMock = jest
  .spyOn(main, 'cleanup')
  .mockImplementation(() => Promise.resolve())

describe('index', () => {
  afterEach(() => {
    clearMocks()
  })
  afterAll(async () => {
    await resetState()
  })

  it('calls entrypoint when imported', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../src/index')
    expect(runMock).toHaveBeenCalled()
  })
})

describe('cleanup', () => {
  it('calls entrypoint when imported', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../src/cleanup')
    expect(cleanupMock).toHaveBeenCalled()
  })
})
