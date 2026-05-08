const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadScripts } = require('./helpers/loadBrowserModules.cjs');

const root = path.resolve(__dirname, '..');

function script(relativePath) {
    return path.join(root, relativePath);
}

function createContext() {
    const context = loadScripts([
        script('js/namespace.js'),
        script('js/moduleRegistry.js'),
        script('js/eventBus.js'),
        script('js/config.js'),
        script('js/utils.js'),
        script('js/storage.js'),
        script('js/storage/schema.js'),
        script('js/storage/migrations.js'),
        script('js/storage/localStorageAdapter.js'),
        script('js/app.js')
    ]);

    context.window.SyncAppService = {
        async startBackgroundSync() {
            return { success: true };
        }
    };
    context.window.Modal = {
        showSyncConflict() {}
    };
    context.window.Overview = {
        refresh() {}
    };

    return context;
}

test('App opens sync conflict modal when background sync returns conflicts', async () => {
    const context = createContext();
    let modalPayload = null;

    context.window.Modal = {
        showSyncConflict(payload) {
            modalPayload = payload;
        }
    };
    context.window.SyncAppService.startBackgroundSync = async () => ({
        success: true,
        hasConflicts: true,
        conflicts: [{ entityType: 'fund', syncId: 'fund-1' }]
    });

    await context.window.App.handleStartupSyncCheck();

    assert.equal(Array.isArray(modalPayload.conflicts), true);
    assert.equal(modalPayload.conflicts.length, 1);
});
