const DetailHoldingHelper = {
    buildHoldingViewModel(summary) {
        const currentHolding = summary.currentHolding || {};
        const EPSILON = 0.0001;
        const isCleared = (currentHolding.shares || 0) <= EPSILON;

        return {
            isCleared,
            rateText: isCleared ? '已清仓' : Utils.formatPercent(summary.profitRate || 0, 2)
        };
    }
};

ModuleRegistry.register('DetailHoldingHelper', DetailHoldingHelper);
