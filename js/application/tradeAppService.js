const TradeAppService = {
    getTradesByFund(fundId) {
        return window.TradeRepository.getByFundId(fundId);
    },

    getAllTrades() {
        return window.TradeRepository.getAll();
    },

    getTrade(tradeId) {
        return window.TradeRepository.getById(tradeId);
    },

    async addTrade(trade) {
        const trades = window.TradeRepository.getAll();
        const normalizedTrade = window.StorageSchema.createTradeEntity(trade);
        trades.push(normalizedTrade);
        const success = window.TradeRepository.saveAll(trades);

        if (!success) {
            return { success: false, trade: null, fundId: trade.fundId, reason: 'save_failed' };
        }

        EventBus.emit(EventType.TRADE_ADDED, { trade: normalizedTrade });
        EventBus.emit(EventType.TRADE_UPDATED, { trade: normalizedTrade });
        EventBus.emit(EventType.CALCULATION_UPDATED, { fundId: normalizedTrade.fundId });

        return { success: true, trade: normalizedTrade, fundId: normalizedTrade.fundId, reason: '' };
    },

    async updateTrade(tradeId, updates) {
        const now = new Date().toISOString();
        const trades = window.TradeRepository.getAll();
        const index = trades.findIndex(trade => trade.id === tradeId);

        if (index === -1) {
            return { success: false, trade: null, fundId: null, reason: 'not_found' };
        }

        trades[index] = window.StorageSchema.createTradeEntity({
            ...trades[index],
            ...updates,
            updatedAt: now,
            updateTime: updates.updateTime || now
        });

        const success = window.TradeRepository.saveAll(trades);

        if (!success) {
            return { success: false, trade: null, fundId: trades[index].fundId, reason: 'save_failed' };
        }

        EventBus.emit(EventType.TRADE_UPDATED, { trade: trades[index] });
        EventBus.emit(EventType.CALCULATION_UPDATED, { fundId: trades[index].fundId });

        return { success: true, trade: trades[index], fundId: trades[index].fundId, reason: '' };
    },

    async deleteTrade(tradeId) {
        const trade = window.TradeRepository.getById(tradeId);
        const success = window.TradeRepository.softDelete(tradeId);

        if (!success) {
            return { success: false, trade: null, fundId: trade ? trade.fundId : null, reason: 'delete_failed' };
        }

        EventBus.emit(EventType.TRADE_DELETED, { trade });
        EventBus.emit(EventType.CALCULATION_UPDATED, { fundId: trade ? trade.fundId : null });

        return { success: true, trade, fundId: trade ? trade.fundId : null, reason: '' };
    },

    async deleteTradesByFund(fundId) {
        const snapshot = window.LocalStorageAdapter.loadSnapshot();
        const now = new Date().toISOString();
        const affectedTradeIds = [];

        snapshot.trades = snapshot.trades.map(trade => {
            if (trade.fundId !== fundId || trade.deletedAt) {
                return trade;
            }

            affectedTradeIds.push(trade.id);
            return {
                ...trade,
                deletedAt: now,
                updatedAt: now
            };
        });

        const success = window.LocalStorageAdapter.saveSnapshot(snapshot);

        if (!success) {
            return { success: false, fundId, affectedTradeIds: [], reason: 'delete_failed' };
        }

        EventBus.emit(EventType.TRADE_UPDATED, { fundId, affectedTradeIds, reason: 'batch-delete' });
        EventBus.emit(EventType.CALCULATION_UPDATED, { fundId });

        return { success: true, fundId, affectedTradeIds, reason: '' };
    }
};

ModuleRegistry.register('TradeAppService', TradeAppService);
