const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadScripts } = require('./helpers/loadBrowserModules.cjs');

const root = path.resolve(__dirname, '..');

function script(relativePath) {
    return path.join(root, relativePath);
}

test('DetailMenuHelper renders edit menu markup', () => {
    const context = loadScripts([
        script('js/namespace.js'),
        script('js/moduleRegistry.js'),
        script('js/eventBus.js'),
        script('js/config.js'),
        script('js/utils.js'),
        script('js/detail/detailMenuHelper.js')
    ]);

    assert.ok(context.window.DetailMenuHelper, 'expected DetailMenuHelper to exist');
    const html = context.window.DetailMenuHelper.renderEditMenuHtml();

    assert.match(html, /edit-menu-overlay/);
    assert.match(html, /menu-edit-name/);
    assert.match(html, /menu-edit-remark/);
    assert.match(html, /menu-refresh-name/);
});
