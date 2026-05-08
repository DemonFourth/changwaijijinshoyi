const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadScripts } = require('./helpers/loadBrowserModules.cjs');

const root = path.resolve(__dirname, '..');

function script(relativePath) {
    return path.join(root, relativePath);
}

test('TradeModalHelper recalculates amount after auto fee changes', () => {
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
        script('js/modal/tradeModalHelper.js')
    ]);

    const amountWithoutFee = context.window.TradeModalHelper.calculateAutoAmount(1, 100, 0, 'buy');
    const amountWithFee = context.window.TradeModalHelper.calculateAutoAmount(1, 100, 1.5, 'buy');

    assert.equal(amountWithoutFee.amount, 100);
    assert.equal(amountWithFee.amount, 101.5);
    assert.notEqual(amountWithoutFee.hintText, amountWithFee.hintText);
});
