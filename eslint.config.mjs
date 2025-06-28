import globals from "globals";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";
import stylistic from "@stylistic/eslint-plugin";

export default [
    // JavaScript 推荐配置
    js.configs.recommended,

    // TypeScript 推荐配置
    ...tseslint.configs.recommended,

    // 全局配置
    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.es6,
            },
        },
    },    // TypeScript 和 JavaScript 文件配置
    {
        files: ["**/*.{js,mjs,cjs,ts,tsx}"],
        plugins: {
            import: importPlugin,
            "@stylistic": stylistic,
        },
        rules: {
            // 保持原有的规则配置
            "@typescript-eslint/ban-ts-comment": "off",
            "@typescript-eslint/no-var-requires": "warn",
            "import/no-unresolved": "off",
            "@typescript-eslint/no-empty-interface": "off",
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-empty-function": "warn",
            "no-empty": "warn",
            "no-useless-catch": "warn",
            "prefer-const": "warn",
            // 样式规则迁移到 ESLint Stylistic
            "@stylistic/quotes": ["warn", "double"],
            "@stylistic/object-curly-spacing": ["error", "always"],
            "@stylistic/indent": ["error", 4], // 统一缩进
            "@stylistic/semi": ["error", "always"], // 强制分号
            "@stylistic/comma-dangle": ["error", "always-multiline"], // 多行末尾逗号
            "@stylistic/brace-style": ["error", "1tbs"], // 大括号风格

            // Import 相关规则
            "import/no-duplicates": "error",
            "import/no-self-import": "error",
            "import/no-useless-path-segments": "error",            // 企业级最佳实践
            "@typescript-eslint/no-unused-vars": ["warn", {
                "argsIgnorePattern": "^_",
                "varsIgnorePattern": "^_"
            }],
            "@typescript-eslint/no-non-null-assertion": "warn",
            "no-console": "warn",
        },
        settings: {
            "import/resolver": {
                "typescript": {
                    "alwaysTryTypes": true,
                    "project": "./tsconfig.json"
                },
                "node": {
                    "extensions": [".js", ".jsx", ".ts", ".tsx"]
                }
            }
        }
    },

    // 特定于主进程的配置
    {
        files: ["src/main/**/*.{ts,js}"],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
        rules: {
            "no-console": "off", // 主进程允许使用 console
        }
    },

    // 特定于渲染进程的配置  
    {
        files: ["src/renderer*/**/*.{ts,tsx,js,jsx}"],
        languageOptions: {
            globals: {
                ...globals.browser,
            },
        },
    },

    // 配置文件和脚本的特殊规则
    {
        files: ["*.config.{js,ts,mjs}", "scripts/**/*.{js,ts}"],
        rules: {
            "@typescript-eslint/no-var-requires": "off",
            "no-console": "off",
        }
    },

    // 忽略文件
    {
        ignores: [
            "node_modules/**",
            "dist/**",
            ".webpack/**",
            "out/**",
            "release/**",
            "**/*.d.ts"
        ]
    }
];
