const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadScripts } = require('./helpers/loadBrowserModules.cjs');

const root = path.resolve(__dirname, '..');

function script(relativePath) {
    return path.join(root, relativePath);
}

test('Overview reads and saves view preferences through AppSettingsService', () => {
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
        script('js/overview.js')
    ]);

    let loadCalls = 0;
    let saveCalls = 0;
    let savedPrefs = null;

    context.window.AppSettingsService.loadViewPrefs = () => {
        loadCalls++;
        return {
            viewMode: 'list',
            sortField: 'name',
            sortOrder: 'asc'
        };
    };

    context.window.AppSettingsService.saveViewPrefs = (prefs) => {
        saveCalls++;
        savedPrefs = prefs;
        return true;
    };

    const loaded = context.window.Overview.loadViewPreferences();
    assert.equal(loadCalls, 1);
    assert.equal(loaded.viewMode, 'list');

    context.window.Overview._viewPrefs = loaded;
    context.window.Overview.saveViewPreferences({ sortOrder: 'desc' });

    assert.equal(saveCalls, 1);
    assert.equal(savedPrefs.sortOrder, 'desc');
    assert.equal(savedPrefs.viewMode, 'list');
});
