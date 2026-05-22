const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadScripts } = require('./helpers/loadBrowserModules.cjs');

const root = path.resolve(__dirname, '..');

function script(relativePath) {
    return path.join(root, relativePath);
}

test('RuntimeConfigLoader detects file:// protocol and returns false', async () => {
    const context = loadScripts([
        script('js/namespace.js'),
        script('js/moduleRegistry.js'),
        script('js/config.js'),
        script('js/runtimeConfigLoader.js')
    ]);

    context.window.location = { protocol: 'file:' };

    const result = await context.window.RuntimeConfigLoader.load();
    assert.equal(result, false, 'file:// 协议应返回 false');
});

test('RuntimeConfigLoader detects http:// protocol and attempts fetch', async () => {
    const context = loadScripts([
        script('js/namespace.js'),
        script('js/moduleRegistry.js'),
        script('js/config.js'),
        script('js/runtimeConfigLoader.js')
    ]);

    context.window.location = { protocol: 'http:' };

    context.window.fetch = async () => {
        throw new Error('Network error');
    };

    const result = await context.window.RuntimeConfigLoader.load();
    assert.equal(result, false, 'fetch 失败应返回 false');
});

test('RuntimeConfigLoader getStorageMode returns correct mode', () => {
    const context = loadScripts([
        script('js/namespace.js'),
        script('js/moduleRegistry.js'),
        script('js/config.js'),
        script('js/runtimeConfigLoader.js')
    ]);

    const defaultMode = context.window.RuntimeConfigLoader.getStorageMode();
    assert.equal(defaultMode, 'local', '默认应为 local 模式');

    context.window.Config.load({ storageMode: 'hybrid' });
    const hybridMode = context.window.RuntimeConfigLoader.getStorageMode();
    assert.equal(hybridMode, 'hybrid', '应返回 hybrid 模式');
});

test('RuntimeConfigLoader isSyncEnabled returns correct value', () => {
    const context = loadScripts([
        script('js/namespace.js'),
        script('js/moduleRegistry.js'),
        script('js/config.js'),
        script('js/runtimeConfigLoader.js')
    ]);

    const defaultEnabled = context.window.RuntimeConfigLoader.isSyncEnabled();
    assert.equal(defaultEnabled, false, '默认应不启用同步');

    context.window.Config.load({ sync: { enabled: true } });
    const enabled = context.window.RuntimeConfigLoader.isSyncEnabled();
    assert.equal(enabled, true, '应返回 true');
});

test('RuntimeConfigLoader getSyncBasePath returns correct value', () => {
    const context = loadScripts([
        script('js/namespace.js'),
        script('js/moduleRegistry.js'),
        script('js/config.js'),
        script('js/runtimeConfigLoader.js')
    ]);

    const defaultPath = context.window.RuntimeConfigLoader.getSyncBasePath();
    assert.equal(defaultPath, '', '默认应为空字符串');

    context.window.Config.load({ sync: { basePath: '/api/sync' } });
    const syncPath = context.window.RuntimeConfigLoader.getSyncBasePath();
    assert.equal(syncPath, '/api/sync', '应返回正确的同步路径');
});
