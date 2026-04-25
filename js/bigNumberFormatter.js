/**
 * 大数字格式化模块
 * 将大额金额智能转换为"万"/"亿"单位显示，悬浮显示完整值
 */

const BigNumberFormatter = {
    /**
     * 格式化大数字
     * @param {number} amount - 金额
     * @param {number} decimals - 小数位，默认2
     * @returns {string} 格式化后的字符串
     */
    format(amount, decimals = 2) {
        if (amount === null || amount === undefined || isNaN(amount)) return '¥0.00';
        
        const abs = Math.abs(amount);
        const sign = amount < 0 ? '-' : '';
        
        if (abs >= 100000000) {
            // 亿级
            const value = (abs / 100000000).toFixed(decimals);
            return `${sign}¥${value}亿`;
        } else if (abs >= 10000) {
            // 万级
            const value = (abs / 10000).toFixed(decimals);
            return `${sign}¥${value}万`;
        } else {
            // 普通千分位
            return BigNumberFormatter.formatFull(amount, decimals);
        }
    },

    /**
     * 返回完整千分位格式
     * @param {number} amount - 金额
     * @param {number} decimals - 小数位，默认2
     * @returns {string}
     */
    formatFull(amount, decimals = 2) {
        if (amount === null || amount === undefined || isNaN(amount)) return '¥0.00';
        
        const abs = Math.abs(amount).toFixed(decimals);
        const parts = abs.split('.');
        const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        const result = parts.length > 1 ? `${intPart}.${parts[1]}` : intPart;
        const sign = amount < 0 ? '-' : '';
        
        return `${sign}¥${result}`;
    },

    /**
     * 判断是否为大数字
     * @param {number} amount
     * @returns {boolean}
     */
    isBigNumber(amount) {
        return Math.abs(amount || 0) >= 10000;
    },

    /**
     * 生成带tooltip的HTML
     * @param {number} amount - 金额
     * @param {number} decimals - 小数位
     * @returns {string} HTML字符串
     */
    formatWithTooltip(amount, decimals = 2) {
        if (!BigNumberFormatter.isBigNumber(amount)) {
            return BigNumberFormatter.formatFull(amount, decimals);
        }
        
        const display = BigNumberFormatter.format(amount, decimals);
        const full = BigNumberFormatter.formatFull(amount, decimals);
        return `<span class="big-number" title="${full}">${display}</span>`;
    }
};

// 注册到模块系统
ModuleRegistry.register('BigNumberFormatter', BigNumberFormatter);
