/**
 * FIFO验证控制器
 * 协调FIFO计算与移动加权平均计算的结果对比
 */

const FIFOValidator = {
    TOLERANCE: 0.01,

    verifyFund(fundId) {
        const fund = FundManager.getFund(fundId);
        if (!fund) {
            return {
                success: false,
                error: '基金不存在'
            };
        }

        const trades = TradeManager.getTradesByFund(fundId);
        if (!trades || trades.length === 0) {
            return {
                success: true,
                consistent: true,
                message: '无交易记录，验证通过'
            };
        }

        const currentNetValue = parseFloat(fund.netValue) || 0;

        const fifoResult = FIFOCalculator.calculate(trades, currentNetValue);

        const sortedTrades = trades.slice().sort(function(a, b) {
            return new Date(a.date) - new Date(b.date);
        });
        const weightedResult = CalculatorV2.calculateFundProfit(sortedTrades, currentNetValue);

        const comparison = FIFOValidator.compareResults(fifoResult, weightedResult);

        return {
            success: true,
            consistent: comparison.consistent,
            fifoResult: fifoResult,
            weightedResult: {
                totalProfit: weightedResult.totalProfit,
                realizedProfit: weightedResult.realizedProfit,
                floatingProfit: weightedResult.floatingProfit,
                totalCost: weightedResult.totalCost,
                holdingShares: weightedResult.holdingShares,
                holdingCost: weightedResult.holdingCost
            },
            differences: comparison.differences,
            message: comparison.consistent ? '验证通过：FIFO与移动加权平均结果一致' : '验证失败：两种方法计算结果不一致'
        };
    },

    compareResults(fifoResult, weightedResult) {
        const differences = [];
        let consistent = true;

        const items = [
            { name: '总收益', fifo: fifoResult.totalProfit, weighted: weightedResult.totalProfit },
            { name: '已实现收益', fifo: fifoResult.realizedProfit, weighted: weightedResult.realizedProfit },
            { name: '浮动收益', fifo: fifoResult.floatingProfit, weighted: weightedResult.floatingProfit },
            { name: '持仓成本', fifo: fifoResult.holdingCost, weighted: weightedResult.holdingCost },
            { name: '持有份额', fifo: fifoResult.holdingShares, weighted: weightedResult.holdingShares }
        ];

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const diff = Math.abs(item.fifo - item.weighted);
            if (diff > FIFOValidator.TOLERANCE) {
                consistent = false;
                differences.push({
                    name: item.name,
                    fifo: item.fifo,
                    weighted: item.weighted,
                    diff: diff
                });
            }
        }

        return {
            consistent: consistent,
            differences: differences
        };
    },

    formatResult(validationResult) {
        if (!validationResult.success) {
            return '验证失败：' + validationResult.error;
        }

        if (validationResult.consistent) {
            return '✅ 验证通过\nFIFO与移动加权平均计算结果一致\n\n' +
                '总收益：' + Utils.formatMoneySmart(validationResult.fifoResult.totalProfit) + '\n' +
                '已实现收益：' + Utils.formatMoneySmart(validationResult.fifoResult.realizedProfit) + '\n' +
                '浮动收益：' + Utils.formatMoneySmart(validationResult.fifoResult.floatingProfit);
        }

        let msg = '❌ 验证失败\nFIFO与移动加权平均计算结果不一致\n\n';
        const diffs = validationResult.differences;
        for (let i = 0; i < diffs.length; i++) {
            const d = diffs[i];
            msg += d.name + ':\n';
            msg += '  FIFO: ' + Utils.formatMoneySmart(d.fifo) + '\n';
            msg += '  加权: ' + Utils.formatMoneySmart(d.weighted) + '\n';
            msg += '  差异: ' + Utils.formatMoneySmart(d.diff) + '\n\n';
        }
        return msg;
    }
};

if (typeof ModuleRegistry !== 'undefined') {
    ModuleRegistry.register('FIFOValidator', FIFOValidator);
}
