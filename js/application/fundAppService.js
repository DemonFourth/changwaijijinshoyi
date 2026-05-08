const FundAppService = {
    getAllFunds() {
        return window.FundRepository.getAll();
    },

    getFund(fundId) {
        return window.FundRepository.getById(fundId);
    },

    async addFund(fund) {
        const funds = window.FundRepository.getAll();
        const normalizedFund = window.StorageSchema.createFundEntity(fund);
        funds.push(normalizedFund);
        const success = window.FundRepository.saveAll(funds);

        if (!success) {
            return { success: false, fund: null, affectedTradeIds: [], reason: 'save_failed' };
        }

        EventBus.emit(EventType.FUND_ADDED, { fund: normalizedFund });
        EventBus.emit(EventType.FUND_UPDATED, { fund: normalizedFund });
        if (typeof window.SyncAppService !== 'undefined') {
            await window.SyncAppService.notifyBusinessDataChanged('event');
        }

        return { success: true, fund: normalizedFund, affectedTradeIds: [], reason: '' };
    },

    async updateFund(fundId, updates) {
        const now = new Date().toISOString();
        const funds = window.FundRepository.getAll();
        const index = funds.findIndex(fund => fund.id === fundId);

        if (index === -1) {
            return { success: false, fund: null, affectedTradeIds: [], reason: 'not_found' };
        }

        funds[index] = window.StorageSchema.createFundEntity({
            ...funds[index],
            ...updates,
            updatedAt: now,
            updateTime: updates.updateTime || now
        });

        const success = window.FundRepository.saveAll(funds);

        if (!success) {
            return { success: false, fund: null, affectedTradeIds: [], reason: 'save_failed' };
        }

        EventBus.emit(EventType.FUND_UPDATED, { fund: funds[index] });
        if (typeof window.SyncAppService !== 'undefined') {
            await window.SyncAppService.notifyBusinessDataChanged('event');
        }

        return { success: true, fund: funds[index], affectedTradeIds: [], reason: '' };
    },

    async deleteFund(fundId) {
        const tradeSnapshot = window.LocalStorageAdapter.loadSnapshot();
        const now = new Date().toISOString();
        const affectedTradeIds = [];
        const fund = window.FundRepository.getById(fundId);

        tradeSnapshot.trades = tradeSnapshot.trades.map(trade => {
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

        const fundDeleted = window.FundRepository.softDelete(fundId);
        const tradeDeleted = window.LocalStorageAdapter.saveSnapshot(tradeSnapshot);
        const success = fundDeleted && tradeDeleted;

        if (!success) {
            return { success: false, fund: null, affectedTradeIds: [], reason: 'delete_failed' };
        }

        EventBus.emit(EventType.FUND_DELETED, { fund });
        EventBus.emit(EventType.TRADE_UPDATED, { fundId, affectedTradeIds });
        EventBus.emit(EventType.CALCULATION_UPDATED, { fundId });
        if (typeof window.SyncAppService !== 'undefined') {
            await window.SyncAppService.notifyBusinessDataChanged('event');
        }

        return { success: true, fund, affectedTradeIds, reason: '' };
    }
};

ModuleRegistry.register('FundAppService', FundAppService);
