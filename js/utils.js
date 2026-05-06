/**
 * 工具函数库
 * 提供通用的工具函数
 */

const Utils = {
    /**
     * 日期格式化
     * @param {Date|string|number} date - 日期对象、字符串或时间戳
     * @param {string} format - 格式字符串，默认 'YYYY-MM-DD'
     * @returns {string}
     */
    formatDate(date, format = 'YYYY-MM-DD') {
        if (!date) return '';

        let d;
        if (date instanceof Date) {
            d = date;
        } else if (typeof date === 'string') {
            d = new Date(date);
        } else if (typeof date === 'number') {
            d = new Date(date);
        } else {
            return '';
        }

        if (isNaN(d.getTime())) {
            return '';
        }

        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');

        return format
            .replace('YYYY', year)
            .replace('MM', month)
            .replace('DD', day)
            .replace('HH', hours)
            .replace('mm', minutes)
            .replace('ss', seconds);
    },

    /**
     * 数字格式化（保留小数位）
     * @param {number} num - 数字
     * @param {number} decimals - 小数位数，默认2
     * @returns {string}
     */
    formatNumber(num, decimals = 2) {
        if (num === null || num === undefined || isNaN(num)) {
            return '0';
        }

        const number = Number(num);
        return number.toFixed(decimals);
    },

    /**
     * 金额格式化（千分位）
     * @param {number} amount - 金额
     * @param {number} decimals - 小数位数，默认2
     * @returns {string}
     */
    formatMoney(amount, decimals = 2) {
        if (amount === null || amount === undefined || isNaN(amount)) {
            return '¥0.00';
        }

        const number = Number(amount);
        const fixed = number.toFixed(decimals);
        const parts = fixed.split('.');
        const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        const decPart = parts[1] ? '.' + parts[1] : '';

        return `¥${intPart}${decPart}`;
    },

    /**
     * 百分比格式化
     * @param {number} value - 数值
     * @param {number} decimals - 小数位数，默认2
     * @returns {string}
     */
    formatPercent(value, decimals = 2) {
        if (value === null || value === undefined || isNaN(value)) {
            return '0.00%';
        }

        const number = Number(value);
        return `${number.toFixed(decimals)}%`;
    },

    /**
     * 生成唯一ID
     * @returns {string}
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    },

    /**
     * 深拷贝对象
     * @param {any} obj - 要拷贝的对象
     * @returns {any}
     */
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }

        if (Array.isArray(obj)) {
            return obj.map(item => this.deepClone(item));
        }

        const cloned = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                cloned[key] = this.deepClone(obj[key]);
            }
        }

        return cloned;
    },

    /**
     * 防抖函数
     * @param {function} func - 要防抖的函数
     * @param {number} wait - 等待时间（毫秒）
     * @returns {function}
     */
    debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    },

    /**
     * 节流函数
     * @param {function} func - 要节流的函数
     * @param {number} wait - 等待时间（毫秒）
     * @returns {function}
     */
    throttle(func, wait) {
        let lastTime = 0;
        return function (...args) {
            const now = Date.now();
            if (now - lastTime >= wait) {
                lastTime = now;
                func.apply(this, args);
            }
        };
    },

    /**
     * 延迟执行
     * @param {number} ms - 延迟时间（毫秒）
     * @returns {Promise}
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * 解析URL参数
     * @param {string} url - URL字符串
     * @returns {object}
     */
    parseUrlParams(url) {
        const params = {};
        const queryString = url.split('?')[1];

        if (!queryString) {
            return params;
        }

        queryString.split('&').forEach(pair => {
            const [key, value] = pair.split('=');
            params[decodeURIComponent(key)] = decodeURIComponent(value || '');
        });

        return params;
    },

    /**
     * 构建URL参数
     * @param {object} params - 参数对象
     * @returns {string}
     */
    buildUrlParams(params) {
        return Object.entries(params)
            .filter(([, value]) => value !== null && value !== undefined)
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
            .join('&');
    },

    /**
     * 验证基金代码格式
     * @param {string} code - 基金代码
     * @returns {boolean}
     */
    isValidFundCode(code) {
        if (!code || typeof code !== 'string') {
            return false;
        }

        // 基金代码通常是6位数字
        return /^\d{6}$/.test(code);
    },

    /**
     * 验证日期格式
     * @param {string} dateStr - 日期字符串
     * @returns {boolean}
     */
    isValidDate(dateStr) {
        if (!dateStr || typeof dateStr !== 'string') {
            return false;
        }

        const date = new Date(dateStr);
        return !isNaN(date.getTime());
    },

    /**
     * 验证数字
     * @param {any} value - 值
     * @returns {boolean}
     */
    isValidNumber(value) {
        if (value === null || value === undefined || value === '') {
            return false;
        }

        const num = Number(value);
        return !isNaN(num) && isFinite(num);
    },

    /**
     * 安全的数值计算（避免浮点数精度问题）
     * @param {number} a - 第一个数
     * @param {number} b - 第二个数
     * @param {string} op - 操作符 ('add', 'sub', 'mul', 'div')
     * @returns {number}
     */
    safeCalc(a, b, op) {
        const precision = 1000000; // 精度倍数

        const numA = Math.round(a * precision);
        const numB = Math.round(b * precision);

        let result;
        switch (op) {
        case 'add':
            result = (numA + numB) / precision;
            break;
        case 'sub':
            result = (numA - numB) / precision;
            break;
        case 'mul':
            result = (numA * numB) / (precision * precision);
            break;
        case 'div':
            result = numB !== 0 ? (numA / numB) : 0;
            break;
        default:
            result = 0;
        }

        return result;
    },

    /**
     * 获取颜色（根据数值正负）
     * @param {number} value - 数值
     * @returns {string} CSS类名
     */
    getValueColor(value) {
        if (value > 0) {
            return 'positive';
        } else if (value < 0) {
            return 'negative';
        }
        return '';
    },

    /**
     * 显示Toast提示
     * @param {string} message - 提示消息
     * @param {string} type - 类型 ('success', 'error', 'info')
     */
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const iconEl = document.getElementById('toast-icon');
        const messageEl = document.getElementById('toast-message');
        const closeBtn = document.getElementById('toast-close');
        const progressEl = document.getElementById('toast-progress');

        if (!container || !messageEl) return;

        const duration = Config.get('ui.toastDuration', 3000);

        const icons = {
            success: '✓',
            error: '✕',
            info: 'ℹ'
        };

        container.className = `toast-container ${type}`;
        container.style.setProperty('--toast-duration', `${duration}ms`);

        if (iconEl) iconEl.textContent = icons[type] || icons.info;
        messageEl.textContent = message;

        if (progressEl) {
            progressEl.style.animation = 'none';
            progressEl.offsetHeight;
            progressEl.style.animation = '';
        }

        const timer = setTimeout(() => {
            container.classList.add('hidden');
        }, duration);

        if (closeBtn) {
            closeBtn.onclick = () => {
                clearTimeout(timer);
                container.classList.add('hidden');
            };
        }
    },

    /**
     * 显示加载提示
     */
    showLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.classList.remove('hidden');
        }
    },

    /**
     * 隐藏加载提示
     */
    hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.classList.add('hidden');
        }
    },

    /**
     * 智能金额格式化（大数字自动转万/亿单位）
     * @param {number} amount - 金额
     * @param {number} decimals - 小数位
     * @returns {string}
     */
    formatMoneySmart(amount, decimals = 2) {
        return BigNumberFormatter.formatWithTooltip(amount, decimals);
    }
};

// 注册到模块系统
ModuleRegistry.register('Utils', Utils);
