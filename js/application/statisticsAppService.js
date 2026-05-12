'use strict';

const StatisticsAppService = {
    _cache: new Map(),

    clearCache() {
        this._cache.clear();
    },

    _getAllFundIds() {
        const funds = window.FundManager.getAllFunds();
        return funds.map(f => f.id);
    },

    _aggregateStats() {
        const fundIds = window.FundManager.getAllFunds().map(f => f.id);
        let totalInvest = 0;
        let totalValue = 0;
        let totalProfit = 0;
        let totalSellAmount = 0;
        let totalRealizedProfit = 0;
        let holdingFundCount = 0;
        let closedFundCount = 0;
        let totalCycles = 0;
        let totalClosedCycles = 0;

        for (const fundId of fundIds) {
            const stats = window.FundManager.getFundStats(fundId);
            if (!stats) {
                continue;
            }

            const summary = stats.summary || {};
            totalInvest += summary.totalInvest || 0;
            totalSellAmount += summary.totalSellAmount || 0;
            totalRealizedProfit += summary.totalRealizedProfit || 0;
            totalValue += summary.currentHolding?.value || 0;
            totalProfit += summary.totalProfit || 0;
            totalCycles += summary.totalCycles || 0;
            totalClosedCycles += summary.closedCycles || 0;

            const hasHolding = (summary.currentHolding?.shares || 0) > 0;
            if (hasHolding) {
                holdingFundCount++;
            }
            if (summary.closedCycles > 0) {
                closedFundCount++;
            }
        }

        return {
            totalInvest,
            totalValue,
            totalProfit,
            totalSellAmount,
            totalRealizedProfit,
            holdingFundCount,
            closedFundCount,
            totalCycles,
            totalClosedCycles
        };
    },

    getAllSummary() {
        const holding = this.getHoldingSummary();
        const closed = this.getClosedSummary();
        const yearly = this.getYearlySummary();
        const monthly = this.getMonthlySummary();

        return {
            holding,
            closed,
            yearly,
            monthly
        };
    },

    getHoldingSummary() {
        const cacheKey = 'holdingSummary';
        if (this._cache.has(cacheKey)) {
            return this._cache.get(cacheKey);
        }

        const aggregated = this._aggregateStats();
        const profitRate = aggregated.totalInvest > 0
            ? (aggregated.totalProfit / aggregated.totalInvest * 100)
            : 0;

        const result = {
            totalInvest: aggregated.totalInvest,
            totalValue: aggregated.totalValue,
            totalProfit: aggregated.totalProfit,
            profitRate: profitRate,
            fundCount: aggregated.holdingFundCount
        };

        this._cache.set(cacheKey, result);
        return result;
    },

    getClosedSummary() {
        const cacheKey = 'closedSummary';
        if (this._cache.has(cacheKey)) {
            return this._cache.get(cacheKey);
        }

        const aggregated = this._aggregateStats();
        const profitRate = aggregated.totalInvest > 0
            ? (aggregated.totalRealizedProfit / aggregated.totalInvest * 100)
            : 0;

        const result = {
            totalInvest: aggregated.totalInvest,
            totalSellAmount: aggregated.totalSellAmount,
            totalProfit: aggregated.totalRealizedProfit,
            profitRate: profitRate,
            fundCount: aggregated.closedFundCount
        };

        this._cache.set(cacheKey, result);
        return result;
    },

    getYearlySummary() {
        const cacheKey = 'yearlySummary';
        if (this._cache.has(cacheKey)) {
            return this._cache.get(cacheKey);
        }

        const currentYear = new Date().getFullYear();
        const fundIds = window.FundManager.getAllFunds().map(f => f.id);

        let totalProfit = 0;
        let totalInvest = 0;
        let sellAmount = 0;
        let fee = 0;
        let cycleCount = 0;

        for (const fundId of fundIds) {
            const stats = window.FundManager.getFundStats(fundId);
            if (!stats) {
                continue;
            }

            const cycles = stats.cycles || [];
            for (const cycle of cycles) {
                if (cycle.status === 'closed' || cycle.trades?.some(t => {
                    const tradeYear = new Date(t.date).getFullYear();
                    return tradeYear === currentYear && t.type === 'sell';
                })) {
                    const cycleYear = new Date(cycle.startDate).getFullYear();
                    if (cycleYear === currentYear) {
                        totalInvest += cycle.totalInvest || 0;
                        sellAmount += cycle.totalSellAmount || 0;
                        fee += (cycle.totalBuyFee || 0) + (cycle.totalSellFee || 0);
                        totalProfit += cycle.totalProfit || 0;
                        cycleCount++;
                    }
                }
            }
        }

        const result = {
            year: currentYear,
            totalProfit,
            totalInvest,
            sellAmount,
            fee,
            cycleCount
        };

        this._cache.set(cacheKey, result);
        return result;
    },

    getMonthlySummary() {
        const cacheKey = 'monthlySummary';
        if (this._cache.has(cacheKey)) {
            return this._cache.get(cacheKey);
        }

        const now = new Date();
        const result = [];

        for (let i = 0; i < 6; i++) {
            const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const year = targetDate.getFullYear();
            const month = targetDate.getMonth() + 1;
            const monthKey = `${year}-${String(month).padStart(2, '0')}`;
            const monthStart = new Date(year, month - 1, 1);
            const monthEnd = new Date(year, month, 0);

            const fundIds = window.FundManager.getAllFunds().map(f => f.id);

            let totalProfit = 0;
            let totalInvest = 0;
            let sellAmount = 0;
            let fee = 0;
            let cycleCount = 0;

            for (const fundId of fundIds) {
                const stats = window.FundManager.getFundStats(fundId);
                if (!stats) {
                    continue;
                }

                const cycles = stats.cycles || [];
                for (const cycle of cycles) {
                    const hasTradesInMonth = cycle.trades?.some(t => {
                        const tradeDate = new Date(t.date);
                        return tradeDate >= monthStart && tradeDate <= monthEnd;
                    });

                    if (hasTradesInMonth) {
                        totalInvest += cycle.totalInvest || 0;
                        sellAmount += cycle.totalSellAmount || 0;
                        fee += (cycle.totalBuyFee || 0) + (cycle.totalSellFee || 0);
                        totalProfit += cycle.totalProfit || 0;
                        cycleCount++;
                    }
                }
            }

            result.push({
                year,
                month,
                monthKey,
                totalProfit,
                totalInvest,
                sellAmount,
                fee,
                cycleCount
            });
        }

        this._cache.set(cacheKey, result);
        return result;
    }
};

EventBus.on(EventType.CALCULATION_UPDATED, () => StatisticsAppService.clearCache());

ModuleRegistry.register('StatisticsAppService', StatisticsAppService);
