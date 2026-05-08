const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadScripts } = require('./helpers/loadBrowserModules.cjs');

const root = path.resolve(__dirname, '..');

function script(relativePath) {
    return path.join(root, relativePath);
}

test('Config.getApiUrl uses HTTPS fund endpoint for mixed-content safe pages', () => {
    const context = loadScripts([
        script('js/namespace.js'),
        script('js/moduleRegistry.js'),
        script('js/config.js')
    ]);

    const url = context.window.Config.getApiUrl('519732');

    assert.equal(url, 'https://fundgz.1234567.com.cn/js/519732.js');
});
