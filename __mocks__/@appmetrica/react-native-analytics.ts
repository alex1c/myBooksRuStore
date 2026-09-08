/**
 * Jest mock for AppMetrica — no native binary required.
 */

const AppMetrica = {
	activate: jest.fn(),
	reportEvent: jest.fn(),
	getLibraryVersion: jest.fn(() => 'mock'),
}

export default AppMetrica
