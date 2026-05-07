const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadScripts } = require('./helpers/loadBrowserModules.cjs');

const root = path.resolve(__dirname, '..');

function script(relativePath) {
    return path.join(root, relativePath);
}

test('DetailHoldingHelper returns cleared labels when holding shares are zero', () => {
    const context = loadScripts([
        script('js/namespace.js'),
        script('js/moduleRegistry.js'),
        script('js/eventBus.js'),
        script('js/config.js'),
        script('js/utils.js'),
        script('js/detail/detailHoldingHelper.js')
    ]);

    assert.ok(context.window.DetailHoldingHelper, 'expected DetailHoldingHelper to exist');
    const viewModel = context.window.DetailHoldingHelper.buildHoldingViewModel({
        currentHolding: { shares: 0, cost: 0, costPerShare: 0, marketValue: 0 },
        totalProfit: 120,
        profitRate: 15
    });

    assert.equal(viewModel.isCleared, true);
    assert.equal(viewModel.rateText, '已清仓');
});

test('DetailHoldingHelper formats active holding rate', () => {
    const context = loadScripts([
        script('js/namespace.js'),
        script('js/moduleRegistry.js'),
        script('js/eventBus.js'),
        script('js/config.js'),
        script('js/utils.js'),
        script('js/detail/detailHoldingHelper.js')
    ]);

    const viewModel = context.window.DetailHoldingHelper.buildHoldingViewModel({
        currentHolding: { shares: 10, cost: 100, costPerShare: 10, marketValue: 120 },
        totalProfit: 20,
        profitRate: 20
    });

    assert.equal(viewModel.isCleared, false);
    assert.match(viewModel.rateText, /20.00%/);
});
