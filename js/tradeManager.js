/**
 * 交易管理器
 * 管理交易记录的增删改查
 * @version 2.0.0 - 修复this上下文问题
 */

const TradeManager = {
    /**
     * 初始化交易管理器
     */
    init() {
        console.log('TradeManager initialized');
    },

    /**
     * 获取基金的所有交易记录
     * @param {string} fundId - 基金ID
     * @returns {array}
     */
    getTradesByFund(fundId) {
        return window.TradeAppService.getTradesByFund(fundId);
    },

    /**
     * 获取单个交易记录
     * @param {string} tradeId - 交易ID
     * @returns {object|null}
     */
    getTrade(tradeId) {
        return window.TradeAppService.getTrade(tradeId);
    },

    /**
     * 添加交易记录
     * @param {object} tradeData - 交易数据
     * @returns {object}
     */
    addTrade(tradeData) {
        // 验证交易数据
        const validation = TradeManager.validateTradeData(tradeData);
        if (!validation.valid) {
            Utils.showToast(validation.errors[0], 'error');
            return null;
        }

        // 构造交易对象
        const trade = {
            id: Utils.generateId(),
            fundId: tradeData.fundId,
            date: tradeData.date,
            type: tradeData.type,
            netValue: parseFloat(tradeData.netValue || 0), // 添加净值字段
            shares: parseFloat(tradeData.shares),
            amount: parseFloat(tradeData.amount),
            fee: parseFloat(tradeData.fee || 0),
            remark: tradeData.remark || '',
            createTime: new Date().toISOString()
        };

        // 验证交易合理性
        // 使用函数引用避免作用域问题
        const checkFn = TradeManager.checkTradeReasonality;
        const reasonCheck = checkFn.call(TradeManager, trade);
        if (!reasonCheck.valid) {
            Utils.showToast(reasonCheck.message, 'error');
            return null;
        }

        // 保存交易记录
        const resultPromise = window.TradeAppService.addTrade(trade);

        return Promise.resolve(resultPromise).then(result => {
            if (result.success) {
                DataService.tradesCache = null;
                DataService.invalidateCache(trade.fundId);
                Utils.showToast('交易记录添加成功', 'success');
                return trade;
            }

            Utils.showToast('交易记录添加失败', 'error');
            return null;
        });
    },

    /**
     * 更新交易记录
     * @param {string} tradeId - 交易ID
     * @param {object} updates - 更新内容
     * @returns {boolean}
     */
    updateTrade(tradeId, updates) {
        const trade = TradeManager.getTrade(tradeId);
        if (!trade) {
            Utils.showToast('交易记录不存在', 'error');
            return false;
        }

        // 合并更新内容
        const updatedTrade = { ...trade, ...updates };

        // 验证交易数据
        const validation = TradeManager.validateTradeData(updatedTrade);
        if (!validation.valid) {
            Utils.showToast(validation.errors[0], 'error');
            return false;
        }

        // 保存更新
        const resultPromise = window.TradeAppService.updateTrade(tradeId, updates);

        return Promise.resolve(resultPromise).then(result => {
            if (result.success) {
                DataService.tradesCache = null;
                DataService.invalidateCache(updatedTrade.fundId);
                Utils.showToast('交易记录更新成功', 'success');
            } else {
                Utils.showToast('交易记录更新失败', 'error');
            }

            return result.success;
        });
    },

    /**
     * 删除交易记录
     * @param {string} tradeId - 交易ID
     * @returns {boolean}
     */
    deleteTrade(tradeId) {
        const trade = window.TradeAppService.getTrade(tradeId);
        const resultPromise = window.TradeAppService.deleteTrade(tradeId);

        return Promise.resolve(resultPromise).then(result => {
            if (result.success && trade) {
                DataService.tradesCache = null;
                DataService.invalidateCache(trade.fundId);
                Utils.showToast('交易记录删除成功', 'success');
            } else {
                Utils.showToast('交易记录删除失败', 'error');
            }

            return result.success;
        });
    },

    /**
     * 验证交易数据
     * @param {object} tradeData - 交易数据
     * @returns {object} {valid, errors}
     */
    validateTradeData(tradeData) {
        const errors = [];

        if (!tradeData.fundId) {
            errors.push('基金ID不能为空');
        }

        if (!tradeData.date || !Utils.isValidDate(tradeData.date)) {
            errors.push('交易日期格式不正确');
        }

        if (!tradeData.type || !['buy', 'sell', 'dividend'].includes(tradeData.type)) {
            errors.push('交易类型不正确');
        }

        if (!Utils.isValidNumber(tradeData.shares) || !Utils.isPositive(parseFloat(tradeData.shares))) {
            errors.push('份额必须大于0');
        }

        const isDividendReinvest = tradeData.type === 'dividend' && tradeData.dividendMode === 'reinvest';
        if (!isDividendReinvest) {
            if (!Utils.isValidNumber(tradeData.amount) || parseFloat(tradeData.amount) <= 0) {
                errors.push('金额必须大于0');
            }
        }

        if (isDividendReinvest && tradeData.amount && parseFloat(tradeData.amount) < 0) {
            errors.push('金额不能为负数');
        }

        if (Utils.isValidNumber(tradeData.fee) && parseFloat(tradeData.fee) < 0) {
            errors.push('手续费不能为负数');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    },

    /**
     * 检查交易合理性
     * @param {object} trade - 交易对象
     * @returns {object} {valid, message}
     */
    checkTradeReasonality(trade) {
        // 如果是卖出，检查是否有足够的份额
        if (trade.type === 'sell') {
            const trades = TradeManager.getTradesByFund(trade.fundId);
            const allTrades = [...trades, trade];

            // 按日期排序
            const sortedTrades = allTrades.sort((a, b) =>
                new Date(a.date) - new Date(b.date)
            );

            // 模拟计算持仓
            let currentShares = 0;
            for (const t of sortedTrades) {
                if (t.type === 'buy') {
                    currentShares += parseFloat(t.shares);
                } else if (t.type === 'sell') {
                    currentShares -= parseFloat(t.shares);
                    if (Utils.isNegative(currentShares)) {
                        return {
                            valid: false,
                            message: `卖出份额超过持有份额（当前持有：${Utils.formatNumber(currentShares + parseFloat(t.shares))}份）`
                        };
                    }
                }
            }
            if (Utils.isNonPositive(currentShares)) {
                currentShares = 0;
            }
        }

        return { valid: true, message: '' };
    },

    /**
     * 批量添加交易记录
     * @param {array} tradesData - 交易数据数组
     * @returns {array} 成功添加的交易记录
     */
    batchAddTrades(tradesData) {
        const addedTrades = [];

        for (const tradeData of tradesData) {
            const trade = TradeManager.addTrade(tradeData);
            if (trade) {
                addedTrades.push(trade);
            }
        }

        if (addedTrades.length > 0) {
            Utils.showToast(`成功添加 ${addedTrades.length} 条交易记录`, 'success');
        }

        return addedTrades;
    },

    /**
     * 获取交易统计
     * @param {string} fundId - 基金ID
     * @returns {object}
     */
    getTradeStats(fundId) {
        const trades = TradeManager.getTradesByFund(fundId);

        let buyCount = 0;
        let sellCount = 0;
        let dividendCount = 0;
        let totalBuyAmount = 0;
        let totalSellAmount = 0;
        let totalDividendAmount = 0;
        let totalFee = 0;

        for (const trade of trades) {
            if (trade.type === 'buy') {
                buyCount++;
                totalBuyAmount += trade.amount;
                totalFee += trade.fee;
            } else if (trade.type === 'sell') {
                sellCount++;
                totalSellAmount += trade.amount;
                totalFee += trade.fee;
            } else if (trade.type === 'dividend') {
                dividendCount++;
                totalDividendAmount += trade.amount;
            }
        }

        return {
            total: trades.length,
            buyCount,
            sellCount,
            dividendCount,
            totalBuyAmount,
            totalSellAmount,
            totalDividendAmount,
            totalFee
        };
    },

    /**
     * 按日期范围筛选交易记录
     * @param {string} fundId - 基金ID
     * @param {string} startDate - 开始日期
     * @param {string} endDate - 结束日期
     * @returns {array}
     */
    getTradesByDateRange(fundId, startDate, endDate) {
        const trades = TradeManager.getTradesByFund(fundId);

        return trades.filter(trade => {
            const tradeDate = new Date(trade.date);
            const start = new Date(startDate);
            const end = new Date(endDate);

            return tradeDate >= start && tradeDate <= end;
        });
    },

    /**
     * 获取最近的交易记录
     * @param {string} fundId - 基金ID
     * @param {number} limit - 数量限制
     * @returns {array}
     */
    getRecentTrades(fundId, limit = 10) {
        const trades = TradeManager.getTradesByFund(fundId);

        return trades
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, limit);
    }
};

// 注册到模块系统
ModuleRegistry.register('TradeManager', TradeManager);

