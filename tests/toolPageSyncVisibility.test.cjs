const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadScripts } = require('./helpers/loadBrowserModules.cjs');

const root = path.resolve(__dirname, '..');

function script(relativePath) {
    return path.join(root, relativePath);
}

test('ToolPage sync panel is designed for fixed visible container instead of hidden conversion detail', () => {
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

    const renderSource = context.window.ToolPage.renderSyncStatus.toString();

    assert.equal(renderSource.includes('tool-sync-panel'), true);
    assert.equal(renderSource.includes('tool-detail[data-tool="conversion"]'), false);
});
