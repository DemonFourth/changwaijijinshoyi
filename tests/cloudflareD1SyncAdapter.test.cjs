const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadScripts } = require('./helpers/loadBrowserModules.cjs');

const root = path.resolve(__dirname, '..');

function script(relativePath) {
    return path.join(root, relativePath);
}

test('CloudflareD1SyncAdapter registers and provides sync methods', () => {
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
        script('js/storage/syncAdapterRegistry.js'),
        script('js/storage/cloudflareD1SyncAdapter.js')
    ]);

    assert.ok(context.window.CloudflareD1SyncAdapter, 'expected CloudflareD1SyncAdapter to exist');
    assert.equal(typeof context.window.CloudflareD1SyncAdapter.init, 'function');
    assert.equal(typeof context.window.CloudflareD1SyncAdapter.getStatus, 'function');
    assert.equal(typeof context.window.CloudflareD1SyncAdapter.isConfigured, 'function');
});

test('CloudflareD1SyncAdapter returns not_configured when workerUrl not set', () => {
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
        script('js/storage/syncAdapterRegistry.js'),
        script('js/storage/cloudflareD1SyncAdapter.js')
    ]);

    const status = context.window.CloudflareD1SyncAdapter.getStatus();
    assert.equal(status.configured, false);
    assert.equal(status.canPull, false);
    assert.equal(status.canPush, false);
});