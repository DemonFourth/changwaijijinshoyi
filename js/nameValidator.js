/**
 * 基金名称验证器
 * 检测基金名称是否为乱码，支持三层检测机制
 */

const NameValidator = {
    GARBLED_PATTERNS: [
        /锘/,
        /\ufffd/,
        new RegExp('[\\x00-\\x08\\x0b\\x0c\\x0e-\\x1f]'),
        /[^\u4e00-\u9fa5\u0020-\u007e\u3000-\u303f\uff00-\uffef\d\-_()]/
    ],

    VALID_PATTERNS: [
        /^[\u4e00-\u9fa5a-zA-Z0-9\s\-_()（）]+$/
    ],

    MIN_VALID_RATIO: 0.7,
    MIN_LENGTH: 2,
    MAX_LENGTH: 50,

    detectGarbled(name) {
        if (!name || typeof name !== 'string') {
            return { isGarbled: true, reason: 'empty_or_invalid', confidence: 1 };
        }

        const trimmed = name.trim();
        if (trimmed.length === 0) {
            return { isGarbled: true, reason: 'empty', confidence: 1 };
        }

        for (let i = 0; i < NameValidator.GARBLED_PATTERNS.length; i++) {
            if (NameValidator.GARBLED_PATTERNS[i].test(name)) {
                return { isGarbled: true, reason: 'garbled_pattern', confidence: 0.95 };
            }
        }

        const ratio = NameValidator.calculateValidRatio(name);
        if (ratio < NameValidator.MIN_VALID_RATIO) {
            return { isGarbled: true, reason: 'low_valid_ratio', confidence: 0.7, ratio: ratio };
        }

        if (name.length < NameValidator.MIN_LENGTH || name.length > NameValidator.MAX_LENGTH) {
            return { isGarbled: true, reason: 'invalid_length', confidence: 0.6, length: name.length };
        }

        return { isGarbled: false, reason: 'valid', confidence: 0.9, ratio: ratio };
    },

    calculateValidRatio(name) {
        if (!name || name.length === 0) return 0;

        let validCount = 0;
        for (let i = 0; i < name.length; i++) {
            const char = name[i];
            const code = char.charCodeAt(0);

            if ((code >= 0x4e00 && code <= 0x9fa5) ||
                (code >= 0x0020 && code <= 0x007e) ||
                (code >= 0x3000 && code <= 0x303f) ||
                (code >= 0xff00 && code <= 0xffef)) {
                validCount++;
            }
        }

        return validCount / name.length;
    },

    isValid(name) {
        const result = NameValidator.detectGarbled(name);
        return !result.isGarbled;
    },

    sanitize(name) {
        if (!name || typeof name !== 'string') return '';

        const sanitized = name
            .replace(/锘/g, '')
            .replace(/�/g, '')
            .replace(/\ufffd/g, '')
            .replace(new RegExp('[\\x00-\\x08\\x0b\\x0c\\x0e-\\x1f]', 'g'), '')
            .trim();

        return sanitized;
    },

    suggestName(name, fundCode) {
        const result = NameValidator.detectGarbled(name);

        if (!result.isGarbled) {
            return name;
        }

        const sanitized = NameValidator.sanitize(name);
        if (sanitized && NameValidator.isValid(sanitized)) {
            return sanitized;
        }

        return '基金' + fundCode;
    }
};

ModuleRegistry.register('NameValidator', NameValidator);
