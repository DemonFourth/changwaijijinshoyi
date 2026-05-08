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

test('FundAppService addFund normalizes persisted fields', () => {
    const context = loadFundAppServiceContext();
    const savedPayloads = [];

    context.window.FundRepository.getAll = () => [];
    context.window.FundRepository.saveAll = (funds) => {
        savedPayloads.push(funds);
        return true;
    };

    const result = context.window.FundAppService.addFund({
        id: 'fund-1',
        code: '000001',
        name: '测试基金'
    });

    assert.equal(result, true);
    assert.equal(savedPayloads.length, 1);
    assert.equal(savedPayloads[0][0].syncId, 'fund-1');
    assert.equal(savedPayloads[0][0].deletedAt, null);
});

test('FundAppService updateFund refreshes updatedAt and preserves id', () => {
    const context = loadFundAppServiceContext();
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

    const result = context.window.FundAppService.updateFund('fund-1', { name: '新名称' });

    assert.equal(result, true);
    assert.equal(savedFunds[0].id, 'fund-1');
    assert.equal(savedFunds[0].name, '新名称');
    assert.notEqual(savedFunds[0].updatedAt, original.updatedAt);
});

test('FundAppService deleteFund soft deletes related trades in snapshot', () => {
    const context = loadFundAppServiceContext();
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

    const result = context.window.FundAppService.deleteFund('fund-1');

    assert.equal(result, true);
    assert.equal(deletedFundId, 'fund-1');
    assert.ok(savedSnapshot.trades[0].deletedAt);
    assert.equal(savedSnapshot.trades[1].deletedAt, null);
});
