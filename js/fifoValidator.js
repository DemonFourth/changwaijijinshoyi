/**
 * FIFO验证控制器
 * 协调FIFO计算与移动加权平均计算的结果对比
 */

const FIFOValidator = {
    TOLERANCE: 0.01,

    verifyFund(fundId) {
        var fund = FundManager.getFund(fundId);
        if (!fund) {
            return {
                success: false,
                error: '基金不存在'
            };
        }

        var trades = TradeManager.getTradesByFund(fundId);
        if (!trades || trades.length === 0) {
            return {
                success: true,
                consistent: true,
                message: '无交易记录，验证通过'
            };
        }

        var currentNetValue = parseFloat(fund.netValue) || 0;

        var fifoResult = FIFOCalculator.calculate(trades, currentNetValue);

        var sortedTrades = trades.slice().sort(function(a, b) {
            return new Date(a.date) - new Date(b.date);
        });
        var weightedResult = CalculatorV2.calculateFundProfit(sortedTrades, currentNetValue);

        var comparison = FIFOValidator.compareResults(fifoResult, weightedResult);

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
        var differences = [];
        var consistent = true;

        var items = [
            { name: '总收益', fifo: fifoResult.totalProfit, weighted: weightedResult.totalProfit },
            { name: '已实现收益', fifo: fifoResult.realizedProfit, weighted: weightedResult.realizedProfit },
            { name: '浮动收益', fifo: fifoResult.floatingProfit, weighted: weightedResult.floatingProfit },
            { name: '持仓成本', fifo: fifoResult.holdingCost, weighted: weightedResult.holdingCost },
            { name: '持有份额', fifo: fifoResult.holdingShares, weighted: weightedResult.holdingShares }
        ];

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var diff = Math.abs(item.fifo - item.weighted);
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

        var msg = '❌ 验证失败\nFIFO与移动加权平均计算结果不一致\n\n';
        var diffs = validationResult.differences;
        for (var i = 0; i < diffs.length; i++) {
            var d = diffs[i];
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
