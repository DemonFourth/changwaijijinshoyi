const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadScripts } = require('./helpers/loadBrowserModules.cjs');

const root = path.resolve(__dirname, '..');

function script(relativePath) {
    return path.join(root, relativePath);
}

function loadFundAppServiceContext() {
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
        script('js/application/fundAppService.js')
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

test('FundAppService addFund normalizes persisted fields and emits sync side effects', async () => {
    const context = loadFundAppServiceContext();
    const events = trackEvents(context);
    const savedPayloads = [];
    const notifyCalls = [];

    context.window.FundRepository.getAll = () => [];
    context.window.FundRepository.saveAll = (funds) => {
        savedPayloads.push(funds);
        return true;
    };
    context.window.SyncAppService = {
        notifyBusinessDataChanged(source) {
            notifyCalls.push(source);
            return Promise.resolve();
        }
    };

    const result = await context.window.FundAppService.addFund({
        id: 'fund-1',
        code: '000001',
        name: '测试基金'
    });

    assert.equal(result.success, true);
    assert.equal(result.fund.id, 'fund-1');
    assert.equal(savedPayloads.length, 1);
    assert.equal(savedPayloads[0][0].syncId, 'fund-1');
    assert.equal(savedPayloads[0][0].deletedAt, null);
    assert.deepEqual(events.map(item => item.event), [
        context.window.EventType.FUND_ADDED,
        context.window.EventType.FUND_UPDATED
    ]);
    assert.deepEqual(notifyCalls, ['event']);
});

test('FundAppService updateFund refreshes updatedAt and emits update side effects', async () => {
    const context = loadFundAppServiceContext();
    const events = trackEvents(context);
    const notifyCalls = [];
    const original = {
        id: 'fund-1',
        code: '000001',
        name: '旧名称',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        syncId: 'fund-1',
        feeTiers: { buyTiers: [], sellTiers: [] }
    };
    let savedFunds = null;

    context.window.FundRepository.getAll = () => [original];
    context.window.FundRepository.saveAll = (funds) => {
        savedFunds = funds;
        return true;
    };
    context.window.SyncAppService = {
        notifyBusinessDataChanged(source) {
            notifyCalls.push(source);
            return Promise.resolve();
        }
    };

    const result = await context.window.FundAppService.updateFund('fund-1', { name: '新名称' });

    assert.equal(result.success, true);
    assert.equal(savedFunds[0].id, 'fund-1');
    assert.equal(savedFunds[0].name, '新名称');
    assert.notEqual(savedFunds[0].updatedAt, original.updatedAt);
    assert.deepEqual(events.map(item => item.event), [context.window.EventType.FUND_UPDATED]);
    assert.deepEqual(notifyCalls, ['event']);
});

test('FundAppService deleteFund soft deletes related trades and emits delete side effects', async () => {
    const context = loadFundAppServiceContext();
    const events = trackEvents(context);
    const notifyCalls = [];
    let savedSnapshot = null;
    let deletedFundId = null;

    context.window.LocalStorageAdapter.loadSnapshot = () => ({
        funds: [{ id: 'fund-1' }],
        trades: [
            { id: 'trade-1', fundId: 'fund-1', deletedAt: null },
            { id: 'trade-2', fundId: 'fund-2', deletedAt: null }
        ],
        syncMeta: {}
    });
    context.window.LocalStorageAdapter.saveSnapshot = (snapshot) => {
        savedSnapshot = snapshot;
        return true;
    };
    context.window.FundRepository.softDelete = (fundId) => {
        deletedFundId = fundId;
        return true;
    };
    context.window.SyncAppService = {
        notifyBusinessDataChanged(source) {
            notifyCalls.push(source);
            return Promise.resolve();
        }
    };

    const result = await context.window.FundAppService.deleteFund('fund-1');

    assert.equal(result.success, true);
    assert.equal(deletedFundId, 'fund-1');
    assert.equal(result.affectedTradeIds.length, 1);
    assert.ok(savedSnapshot.trades[0].deletedAt);
    assert.equal(savedSnapshot.trades[1].deletedAt, null);
    assert.deepEqual(events.map(item => item.event), [
        context.window.EventType.FUND_DELETED,
        context.window.EventType.TRADE_UPDATED,
        context.window.EventType.CALCULATION_UPDATED
    ]);
    assert.deepEqual(notifyCalls, ['event']);
});
