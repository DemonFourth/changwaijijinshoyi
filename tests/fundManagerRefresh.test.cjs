const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadScripts } = require('./helpers/loadBrowserModules.cjs');

const root = path.resolve(__dirname, '..');

function script(relativePath) {
    return path.join(root, relativePath);
}

test('Detail page flow should not mark the same fund refresh as repeated pending changes', async () => {
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
        script('js/repositories/fundRepository.js'),
        script('js/application/fundAppService.js')
    ]);

    let notifyCount = 0;
    context.window.SyncAppService = {
        async notifyBusinessDataChanged() {
            notifyCount += 1;
        }
    };

    await context.window.FundAppService.addFund({ id: 'fund-1', code: '012922', name: '测试基金' });
    await context.window.FundAppService.updateFund('fund-1', {
        netValue: 1,
        netValueDate: '2026-05-09',
        estimatedValue: 1,
        estimatedGrowth: '0.00%',
        updateTime: '2026-05-09T00:00:00.000Z'
    });

    assert.equal(notifyCount, 2);
});
