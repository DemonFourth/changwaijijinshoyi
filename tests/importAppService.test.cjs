const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadScripts } = require('./helpers/loadBrowserModules.cjs');

const root = path.resolve(__dirname, '..');

function script(relativePath) {
    return path.join(root, relativePath);
}

function loadImportAppServiceContext() {
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
        script('js/application/importAppService.js')
    ]);
}

test('ImportAppService importData merges business data and emits one import event', async () => {
    const context = loadImportAppServiceContext();
    const importedEvents = [];
    const notifyCalls = [];
    let savedFunds = null;
    let savedTrades = null;
    let savedSettings = null;
    let syncMetaUpdates = null;

    context.window.FundRepository.getAll = () => [
        context.window.StorageSchema.createFundEntity({ id: 'fund-1', code: '000001', name: '原基金' })
    ];
    context.window.TradeRepository.getAll = () => [
        context.window.StorageSchema.createTradeEntity({
            id: 'trade-1',
            fundId: 'fund-1',
            date: '2024-01-01',
            type: 'buy',
            netValue: 1,
            shares: 10,
            amount: 10,
            fee: 0
        })
    ];
    context.window.FundRepository.saveAll = (funds) => {
        savedFunds = funds;
        return true;
    };
    context.window.TradeRepository.saveAll = (trades) => {
        savedTrades = trades;
        return true;
    };
    context.window.Storage.saveSettings = (settings) => {
        savedSettings = settings;
        return true;
    };
    context.window.Storage.loadSettings = () => ({ theme: 'dark' });
    context.window.LocalStorageAdapter.getSyncMeta = () => ({
        provider: 'cloudflare',
        deviceId: 'device-1',
        cloudRevision: 9,
        pendingChanges: 2,
        syncStatus: 'pending'
    });
    context.window.LocalStorageAdapter.updateSyncMeta = (updates) => {
        syncMetaUpdates = updates;
        return true;
    };
    context.window.SyncAppService = {
        notifyBusinessDataChanged(source) {
            notifyCalls.push(source);
            return Promise.resolve();
        }
    };

    context.window.EventBus.on(context.window.EventType.DATA_IMPORTED, (payload) => {
        importedEvents.push(payload);
    });

    const result = await context.window.ImportAppService.importData({
        funds: [
            { id: 'fund-2', code: '000002', name: '新基金' }
        ],
        trades: [
            {
                id: 'trade-2',
                fundId: 'fund-2',
                date: '2024-01-02',
                type: 'buy',
                netValue: 1.2,
                shares: 20,
                amount: 24,
                fee: 0.1
            }
        ],
        settings: { defaultViewMode: 'list' },
        syncMeta: {
            provider: 'malicious',
            deviceId: 'evil',
            cloudRevision: -1,
            pendingChanges: 999
        }
    }, { merge: true });

    assert.equal(result.success, true);
    assert.equal(result.mode, 'merge');
    assert.equal(savedFunds.length, 2);
    assert.equal(savedTrades.length, 2);
    assert.equal(JSON.stringify(savedSettings), JSON.stringify({ theme: 'dark', defaultViewMode: 'list' }));
    assert.equal(importedEvents.length, 1);
    assert.equal(notifyCalls.length, 1);
    assert.equal(notifyCalls[0], 'import');
    assert.equal(syncMetaUpdates.provider, 'cloudflare');
    assert.equal(syncMetaUpdates.deviceId, 'device-1');
    assert.equal(syncMetaUpdates.cloudRevision, 9);
    assert.equal(syncMetaUpdates.pendingChanges, 0);
    assert.equal(syncMetaUpdates.syncStatus, 'pending');
}
);

test('ImportAppService importData rejects invalid payload without persisting', async () => {
    const context = loadImportAppServiceContext();
    let saveFundCalls = 0;
    let saveTradeCalls = 0;

    context.window.FundRepository.saveAll = () => {
        saveFundCalls++;
        return true;
    };
    context.window.TradeRepository.saveAll = () => {
        saveTradeCalls++;
        return true;
    };

    const result = await context.window.ImportAppService.importData(null, { merge: false });

    assert.equal(result.success, false);
    assert.equal(saveFundCalls, 0);
    assert.equal(saveTradeCalls, 0);
}
);

test('ImportAppService clearAll clears business data and notifies sync', async () => {
    const context = loadImportAppServiceContext();
    const clearedEvents = [];
    const notifyCalls = [];
    let savedFunds = null;
    let savedTrades = null;
    let syncMetaUpdates = null;

    context.window.FundRepository.saveAll = (funds) => {
        savedFunds = funds;
        return true;
    };
    context.window.TradeRepository.saveAll = (trades) => {
        savedTrades = trades;
        return true;
    };
    context.window.LocalStorageAdapter.getSyncMeta = () => ({
        provider: 'cloudflare',
        deviceId: 'device-1',
        cloudRevision: 9,
        pendingChanges: 3,
        syncStatus: 'syncing'
    });
    context.window.LocalStorageAdapter.updateSyncMeta = (updates) => {
        syncMetaUpdates = updates;
        return true;
    };
    context.window.SyncAppService = {
        notifyBusinessDataChanged(source) {
            notifyCalls.push(source);
            return Promise.resolve();
        }
    };

    context.window.EventBus.on(context.window.EventType.DATA_CLEARED, () => {
        clearedEvents.push('cleared');
    });

    const result = await context.window.ImportAppService.clearAll();

    assert.equal(result.success, true);
    assert.equal(result.mode, 'clear');
    assert.equal(JSON.stringify(savedFunds), JSON.stringify([]));
    assert.equal(JSON.stringify(savedTrades), JSON.stringify([]));
    assert.equal(clearedEvents.length, 1);
    assert.deepEqual(notifyCalls, ['clear']);
    assert.equal(syncMetaUpdates.pendingChanges, 0);
    assert.equal(syncMetaUpdates.cloudRevision, 9);
}
);
