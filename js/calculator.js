/**
 * 收益计算引擎
 * 实现FIFO（先进先出）成本计算算法
 */

const Calculator = {
    /**
     * 计算基金的收益情况
     * @param {array} trades - 交易记录数组
     * @param {number} currentNetValue - 当前净值
     * @returns {object} 计算结果
     */
    calculateFundProfit(trades, currentNetValue) {
        if (!trades || trades.length === 0) {
            return this.getEmptyResult();
        }

        // 按日期排序交易记录
        const sortedTrades = [...trades].sort((a, b) =>
            new Date(a.date) - new Date(b.date)
        );

        // FIFO计算
        const fifoResult = this.calculateFIFO(sortedTrades);

        // 计算持仓收益
        const holdingProfit = this.calculateHoldingProfit(
            fifoResult.totalShares,
            fifoResult.totalCost,
            currentNetValue
        );

        // 计算总收益
        const totalProfit = {
            amount: holdingProfit.profit + fifoResult.totalRealizedProfit,
            rate: fifoResult.totalCost > 0
                ? ((holdingProfit.profit + fifoResult.totalRealizedProfit) / fifoResult.totalCost * 100)
                : 0
        };

        return {
            // 持仓信息
            holding: {
                shares: fifoResult.totalShares,
                cost: fifoResult.totalCost,
                costPerShare: fifoResult.costPerShare,
                value: holdingProfit.value,
                profit: holdingProfit.profit,
                profitRate: holdingProfit.profitRate
            },
            // 已实现收益
            realized: {
                profit: fifoResult.totalRealizedProfit,
                details: fifoResult.realizedProfits
            },
            // 总收益
            total: totalProfit,
            // 持仓队列（用于调试）
            holdingQueue: fifoResult.holdingQueue
        };
    },

    /**
     * FIFO算法核心实现
     * @param {array} trades - 排序后的交易记录
     * @returns {object}
     */
    calculateFIFO(trades) {
        const holdingQueue = []; // 持仓队列
        let totalCost = 0; // 总成本
        let totalShares = 0; // 总份额
        const realizedProfits = []; // 已实现收益记录
        let totalRealizedProfit = 0; // 总已实现收益

        for (const trade of trades) {
            if (trade.type === 'buy') {
                // 买入：加入队列
                const cost = trade.amount + trade.fee;
                holdingQueue.push({
                    tradeId: trade.id,
                    date: trade.date,
                    shares: trade.shares,
                    cost: cost,
                    remainingShares: trade.shares,
                    pricePerShare: cost / trade.shares
                });

                totalCost += cost;
                totalShares += trade.shares;
            } else if (trade.type === 'sell') {
                // 卖出：FIFO匹配
                const result = this.processSell(
                    holdingQueue,
                    trade.shares,
                    trade.amount,
                    trade.fee
                );

                totalShares -= trade.shares;
                totalCost -= result.costAmount;

                realizedProfits.push({
                    tradeId: trade.id,
                    date: trade.date,
                    shares: trade.shares,
                    sellAmount: trade.amount,
                    costAmount: result.costAmount,
                    fee: trade.fee,
                    profit: result.profit
                });

                totalRealizedProfit += result.profit;
            } else if (trade.type === 'dividend') {
                // 分红：计入已实现收益
                realizedProfits.push({
                    tradeId: trade.id,
                    date: trade.date,
                    type: 'dividend',
                    amount: trade.amount,
                    profit: trade.amount
                });

                totalRealizedProfit += trade.amount;
            }
        }

        // 计算每份成本
        const costPerShare = totalShares > 0 ? totalCost / totalShares : 0;

        return {
            holdingQueue,
            totalCost,
            totalShares,
            costPerShare,
            realizedProfits,
            totalRealizedProfit
        };
    },

    /**
     * 处理卖出交易
     * @param {array} holdingQueue - 持仓队列
     * @param {number} sellShares - 卖出份额
     * @param {number} sellAmount - 危出金额
     * @param {number} fee - 手续费
     * @returns {object}
     */
    processSell(holdingQueue, sellShares, sellAmount, fee) {
        let remainingSellShares = sellShares;
        let costAmount = 0;

        while (remainingSellShares > 0 && holdingQueue.length > 0) {
            const holding = holdingQueue[0];
            const matchShares = Math.min(remainingSellShares, holding.remainingShares);

            // 计算匹配成本
            const matchCost = holding.pricePerShare * matchShares;
            costAmount += matchCost;

            // 更新持仓
            holding.remainingShares -= matchShares;
            remainingSellShares -= matchShares;

            // 如果该持仓已用完，移除队列
            if (holding.remainingShares <= 0) {
                holdingQueue.shift();
            }
        }

        // 计算收益
        const profit = sellAmount - costAmount - fee;

        return {
            costAmount,
            profit
        };
    },

    /**
     * 计算持仓收益
     * @param {number} shares - 持有份额
     * @param {number} cost - 持仓成本
     * @param {number} netValue - 当前净值
     * @returns {object}
     */
    calculateHoldingProfit(shares, cost, netValue) {
        const value = shares * netValue;
        const profit = value - cost;
        const profitRate = cost > 0 ? (profit / cost * 100) : 0;

        return {
            value,
            profit,
            profitRate
        };
    },

    /**
     * 获取空结果
     * @returns {object}
     */
    getEmptyResult() {
        return {
            holding: {
                shares: 0,
                cost: 0,
                costPerShare: 0,
                value: 0,
                profit: 0,
                profitRate: 0
            },
            realized: {
                profit: 0,
                details: []
            },
            total: {
                amount: 0,
                rate: 0
            },
            holdingQueue: []
        };
    },

    /**
     * 计算汇总统计
     * @param {array} funds - 基金列表
     * @param {object} tradesMap - 交易记录映射 {fundId: trades}
     * @param {object} netValues - 净值映射 {fundId: netValue}
     * @returns {object}
     */
    calculateSummary(funds, tradesMap, netValues) {
        let totalInvest = 0; // 总投入
        let totalValue = 0; // 总市值
        let totalProfit = 0; // 总收益
        let totalRealizedProfit = 0; // 总已实现收益

        const fundResults = {};

        for (const fund of funds) {
            const trades = tradesMap[fund.id] || [];
            const netValue = netValues[fund.id] || 0;

            const result = this.calculateFundProfit(trades, netValue);
            fundResults[fund.id] = result;

            totalInvest += result.holding.cost;
            totalValue += result.holding.value;
            totalProfit += result.total.amount;
            totalRealizedProfit += result.realized.profit;
        }

        const totalProfitRate = totalInvest > 0 ? (totalProfit / totalInvest * 100) : 0;

        return {
            totalInvest,
            totalValue,
            totalProfit,
            totalProfitRate,
            totalRealizedProfit,
            fundResults
        };
    },

    /**
     * 计算单只基金的统计
     * @param {string} fundId - 基金ID
     * @returns {object}
     */
    calculateFundStats(fundId) {
        const fund = DataService.getFund(fundId);
        if (!fund) {
            return null;
        }

        const trades = DataService.getTradesByFund(fundId);
        const netValue = fund.netValue || 0;

        return this.calculateFundProfit(trades, netValue);
    },

    /**
     * 计算所有基金的汇总统计
     * @returns {object}
     */
    calculateAllStats() {
        const funds = DataService.loadFunds();

        // 构建交易记录映射
        const tradesMap = {};
        for (const fund of funds) {
            tradesMap[fund.id] = DataService.getTradesByFund(fund.id);
        }

        // 构建净值映射
        const netValues = {};
        for (const fund of funds) {
            netValues[fund.id] = fund.netValue || 0;
        }

        return this.calculateSummary(funds, tradesMap, netValues);
    },

    /**
     * 验证交易记录的合理性
     * @param {array} trades - 交易记录
     * @returns {object} {valid, errors}
     */
    validateTrades(trades) {
        const errors = [];
        let currentShares = 0;

        const sortedTrades = [...trades].sort((a, b) =>
            new Date(a.date) - new Date(b.date)
        );

        for (const trade of sortedTrades) {
            if (trade.type === 'buy') {
                currentShares += trade.shares;
            } else if (trade.type === 'sell') {
                currentShares -= trade.shares;
                if (currentShares < 0) {
                    errors.push(`交易日期 ${trade.date}：卖出份额超过持有份额`);
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
};

// 注册到模块系统
ModuleRegistry.register('Calculator', Calculator);
