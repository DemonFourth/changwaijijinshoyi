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
        ...overrides
    };

    context.window.SyncAdapterRegistry.getCurrentAdapter = () => adapter;
    return adapter;
}

test('SyncAppService exposes sync methods', () => {
    const context = createContext();

    assert.ok(context.window.SyncAppService, 'expected SyncAppService to exist');
    assert.equal(typeof context.window.SyncAppService.init, 'function');
    assert.equal(typeof context.window.SyncAppService.startBackgroundSync, 'function');
    assert.equal(typeof context.window.SyncAppService.getSyncStatus, 'function');
});

test('notifyBusinessDataChanged marks import changes as pending', async () => {
    const context = createContext();
    mockPushAdapter(context);

    await context.window.SyncAppService.notifyBusinessDataChanged('import');

    const syncMeta = context.window.LocalStorageAdapter.getSyncMeta();
    assert.equal(syncMeta.syncStatus, 'pending');
    assert.equal(syncMeta.pendingChanges, 1);
    assert.equal(syncMeta.pendingSource, 'import');
});

test('notifyBusinessDataChanged schedules immediate push for import', async () => {
    const context = createContext();
    mockPushAdapter(context);
    const delays = [];
    const originalSetTimeout = context.setTimeout;
    context.setTimeout = (callback, delay) => {
        delays.push(delay);
        return originalSetTimeout(callback, 0);
    };

    await context.window.SyncAppService.notifyBusinessDataChanged('import');

    assert.deepEqual(delays, [0]);
});

test('notifyBusinessDataChanged uses default delay for unknown source', async () => {
    const context = createContext();
    mockPushAdapter(context);
    const delays = [];
    const originalSetTimeout = context.setTimeout;
    context.setTimeout = (callback, delay) => {
        delays.push(delay);
        return originalSetTimeout(callback, 0);
    };

    await context.window.SyncAppService.notifyBusinessDataChanged('unknown');

    assert.deepEqual(delays, [5000]);
});

test('notifyBusinessDataChanged is safe when cloud sync is not configured', async () => {
    const context = createContext();

    await assert.doesNotReject(async () => context.window.SyncAppService.notifyBusinessDataChanged('import'));
});

test('notifyBusinessDataChanged visibility compensation triggers push when pending', async () => {
    const context = createContext();
    let visibilityHandler = null;
    let pushCount = 0;

    context.document.addEventListener = (event, handler) => {
        if (event === 'visibilitychange') {
            visibilityHandler = handler;
        }
    };

    mockPushAdapter(context, {
        isConfigured() {
            return true;
        },
        async push() {
            pushCount += 1;
            return { success: true, revision: 1 };
        }
    });

    await context.window.SyncAppService.init({ enabled: false, basePath: '' });
    await context.window.SyncAppService.notifyBusinessDataChanged('import');
    context.document.hidden = true;
    await visibilityHandler();

    assert.equal(pushCount >= 1, true);
});
