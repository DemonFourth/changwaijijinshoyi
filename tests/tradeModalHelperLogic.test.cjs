const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadScripts } = require('./helpers/loadBrowserModules.cjs');

const root = path.resolve(__dirname, '..');

function script(relativePath) {
    return path.join(root, relativePath);
}

function loadTradeModalHelperContext() {
    return loadScripts([
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
}

test('TradeModalHelper applies default fee tiers when fund tiers are missing', () => {
    const context = loadTradeModalHelperContext();

    const effective = context.window.TradeModalHelper.getEffectiveFeeTiers(
        { feeTiers: { buyTiers: [], sellTiers: [] } },
        { defaultBuyFeeRate: 0.15, defaultSellFeeRate: 0.5 }
    );

    assert.equal(effective.buyTiers[0].rate, 0.15);
    assert.equal(effective.sellTiers[0].rate, 0.5);
});

test('TradeModalHelper calculates amount by trade type', () => {
    const context = loadTradeModalHelperContext();

    const buyResult = context.window.TradeModalHelper.calculateAutoAmount(1.5, 100, 2, 'buy');
    const sellResult = context.window.TradeModalHelper.calculateAutoAmount(1.5, 100, 2, 'sell');

    assert.equal(buyResult.amount, 152);
    assert.match(buyResult.hintText, /净值×份额\+手续费/);
    assert.equal(sellResult.amount, 148);
    assert.match(sellResult.hintText, /净值×份额-手续费/);
});
