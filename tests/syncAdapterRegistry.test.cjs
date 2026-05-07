const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadScripts } = require('./helpers/loadBrowserModules.cjs');

const root = path.resolve(__dirname, '..');

function script(relativePath) {
    return path.join(root, relativePath);
}

test('SyncAdapterRegistry exposes local adapter and sync status operations', () => {
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
        script('js/storage/localSyncAdapter.js'),
        script('js/storage/syncAdapterRegistry.js')
    ]);

    assert.ok(context.window.SyncAdapterRegistry, 'expected SyncAdapterRegistry to exist');
    const adapter = context.window.SyncAdapterRegistry.getAdapter('local');
    assert.ok(adapter, 'expected local sync adapter');
    assert.equal(typeof adapter.getStatus, 'function');
    assert.equal(typeof adapter.markSyncComplete, 'function');
});

test('Local sync adapter updates syncMeta lastSyncAt', () => {
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
        script('js/storage/localSyncAdapter.js'),
        script('js/storage/syncAdapterRegistry.js')
    ]);

    let savedSnapshot = null;
    context.window.LocalStorageAdapter.loadSnapshot = () => ({
        schemaVersion: 1,
        funds: [],
        trades: [],
        syncMeta: {
            provider: 'local',
            deviceId: 'device-1',
            lastSyncAt: null
        }
    });
    context.window.LocalStorageAdapter.saveSnapshot = (snapshot) => {
        savedSnapshot = snapshot;
        return true;
    };

    const adapter = context.window.SyncAdapterRegistry.getAdapter('local');
    adapter.markSyncComplete('2026-05-07T10:00:00.000Z');

    assert.equal(savedSnapshot.syncMeta.lastSyncAt, '2026-05-07T10:00:00.000Z');
    assert.equal(savedSnapshot.syncMeta.provider, 'local');
});
