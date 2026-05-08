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
        this.fundsCache = funds;
        const success = window.FundRepository.saveAll(funds);

        if (success) {
            EventBus.emit(EventType.FUND_UPDATED, { funds });
        }

        return success;
    },

    getFund(fundId) {
        return window.FundRepository.getById(fundId);
    },

    addFund(fund) {
        const funds = this.loadFunds();

        if (funds.find(f => f.id === fund.id)) {
            console.error('Fund already exists:', fund.id);
            return false;
        }

        const success = window.FundAppService.addFund(fund);

        if (success) {
            this.fundsCache = null;
            EventBus.emit(EventType.FUND_ADDED, { fund });
            EventBus.emit(EventType.FUND_UPDATED, { fund });
        }

        return success;
    },

    updateFund(fundId, updates) {
        const currentFund = window.FundRepository.getById(fundId);

        if (!currentFund) {
            console.error('Fund not found:', fundId);
            return false;
        }

        const success = window.FundAppService.updateFund(fundId, updates);

        if (success) {
            this.fundsCache = null;
            EventBus.emit(EventType.FUND_UPDATED, { fund: window.FundRepository.getById(fundId) });
        }

        return success;
    },

    deleteFund(fundId) {
        const deletedFund = window.FundRepository.getById(fundId);

        if (!deletedFund) {
            console.error('Fund not found:', fundId);
            return false;
        }

        const success = window.FundAppService.deleteFund(fundId);

        if (success) {
            this.fundsCache = null;
            this.tradesCache = null;
            this.invalidateCache(fundId);
            EventBus.emit(EventType.FUND_DELETED, { fund: deletedFund });
            EventBus.emit(EventType.TRADE_UPDATED, { fundId });
            EventBus.emit(EventType.CALCULATION_UPDATED, { fundId });
        }

        return success;
    },

    loadTrades() {
        this.tradesCache = window.TradeRepository.getAll();
        return this.tradesCache;
    },

    saveTrades(trades) {
        this.tradesCache = trades;
        const success = window.TradeRepository.saveAll(trades);

        if (success) {
            EventBus.emit(EventType.TRADE_UPDATED, { trades });
        }

        return success;
    },

    getTradesByFund(fundId) {
        return window.TradeRepository.getByFundId(fundId);
    },

    addTrade(trade) {
        const success = window.TradeAppService.addTrade(trade);

        if (success) {
            this.tradesCache = null;
            this.invalidateCache(trade.fundId);
            EventBus.emit(EventType.TRADE_ADDED, { trade });
            EventBus.emit(EventType.TRADE_UPDATED, { trade });
            EventBus.emit(EventType.CALCULATION_UPDATED, { fundId: trade.fundId });
        }

        return success;
    },

    updateTrade(tradeId, updates) {
        const trade = window.TradeRepository.getById(tradeId);

        if (!trade) {
            console.error('Trade not found:', tradeId);
            return false;
        }

        const fundId = trade.fundId;
        const success = window.TradeAppService.updateTrade(tradeId, updates);

        if (success) {
            this.tradesCache = null;
            this.invalidateCache(fundId);
            EventBus.emit(EventType.TRADE_UPDATED, { trade: window.TradeRepository.getById(tradeId) });
            EventBus.emit(EventType.CALCULATION_UPDATED, { fundId });
        }

        return success;
    },

    deleteTrade(tradeId) {
        const deletedTrade = window.TradeRepository.getById(tradeId);

        if (!deletedTrade) {
            console.error('Trade not found:', tradeId);
            return false;
        }

        const fundId = deletedTrade.fundId;
        const success = window.TradeAppService.deleteTrade(tradeId);

        if (success) {
            this.tradesCache = null;
            this.invalidateCache(fundId);
            EventBus.emit(EventType.TRADE_DELETED, { trade: deletedTrade });
            EventBus.emit(EventType.CALCULATION_UPDATED, { fundId });
        }

        return success;
    },

    deleteTradesByFund(fundId) {
        const snapshot = window.LocalStorageAdapter.loadSnapshot();
        const now = new Date().toISOString();
        snapshot.trades = snapshot.trades.map(trade => {
            if (trade.fundId !== fundId) {
                return trade;
            }

            return {
                ...trade,
                deletedAt: now,
                updatedAt: now
            };
        });

        const success = window.LocalStorageAdapter.saveSnapshot(snapshot);

        if (success) {
            this.tradesCache = null;
            this.invalidateCache(fundId);
        }

        return success;
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

    importData(data, merge = false) {
        const success = Storage.importAll(data, merge);

        if (success) {
            this.fundsCache = null;
            this.tradesCache = null;
            this._calculationCache.clear();
            this.loadFunds();
            this.loadTrades();

            EventBus.emit(EventType.DATA_IMPORTED, { data, merge });
        }

        return success;
    },

    clearAll() {
        this.fundsCache = [];
        this.tradesCache = [];
        this._calculationCache.clear();

        const success = Storage.clear();

        if (success) {
            EventBus.emit(EventType.DATA_CLEARED);
        }

        return success;
    }
};

ModuleRegistry.register('DataService', DataService);
