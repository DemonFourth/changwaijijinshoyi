const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadScripts } = require('./helpers/loadBrowserModules.cjs');

const root = path.resolve(__dirname, '..');

function script(relativePath) {
    return path.join(root, relativePath);
}

function loadDataServiceContext() {
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
        script('js/repositories/fundRepository.js'),
        script('js/repositories/tradeRepository.js'),
        script('js/application/fundAppService.js'),
        script('js/application/tradeAppService.js'),
        script('js/application/importAppService.js'),
        script('js/dataService.js')
    ]);
}

test('DataService importData delegates to ImportAppService without duplicate emit', async () => {
    const context = loadDataServiceContext();
    const events = [];
    let importCalls = 0;

    const originalEmit = context.window.EventBus.emit.bind(context.window.EventBus);
    context.window.EventBus.emit = (event, payload) => {
        events.push(event);
        return originalEmit(event, payload);
    };
    context.window.ImportAppService.importData = async () => {
        importCalls++;
        context.window.EventBus.emit(context.window.EventType.DATA_IMPORTED, {});
        return { success: true, mode: 'overwrite' };
    };
    context.window.FundRepository.getAll = () => [];
    context.window.TradeRepository.getAll = () => [];

    const result = await context.window.DataService.importData({ funds: [] }, false);

    assert.equal(result.success, true);
    assert.equal(importCalls, 1);
    assert.equal(events.filter(event => event === context.window.EventType.DATA_IMPORTED).length, 1);
}
);

test('DataService addTrade delegates to TradeAppService and only invalidates cache', async () => {
    const context = loadDataServiceContext();
    const events = [];
    let addTradeCalls = 0;
    let invalidatedFundId = null;

    const originalEmit = context.window.EventBus.emit.bind(context.window.EventBus);
    context.window.EventBus.emit = (event, payload) => {
        events.push(event);
        return originalEmit(event, payload);
    };
    context.window.TradeAppService.addTrade = async (trade) => {
        addTradeCalls++;
        context.window.EventBus.emit(context.window.EventType.TRADE_ADDED, { trade });
        return { success: true, trade, fundId: trade.fundId, reason: '' };
    };
    context.window.DataService.invalidateCache = (fundId) => {
        invalidatedFundId = fundId;
    };

    const result = await context.window.DataService.addTrade({ id: 'trade-1', fundId: 'fund-1' });

    assert.equal(result.success, true);
    assert.equal(addTradeCalls, 1);
    assert.equal(invalidatedFundId, 'fund-1');
    assert.equal(events.filter(event => event === context.window.EventType.TRADE_ADDED).length, 1);
}
);
