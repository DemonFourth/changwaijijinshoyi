const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadScripts } = require('./helpers/loadBrowserModules.cjs');

const root = path.resolve(__dirname, '..');

function script(relativePath) {
    return path.join(root, relativePath);
}

test('RuntimeConfigLoader exposes load and getter methods', () => {
    const context = loadScripts([
        script('js/namespace.js'),
        script('js/moduleRegistry.js'),
        script('js/eventBus.js'),
        script('js/config.js'),
        script('js/runtimeConfigLoader.js')
    ]);

    assert.ok(context.window.RuntimeConfigLoader, 'expected RuntimeConfigLoader to exist');
    assert.equal(typeof context.window.RuntimeConfigLoader.load, 'function');
    assert.equal(typeof context.window.RuntimeConfigLoader.getStorageMode, 'function');
    assert.equal(typeof context.window.RuntimeConfigLoader.isSyncEnabled, 'function');
    assert.equal(typeof context.window.RuntimeConfigLoader.getSyncBasePath, 'function');
});

test('RuntimeConfigLoader returns local mode by default', () => {
    const context = loadScripts([
        script('js/namespace.js'),
        script('js/moduleRegistry.js'),
        script('js/eventBus.js'),
        script('js/config.js'),
        script('js/runtimeConfigLoader.js')
    ]);

    // 默认没有加载过运行时配置，应为 local
    const mode = context.window.RuntimeConfigLoader.getStorageMode();
    assert.equal(mode, 'local');
    assert.equal(context.window.RuntimeConfigLoader.isSyncEnabled(), false);
});

test('RuntimeConfigLoader returns sync config from /api/runtime-config after load', () => {
    const context = loadScripts([
        script('js/namespace.js'),
        script('js/moduleRegistry.js'),
        script('js/eventBus.js'),
        script('js/config.js'),
        script('js/runtimeConfigLoader.js')
    ]);

    context.window.Config.load({
        sync: { enabled: true, basePath: '/api/sync', timeout: 10000 },
        storageMode: 'hybrid'
    });

    assert.equal(context.window.RuntimeConfigLoader.isSyncEnabled(), true);
    assert.equal(context.window.RuntimeConfigLoader.getSyncBasePath(), '/api/sync');
    assert.equal(context.window.RuntimeConfigLoader.getStorageMode(), 'hybrid');
});

test('RuntimeConfigLoader skips runtime-config fetch for file protocol', async () => {
    const context = loadScripts([
        script('js/namespace.js'),
        script('js/moduleRegistry.js'),
        script('js/eventBus.js'),
        script('js/config.js'),
        script('js/runtimeConfigLoader.js')
    ]);

    let fetchCalled = false;
    context.window.location = { protocol: 'file:' };
    context.fetch = async () => {
        fetchCalled = true;
        throw new Error('should not fetch');
    };

    const loaded = await context.window.RuntimeConfigLoader.load();

    assert.equal(loaded, false);
    assert.equal(fetchCalled, false);
});
