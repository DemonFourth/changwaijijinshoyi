/**
 * 数据服务
 * 提供统一的数据访问接口
 */

const DataService = {
    // 基金数据缓存
    fundsCache: null,

    // 交易记录缓存
    tradesCache: null,

    /**
     * 初始化数据服务
     */
    init() {
        // 加载数据到缓存
        this.loadFunds();
        this.loadTrades();
        console.log('DataService initialized');
    },

    /**
     * 加载基金数据
     * @returns {array}
     */
    loadFunds() {
        if (!this.fundsCache) {
            this.fundsCache = Storage.loadFunds();
        }
        return this.fundsCache;
    },

    /**
     * 保存基金数据
     * @param {array} funds - 基金列表
     * @returns {boolean}
     */
    saveFunds(funds) {
        this.fundsCache = funds;
        const success = Storage.saveFunds(funds);

        if (success) {
            EventBus.emit(EventType.FUND_UPDATED, { funds });
        }

        return success;
    },

    /**
     * 获取单个基金
     * @param {string} fundId - 基金ID
     * @returns {object|null}
     */
    getFund(fundId) {
        const funds = this.loadFunds();
        return funds.find(f => f.id === fundId) || null;
    },

    /**
     * 添加基金
     * @param {object} fund - 基金对象
     * @returns {boolean}
     */
    addFund(fund) {
        const funds = this.loadFunds();

        // 检查是否已存在
        if (funds.find(f => f.id === fund.id)) {
            console.error('Fund already exists:', fund.id);
            return false;
        }

        funds.push(fund);
        const success = this.saveFunds(funds);

        if (success) {
            EventBus.emit(EventType.FUND_ADDED, { fund });
        }

        return success;
    },

    /**
     * 更新基金
     * @param {string} fundId - 基金ID
     * @param {object} updates - 更新内容
     * @returns {boolean}
     */
    updateFund(fundId, updates) {
        const funds = this.loadFunds();
        const index = funds.findIndex(f => f.id === fundId);

        if (index === -1) {
            console.error('Fund not found:', fundId);
            return false;
        }

        funds[index] = { ...funds[index], ...updates };
        const success = this.saveFunds(funds);

        if (success) {
            EventBus.emit(EventType.FUND_UPDATED, { fund: funds[index] });
        }

        return success;
    },

    /**
     * 删除基金
     * @param {string} fundId - 基金ID
     * @returns {boolean}
     */
    deleteFund(fundId) {
        const funds = this.loadFunds();
        const index = funds.findIndex(f => f.id === fundId);

        if (index === -1) {
            console.error('Fund not found:', fundId);
            return false;
        }

        const deletedFund = funds[index];
        funds.splice(index, 1);
        const success = this.saveFunds(funds);

        if (success) {
            // 同时删除相关的交易记录
            this.deleteTradesByFund(fundId);

            EventBus.emit(EventType.FUND_DELETED, { fund: deletedFund });
        }

        return success;
    },

    /**
     * 加载交易记录
     * @returns {array}
     */
    loadTrades() {
        if (!this.tradesCache) {
            this.tradesCache = Storage.loadTrades();
        }
        return this.tradesCache;
    },

    /**
     * 保存交易记录
     * @param {array} trades - 交易记录列表
     * @returns {boolean}
     */
    saveTrades(trades) {
        this.tradesCache = trades;
        const success = Storage.saveTrades(trades);

        if (success) {
            EventBus.emit(EventType.TRADE_UPDATED, { trades });
        }

        return success;
    },

    /**
     * 获取基金的交易记录
     * @param {string} fundId - 基金ID
     * @returns {array}
     */
    getTradesByFund(fundId) {
        const trades = this.loadTrades();
        return trades.filter(t => t.fundId === fundId);
    },

    /**
     * 添加交易记录
     * @param {object} trade - 交易记录对象
     * @returns {boolean}
     */
    addTrade(trade) {
        const trades = this.loadTrades();
        trades.push(trade);
        const success = this.saveTrades(trades);

        if (success) {
            EventBus.emit(EventType.TRADE_ADDED, { trade });
            EventBus.emit(EventType.CALCULATION_UPDATED, { fundId: trade.fundId });
        }

        return success;
    },

    /**
     * 更新交易记录
     * @param {string} tradeId - 交易记录ID
     * @param {object} updates - 更新内容
     * @returns {boolean}
     */
    updateTrade(tradeId, updates) {
        const trades = this.loadTrades();
        const index = trades.findIndex(t => t.id === tradeId);

        if (index === -1) {
            console.error('Trade not found:', tradeId);
            return false;
        }

        const fundId = trades[index].fundId;
        trades[index] = { ...trades[index], ...updates };
        const success = this.saveTrades(trades);

        if (success) {
            EventBus.emit(EventType.TRADE_UPDATED, { trade: trades[index] });
            EventBus.emit(EventType.CALCULATION_UPDATED, { fundId });
        }

        return success;
    },

    /**
     * 删除交易记录
     * @param {string} tradeId - 交易记录ID
     * @returns {boolean}
     */
    deleteTrade(tradeId) {
        const trades = this.loadTrades();
        const index = trades.findIndex(t => t.id === tradeId);

        if (index === -1) {
            console.error('Trade not found:', tradeId);
            return false;
        }

        const fundId = trades[index].fundId;
        const deletedTrade = trades[index];
        trades.splice(index, 1);
        const success = this.saveTrades(trades);

        if (success) {
            EventBus.emit(EventType.TRADE_DELETED, { trade: deletedTrade });
            EventBus.emit(EventType.CALCULATION_UPDATED, { fundId });
        }

        return success;
    },

    /**
     * 删除基金的所有交易记录
     * @param {string} fundId - 基金ID
     * @returns {boolean}
     */
    deleteTradesByFund(fundId) {
        const trades = this.loadTrades();
        const filteredTrades = trades.filter(t => t.fundId !== fundId);
        return this.saveTrades(filteredTrades);
    },

    /**
     * 验证基金数据
     * @param {object} fund - 基金对象
     * @returns {object} {valid, errors}
     */
    validateFund(fund) {
        const errors = [];

        if (!fund.id) {
            errors.push('基金ID不能为空');
        }

        if (!fund.code || !Utils.isValidFundCode(fund.code)) {
            errors.push('基金代码格式不正确（应为6位数字）');
        }

        if (!fund.name) {
            errors.push('基金名称不能为空');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    },

    /**
     * 验证交易记录数据
     * @param {object} trade - 交易记录对象
     * @returns {object} {valid, errors}
     */
    validateTrade(trade) {
        const errors = [];

        if (!trade.id) {
            errors.push('交易ID不能为空');
        }

        if (!trade.fundId) {
            errors.push('基金ID不能为空');
        }

        if (!trade.date || !Utils.isValidDate(trade.date)) {
            errors.push('交易日期格式不正确');
        }

        if (!trade.type || !['buy', 'sell', 'dividend'].includes(trade.type)) {
            errors.push('交易类型不正确');
        }

        if (!Utils.isValidNumber(trade.shares) || trade.shares <= 0) {
            errors.push('份额必须大于0');
        }

        if (!Utils.isValidNumber(trade.amount) || trade.amount <= 0) {
            errors.push('金额必须大于0');
        }

        if (!Utils.isValidNumber(trade.fee) || trade.fee < 0) {
            errors.push('手续费不能为负数');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    },

    /**
     * 导出所有数据
     * @returns {object}
     */
    exportData() {
        const data = Storage.exportAll();
        EventBus.emit(EventType.DATA_EXPORTED, { data });
        return data;
    },

    /**
     * 导入数据
     * @param {object} data - 导入的数据
     * @param {boolean} merge - 是否合并
     * @returns {boolean}
     */
    importData(data, merge = false) {
        const success = Storage.importAll(data, merge);

        if (success) {
            // 清空缓存，重新加载
            this.fundsCache = null;
            this.tradesCache = null;
            this.loadFunds();
            this.loadTrades();

            EventBus.emit(EventType.DATA_IMPORTED, { data, merge });
        }

        return success;
    },

    /**
     * 清空所有数据
     * @returns {boolean}
     */
    clearAll() {
        this.fundsCache = [];
        this.tradesCache = [];

        const success = Storage.clear();

        if (success) {
            EventBus.emit(EventType.DATA_CLEARED);
        }

        return success;
    }
};

// 注册到模块系统
ModuleRegistry.register('DataService', DataService);
