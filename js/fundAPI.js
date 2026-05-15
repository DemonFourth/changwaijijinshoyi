/**
 * 基金API服务（兼容层）
 * 通过 FundProviderRegistry 委托给当前激活的数据提供者
 * 保持向后兼容，供 detail.js、modal.js 等模块直接引用
 */

const FundAPI = {
    getFundData(fundCode, useCache) {
        return FundProviderRegistry.getCurrentProvider().getFundData(fundCode, useCache);
    },

    refreshFundData(fundCode) {
        return FundProviderRegistry.getCurrentProvider().refreshFundData(fundCode);
    },

    batchGetFundData(fundCodes, concurrency) {
        return FundProviderRegistry.getCurrentProvider().batchGetFundData(fundCodes, concurrency);
    },

    fetchNameOnly(fundCode) {
        return FundProviderRegistry.getCurrentProvider().fetchNameOnly(fundCode);
    },

    clearCache() {
        return FundProviderRegistry.getCurrentProvider().clearCache();
    },

    clearCacheForFund(fundCode) {
        return FundProviderRegistry.getCurrentProvider().clearCacheForFund(fundCode);
    }
};

ModuleRegistry.register('FundAPI', FundAPI);
