const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadScripts } = require('./helpers/loadBrowserModules.cjs');

const root = path.resolve(__dirname, '..');

function script(relativePath) {
    return path.join(root, relativePath);
}

test('AppSettingsService provides unified settings access for page modules', () => {
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
        script('js/application/appSettingsService.js')
    ]);

    assert.ok(context.window.AppSettingsService, 'expected AppSettingsService to be defined');
    assert.equal(typeof context.window.AppSettingsService.loadSettings, 'function');
    assert.equal(typeof context.window.AppSettingsService.saveSettings, 'function');
});

test('AppSettingsService importData delegates to ImportAppService', async () => {
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
        script('js/application/importAppService.js'),
        script('js/application/appSettingsService.js')
    ]);
    const calls = [];

    context.window.ImportAppService.importData = async (data, options) => {
        calls.push({ data, options });
        return { success: true, mode: 'overwrite' };
    };

    const result = await context.window.AppSettingsService.importData({ funds: [] }, false);

    assert.equal(result.success, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.merge, false);
});

test('AppSettingsService clearAllData delegates to ImportAppService clearAll', async () => {
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
        script('js/application/importAppService.js'),
        script('js/application/appSettingsService.js')
    ]);
    let clearCalls = 0;

    context.window.ImportAppService.clearAll = async () => {
        clearCalls++;
        return { success: true, mode: 'clear' };
    };

    const result = await context.window.AppSettingsService.clearAllData();

    assert.equal(result.success, true);
    assert.equal(clearCalls, 1);
});
