const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadScripts } = require('./helpers/loadBrowserModules.cjs');

const root = path.resolve(__dirname, '..');

function script(relativePath) {
    return path.join(root, relativePath);
}

test('TradeModalHelper renders trade form sections with settings defaults', () => {
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

    context.window.AppSettingsService.loadSettings = () => ({
        defaultDividendMode: 'reinvest'
    });

    assert.ok(context.window.TradeModalHelper, 'expected TradeModalHelper to be defined');
    const html = context.window.TradeModalHelper.renderTradeFormSections({});

    assert.match(html, /input-trade-date/);
    assert.match(html, /input-dividend-mode/);
    assert.match(html, /value="reinvest" selected/);
});
