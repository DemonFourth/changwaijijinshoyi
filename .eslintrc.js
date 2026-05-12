module.exports = {
  env: {
    browser: true,
    es2021: true
  },
  extends: 'eslint:recommended',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'script'
  },
  overrides: [
    {
      files: ['js/chartManager.js'],
      parserOptions: {
        ecmaVersion: 2015
      }
    }
  ],
  rules: {
    // 错误级别规则
    'no-undef': 'error',           // 禁止使用未定义的变量
    'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],     // 禁止未使用的变量
    'no-use-before-define': 'error', // 禁止在定义前使用
    'no-shadow': 'error',          // 禁止变量遮蔽
    'no-redeclare': 'off',         // 允许重定义（用于全局模块）
    
    // 最佳实践
    'eqeqeq': 'error',             // 使用 === 代替 ==
    'no-eval': 'error',            // 禁止eval
    'no-implied-eval': 'error',    // 禁止隐式eval
    'no-new-func': 'error',        // 禁止new Function
    'no-return-await': 'error',    // 禁止不必要的return await
    
    // 代码风格
    'indent': ['error', 4],        // 缩进4个空格
    'quotes': ['error', 'single'], // 使用单引号
    'semi': ['error', 'always'],   // 必须使用分号
    'comma-dangle': ['error', 'never'], // 不允许尾逗号
    'no-trailing-spaces': 'error', // 禁止行尾空格
    'eol-last': 'error',           // 文件末尾换行
    
    // 变量规则
    'no-var': 'error',             // 禁止var，使用let/const
    'prefer-const': 'error',       // 优先使用const
    'no-mixed-spaces-and-tabs': 'error', // 禁止空格和tab混用
    
    // 函数规则
    'no-empty-function': 'warn',   // 禁止空函数
    'no-multi-spaces': 'error',    // 禁止多个空格
    
    // 对象规则
    'no-dupe-keys': 'error',       // 禁止对象重复键
    
    // 数组规则
    'no-sparse-arrays': 'error',   // 禁止稀疏数组
    
    // 其他
    'no-console': 'off',           // 允许console
    'no-debugger': 'warn',         // 警告debugger
    'no-control-regex': 'off',    // 允许控制字符正则（用于清理乱码）
    'noSyntaxError': 'off'        // 允许语法错误（文件可被浏览器解析）
  },
  globals: {
    // 全局变量
    'FundCalculator': 'readonly',
    'ModuleRegistry': 'readonly',
    'EventBus': 'readonly',
    'EventType': 'readonly',
    'Config': 'readonly',
    'Utils': 'readonly',
    'Storage': 'readonly',
    'DataService': 'readonly',
    'FundAPI': 'readonly',
    'Calculator': 'readonly',
    'CalculatorV2': 'readonly',
    'FundManager': 'readonly',
    'TradeManager': 'readonly',
    'Router': 'readonly',
    'Modal': 'readonly',
    'Overview': 'readonly',
    'Detail': 'readonly',
    'App': 'readonly',
    // 额外模块
    'ThemeManager': 'readonly',
    'ChartManager': 'readonly',
    'CycleGroupRenderer': 'readonly',
    'CycleTradeDisplay': 'readonly',
    'Paginator': 'readonly',
    'NameCache': 'readonly',
    'NameValidator': 'readonly',
    'FIFOCalculator': 'readonly',
    'FIFOValidator': 'readonly',
    'BigNumberFormatter': 'readonly',
    'echarts': 'readonly',
    'ConversionCalculator': 'readonly',
    'ToolPage': 'readonly',
    'StatisticsAppService': 'readonly'
  }
};
