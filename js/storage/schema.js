const StorageSchema = {
    VERSION: 1,

    createEmptySnapshot() {
        return {
            schemaVersion: StorageSchema.VERSION,
            funds: [],
            trades: [],
            syncMeta: {
                provider: 'local',
                deviceId: '',
                lastSyncAt: null
            }
        };
    },

    normalizeFeeTiers(feeTiers) {
        return feeTiers || {
            buyTiers: [],
            sellTiers: []
        };
    },

    createFundEntity(fund) {
        const now = new Date().toISOString();

        return {
            ...fund,
            id: fund.id,
            code: fund.code,
            name: fund.name,
            remark: fund.remark || '',
            feeTiers: StorageSchema.normalizeFeeTiers(fund.feeTiers),
            createdAt: fund.createdAt || fund.createTime || now,
            updatedAt: fund.updatedAt || fund.updateTime || now,
            deletedAt: fund.deletedAt || null,
            syncId: fund.syncId || fund.id
        };
    },

    createTradeEntity(trade) {
        const now = new Date().toISOString();

        return {
            ...trade,
            id: trade.id,
            fundId: trade.fundId,
            date: trade.date,
            type: trade.type,
            netValue: Number(trade.netValue || 0),
            shares: Number(trade.shares || 0),
            amount: Number(trade.amount || 0),
            fee: Number(trade.fee || 0),
            remark: trade.remark || '',
            dividendMode: trade.dividendMode || null,
            createdAt: trade.createdAt || trade.createTime || now,
            updatedAt: trade.updatedAt || trade.updateTime || now,
            deletedAt: trade.deletedAt || null,
            syncId: trade.syncId || trade.id
        };
    }
};

ModuleRegistry.register('StorageSchema', StorageSchema);
