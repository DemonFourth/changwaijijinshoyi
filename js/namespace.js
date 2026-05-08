/**
 * 场外基金收益计算器 - 全局命名空间
 * 用于统一管理所有模块和组件
 */

const FundCalculator = {
    // 版本信息
    version: '1.0.0',

    // 模块注册表
    modules: {},

    /**
     * 注册模块到命名空间
     * @param {string} name - 模块名称
     * @param {object} module - 模块对象
     */
    register(name, module) {
        if (this.modules[name]) {
            console.warn(`Module ${name} already exists, will be overwritten`);
        }
        this.modules[name] = module;
        console.log(`Module ${name} registered`);
    },

    /**
     * 获取已注册的模块
     * @param {string} name - 模块名称
     * @returns {object} 模块对象
     */
    get(name) {
        if (!this.modules[name]) {
            console.error(`Module ${name} not found`);
            return null;
        }
        return this.modules[name];
    },

    /**
     * 检查模块是否已注册
     * @param {string} name - 模块名称
     * @returns {boolean}
     */
    has(name) {
        return !!this.modules[name];
    },

    /**
     * 获取所有已注册的模块名称
     * @returns {string[]}
     */
    list() {
        return Object.keys(this.modules);
    }
};

// 暴露到全局
window.FundCalculator = FundCalculator;
