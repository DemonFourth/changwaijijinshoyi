const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadScripts } = require('./helpers/loadBrowserModules.cjs');

const root = path.resolve(__dirname, '..');

function script(relativePath) {
    return path.join(root, relativePath);
}

test('DetailEditHelper builds editable name markup', () => {
    const context = loadScripts([
        script('js/namespace.js'),
        script('js/moduleRegistry.js'),
        script('js/eventBus.js'),
        script('js/config.js'),
        script('js/utils.js'),
        script('js/detail/detailEditHelper.js')
    ]);

    assert.ok(context.window.DetailEditHelper, 'expected DetailEditHelper to exist');
    const html = context.window.DetailEditHelper.renderNameEditHtml('华夏成长');

    assert.match(html, /input-edit-fund-name/);
    assert.match(html, /btn-save-fund-name/);
    assert.match(html, /华夏成长/);
});

test('DetailEditHelper builds editable remark markup', () => {
    const context = loadScripts([
        script('js/namespace.js'),
        script('js/moduleRegistry.js'),
        script('js/eventBus.js'),
        script('js/config.js'),
        script('js/utils.js'),
        script('js/detail/detailEditHelper.js')
    ]);

    const html = context.window.DetailEditHelper.renderRemarkEditHtml('长期定投');

    assert.match(html, /input-edit-fund-remark/);
    assert.match(html, /btn-save-fund-remark/);
    assert.match(html, /长期定投/);
});
