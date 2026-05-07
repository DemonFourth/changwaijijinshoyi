const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadScripts } = require('./helpers/loadBrowserModules.cjs');

const root = path.resolve(__dirname, '..');

function script(relativePath) {
    return path.join(root, relativePath);
}

test('DetailTradeActionHelper resolves edit action payload from row dataset', () => {
    const context = loadScripts([
        script('js/namespace.js'),
        script('js/moduleRegistry.js'),
        script('js/eventBus.js'),
        script('js/config.js'),
        script('js/utils.js'),
        script('js/detail/detailTradeActionHelper.js')
    ]);

    assert.ok(context.window.DetailTradeActionHelper, 'expected DetailTradeActionHelper to exist');

    const trade = { id: 'trade-1', type: 'buy' };
    const payload = context.window.DetailTradeActionHelper.buildEditTradePayload(trade);

    assert.equal(payload.type, 'editTrade');
    assert.equal(payload.data.trade.id, 'trade-1');
});

test('DetailTradeActionHelper builds delete confirm payload', () => {
    const context = loadScripts([
        script('js/namespace.js'),
        script('js/moduleRegistry.js'),
        script('js/eventBus.js'),
        script('js/config.js'),
        script('js/utils.js'),
        script('js/detail/detailTradeActionHelper.js')
    ]);

    const payload = context.window.DetailTradeActionHelper.buildDeleteTradePayload('trade-9');

    assert.equal(payload.type, 'deleteConfirm');
    assert.match(payload.data.message, /删除该交易记录/);
    assert.equal(typeof payload.data.onConfirm, 'function');
});
