const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadScripts } = require('./helpers/loadBrowserModules.cjs');

const root = path.resolve(__dirname, '..');

function script(relativePath) {
    return path.join(root, relativePath);
}

test('Detail reads page size through AppSettingsService', () => {
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
        script('js/application/appSettingsService.js'),
        script('js/detail.js')
    ]);

    let loadCalls = 0;
    context.window.AppSettingsService.loadSettings = () => {
        loadCalls++;
        return { defaultPageSize: 20 };
    };

    const pageSize = context.window.Detail._getPageSize();

    assert.equal(loadCalls, 1);
    assert.equal(pageSize, 20);
});
