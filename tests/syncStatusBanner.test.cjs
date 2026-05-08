const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadScripts } = require('./helpers/loadBrowserModules.cjs');

const root = path.resolve(__dirname, '..');

function script(relativePath) {
    return path.join(root, relativePath);
}

test('Overview renders sync status banner html with failure reason and action hint', () => {
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
        script('js/overview.js')
    ]);

    const html = context.window.Overview.buildSyncStatusBannerHtml({
        syncStatus: 'error',
        pendingChanges: 4,
        lastError: 'HTTP 405'
    });

    assert.equal(html.includes('同步失败'), true);
    assert.equal(html.includes('HTTP 405'), true);
    assert.equal(html.includes('查看同步工具'), true);
});

test('Detail renders sync status banner html with pending state', () => {
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
        script('js/detail.js')
    ]);

    const html = context.window.Detail.buildSyncStatusBannerHtml({
        syncStatus: 'pending',
        pendingChanges: 2,
        lastError: null
    });

    assert.equal(html.includes('待同步 2 项'), true);
    assert.equal(html.includes('查看同步工具'), true);
});
