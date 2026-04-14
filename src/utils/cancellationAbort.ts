import * as vscode from 'vscode';

/** User cancel or fetch AbortSignal — do not retry or count as provider failure */
export function isAbortOrUserCancellation(error: unknown): boolean {
    if (error == null || typeof error !== 'object') {
        return false;
    }
    const e = error as { name?: string; message?: string };
    const name = (e.name || '').toLowerCase();
    const msg = (e.message || '').toLowerCase();
    return (
        name === 'aborterror' ||
        msg === 'operation cancelled' ||
        msg.includes('the operation was aborted') ||
        msg.includes('user aborted') ||
        msg.includes('request was cancelled')
    );
}

/**
 * Links a VS Code cancellation token to an AbortSignal for fetch / SDK calls.
 * Call `dispose()` when the operation completes to remove the listener.
 */
export function linkCancellationToAbort(token: vscode.CancellationToken | undefined): {
    signal: AbortSignal | undefined;
    dispose: () => void;
} {
    if (!token) {
        return { signal: undefined, dispose: () => { /* noop */ } };
    }
    const controller = new AbortController();
    if (token.isCancellationRequested) {
        controller.abort();
        return { signal: controller.signal, dispose: () => { /* noop */ } };
    }
    const disposable = token.onCancellationRequested(() => controller.abort());
    return {
        signal: controller.signal,
        dispose: () => disposable.dispose(),
    };
}
