/**
 * 基金管理器
 * 管理基金信息的增删改查
 */

const FundManager = {
    /**
     * 初始化基金管理器
     */
    init() {
        console.log('FundManager initialized');
    },

    /**
     * 获取所有基金
     * @returns {array}
     */
    getAllFunds() {
        return DataService.loadFunds();
    },

    /**
     * 获取单个基金
     * @param {string} fundId - 基金ID
     * @returns {object|null}
     */
    getFund(fundId) {
        return DataService.getFund(fundId);
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

            // 验证基金代码
            if (!Utils.isValidFundCode(fundData.code)) {
                throw new Error('基金代码格式不正确');
            }

            // 检查是否已存在
            const existingFunds = this.getAllFunds();
            if (existingFunds.find(f => f.code === fundData.code)) {
                throw new Error('该基金已存在');
            }

            // 获取基金信息
            const apiData = await FundAPI.getFundData(fundData.code);
            console.log('2. API data received:', apiData);
            console.log('3. API fund name:', apiData.name);

            // 构造基金对象
            const fund = {
                id: Utils.generateId(),
                code: fundData.code,
                name: apiData.name,
                netValue: apiData.netValue,
                netValueDate: apiData.netValueDate,
                estimatedValue: apiData.estimatedValue,
                estimatedGrowth: apiData.estimatedGrowth,
                createTime: new Date().toISOString(),
                updateTime: new Date().toISOString()
            };

            console.log('4. Final fund object:', fund);
            console.log('5. Final fund name:', fund.name);

            // 保存基金
            const success = DataService.addFund(fund);

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
        const success = DataService.updateFund(fundId, {
            ...updates,
            updateTime: new Date().toISOString()
        });

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
        const success = DataService.deleteFund(fundId);

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

            // 获取最新数据
            const apiData = await FundAPI.refreshFundData(fund.code);

            // 更新基金信息
            const updates = {
                name: apiData.name,
                netValue: apiData.netValue,
                netValueDate: apiData.netValueDate,
                estimatedValue: apiData.estimatedValue,
                estimatedGrowth: apiData.estimatedGrowth,
                updateTime: new Date().toISOString()
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

            // 批量获取最新数据
            const apiResults = await FundAPI.batchGetFundData(fundCodes);

            // 更新基金信息
            for (const apiData of apiResults) {
                const fund = funds.find(f => f.code === apiData.code);
                if (fund) {
                    this.updateFund(fund.id, {
                        name: apiData.name,
                        netValue: apiData.netValue,
                        netValueDate: apiData.netValueDate,
                        estimatedValue: apiData.estimatedValue,
                        estimatedGrowth: apiData.estimatedGrowth
                    });
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
        return Calculator.calculateFundStats(fundId);
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
