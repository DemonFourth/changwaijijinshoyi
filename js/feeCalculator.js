/**
 * 费率计算引擎
 * 支持买入金额费率和卖出持有天数费率（FIFO逻辑）
 */

const FeeCalculator = {
    EPSILON: 0.0001,

    /**
     * 计算买入手续费
     * @param {number} amount - 买入金额
     * @param {array} buyTiers - 买入费率区间 [{minAmount, maxAmount, rate}]
     * @returns {object} {fee, rate, matchedTier}
     */
    calculateBuyFee(amount, buyTiers) {
        const amt = parseFloat(amount) || 0;
        if (!buyTiers || !Array.isArray(buyTiers) || buyTiers.length === 0) {
            return { fee: 0, rate: 0, matchedTier: null };
        }

        const rate = FeeCalculator.getBuyRate(amt, buyTiers);
        let matchedTier = null;
        for (const tier of buyTiers) {
            const min = parseFloat(tier.minAmount) || 0;
            const max = tier.maxAmount !== null ? parseFloat(tier.maxAmount) : null;
            const meetsMin = amt > min - FeeCalculator.EPSILON;
            const meetsMax = max === null || amt < max + FeeCalculator.EPSILON;
            if (meetsMin && meetsMax) {
                matchedTier = tier;
                break;
            }
        }

        const fee = amt * (rate / 100);
        return { fee: fee, rate: rate, matchedTier: matchedTier };
    },

    /**
     * 获取买入费率
     * @param {number} amount - 买入金额
     * @param {array} buyTiers - 买入费率区间
     * @returns {number} 费率百分比
     */
    getBuyRate(amount, buyTiers) {
        const amt = parseFloat(amount) || 0;
        if (!buyTiers || !Array.isArray(buyTiers)) {
            return 0;
        }

        for (const tier of buyTiers) {
            const min = parseFloat(tier.minAmount) || 0;
            const max = tier.maxAmount !== null ? parseFloat(tier.maxAmount) : null;
            const rate = parseFloat(tier.rate) || 0;
            const meetsMin = amt > min - FeeCalculator.EPSILON;
            const meetsMax = max === null || amt < max + FeeCalculator.EPSILON;
            if (meetsMin && meetsMax) {
                return rate;
            }
        }
        return 0;
    },

    /**
     * 获取卖出费率
     * @param {number} holdingDays - 持有天数
     * @param {array} sellTiers - 卖出费率区间 [{minDays, maxDays, rate}]
     * @returns {number} 费率百分比
     */
    getSellRate(holdingDays, sellTiers) {
        const days = parseInt(holdingDays) || 0;
        if (!sellTiers || !Array.isArray(sellTiers)) {
            return 0;
        }

        for (const tier of sellTiers) {
            const min = parseInt(tier.minDays) || 0;
            const max = tier.maxDays !== null ? parseInt(tier.maxDays) : null;
            const rate = parseFloat(tier.rate) || 0;
            const meetsMin = days > min - FeeCalculator.EPSILON;
            const meetsMax = max === null || days < max + FeeCalculator.EPSILON;
            if (meetsMin && meetsMax) {
                return rate;
            }
        }
        return 0;
    },

    /**
     * 计算卖出手续费（FIFO逻辑）
     * @param {object} sellTrade - 卖出交易 {date, shares, netValue, id}
     * @param {array} allTrades - 所有交易记录
     * @param {array} sellTiers - 卖出费率区间 [{minDays, maxDays, rate}]
     * @returns {object} {fee, details: [{fromDate, toDate, days, shares, rate, fee}]}
     */
    calculateSellFee(sellTrade, allTrades, sellTiers) {
        if (!sellTrade || !allTrades || !Array.isArray(allTrades) || !sellTiers || sellTiers.length === 0) {
            return { fee: 0, details: [] };
        }

        const sellShares = parseFloat(sellTrade.shares) || 0;
        if (sellShares <= FeeCalculator.EPSILON) {
            return { fee: 0, details: [] };
        }

        const sellDate = new Date(sellTrade.date);
        if (isNaN(sellDate.getTime())) {
            return { fee: 0, details: [] };
        }

        // 构建FIFO队列（排除当前卖出交易）
        const holdingQueue = [];
        for (const trade of allTrades) {
            if (trade.id === sellTrade.id) continue;
            const tradeDate = new Date(trade.date);
            if (tradeDate >= sellDate) continue;

            if (trade.type === 'buy') {
                const shares = parseFloat(trade.shares) || 0;
                if (shares > FeeCalculator.EPSILON) {
                    holdingQueue.push({
                        shares: shares,
                        date: trade.date
                    });
                }
            } else if (trade.type === 'sell') {
                const tradeShares = parseFloat(trade.shares) || 0;
                let remainingSell = tradeShares;
                while (remainingSell > FeeCalculator.EPSILON && holdingQueue.length > 0) {
                    const head = holdingQueue[0];
                    if (head.shares <= remainingSell + FeeCalculator.EPSILON) {
                        remainingSell -= head.shares;
                        holdingQueue.shift();
                    } else {
                        head.shares -= remainingSell;
                        remainingSell = 0;
                    }
                }
            }
        }

        // 按FIFO计算卖出手续费
        const tempQueue = holdingQueue.map(item => ({ shares: item.shares, date: item.date }));
        let remainingSell = sellShares;
        const details = [];
        let totalFee = 0;
        const sellNetValue = parseFloat(sellTrade.netValue) || 0;

        while (remainingSell > FeeCalculator.EPSILON && tempQueue.length > 0) {
            const head = tempQueue[0];
            const portionShares = Math.min(head.shares, remainingSell);
            const buyDate = new Date(head.date);
            const timeDiff = sellDate.getTime() - buyDate.getTime();
            const holdingDays = Math.floor(timeDiff / (1000 * 3600 * 24));
            const rate = FeeCalculator.getSellRate(holdingDays, sellTiers);
            const portionSellAmount = portionShares * sellNetValue;
            const portionFee = portionSellAmount * (rate / 100);

            details.push({
                fromDate: head.date,
                toDate: sellTrade.date,
                days: holdingDays,
                shares: portionShares,
                rate: rate,
                fee: portionFee
            });

            totalFee += portionFee;

            if (head.shares <= remainingSell + FeeCalculator.EPSILON) {
                remainingSell -= head.shares;
                tempQueue.shift();
            } else {
                head.shares -= remainingSell;
                remainingSell = 0;
            }
        }

        return { fee: totalFee, details: details };
    }
};

// 注册到模块系统
ModuleRegistry.register('FeeCalculator', FeeCalculator);
