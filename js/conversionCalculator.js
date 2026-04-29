/**
 * 基金转换计算器
 * 计算从A基金转换到B基金的完整过程
 */

const ConversionCalculator = {
    /**
     * 执行转换计算
     * @param {object} params - 转换参数
     * @returns {object} 计算结果
     */
    calculate(params) {
        const {
            aNetValue,
            aShares,
            aSellRate,
            bNetValue,
            bShares,
            bBuyRate
        } = params;

        // 验证输入
        const validation = ConversionCalculator.validate(params);
        if (!validation.valid) {
            return { error: validation.message };
        }

        // A基金卖出
        const transferAmount = aNetValue * aShares;
        const sellFee = transferAmount * (aSellRate / 100);
        const receivedAmount = transferAmount - sellFee;

        // B基金买入
        const baseAmount = bNetValue * bShares;
        const buyFee = baseAmount * (bBuyRate / 100);
        const paidAmount = baseAmount + buyFee;

        // 资金结算
        const balance = receivedAmount - paidAmount;
        const totalFee = sellFee + buyFee;

        return {
            // A基金
            transferAmount: transferAmount,
            sellFee: sellFee,
            receivedAmount: receivedAmount,

            // B基金
            baseAmount: baseAmount,
            buyFee: buyFee,
            paidAmount: paidAmount,

            // 结算
            balance: balance,
            totalFee: totalFee,

            // 输入参数
            input: params
        };
    },

    /**
     * 验证输入参数
     * @param {object} params - 转换参数
     * @returns {object} {valid, message}
     */
    validate(params) {
        const {
            aNetValue,
            aShares,
            aSellRate,
            bNetValue,
            bShares,
            bBuyRate
        } = params;

        if (!aNetValue || aNetValue <= 0) {
            return { valid: false, message: 'A基金净值必须大于0' };
        }
        if (!aShares || aShares <= 0) {
            return { valid: false, message: 'A基金份额必须大于0' };
        }
        if (aSellRate === undefined || aSellRate === null || aSellRate < 0) {
            return { valid: false, message: 'A基金卖出费率不能为空' };
        }
        if (!bNetValue || bNetValue <= 0) {
            return { valid: false, message: 'B基金净值必须大于0' };
        }
        if (!bShares || bShares <= 0) {
            return { valid: false, message: 'B基金份额必须大于0' };
        }
        if (bBuyRate === undefined || bBuyRate === null || bBuyRate < 0) {
            return { valid: false, message: 'B基金买入费率不能为空' };
        }

        return { valid: true, message: '' };
    },

    /**
     * 生成交易记录
     * @param {object} result - 计算结果
     * @param {object} options - 选项 {date, remark, targetFundId, sourceFundId}
     * @returns {array} 两条交易记录 [卖出记录, 买入记录]
     */
    generateTrades(result, options) {
        const { date, remark, targetFundId, sourceFundId } = options;

        // A基金卖出记录
        const sellTrade = {
            fundId: sourceFundId || '',
            date: date,
            type: 'sell',
            netValue: result.input.aNetValue,
            shares: result.input.aShares,
            amount: result.receivedAmount,
            fee: result.sellFee,
            remark: remark ? `[转换] ${remark}` : '基金转换-卖出',
            createTime: new Date().toISOString()
        };

        // B基金买入记录
        const buyTrade = {
            fundId: targetFundId || '',
            date: date,
            type: 'buy',
            netValue: result.input.bNetValue,
            shares: result.input.bShares,
            amount: result.paidAmount,
            fee: result.buyFee,
            remark: remark ? `[转换] ${remark}` : '基金转换-买入',
            createTime: new Date().toISOString()
        };

        return [sellTrade, buyTrade];
    }
};

// 注册到模块系统
ModuleRegistry.register('ConversionCalculator', ConversionCalculator);
