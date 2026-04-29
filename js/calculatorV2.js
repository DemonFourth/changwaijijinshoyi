/**
 * 收益计算引擎 v2.0
 * 加权平均成本法：
 * - 买入: 持仓总成本 += amount (用户实际支付金额，含手续费)
 * - 卖出: 持仓总成本 -= 卖出份额×持仓成本价 (成本价不变)
 * - 持仓成本价 = 持仓总成本 / 持仓总份额
 */

const CalculatorV2 = {
    // 精度阈值，用于浮点数比较
    EPSILON: 0.0001,

    /**
     * 计算基金的收益情况（支持多轮持仓）
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

        // 识别持仓周期
        const cycles = this.identifyHoldingCycles(sortedTrades);

        // 计算每个周期的收益
        const cyclesWithProfit = cycles.map(cycle =>
            this.calculateCycleProfit(cycle, currentNetValue)
        );

        // 计算总收益
        return this.calculateTotalProfit(cyclesWithProfit);
    },

    /**
     * 识别持仓周期
     * @param {array} trades - 排序后的交易记录
     * @returns {array} 持仓周期数组
     */
    identifyHoldingCycles(trades) {
        const cycles = [];
        let currentCycle = null;
        let holdingShares = 0;
        let cycleId = 1;

        for (const trade of trades) {
            if (trade.type === 'buy') {
                if (holdingShares <= CalculatorV2.EPSILON) {
                    currentCycle = {
                        id: cycleId++,
                        startDate: trade.date,
                        status: 'active',
                        trades: []
                    };
                    cycles.push(currentCycle);
                }

                holdingShares += parseFloat(trade.shares);
                currentCycle.trades.push(trade);

            } else if (trade.type === 'sell') {
                holdingShares -= parseFloat(trade.shares);

                if (currentCycle) {
                    currentCycle.trades.push(trade);
                }

                if (holdingShares <= CalculatorV2.EPSILON) {
                    if (currentCycle) {
                        currentCycle.endDate = trade.date;
                        currentCycle.status = 'closed';
                    }
                    currentCycle = null;
                    holdingShares = 0;
                }
            } else if (trade.type === 'dividend') {
                const dividendMode = trade.dividendMode || 'cash';

                if (dividendMode === 'reinvest') {
                    holdingShares += parseFloat(trade.shares);
                }

                if (currentCycle) {
                    currentCycle.trades.push(trade);
                }
            }
        }

        return cycles;
    },

    /**
     * 计算单个持仓周期的收益（加权平均成本法）
     * @param {object} cycle - 持仓周期对象
     * @param {number} currentNetValue - 当前净值
     * @returns {object} 周期收益对象
     */
    calculateCycleProfit(cycle, currentNetValue) {
        let totalInvest = 0; // 总投入(净值×份额+手续费)
        let totalSellAmount = 0; // 总卖出金额(到手金额，已扣手续费)
        let totalBuyFee = 0; // 总买入手续费
        let totalSellFee = 0; // 总卖出手续费
        let totalShares = 0; // 总买入份额
        let holdingShares = 0; // 持有份额
        let holdingCost = 0; // 持仓总成本(含手续费)
        let realizedProfit = 0; // 已实现收益
        const realizedDetails = []; // 已实现收益明细
        const tradeDetails = []; // 交易明细

        for (const trade of cycle.trades) {
            const shares = parseFloat(trade.shares);
            const amount = parseFloat(trade.amount) || 0;
            const fee = parseFloat(trade.fee || 0);
            const netValue = parseFloat(trade.netValue || 0);

            if (trade.type === 'buy') {
                // 买入: 持仓总成本 += amount (用户实际支付的金额)
                // amount由表单自动计算为净值×份额+手续费，用户可手动修改
                totalInvest += amount;
                totalBuyFee += fee;
                totalShares += shares;
                holdingShares += shares;
                holdingCost += amount;

                tradeDetails.push({
                    date: trade.date,
                    type: 'buy',
                    shares: shares,
                    amount: amount,
                    fee: fee,
                    netValue: trade.netValue || 0
                });

            } else if (trade.type === 'sell') {
                // 卖出: amount是到手金额(已扣手续费)
                // 持仓成本价不变，减少的成本 = 卖出份额 × 持仓成本价
                totalSellAmount += amount;
                totalSellFee += fee;

                const costPrice = holdingShares > 0 ? holdingCost / holdingShares : 0;
                const costAmount = shares * costPrice;

                holdingShares -= shares;
                holdingCost -= costAmount;

                // 已实现收益 = 到手金额 - 卖出份额×成本价
                const profit = amount - costAmount;
                realizedProfit += profit;

                realizedDetails.push({
                    tradeId: trade.id,
                    date: trade.date,
                    shares: shares,
                    sellAmount: amount,
                    costAmount: costAmount,
                    fee: fee,
                    profit: profit,
                    profitRate: costAmount > 0 ? (profit / costAmount * 100) : 0
                });

                tradeDetails.push({
                    date: trade.date,
                    type: 'sell',
                    shares: shares,
                    amount: amount,
                    fee: fee,
                    costAmount: costAmount,
                    profit: profit,
                    netValue: trade.netValue || 0
                });

            } else if (trade.type === 'dividend') {
                const dividendMode = trade.dividendMode || 'cash';

                if (dividendMode === 'reinvest') {
                    holdingShares += shares;

                    realizedProfit -= amount;
                    realizedDetails.push({
                        tradeId: trade.id,
                        date: trade.date,
                        type: 'dividend_reinvest',
                        shares: shares,
                        amount: amount,
                        profit: -amount
                    });

                    tradeDetails.push({
                        date: trade.date,
                        type: 'dividend_reinvest',
                        shares: shares,
                        amount: amount
                    });
                } else {
                    realizedProfit += amount;
                    realizedDetails.push({
                        tradeId: trade.id,
                        date: trade.date,
                        type: 'dividend',
                        amount: amount,
                        profit: amount
                    });

                    tradeDetails.push({
                        date: trade.date,
                        type: 'dividend',
                        amount: amount
                    });
                }
            }
        }

        // 计算浮动收益
        let holdingValue = holdingShares * currentNetValue;
        let floatingProfit = holdingValue - holdingCost;

        // 确保已清仓周期的持仓信息正确归零
        if (holdingShares <= CalculatorV2.EPSILON) {
            holdingShares = 0;
            holdingCost = 0;
            holdingValue = 0;
            floatingProfit = 0;
        }

        // 确保持仓成本不为负数
        holdingCost = Math.max(0, holdingCost);

        // 周期总收益
        const totalProfit = realizedProfit + floatingProfit;
        const profitRate = totalInvest > 0 ? (totalProfit / totalInvest * 100) : 0;

        // 计算持仓天数
        const holdingDays = this.calculateHoldingDays(cycle);

        return {
            ...cycle,
            // 投入统计
            totalInvest,
            totalBuyFee,
            totalShares,

            // 卖出统计
            totalSellAmount,
            totalSellFee,
            sellCount: realizedDetails.filter(d => d.type !== 'dividend').length,

            // 持仓信息
            holdingShares,
            holdingCost,
            holdingValue,
            holdingDays,

            // 收益信息
            realizedProfit,
            floatingProfit,
            totalProfit,
            profitRate,

            // 明细
            realizedDetails,
            tradeDetails
        };
    },

    /**
     * 计算持仓天数
     * @param {object} cycle - 持仓周期对象
     * @returns {number} 持仓天数
     */
    calculateHoldingDays(cycle) {
        const startDate = new Date(cycle.startDate);
        const endDate = cycle.endDate ? new Date(cycle.endDate) : new Date();
        const days = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));
        return days > 0 ? days : 0;
    },

    /**
     * 计算总收益
     * @param {array} cycles - 所有持仓周期
     * @returns {object} 总收益结果
     */
    calculateTotalProfit(cycles) {
        let totalInvest = 0;
        let totalSellAmount = 0;
        let totalBuyFee = 0;
        let totalSellFee = 0;
        let totalProfit = 0;
        let totalRealizedProfit = 0;
        let totalFloatingProfit = 0;
        let closedCycles = 0;
        let activeCycles = 0;

        const currentHolding = {
            shares: 0,
            cost: 0,
            value: 0,
            floatingProfit: 0
        };

        for (const cycle of cycles) {
            totalInvest += cycle.totalInvest;
            totalSellAmount += cycle.totalSellAmount || 0;
            totalBuyFee += cycle.totalBuyFee || 0;
            totalSellFee += cycle.totalSellFee || 0;
            totalProfit += cycle.totalProfit;
            totalRealizedProfit += cycle.realizedProfit;
            totalFloatingProfit += cycle.floatingProfit || 0;

            if (cycle.status === 'closed') {
                closedCycles++;
            } else {
                activeCycles++;
                currentHolding.shares += cycle.holdingShares;
                currentHolding.cost += cycle.holdingCost;
                currentHolding.value += cycle.holdingValue;
                currentHolding.floatingProfit += cycle.floatingProfit;
            }
        }

        const profitRate = totalInvest > 0 ? (totalProfit / totalInvest * 100) : 0;
        const totalFee = totalBuyFee + totalSellFee;

        // 最终校验：确保持仓数据合法
        if (currentHolding.shares <= CalculatorV2.EPSILON) {
            currentHolding.shares = 0;
            currentHolding.cost = 0;
            currentHolding.value = 0;
            currentHolding.floatingProfit = 0;
        }

        return {
            cycles: cycles,
            summary: {
                totalCycles: cycles.length,
                closedCycles,
                activeCycles,

                // 投入统计
                totalInvest,
                totalBuyFee,

                // 卖出统计
                totalSellAmount,
                totalSellFee,
                totalFee,

                // 收益统计
                totalProfit,
                totalRealizedProfit,
                totalFloatingProfit,
                profitRate,

                // 当前持仓
                currentHolding
            },

            // 兼容旧格式
            holding: {
                shares: currentHolding.shares,
                cost: currentHolding.cost,
                costPerShare: currentHolding.shares > 0 ? currentHolding.cost / currentHolding.shares : 0,
                value: currentHolding.value,
                profit: currentHolding.floatingProfit,
                profitRate: currentHolding.cost > 0 ? (currentHolding.floatingProfit / currentHolding.cost * 100) : 0
            },
            realized: {
                profit: totalRealizedProfit,
                details: cycles.flatMap(c => c.realizedDetails || [])
            },
            total: {
                amount: totalProfit,
                rate: profitRate
            }
        };
    },

    /**
     * 获取空结果
     * @returns {object}
     */
    getEmptyResult() {
        return {
            cycles: [],
            summary: {
                totalCycles: 0,
                closedCycles: 0,
                activeCycles: 0,
                totalInvest: 0,
                totalSellAmount: 0,
                totalBuyFee: 0,
                totalSellFee: 0,
                totalFee: 0,
                totalProfit: 0,
                profitRate: 0,
                totalRealizedProfit: 0,
                totalFloatingProfit: 0,
                currentHolding: {
                    shares: 0,
                    cost: 0,
                    value: 0,
                    floatingProfit: 0
                }
            },
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
            }
        };
    }
};

// 注册到模块系统
ModuleRegistry.register('CalculatorV2', CalculatorV2);
