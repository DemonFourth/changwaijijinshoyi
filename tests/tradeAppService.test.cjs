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

function trackEvents(context) {
    const events = [];
    const originalEmit = context.window.EventBus.emit.bind(context.window.EventBus);
    context.window.EventBus.emit = (event, payload) => {
        events.push({ event, payload });
        return originalEmit(event, payload);
    };
    return events;
}

test('TradeAppService addTrade normalizes persisted trade fields and emits side effects', async () => {
    const context = loadTradeAppServiceContext();
    const events = trackEvents(context);
    const savedPayloads = [];
    const notifyCalls = [];

    context.window.TradeRepository.getAll = () => [];
    context.window.TradeRepository.saveAll = (trades) => {
        savedPayloads.push(trades);
        return true;
    };
    context.window.SyncAppService = {
        notifyBusinessDataChanged(source) {
            notifyCalls.push(source);
            return Promise.resolve();
        }
    };

    const result = await context.window.TradeAppService.addTrade({
        id: 'trade-1',
        fundId: 'fund-1',
        date: '2024-01-01',
        type: 'buy',
        netValue: '1.2345',
        shares: '100.5',
        amount: '124.06',
        fee: '0.10'
    });

    assert.equal(result.success, true);
    assert.equal(savedPayloads.length, 1);
    assert.equal(savedPayloads[0][0].syncId, 'trade-1');
    assert.equal(savedPayloads[0][0].shares, 100.5);
    assert.equal(savedPayloads[0][0].fee, 0.1);
    assert.deepEqual(events.map(item => item.event), [
        context.window.EventType.TRADE_ADDED,
        context.window.EventType.TRADE_UPDATED,
        context.window.EventType.CALCULATION_UPDATED
    ]);
    assert.deepEqual(notifyCalls, ['event']);
});

test('TradeAppService updateTrade refreshes updatedAt and emits side effects', async () => {
    const context = loadTradeAppServiceContext();
    const events = trackEvents(context);
    const notifyCalls = [];
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
    context.window.SyncAppService = {
        notifyBusinessDataChanged(source) {
            notifyCalls.push(source);
            return Promise.resolve();
        }
    };

    const result = await context.window.TradeAppService.updateTrade('trade-1', { amount: 121.5, fee: 0.2 });

    assert.equal(result.success, true);
    assert.equal(savedTrades[0].amount, 121.5);
    assert.equal(savedTrades[0].fee, 0.2);
    assert.notEqual(savedTrades[0].updatedAt, original.updatedAt);
    assert.deepEqual(events.map(item => item.event), [
        context.window.EventType.TRADE_UPDATED,
        context.window.EventType.CALCULATION_UPDATED
    ]);
    assert.deepEqual(notifyCalls, ['event']);
});

test('TradeAppService deleteTrade delegates to repository softDelete and emits side effects', async () => {
    const context = loadTradeAppServiceContext();
    const events = trackEvents(context);
    const notifyCalls = [];
    let deletedTradeId = null;

    context.window.TradeRepository.getById = () => ({ id: 'trade-1', fundId: 'fund-1' });
    context.window.TradeRepository.softDelete = (tradeId) => {
        deletedTradeId = tradeId;
        return true;
    };
    context.window.SyncAppService = {
        notifyBusinessDataChanged(source) {
            notifyCalls.push(source);
            return Promise.resolve();
        }
    };

    const result = await context.window.TradeAppService.deleteTrade('trade-1');

    assert.equal(result.success, true);
    assert.equal(deletedTradeId, 'trade-1');
    assert.deepEqual(events.map(item => item.event), [
        context.window.EventType.TRADE_DELETED,
        context.window.EventType.CALCULATION_UPDATED
    ]);
    assert.deepEqual(notifyCalls, ['event']);
});

test('TradeAppService deleteTradesByFund soft deletes related trades and emits batch side effects', async () => {
    const context = loadTradeAppServiceContext();
    const events = trackEvents(context);
    const notifyCalls = [];
    let savedSnapshot = null;

    context.window.LocalStorageAdapter.loadSnapshot = () => ({
        funds: [],
        trades: [
            { id: 'trade-1', fundId: 'fund-1', deletedAt: null },
            { id: 'trade-2', fundId: 'fund-1', deletedAt: null },
            { id: 'trade-3', fundId: 'fund-2', deletedAt: null }
        ],
        syncMeta: {}
    });
    context.window.LocalStorageAdapter.saveSnapshot = (snapshot) => {
        savedSnapshot = snapshot;
        return true;
    };
    context.window.SyncAppService = {
        notifyBusinessDataChanged(source) {
            notifyCalls.push(source);
            return Promise.resolve();
        }
    };

    const result = await context.window.TradeAppService.deleteTradesByFund('fund-1');

    assert.equal(result.success, true);
    assert.equal(result.fundId, 'fund-1');
    assert.equal(JSON.stringify(result.affectedTradeIds), JSON.stringify(['trade-1', 'trade-2']));
    assert.ok(savedSnapshot.trades[0].deletedAt);
    assert.ok(savedSnapshot.trades[1].deletedAt);
    assert.equal(savedSnapshot.trades[2].deletedAt, null);
    assert.deepEqual(events.map(item => item.event), [
        context.window.EventType.TRADE_UPDATED,
        context.window.EventType.CALCULATION_UPDATED
    ]);
    assert.deepEqual(notifyCalls, ['batch-delete']);
});
