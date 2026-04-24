module.exports = {
  extends: 'stylelint-config-standard',
  rules: {
    // 颜色规则
    'color-hex-length': 'long',           // 使用长十六进制颜色
    'color-named': null,                  // 允许使用颜色名称
    
    // 字体规则
    'font-family-name-quotes': 'always-where-recommended',
    
    // 函数规则
    'function-url-quotes': 'always',
    
    // 数字规则
    'number-max-precision': 4,            // 最多4位小数
    
    // 长度规则
    'length-zero-no-unit': true,          // 0值不带单位
    
    // 选择器规则
    'selector-class-pattern': null,       // 允许任意类名
    'selector-id-pattern': null,          // 允许任意ID
    'selector-max-id': 1,                 // 最多1个ID选择器
    'selector-no-qualifying-type': null,  // 允许限定类型
    
    // 属性规则
    'property-no-vendor-prefix': null,    // 允许厂商前缀
    
    // 值规则
    'value-no-vendor-prefix': null,       // 允许厂商前缀
    
    // 声明规则
    'declaration-block-no-duplicate-properties': true, // 禁止重复属性
    'declaration-block-no-shorthand-property-overrides': true,
    
    // 块规则
    'block-no-empty': true,               // 禁止空块
    
    // 注释规则
    'comment-no-empty': true,             // 禁止空注释
    
    // 通用规则
    'no-duplicate-selectors': true,       // 禁止重复选择器
    'no-empty-source': true,              // 禁止空源
    'no-invalid-double-slash-comments': true,
    
    // 命名规则
    'custom-property-pattern': null,      // 允许任意CSS变量名
    'keyframes-name-pattern': null        // 允许任意keyframe名称
  }
};
