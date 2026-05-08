/**
 * 数据服务
 * 提供统一的数据访问接口
 */

const DataService = {
    fundsCache: null,
    tradesCache: null,
    _calculationCache: new Map(),

    init() {
        this.loadFunds();
        this.loadTrades();
        console.log('DataService initialized');
    },

    getCalculatedProfit(fundId, currentNetValue) {
        const fund = this.getFund(fundId);
        if (!fund) return null;

        const trades = this.getTradesByFund(fundId);
        if (!trades || trades.length === 0) {
            return CalculatorV2.getEmptyResult();
        }

        const cacheKey = String(currentNetValue);

        if (!this._calculationCache.has(fundId)) {
            this._calculationCache.set(fundId, new Map());
        }

        const fundCache = this._calculationCache.get(fundId);

        if (fundCache.has(cacheKey)) {
            return fundCache.get(cacheKey);
        }

        const result = CalculatorV2.calculateFundProfit(trades, currentNetValue);
        fundCache.set(cacheKey, result);

        return result;
    },

    invalidateCache(fundId) {
        if (fundId) {
            this._calculationCache.delete(fundId);
        } else {
            this._calculationCache.clear();
        }
    },

    loadFunds() {
        this.fundsCache = window.FundRepository.getAll();
        return this.fundsCache;
    },

    saveFunds(funds) {
        console.warn('[DataService.saveFunds] deprecated, use FundAppService');
        this.fundsCache = funds;
        return window.FundRepository.saveAll(funds);
    },

    getFund(fundId) {
        return window.FundRepository.getById(fundId);
    },

    async addFund(fund) {
        const funds = this.loadFunds();

        if (funds.find(f => f.id === fund.id)) {
            console.error('Fund already exists:', fund.id);
            return { success: false, fund: null, affectedTradeIds: [], reason: 'already_exists' };
        }

        const result = await window.FundAppService.addFund(fund);

        if (result.success) {
            this.fundsCache = null;
        }

        return result;
    },

    async updateFund(fundId, updates) {
        const currentFund = window.FundRepository.getById(fundId);

        if (!currentFund) {
            console.error('Fund not found:', fundId);
            return { success: false, fund: null, affectedTradeIds: [], reason: 'not_found' };
        }

        const result = await window.FundAppService.updateFund(fundId, updates);

        if (result.success) {
            this.fundsCache = null;
        }

        return result;
    },

    async deleteFund(fundId) {
        const deletedFund = window.FundRepository.getById(fundId);

        if (!deletedFund) {
            console.error('Fund not found:', fundId);
            return { success: false, fund: null, affectedTradeIds: [], reason: 'not_found' };
        }

        const result = await window.FundAppService.deleteFund(fundId);

        if (result.success) {
            this.fundsCache = null;
            this.tradesCache = null;
            this.invalidateCache(fundId);
        }

        return result;
    },

    loadTrades() {
        this.tradesCache = window.TradeRepository.getAll();
        return this.tradesCache;
    },

    saveTrades(trades) {
        console.warn('[DataService.saveTrades] deprecated, use TradeAppService');
        this.tradesCache = trades;
        return window.TradeRepository.saveAll(trades);
    },

    getTradesByFund(fundId) {
        return window.TradeRepository.getByFundId(fundId);
    },

    async addTrade(trade) {
        const result = await window.TradeAppService.addTrade(trade);

        if (result.success) {
            this.tradesCache = null;
            this.invalidateCache(trade.fundId);
        }

        return result;
    },

    async updateTrade(tradeId, updates) {
        const trade = window.TradeRepository.getById(tradeId);

        if (!trade) {
            console.error('Trade not found:', tradeId);
            return { success: false, trade: null, fundId: null, reason: 'not_found' };
        }

        const fundId = trade.fundId;
        const result = await window.TradeAppService.updateTrade(tradeId, updates);

        if (result.success) {
            this.tradesCache = null;
            this.invalidateCache(fundId);
        }

        return result;
    },

    async deleteTrade(tradeId) {
        const deletedTrade = window.TradeRepository.getById(tradeId);

        if (!deletedTrade) {
            console.error('Trade not found:', tradeId);
            return { success: false, trade: null, fundId: null, reason: 'not_found' };
        }

        const fundId = deletedTrade.fundId;
        const result = await window.TradeAppService.deleteTrade(tradeId);

        if (result.success) {
            this.tradesCache = null;
            this.invalidateCache(fundId);
        }

        return result;
    },

    async deleteTradesByFund(fundId) {
        const result = await window.TradeAppService.deleteTradesByFund(fundId);

        if (result.success) {
            this.tradesCache = null;
            this.invalidateCache(fundId);
        }

        return result;
    },

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

    exportData() {
        const data = Storage.exportAll();
        EventBus.emit(EventType.DATA_EXPORTED, { data });
        return data;
    },

    async importData(data, merge = false) {
        const result = await window.ImportAppService.importData(data, { merge });

        if (result.success) {
            this.fundsCache = null;
            this.tradesCache = null;
            this._calculationCache.clear();
            this.loadFunds();
            this.loadTrades();
        }

        return result;
    },

    async clearAll() {
        const result = await window.ImportAppService.clearAll();

        if (result.success) {
            this.fundsCache = [];
            this.tradesCache = [];
            this._calculationCache.clear();
        }

        return result;
    }
};

ModuleRegistry.register('DataService', DataService);
