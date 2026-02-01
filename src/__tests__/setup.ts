// Test setup file
// This file runs before each test file

import { vi, beforeEach, afterAll } from 'vitest';

// Mock VSCode API globally
vi.mock('vscode', () => ({
    window: {
        showInformationMessage: vi.fn(),
        showErrorMessage: vi.fn(),
        showWarningMessage: vi.fn(),
        showInputBox: vi.fn(),
        showQuickPick: vi.fn(),
        createStatusBarItem: vi.fn(() => ({
            show: vi.fn(),
            hide: vi.fn(),
            dispose: vi.fn(),
            text: '',
            tooltip: '',
            command: '',
        })),
    },
    workspace: {
        getConfiguration: vi.fn(() => ({
            get: vi.fn(),
            update: vi.fn(),
        })),
        openTextDocument: vi.fn(),
        registerTextDocumentContentProvider: vi.fn(),
        onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
    },
    commands: {
        registerCommand: vi.fn(() => ({ dispose: vi.fn() })),
        executeCommand: vi.fn(),
    },
    Uri: {
        parse: vi.fn((uri: string) => ({
            toString: () => uri,
            scheme: uri.split(':')[0],
        })),
        file: vi.fn((path: string) => ({
            fsPath: path,
            toString: () => `file://${path}`,
        })),
    },
    ExtensionContext: {},
    ConfigurationTarget: {
        Global: 1,
        Workspace: 2,
        WorkspaceFolder: 3,
    },
    StatusBarAlignment: {
        Left: 1,
        Right: 2,
    },
    ProgressLocation: {
        Notification: 15,
    },
}));

// Reset all mocks before each test
beforeEach(() => {
    vi.clearAllMocks();
});

// Cleanup after all tests
afterAll(() => {
    vi.restoreAllMocks();
});
