const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadScripts } = require('./helpers/loadBrowserModules.cjs');

const root = path.resolve(__dirname, '..');

function script(relativePath) {
    return path.join(root, relativePath);
}

test('TradeModalHelper builds amount hint html with import button', () => {
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

    const html = context.window.TradeModalHelper.buildAmountHintHtml(101.5, '买入');

    assert.match(html, /自动计算：净值×份额\+手续费 = 101.50/);
    assert.match(html, /btn-import-amount/);
    assert.match(html, /导入金额/);
});
