const FundAppService = {
    // 不需要同步到云端的字段（净值等 API 实时数据）
    TRANSIENT_FIELDS: new Set([
        'netValue', 'netValueDate',
        'estimatedValue', 'estimatedGrowth', 'estimatedDate',
        'nameSource', 'nameUpdateTime'
    ]),

    // 元数据键（不计入任何变更判断）
    META_KEYS: new Set([
        'updatedAt', 'updateTime', 'lastSyncedAt', 'createdAt', 'deletedAt'
    ]),

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

        return { success: true, fund: normalizedFund, affectedTradeIds: [], reason: '' };
    },

    async updateFund(fundId, updates) {
        const now = new Date().toISOString();
        const funds = window.FundRepository.getAll();
        const index = funds.findIndex(fund => fund.id === fundId);

        if (index === -1) {
            return { success: false, fund: null, affectedTradeIds: [], reason: 'not_found' };
        }

        const existing = funds[index];

        // 判断是否有净值类变更（瞬态字段变化）
        const hasNetValueChange = Object.keys(updates).some(key =>
            FundAppService.TRANSIENT_FIELDS.has(key) &&
            JSON.stringify(existing[key]) !== JSON.stringify(updates[key])
        );

        // 判断是否有结构性变更（业务字段变化）
        const hasStructuralChange = Object.keys(updates).some(key =>
            !FundAppService.META_KEYS.has(key) &&
            !FundAppService.TRANSIENT_FIELDS.has(key) &&
            JSON.stringify(existing[key]) !== JSON.stringify(updates[key])
        );

        funds[index] = window.StorageSchema.createFundEntity({
            ...existing,
            ...updates,
            updatedAt: now,
            updateTime: updates.updateTime || now
        });

        const success = window.FundRepository.saveAll(funds);

        if (!success) {
            return { success: false, fund: null, affectedTradeIds: [], reason: 'save_failed' };
        }

        // 净值变化 → 发射 NET_VALUE_UPDATED（不触发同步）
        // 结构性变化 → 发射 FUND_UPDATED（触发同步）
        if (hasNetValueChange && !hasStructuralChange) {
            EventBus.emit(EventType.NET_VALUE_UPDATED, { fund: funds[index] });
        } else if (hasStructuralChange) {
            EventBus.emit(EventType.FUND_UPDATED, { fund: funds[index] });
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

        return { success: true, fund, affectedTradeIds, reason: '' };
    }
};

ModuleRegistry.register('FundAppService', FundAppService);
