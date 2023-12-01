/**
 * Unit tests for the action's entrypoint, src/index.ts
 */

import * as main from '../src/main'

const runMock = jest.spyOn(main, 'entry').mockImplementation()
const cleanupMock = jest.spyOn(main, 'cleanup').mockImplementation()

describe('index', () => {
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
