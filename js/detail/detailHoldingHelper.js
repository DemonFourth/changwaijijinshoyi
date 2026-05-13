const DetailHoldingHelper = {
    buildHoldingViewModel(summary) {
        const currentHolding = summary.currentHolding || {};
        const isCleared = Utils.isNonPositive(currentHolding.shares || 0);

        return {
            isCleared,
            rateText: isCleared ? '已清仓' : Utils.formatPercent(summary.profitRate || 0, 2)
        };
    }
};

ModuleRegistry.register('DetailHoldingHelper', DetailHoldingHelper);
