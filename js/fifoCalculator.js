/**
 * FIFO计算引擎
 * 使用先进先出法计算基金收益，用于验证移动加权平均法的计算结果
 */

const FIFOCalculator = {
    EPSILON: 0.0001,

    calculate(trades, currentNetValue) {
        if (!trades || trades.length === 0) {
            return {
                totalProfit: 0,
                realizedProfit: 0,
                floatingProfit: 0,
                totalCost: 0,
                holdingShares: 0,
                holdingCost: 0,
                cycles: []
            };
        }

        var sortedTrades = trades.slice().sort(function(a, b) {
            return new Date(a.date) - new Date(b.date);
        });

        var cycles = CalculatorV2.identifyHoldingCycles(sortedTrades);
        if (!cycles || cycles.length === 0) {
            cycles = [{
                id: 1,
                status: 'active',
                startDate: sortedTrades[0].date,
                endDate: null,
                trades: sortedTrades
            }];
        }

        var totalRealizedProfit = 0;
        var totalHoldingCost = 0;
        var totalHoldingShares = 0;
        var cycleResults = [];

        for (var i = 0; i < cycles.length; i++) {
            var cycle = cycles[i];
            var cycleResult = FIFOCalculator.calculateCycle(cycle);
            cycleResults.push(cycleResult);
            totalRealizedProfit += cycleResult.realizedProfit;
            totalHoldingShares += cycleResult.holdingShares;
            totalHoldingCost += cycleResult.holdingCost;
        }

        var netValue = parseFloat(currentNetValue) || 0;
        var floatingProfit = (totalHoldingShares * netValue) - totalHoldingCost;
        var totalProfit = totalRealizedProfit + floatingProfit;

        return {
            totalProfit: totalProfit,
            realizedProfit: totalRealizedProfit,
            floatingProfit: floatingProfit,
            totalCost: totalHoldingCost,
            holdingShares: totalHoldingShares,
            holdingCost: totalHoldingCost,
            cycles: cycleResults
        };
    },

    calculateCycle(cycle) {
        var holdingQueue = [];
        var realizedProfit = 0;
        var holdingShares = 0;
        var holdingCost = 0;

        var trades = cycle.trades || [];
        for (var i = 0; i < trades.length; i++) {
            var trade = trades[i];
            var shares = parseFloat(trade.shares) || 0;
            var amount = parseFloat(trade.amount) || 0;
            var fee = parseFloat(trade.fee) || 0;

            if (trade.type === 'buy') {
                var costPerShare = shares > 0 ? amount / shares : 0;
                holdingQueue.push({
                    shares: shares,
                    cost: amount,
                    date: trade.date,
                    costPerShare: costPerShare
                });
                holdingShares += shares;
                holdingCost += amount;
            } else if (trade.type === 'sell') {
                var sellCost = FIFOCalculator.dequeueCost(holdingQueue, shares);
                var profit = amount - sellCost;
                realizedProfit += profit;
                holdingShares -= shares;
                holdingCost -= sellCost;
            } else if (trade.type === 'dividend') {
                var dividendMode = trade.dividendMode || 'cash';
                if (dividendMode === 'reinvest' && trade.reinvestShares) {
                    var reinvestShares = parseFloat(trade.reinvestShares) || 0;
                    var costPerShare = reinvestShares > 0 ? amount / reinvestShares : 0;
                    holdingQueue.push({
                        shares: reinvestShares,
                        cost: amount,
                        date: trade.date,
                        costPerShare: costPerShare
                    });
                    holdingShares += reinvestShares;
                    holdingCost += amount;
                } else {
                    realizedProfit += amount;
                }
            }
        }

        return {
            cycleId: cycle.id,
            realizedProfit: realizedProfit,
            holdingShares: holdingShares,
            holdingCost: holdingCost,
            tradeCount: trades.length
        };
    },

    dequeueCost(queue, sellShares) {
        var totalCost = 0;
        var remaining = sellShares;

        while (remaining > FIFOCalculator.EPSILON && queue.length > 0) {
            var head = queue[0];
            if (head.shares <= remaining + FIFOCalculator.EPSILON) {
                totalCost += head.cost;
                remaining -= head.shares;
                queue.shift();
            } else {
                var ratio = remaining / head.shares;
                totalCost += head.cost * ratio;
                head.shares -= remaining;
                head.cost = head.shares * head.costPerShare;
                remaining = 0;
            }
        }

        return totalCost;
    }
};

if (typeof ModuleRegistry !== 'undefined') {
    ModuleRegistry.register('FIFOCalculator', FIFOCalculator);
}
