const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadScripts } = require('./helpers/loadBrowserModules.cjs');

const root = path.resolve(__dirname, '..');

function script(relativePath) {
    return path.join(root, relativePath);
}

function loadTradeAppServiceContext() {
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
        script('js/repositories/tradeRepository.js'),
        script('js/application/tradeAppService.js')
    ]);
}

test('TradeAppService addTrade normalizes persisted trade fields', () => {
    const context = loadTradeAppServiceContext();
    const savedPayloads = [];

    context.window.TradeRepository.getAll = () => [];
    context.window.TradeRepository.saveAll = (trades) => {
        savedPayloads.push(trades);
        return true;
    };

    const result = context.window.TradeAppService.addTrade({
        id: 'trade-1',
        fundId: 'fund-1',
        date: '2024-01-01',
        type: 'buy',
        netValue: '1.2345',
        shares: '100.5',
        amount: '124.06',
        fee: '0.10'
    });

    assert.equal(result, true);
    assert.equal(savedPayloads.length, 1);
    assert.equal(savedPayloads[0][0].syncId, 'trade-1');
    assert.equal(savedPayloads[0][0].shares, 100.5);
    assert.equal(savedPayloads[0][0].fee, 0.1);
});

test('TradeAppService updateTrade refreshes updatedAt and merges fields', () => {
    const context = loadTradeAppServiceContext();
    const original = {
        id: 'trade-1',
        fundId: 'fund-1',
        date: '2024-01-01',
        type: 'buy',
        netValue: 1.2,
        shares: 100,
        amount: 120,
        fee: 0,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        syncId: 'trade-1'
    };
    let savedTrades = null;

    context.window.TradeRepository.getAll = () => [original];
    context.window.TradeRepository.saveAll = (trades) => {
        savedTrades = trades;
        return true;
    };

    const result = context.window.TradeAppService.updateTrade('trade-1', { amount: 121.5, fee: 0.2 });

    assert.equal(result, true);
    assert.equal(savedTrades[0].amount, 121.5);
    assert.equal(savedTrades[0].fee, 0.2);
    assert.notEqual(savedTrades[0].updatedAt, original.updatedAt);
});

test('TradeAppService deleteTrade delegates to repository softDelete', () => {
    const context = loadTradeAppServiceContext();
    let deletedTradeId = null;

    context.window.TradeRepository.softDelete = (tradeId) => {
        deletedTradeId = tradeId;
        return true;
    };

    const result = context.window.TradeAppService.deleteTrade('trade-1');

    assert.equal(result, true);
    assert.equal(deletedTradeId, 'trade-1');
});
