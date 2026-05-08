const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadScripts } = require('./helpers/loadBrowserModules.cjs');

const root = path.resolve(__dirname, '..');

function script(relativePath) {
    return path.join(root, relativePath);
}

function createContext() {
    return loadScripts([
        script('js/namespace.js'),
        script('js/moduleRegistry.js'),
        script('js/eventBus.js'),
        script('js/config.js'),
        script('js/utils.js'),
        script('js/storage.js'),
        script('js/storage/schema.js'),
        script('js/storage/migrations.js'),
        script('js/storage/localStorageAdapter.js'),
        script('js/storage/localSyncAdapter.js'),
        script('js/storage/syncAdapterRegistry.js'),
        script('js/application/syncAppService.js')
    ]);
}

function mockPushAdapter(context, overrides = {}) {
    const adapter = {
        getStatus() {
            return { canPush: true, canPull: true };
        },
        async push() {
            return { success: true, revision: 1 };
        },
        async resolve() {
            return { success: true };
        },
        ...overrides
    };

    context.window.SyncAdapterRegistry.getCurrentAdapter = () => adapter;
    context.window.LocalStorageAdapter.getCurrentSyncAdapter = () => adapter;
    return adapter;
}

test('SyncAppService resolveConflicts emits sync applied event on success', async () => {
    const context = createContext();
    const emitted = [];

    context.window.EventBus.emit = (event, payload) => {
        emitted.push({ event, payload });
    };

    mockPushAdapter(context, {
        async resolve() {
            return { success: true };
        }
    });

    const result = await context.window.SyncAppService.resolveConflicts(
        [{ entityType: 'fund', syncId: 'fund-1', local: { id: 'fund-1' }, cloud: { id: 'fund-1' } }],
        ['local']
    );

    assert.equal(result.success, true);
    assert.equal(emitted.some(item => item.event === context.window.EventType.SYNC_DATA_APPLIED), true);
});
