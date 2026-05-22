/**
 * 统一错误处理器
 * 提供标准化的错误处理、用户提示和日志记录
 */

const ErrorHandler = {
    /**
     * 错误类型映射
     */
    _errorMessages: {
        'network': '网络错误，请检查网络连接',
        'timeout': '请求超时，请稍后重试',
        'not_found': '数据不存在',
        'validation_failed': '数据验证失败，请检查输入',
        'sync_failed': '同步失败，请稍后重试',
        'auth_failed': '认证失败，请检查密钥',
        'permission_denied': '权限不足',
        'unknown': '操作失败，请重试'
    },

    /**
     * 处理错误
     * @param {Error|string} error - 错误对象或消息
     * @param {object} context - 上下文信息
     * @returns {object} 错误信息对象
     */
    handle(error, context = {}) {
        const errorInfo = this._parseError(error);

        console.error(
            '[Error][' + (context.module || 'Unknown') + ']',
            errorInfo.message,
            context.data || ''
        );

        if (context.showToast !== false) {
            const userMessage = this._getUserMessage(errorInfo);
            window.Utils?.showToast(userMessage, 'error', context.toastDuration);
        }

        if (context.updateSyncStatus) {
            window.LocalStorageAdapter?.updateSyncMeta({
                syncStatus: 'error',
                lastError: errorInfo.message
            });
        }

        if (context.report !== false && this._shouldReport(errorInfo)) {
            this._report(errorInfo, context);
        }

        return errorInfo;
    },

    /**
     * 解析错误信息
     */
    _parseError(error) {
        if (error instanceof Error) {
            return {
                type: this._classifyError(error),
                message: error.message,
                stack: error.stack
            };
        }

        if (typeof error === 'string') {
            return {
                type: this._classifyError({ message: error }),
                message: error,
                stack: null
            };
        }

        return {
            type: 'unknown',
            message: String(error),
            stack: null
        };
    },

    /**
     * 分类错误类型
     */
    _classifyError(error) {
        const message = (error.message || '').toLowerCase();

        if (message.includes('network') || message.includes('fetch') || message.includes('连接')) {
            return 'network';
        }
        if (message.includes('timeout') || message.includes('etimedout')) {
            return 'timeout';
        }
        if (message.includes('not found') || message.includes('不存在')) {
            return 'not_found';
        }
        if (message.includes('validation') || message.includes('验证')) {
            return 'validation_failed';
        }
        if (message.includes('sync') || message.includes('同步')) {
            return 'sync_failed';
        }
        if (message.includes('auth') || message.includes('认证') || message.includes('key')) {
            return 'auth_failed';
        }
        if (message.includes('permission') || message.includes('权限')) {
            return 'permission_denied';
        }

        return 'unknown';
    },

    /**
     * 获取用户友好提示
     */
    _getUserMessage(errorInfo) {
        return this._errorMessages[errorInfo.type] || this._errorMessages.unknown;
    },

    /**
     * 判断是否需要上报
     */
    _shouldReport(errorInfo) {
        const noReportTypes = ['network', 'timeout'];
        return !noReportTypes.includes(errorInfo.type);
    },

    /**
     * 错误上报（可扩展）
     */
    _report(errorInfo, context) {
        console.log('[ErrorHandler] Error reported:', {
            type: errorInfo.type,
            message: errorInfo.message,
            module: context.module,
            timestamp: new Date().toISOString()
        });
    },

    /**
     * 创建业务异常
     */
    createBusinessError(code, message, data = null) {
        const error = new Error(message);
        error.code = code;
        error.data = data;
        error.isBusinessError = true;
        return error;
    }
};

ModuleRegistry.register('ErrorHandler', ErrorHandler);
