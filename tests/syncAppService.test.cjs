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

test('SyncAppService executePush updates sync meta and entity lastSyncedAt on success', async () => {
    const context = createContext();
    const now = '2026-05-08T12:00:00.000Z';

    context.window.LocalStorageAdapter.saveSnapshot({
        ...context.window.StorageSchema.createEmptySnapshot(),
        funds: [{ id: 'fund-1', syncId: 'fund-1', updatedAt: '2026-05-08T11:00:00.000Z', lastSyncedAt: null }],
        trades: [{ id: 'trade-1', syncId: 'trade-1', updatedAt: '2026-05-08T11:30:00.000Z', lastSyncedAt: null }],
        syncMeta: context.window.LocalStorageAdapter.getSyncMeta()
    });

    mockPushAdapter(context, {
        async push() {
            return { success: true, revision: 12 };
        }
    });

    context.window.SyncAppService._getNowIso = () => now;

    const result = await context.window.SyncAppService._executePush();
    const snapshot = context.window.LocalStorageAdapter.loadSnapshot();
    const syncMeta = context.window.LocalStorageAdapter.getSyncMeta();

    assert.equal(result.success, true);
    assert.equal(syncMeta.cloudRevision, 12);
    assert.equal(syncMeta.pendingChanges, 0);
    assert.equal(syncMeta.syncStatus, 'idle');
    assert.equal(snapshot.funds[0].lastSyncedAt, now);
    assert.equal(snapshot.trades[0].lastSyncedAt, now);
});

test('SyncAppService executePull emits sync applied event after snapshot changes', async () => {
    const context = createContext();
    const emitted = [];

    context.window.EventBus.emit = (event, payload) => {
        emitted.push({ event, payload });
    };
    context.window.LocalStorageAdapter.saveSnapshot({
        ...context.window.StorageSchema.createEmptySnapshot(),
        funds: [],
        trades: [],
        syncMeta: context.window.LocalStorageAdapter.getSyncMeta()
    });
    context.window.LocalStorageAdapter.getCurrentSyncAdapter = () => ({
        getStatus() {
            return { canPull: true, canPush: true };
        },
        async pull() {
            return {
                success: true,
                funds: [{ id: 'fund-1', syncId: 'fund-1', updatedAt: '2026-05-08T10:00:00.000Z' }],
                trades: [],
                revision: 2
            };
        },
        markSyncComplete() {}
    });

    const result = await context.window.SyncAppService._executePull();

    assert.equal(result.success, true);
    assert.equal(emitted.some(item => item.event === context.window.EventType.SYNC_DATA_APPLIED), true);
});

test('SyncAppService schedules retry with backoff after push failure', async () => {
    const context = createContext();
    const delays = [];
    let pushCount = 0;

    const originalSetTimeout = context.setTimeout;
    context.setTimeout = (callback, delay) => {
        delays.push(delay);
        return originalSetTimeout(() => {}, 0);
    };

    mockPushAdapter(context, {
        async push() {
            pushCount += 1;
            return { success: false, reason: 'network_error' };
        }
    });

    await context.window.SyncAppService._executePush();

    assert.equal(pushCount, 1);
    assert.equal(delays.some(delay => delay >= 3000), true);
});
