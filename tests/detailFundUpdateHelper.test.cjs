const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadScripts } = require('./helpers/loadBrowserModules.cjs');

const root = path.resolve(__dirname, '..');

function script(relativePath) {
    return path.join(root, relativePath);
}

test('DetailFundUpdateHelper builds name update payload', () => {
    const context = loadScripts([
        script('js/namespace.js'),
        script('js/moduleRegistry.js'),
        script('js/eventBus.js'),
        script('js/config.js'),
        script('js/utils.js'),
        script('js/detail/detailFundUpdateHelper.js')
    ]);

    assert.ok(context.window.DetailFundUpdateHelper, 'expected DetailFundUpdateHelper to exist');
    const payload = context.window.DetailFundUpdateHelper.buildNameUpdatePayload('新基金名');

    assert.equal(payload.name, '新基金名');
    assert.equal(payload.nameSource, 'manual');
    assert.ok(payload.nameUpdateTime);
});

test('DetailFundUpdateHelper builds remark update payload', () => {
    const context = loadScripts([
        script('js/namespace.js'),
        script('js/moduleRegistry.js'),
        script('js/eventBus.js'),
        script('js/config.js'),
        script('js/utils.js'),
        script('js/detail/detailFundUpdateHelper.js')
    ]);

    const payload = context.window.DetailFundUpdateHelper.buildRemarkUpdatePayload('新的备注');

    assert.equal(payload.remark, '新的备注');
    assert.equal(Object.keys(payload).length, 1);
});
