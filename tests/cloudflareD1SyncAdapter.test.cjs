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

test('CloudflareD1SyncAdapter returns not_configured when basePath not set', () => {
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

test('CloudflareD1SyncAdapter returns configured when basePath is set', () => {
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

    context.window.CloudflareD1SyncAdapter.init({ basePath: '/api/sync', timeout: 10000 });
    const status = context.window.CloudflareD1SyncAdapter.getStatus();
    assert.equal(status.configured, true);
    assert.equal(status.canPull, true);
    assert.equal(status.canPush, true);
});

test('CloudflareD1SyncAdapter push uses normalized sync endpoint when basePath already contains sync', async () => {
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

    let requestedEndpoint = null;
    context.window.CloudflareD1SyncAdapter._request = async (endpoint) => {
        requestedEndpoint = endpoint;
        return { success: true, revision: 1 };
    };

    context.window.CloudflareD1SyncAdapter.init({ basePath: '/api/sync', timeout: 10000 });
    await context.window.CloudflareD1SyncAdapter.push([], []);

    assert.equal(requestedEndpoint, '/push');
});
