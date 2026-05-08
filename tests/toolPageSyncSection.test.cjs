const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadScripts } = require('./helpers/loadBrowserModules.cjs');

const root = path.resolve(__dirname, '..');

function script(relativePath) {
    return path.join(root, relativePath);
}

test('ToolPage builds visible sync section with manual actions', () => {
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
        script('js/syncStatusPresenter.js'),
        script('js/toolPage.js')
    ]);

    context.window.SyncAppService = {
        getSyncStatus() {
            return { syncStatus: 'error', cloudRevision: 3, pendingChanges: 2, lastError: 'HTTP 405' };
        }
    };

    const html = context.window.ToolPage.buildSyncSectionHtml();

    assert.equal(html.includes('立即同步'), true);
    assert.equal(html.includes('强制上传本地'), true);
    assert.equal(html.includes('强制下载云端'), true);
    assert.equal(html.includes('HTTP 405'), true);
});
