/**
 * FIFO计算引擎
 * 使用先进先出法计算基金收益，用于验证移动加权平均法的计算结果
 */

const FIFOCalculator = {
    EPSILON: 0.0001,

    calculate(trades, currentNetValue) {
        const result = this.calculateWithDetails(trades, currentNetValue);
        return {
            totalProfit: result.totalProfit,
            realizedProfit: result.realizedProfit,
            floatingProfit: result.floatingProfit,
            totalCost: result.totalCost,
            holdingShares: result.holdingShares,
            holdingCost: result.holdingCost
        };
    },

    calculateWithDetails(trades, currentNetValue) {
        if (!trades || trades.length === 0) {
            return {
                totalProfit: 0,
                realizedProfit: 0,
                floatingProfit: 0,
                totalCost: 0,
                holdingShares: 0,
                holdingCost: 0,
                steps: []
            };
        }

        const sortedTrades = trades.slice().sort(function(a, b) {
            return new Date(a.date) - new Date(b.date);
        });

        let cycles = CalculatorV2.identifyHoldingCycles(sortedTrades);
        if (!cycles || cycles.length === 0) {
            cycles = [{
                id: 1,
                status: 'active',
                startDate: sortedTrades[0].date,
                endDate: null,
                trades: sortedTrades
            }];
        }

        let totalRealizedProfit = 0;
        let totalHoldingCost = 0;
        let totalHoldingShares = 0;
        const steps = [];

        for (let i = 0; i < cycles.length; i++) {
            const cycle = cycles[i];
            const cycleResult = FIFOCalculator.calculateCycleWithDetails(cycle, i + 1);
            steps.push(...cycleResult.steps);
            totalRealizedProfit += cycleResult.realizedProfit;
            totalHoldingShares += cycleResult.holdingShares;
            totalHoldingCost += cycleResult.holdingCost;
        }

        const netValue = parseFloat(currentNetValue) || 0;
        const holdingValue = totalHoldingShares * netValue;
        const floatingProfit = holdingValue - totalHoldingCost;
        const totalProfit = totalRealizedProfit + floatingProfit;

        return {
            totalProfit: totalProfit,
            realizedProfit: totalRealizedProfit,
            floatingProfit: floatingProfit,
            totalCost: totalHoldingCost,
            holdingShares: totalHoldingShares,
            holdingCost: totalHoldingCost,
            steps: steps
        };
    },

    calculateCycle(cycle) {
        const holdingQueue = [];
        let realizedProfit = 0;
        let holdingShares = 0;
        let holdingCost = 0;

        const trades = cycle.trades || [];
        for (let i = 0; i < trades.length; i++) {
            const trade = trades[i];
            const shares = parseFloat(trade.shares) || 0;
            const amount = parseFloat(trade.amount) || 0;

            if (trade.type === 'buy') {
                const costPerShare = shares > 0 ? amount / shares : 0;
                holdingQueue.push({
                    shares: shares,
                    cost: amount,
                    date: trade.date,
                    costPerShare: costPerShare
                });
                holdingShares += shares;
                holdingCost += amount;
            } else if (trade.type === 'sell') {
                const sellCost = FIFOCalculator.dequeueCost(holdingQueue, shares);
                const profit = amount - sellCost;
                realizedProfit += profit;
                holdingShares -= shares;
                holdingCost -= sellCost;
            } else if (trade.type === 'dividend') {
                const dividendMode = trade.dividendMode || 'cash';
                if (dividendMode === 'reinvest' && trade.reinvestShares) {
                    const reinvestShares = parseFloat(trade.reinvestShares) || 0;
                    const costPerShare = reinvestShares > 0 ? amount / reinvestShares : 0;
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
        let totalCost = 0;
        let remaining = sellShares;

        while (remaining > FIFOCalculator.EPSILON && queue.length > 0) {
            const head = queue[0];
            if (head.shares <= remaining + FIFOCalculator.EPSILON) {
                totalCost += head.cost;
                remaining -= head.shares;
                queue.shift();
            } else {
                const ratio = remaining / head.shares;
                totalCost += head.cost * ratio;
                head.shares -= remaining;
                head.cost = head.shares * head.costPerShare;
                remaining = 0;
            }
        }

        return totalCost;
    },

    calculateCycleWithDetails(cycle, _cycleIndex) {
        const holdingQueue = [];
        let realizedProfit = 0;
        let holdingShares = 0;
        let holdingCost = 0;
        const steps = [];

        const trades = cycle.trades || [];
        for (let i = 0; i < trades.length; i++) {
            const trade = trades[i];
            const shares = parseFloat(trade.shares) || 0;
            const amount = parseFloat(trade.amount) || 0;
            const fee = parseFloat(trade.fee) || 0;

            const step = {
                step: i + 1,
                date: trade.date,
                type: trade.type,
                shares: shares,
                amount: amount,
                fee: fee,
                holdingShares: holdingShares,
                holdingCost: holdingCost,
                realizedProfit: 0,
                method: 'FIFO'
            };

            if (trade.type === 'buy') {
                const costPerShare = shares > 0 ? amount / shares : 0;
                holdingQueue.push({
                    shares: shares,
                    cost: amount,
                    date: trade.date,
                    costPerShare: costPerShare
                });
                holdingShares += shares;
                holdingCost += amount;
                step.holdingShares = holdingShares;
                step.holdingCost = holdingCost;
                step.note = `成本价 ${costPerShare.toFixed(4)}`;
            } else if (trade.type === 'sell') {
                const sellCost = FIFOCalculator.dequeueCost(holdingQueue, shares);
                const profit = amount - sellCost;
                const costPerShare = shares > 0 ? sellCost / shares : 0;
                realizedProfit += profit;
                holdingShares -= shares;
                holdingCost -= sellCost;
                step.holdingShares = holdingShares;
                step.holdingCost = holdingCost;
                step.realizedProfit = profit;
                step.note = `卖出成本 ${costPerShare.toFixed(4)}，卖出份额出${shares.toFixed(2)}`;
            } else if (trade.type === 'dividend') {
                const dividendMode = trade.dividendMode || 'cash';
                if (dividendMode === 'reinvest' && trade.reinvestShares) {
                    const reinvestShares = parseFloat(trade.reinvestShares) || 0;
                    const costPerShare = reinvestShares > 0 ? amount / reinvestShares : 0;
                    holdingQueue.push({
                        shares: reinvestShares,
                        cost: amount,
                        date: trade.date,
                        costPerShare: costPerShare
                    });
                    holdingShares += reinvestShares;
                    holdingCost += amount;
                    step.holdingShares = holdingShares;
                    step.holdingCost = holdingCost;
                    step.note = `红利再投 ${reinvestShares.toFixed(2)}份`;
                } else {
                    realizedProfit += amount;
                    step.note = '现金分红';
                }
            }

            steps.push(step);
        }

        return {
            cycleId: cycle.id,
            realizedProfit: realizedProfit,
            holdingShares: holdingShares,
            holdingCost: holdingCost,
            steps: steps
        };
    }
};

if (typeof ModuleRegistry !== 'undefined') {
    ModuleRegistry.register('FIFOCalculator', FIFOCalculator);
}
