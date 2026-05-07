const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadScripts } = require('./helpers/loadBrowserModules.cjs');

const root = path.resolve(__dirname, '..');

function script(relativePath) {
    return path.join(root, relativePath);
}

test('SyncAppService exposes sync methods', () => {
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
        script('js/application/syncAppService.js')
    ]);

    assert.ok(context.window.SyncAppService, 'expected SyncAppService to exist');
    assert.equal(typeof context.window.SyncAppService.init, 'function');
    assert.equal(typeof context.window.SyncAppService.startBackgroundSync, 'function');
    assert.equal(typeof context.window.SyncAppService.getSyncStatus, 'function');
});