export default [
  {
    files: ["*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        // Browser globals
        window: "readonly",
        document: "readonly",
        console: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        requestAnimationFrame: "readonly",
        Math: "readonly",
        Date: "readonly",
        Array: "readonly",
        // Game globals
        gameState: "writable",
        GAME_CONSTANTS: "readonly",
        INITIAL_TECHNOLOGIES: "readonly",
        TECHNOLOGY_VISIBILITY: "readonly",
        TECHNOLOGY_ELEMENT_MAPPING: "readonly",
        storyContent: "readonly"
      }
    },
    rules: {
      "no-unused-vars": ["error", { 
        "vars": "all", 
        "args": "after-used", 
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }],
      "no-undef": "error",
      "no-redeclare": "error",
      "no-implicit-globals": "error",
      "eqeqeq": ["warn", "smart"],
      "prefer-const": "error",
      "no-var": "error",
      "no-new-func": "error",
      "no-global-assign": "error",
      "no-unreachable": "error",
      "no-duplicate-case": "error",
      "no-fallthrough": "error"
    }
  }
];