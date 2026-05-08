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

test('SyncAppService auto push failure shows error toast for visible feedback', async () => {
    const context = createContext();
    let toastPayload = null;

    context.window.Utils.showToast = (message, type) => {
        toastPayload = { message, type };
    };
    context.window.LocalStorageAdapter.getCurrentSyncAdapter = () => ({
        getStatus() {
            return { provider: 'cloudflare', canPush: true, canPull: true };
        },
        async push() {
            return { success: false, reason: 'HTTP 405' };
        }
    });

    await context.window.SyncAppService._executePush();

    assert.deepEqual(toastPayload, { message: '自动同步失败：HTTP 405', type: 'error' });
});
