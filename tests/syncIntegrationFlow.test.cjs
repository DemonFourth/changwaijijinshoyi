const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadScripts } = require('./helpers/loadBrowserModules.cjs');

const root = path.resolve(__dirname, '..');

function script(relativePath) {
    return path.join(root, relativePath);
}

function createContext() {
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
        script('js/storage/localSyncAdapter.js'),
        script('js/storage/syncAdapterRegistry.js'),
        script('js/repositories/fundRepository.js'),
        script('js/repositories/tradeRepository.js'),
        script('js/application/fundAppService.js'),
        script('js/application/tradeAppService.js'),
        script('js/application/syncAppService.js')
    ]);
}

test('integration: local change becomes pending and is pushed to adapter', async () => {
    const context = createContext();
    let pushPayload = null;

    const adapter = {
        getStatus() {
            return { provider: 'cloudflare', canPush: true, canPull: true };
        },
        async push(funds, trades) {
            pushPayload = { funds, trades };
            return { success: true, revision: 3 };
        }
    };

    context.window.SyncAdapterRegistry.getCurrentAdapter = () => adapter;
    context.window.LocalStorageAdapter.getCurrentSyncAdapter = () => adapter;
    context.window.SyncAppService._getNowIso = () => '2026-05-08T12:00:00.000Z';

    await context.window.FundAppService.addFund({ id: 'fund-1', code: '000001', name: '测试基金' });
    await context.window.SyncAppService._executePush();

    assert.equal(Array.isArray(pushPayload.funds), true);
    assert.equal(pushPayload.funds.length, 1);
});

test('integration: adding trade schedules push and sends trade payload to cloud adapter', async () => {
    const context = createContext();
    let pushPayload = null;

    context.setTimeout = (callback) => {
        callback();
        return 1;
    };
    context.clearTimeout = () => {};

    const adapter = {
        getStatus() {
            return { provider: 'cloudflare', canPush: true, canPull: true };
        },
        async push(funds, trades) {
            pushPayload = { funds, trades };
            return { success: true, revision: 4 };
        }
    };

    context.window.SyncAdapterRegistry.getCurrentAdapter = () => adapter;
    context.window.LocalStorageAdapter.getCurrentSyncAdapter = () => adapter;
    context.window.SyncAppService._getNowIso = () => '2026-05-08T12:00:00.000Z';

    await context.window.FundAppService.addFund({ id: 'fund-1', code: '000001', name: '测试基金' });
    await context.window.TradeAppService.addTrade({
        id: 'trade-1',
        fundId: 'fund-1',
        date: '2026-05-08',
        type: 'buy',
        netValue: 1.23,
        shares: 100,
        amount: 123,
        fee: 0
    });

    assert.equal(Array.isArray(pushPayload.trades), true);
    assert.equal(pushPayload.trades.length, 1);
    assert.equal(pushPayload.trades[0].syncId, 'trade-1');
});

test('integration: pull merges remote changes into local snapshot', async () => {
    const context = createContext();

    context.window.LocalStorageAdapter.saveSnapshot({
        ...context.window.StorageSchema.createEmptySnapshot(),
        funds: [{ id: 'fund-1', syncId: 'fund-1', updatedAt: '2026-05-08T10:00:00.000Z', lastSyncedAt: '2026-05-08T10:00:00.000Z' }],
        trades: [],
        syncMeta: context.window.LocalStorageAdapter.getSyncMeta()
    });

    const adapter = {
        getStatus() {
            return { canPull: true, canPush: true };
        },
        async pull() {
            return {
                success: true,
                funds: [
                    { id: 'fund-1', syncId: 'fund-1', updatedAt: '2026-05-08T10:00:00.000Z', lastSyncedAt: '2026-05-08T10:00:00.000Z' },
                    { id: 'fund-2', syncId: 'fund-2', updatedAt: '2026-05-08T11:00:00.000Z', lastSyncedAt: null }
                ],
                trades: []
            };
        },
        markSyncComplete() {}
    };

    context.window.LocalStorageAdapter.getCurrentSyncAdapter = () => adapter;

    await context.window.SyncAppService._executePull();

    const snapshot = context.window.LocalStorageAdapter.loadSnapshot();
    assert.equal(snapshot.funds.length, 2);
});

test('integration: conflicting local and remote edits are surfaced as conflicts', async () => {
    const context = createContext();

    context.window.LocalStorageAdapter.saveSnapshot({
        ...context.window.StorageSchema.createEmptySnapshot(),
        funds: [{
            id: 'fund-1',
            syncId: 'fund-1',
            updatedAt: '2026-05-08T12:00:00.000Z',
            lastSyncedAt: '2026-05-08T10:00:00.000Z'
        }],
        trades: [],
        syncMeta: context.window.LocalStorageAdapter.getSyncMeta()
    });

    const adapter = {
        getStatus() {
            return { canPull: true, canPush: true };
        },
        async pull() {
            return {
                success: true,
                funds: [{
                    id: 'fund-1',
                    syncId: 'fund-1',
                    updatedAt: '2026-05-08T12:30:00.000Z',
                    lastSyncedAt: '2026-05-08T10:00:00.000Z'
                }],
                trades: []
            };
        },
        markSyncComplete() {}
    };

    context.window.LocalStorageAdapter.getCurrentSyncAdapter = () => adapter;

    const result = await context.window.SyncAppService._executePull();

    assert.equal(result.hasConflicts, true);
    assert.equal(result.conflicts.length, 1);
});
