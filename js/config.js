/**
 * 配置管理模块
 * 统一管理应用的所有配置项
 */

const Config = {
    // API配置
    api: {
        // 基金数据API基础地址
        baseUrl: 'https://fundgz.1234567.com.cn/js',
        // API请求超时时间（毫秒）
        timeout: 10000,
        // 请求重试次数
        retryCount: 3,
        // 重试延迟（毫秒）
        retryDelay: 1000
    },

    // 缓存配置
    cache: {
        // API缓存过期时间（毫秒）- 5分钟
        apiTTL: 5 * 60 * 1000,
        // 最大缓存条目数
        maxEntries: 100
    },

    // 存储配置
    storage: {
        // 基金数据存储键
        fundsKey: 'fund_calculator_funds',
        // 交易记录存储键
        tradesKey: 'fund_calculator_trades',
        // 应用设置存储键
        settingsKey: 'fund_calculator_settings',
        // 主题设置存储键
        themeKey: 'fund_calculator_theme',
        // 统一快照存储键
        snapshotKey: 'fund_calculator_snapshot'
    },

    // 应用配置
    app: {
        // 应用名称
        name: '场外基金收益计算器',
        // 版本号
        version: '1.0.0',
        // 默认主题
        defaultTheme: 'light',
        // 日期格式
        dateFormat: 'YYYY-MM-DD',
        // 数字精度（小数位数）
        numberPrecision: 2,
        // 金额精度
        moneyPrecision: 2
    },

    // 计算配置
    calculation: {
        // 手续费默认费率（买入，区间固定为 0~100 万元）
        defaultBuyFeeRate: 0,
        // 手续费默认费率（卖出，区间固定为 0~7 天）
        defaultSellFeeRate: 0,
        // 计算方法（加权平均成本法）
        useWeightedAverage: true
    },

    // UI配置
    ui: {
        // Toast显示时长（毫秒）
        toastDuration: 3000,
        // 加载提示最小显示时长（毫秒）
        loadingMinDuration: 500,
        // 动画时长（毫秒）
        animationDuration: 300,
        // 默认视图模式（card=卡片视图, list=列表视图）
        defaultViewMode: 'card',
        // 默认排序字段（长期持有关注收益率）
        defaultSortField: 'profitRate',
        // 默认排序方向
        defaultSortOrder: 'desc',
        // 默认每页条数
        defaultPageSize: 10,
        // 每页条数选项
        pageSizeOptions: [10, 20, 50],
        // 备注最大长度
        remarkMaxLength: 50,
        // 大数字转换阈值（超过此值自动转为"万"单位）
        bigNumberThreshold: 10000,
        // 亿级阈值
        bigNumberWanThreshold: 100000000
    },

    // 基金数据提供者配置
    fundProvider: {
        // 当前激活的提供者
        active: 'tiantian',
        // 可用提供者列表
        available: ['tiantian']
    },

    // ECharts配置
    echarts: {
        // 是否启用ECharts图表
        enabled: true
    },

    // 同步配置
    sync: {
        // 是否启用云同步（默认 false，本地静态模式为 false；Pages 部署后由 runtime-config 注入为 true）
        enabled: false,
        // 云同步 API 基础路径（同源 /api/sync，由 runtime-config 注入）
        basePath: '',
        // 同步请求超时时间（毫秒）
        timeout: 10000
    },

    /**
     * 获取配置项
     * @param {string} key - 配置项路径，如 'api.timeout'
     * @param {any} defaultValue - 默认值
     * @returns {any}
     */
    get(key, defaultValue = undefined) {
        const keys = key.split('.');
        let value = this;

        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return defaultValue;
            }
        }

        return value;
    },

    /**
     * 设置配置项
     * @param {string} key - 配置项路径
     * @param {any} value - 配置值
     */
    set(key, value) {
        const keys = key.split('.');
        let obj = this;

        for (let i = 0; i < keys.length - 1; i++) {
            const k = keys[i];
            if (!obj[k] || typeof obj[k] !== 'object') {
                obj[k] = {};
            }
            obj = obj[k];
        }

        obj[keys[keys.length - 1]] = value;
    },

    /**
     * 加载用户自定义配置
     * @param {object} userConfig - 用户配置对象
     */
    load(userConfig) {
        if (!userConfig || typeof userConfig !== 'object') {
            return;
        }

        // 深度合并配置
        this.merge(this, userConfig);
    },

    /**
     * 深度合并对象
     * @param {object} target - 目标对象
     * @param {object} source - 源对象
     */
    merge(target, source) {
        for (const key in source) {
            if (Object.prototype.hasOwnProperty.call(source, key)) {
                if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    if (!target[key] || typeof target[key] !== 'object') {
                        target[key] = {};
                    }
                    this.merge(target[key], source[key]);
                } else {
                    target[key] = source[key];
                }
            }
        }
    },

    /**
     * 获取API URL
     * @param {string} fundCode - 基金代码
     * @returns {string}
     */
    getApiUrl(fundCode) {
        return `${this.api.baseUrl}/${fundCode}.js`;
    },

    /**
     * 打印当前配置（调试用）
     */
    debug() {
        console.log('Current Config:', JSON.stringify(this, null, 2));
    }
};

// 注册到模块系统
ModuleRegistry.register('Config', Config);
