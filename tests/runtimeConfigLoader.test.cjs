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
    assert.equal(typeof context.window.RuntimeConfigLoader.getWorkerUrl, 'function');
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
});

test('RuntimeConfigLoader returns workerUrl from config after load', () => {
    const context = loadScripts([
        script('js/namespace.js'),
        script('js/moduleRegistry.js'),
        script('js/eventBus.js'),
        script('js/config.js'),
        script('js/runtimeConfigLoader.js')
    ]);

    // 模拟加载后的配置
    context.window.Config.load({
        sync: { workerUrl: 'https://test-worker.workers.dev', timeout: 5000 },
        storageMode: 'hybrid'
    });

    const workerUrl = context.window.RuntimeConfigLoader.getWorkerUrl();
    assert.equal(workerUrl, 'https://test-worker.workers.dev');

    const mode = context.window.RuntimeConfigLoader.getStorageMode();
    assert.equal(mode, 'hybrid');
});
