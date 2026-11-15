import globals from 'globals';

const jsxNoUndef = {
  meta: {
    type: 'problem',
    schema: [],
    messages: { undef: "'{{name}}' is not defined." },
  },
  create(context) {
    function missing(node, name) {
      let scope = context.sourceCode.getScope(node);
      while (scope) {
        if (scope.set.get(name)) return;
        scope = scope.upper;
      }
      context.report({ node, messageId: 'undef', data: { name } });
    }
    return {
      JSXOpeningElement(node) {
        const root = node.name.type === 'JSXMemberExpression' ? node.name.object : node.name;
        if (!root || root.type !== 'JSXIdentifier') return;
        if (root.name[0] === root.name[0].toLowerCase()) return;
        missing(node, root.name);
      },
    };
  },
};

export default [
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.es2024 },
    },
    plugins: { react: { rules: { 'jsx-no-undef': jsxNoUndef } } },
    rules: {
      'no-undef': 'error',
      'react/jsx-no-undef': 'error',
    },
  },
];
