const DetailTradeActionHelper = {
    buildEditTradePayload(trade) {
        return {
            type: 'editTrade',
            data: { trade }
        };
    },

    buildDeleteTradePayload(tradeId) {
        return {
            type: 'deleteConfirm',
            data: {
                message: '确定要删除该交易记录吗？',
                onConfirm: () => {
                    TradeManager.deleteTrade(tradeId);
                }
            }
        };
    }
};

ModuleRegistry.register('DetailTradeActionHelper', DetailTradeActionHelper);
