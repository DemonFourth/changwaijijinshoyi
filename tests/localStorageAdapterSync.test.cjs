const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadScripts } = require('./helpers/loadBrowserModules.cjs');

const root = path.resolve(__dirname, '..');

function script(relativePath) {
    return path.join(root, relativePath);
}

test('LocalStorageAdapter exposes current sync adapter helper', () => {
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

    assert.equal(typeof context.window.LocalStorageAdapter.getCurrentSyncAdapter, 'function');
    const adapter = context.window.LocalStorageAdapter.getCurrentSyncAdapter();
    assert.equal(adapter, context.window.SyncAdapterRegistry.getAdapter('local'));
});
