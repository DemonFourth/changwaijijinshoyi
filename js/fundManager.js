/**
 * 基金管理器
 * 管理基金信息的增删改查
 */

const fundAppServiceModule = window.FundAppService;
const tradeAppServiceModule = window.TradeAppService;

const FundManager = {
    // 统计数据缓存
    _statsCache: new Map(),

    /**
     * 初始化基金管理器
     */
    init() {
        console.log('FundManager initialized');

        // 监听数据变更事件，自动清除缓存
        EventBus.on(EventType.FUND_UPDATED, () => this.clearStatsCache());
        EventBus.on(EventType.FUND_DELETED, () => this.clearStatsCache());
        EventBus.on(EventType.TRADE_ADDED, () => this.clearStatsCache());
        EventBus.on(EventType.TRADE_UPDATED, () => this.clearStatsCache());
        EventBus.on(EventType.TRADE_DELETED, () => this.clearStatsCache());
        EventBus.on(EventType.FUND_REFRESHED, () => this.clearStatsCache());
    },

    /**
     * 清除统计缓存
     * @param {string} [fundId] - 指定基金ID，不传则清除全部
     */
    clearStatsCache(fundId) {
        if (fundId) {
            this._statsCache.delete(fundId);
        } else {
            this._statsCache.clear();
        }
    },

    /**
     * 获取所有基金
     * @returns {array}
     */
    getAllFunds() {
        return fundAppServiceModule.getAllFunds();
    },

    /**
     * 获取单个基金
     * @param {string} fundId - 基金ID
     * @returns {object|null}
     */
    getFund(fundId) {
        return fundAppServiceModule.getFund(fundId);
    },

    /**
     * 添加基金
     * @param {object} fundData - 基金数据
     * @returns {Promise<object>}
     */
    async addFund(fundData) {
        try {
            Utils.showLoading();

            console.log('=== Add Fund Debug ===');
            console.log('1. Input fund data:', fundData);

            if (!Utils.isValidFundCode(fundData.code)) {
                throw new Error('基金代码格式不正确');
            }

            const existingFunds = this.getAllFunds();
            if (existingFunds.find(f => f.code === fundData.code)) {
                throw new Error('该基金已存在');
            }

            let fundName = fundData.name;
            let nameSource = fundData.nameSource || 'manual';
            let apiData = null;

            if (!fundName) {
                apiData = await FundAPI.getFundData(fundData.code);
                console.log('2. API data received:', apiData);
                console.log('3. API fund name:', apiData.name);
                fundName = apiData.name;
                nameSource = 'api';
            }

            if (!apiData) {
                apiData = await FundAPI.getFundData(fundData.code);
            }

            const validation = NameValidator.detectGarbled(fundName);
            if (validation.isGarbled) {
                console.warn('Name appears garbled:', fundName, validation);
                const cachedEntry = NameCache.get(fundData.code);
                if (cachedEntry && !NameValidator.detectGarbled(cachedEntry.name).isGarbled) {
                    fundName = cachedEntry.name;
                    nameSource = 'cache';
                }
            }

            const fund = {
                id: Utils.generateId(),
                code: fundData.code,
                name: fundName,
                nameSource: nameSource,
                nameUpdateTime: new Date().toISOString(),
                remark: fundData.remark || '', // 新增备注字段
                netValue: apiData ? apiData.netValue : 0,
                netValueDate: apiData ? apiData.netValueDate : '',
                estimatedValue: apiData ? apiData.estimatedValue : 0,
                estimatedGrowth: apiData ? apiData.estimatedGrowth : 0,
                createTime: new Date().toISOString(),
                updateTime: apiData && apiData.estimatedDate ? apiData.estimatedDate : new Date().toISOString()
            };

            console.log('4. Final fund object:', fund);
            console.log('5. Final fund name:', fund.name);

            if (!NameValidator.detectGarbled(fundName).isGarbled) {
                NameCache.set(fundData.code, fundName, nameSource);
            }

            const success = fundAppServiceModule.addFund(fund);

            if (success) {
                DataService.fundsCache = null;
                EventBus.emit(EventType.FUND_ADDED, { fund });
                EventBus.emit(EventType.FUND_UPDATED, { fund });
            }

            if (!success) {
                throw new Error('保存基金失败');
            }

            Utils.hideLoading();
            Utils.showToast('基金添加成功', 'success');

            return fund;
        } catch (error) {
            Utils.hideLoading();
            Utils.showToast(error.message, 'error');
            throw error;
        }
    },

    /**
     * 更新基金
     * @param {string} fundId - 基金ID
     * @param {object} updates - 更新内容
     * @returns {boolean}
     */
    updateFund(fundId, updates) {
        // 确保备注字段被正确处理
        if (updates.remark !== undefined) {
            // 备注字段需要显式处理，确保更新时不会丢失
            updates.updateTime = new Date().toISOString();
        }

        const success = fundAppServiceModule.updateFund(fundId, updates);

        if (success) {
            DataService.fundsCache = null;
            EventBus.emit(EventType.FUND_UPDATED, { fund: fundAppServiceModule.getFund(fundId) });
        }

        if (success) {
            Utils.showToast('基金更新成功', 'success');
        } else {
            Utils.showToast('基金更新失败', 'error');
        }

        return success;
    },

    /**
     * 删除基金
     * @param {string} fundId - 基金ID
     * @returns {boolean}
     */
    deleteFund(fundId) {
        const deletedFund = fundAppServiceModule.getFund(fundId);
        const success = fundAppServiceModule.deleteFund(fundId);

        if (success) {
            DataService.fundsCache = null;
            DataService.tradesCache = null;
            DataService.invalidateCache(fundId);
            EventBus.emit(EventType.FUND_DELETED, { fund: deletedFund });
            EventBus.emit(EventType.TRADE_UPDATED, { fundId });
            EventBus.emit(EventType.CALCULATION_UPDATED, { fundId });
        }

        if (success) {
            Utils.showToast('基金删除成功', 'success');
        } else {
            Utils.showToast('基金删除失败', 'error');
        }

        return success;
    },

    /**
     * 刷新基金数据
     * @param {string} fundId - 基金ID
     * @returns {Promise<object>}
     */
    async refreshFund(fundId) {
        try {
            const fund = this.getFund(fundId);
            if (!fund) {
                throw new Error('基金不存在');
            }

            Utils.showLoading();

            const apiData = await FundAPI.refreshFundData(fund.code);

            const updates = {
                netValue: apiData.netValue,
                netValueDate: apiData.netValueDate,
                estimatedValue: apiData.estimatedValue,
                estimatedGrowth: apiData.estimatedGrowth,
                updateTime: apiData.estimatedDate || new Date().toISOString()
            };

            const success = this.updateFund(fundId, updates);

            Utils.hideLoading();

            if (success) {
                Utils.showToast('基金数据刷新成功', 'success');
                EventBus.emit(EventType.FUND_REFRESHED, { fundId });
            }

            return { ...fund, ...updates };
        } catch (error) {
            Utils.hideLoading();
            Utils.showToast(error.message, 'error');
            throw error;
        }
    },

    /**
     * 刷新所有基金数据
     * @returns {Promise<void>}
     */
    async refreshAllFunds() {
        try {
            Utils.showLoading();

            const funds = this.getAllFunds();
            const fundCodes = funds.map(f => f.code);

            const apiResults = await FundAPI.batchGetFundData(fundCodes);

            for (const apiData of apiResults) {
                const fund = funds.find(f => f.code === apiData.code);
                if (fund) {
                    const updates = {
                        netValue: apiData.netValue,
                        netValueDate: apiData.netValueDate,
                        estimatedValue: apiData.estimatedValue,
                        estimatedGrowth: apiData.estimatedGrowth,
                        updateTime: apiData.estimatedDate || new Date().toISOString()
                    };

                    this.updateFund(fund.id, updates);
                }
            }

            Utils.hideLoading();
            Utils.showToast('所有基金数据刷新成功', 'success');

            EventBus.emit(EventType.FUND_REFRESHED);
        } catch (error) {
            Utils.hideLoading();
            Utils.showToast(error.message, 'error');
            throw error;
        }
    },

    /**
     * 获取基金统计信息
     * @param {string} fundId - 基金ID
     * @returns {object}
     */
    getFundStats(fundId) {
        const fund = fundAppServiceModule.getFund(fundId);
        if (!fund) {
            return null;
        }

        const trades = tradeAppServiceModule.getTradesByFund(fundId);
        const currentNetValue = fund.estimatedValue || fund.netValue || 0;

        // 汇总页当前持仓相关统计：估算净值优先，空时回退最新净值
        const stats = CalculatorV2.calculateFundProfit(trades, currentNetValue);

        // 清除缓存以获取最新数据
        this._statsCache.delete(fundId);
        this._statsCache.set(fundId, stats);

        return stats;
    },

    /**
     * 批量获取基金统计信息（避免重复计算）
     * @param {array} fundIds - 基金ID数组
     * @returns {Map} fundId -> stats
     */
    batchGetFundStats(fundIds) {
        const results = new Map();
        for (const fundId of fundIds) {
            results.set(fundId, this.getFundStats(fundId));
        }
        return results;
    },

    /**
     * 搜索基金
     * @param {string} keyword - 搜索关键词
     * @returns {array}
     */
    searchFunds(keyword) {
        const funds = this.getAllFunds();
        const lowerKeyword = keyword.toLowerCase();

        return funds.filter(fund =>
            fund.code.includes(keyword) ||
            fund.name.toLowerCase().includes(lowerKeyword)
        );
    },

    /**
     * 按收益率排序基金
     * @param {array} funds - 基金列表
     * @param {string} order - 排序方式 'asc' 或 'desc'
     * @returns {array}
     */
    sortFundsByProfitRate(funds, order = 'desc') {
        return funds.sort((a, b) => {
            const statsA = this.getFundStats(a.id);
            const statsB = this.getFundStats(b.id);

            const rateA = statsA ? statsA.total.rate : 0;
            const rateB = statsB ? statsB.total.rate : 0;

            return order === 'desc' ? rateB - rateA : rateA - rateB;
        });
    },

    /**
     * 检查基金代码是否已存在
     * @param {string} code - 基金代码
     * @returns {boolean}
     */
    isFundCodeExists(code) {
        const funds = this.getAllFunds();
        return funds.some(f => f.code === code);
    }
};

// 注册到模块系统
ModuleRegistry.register('FundManager', FundManager);
