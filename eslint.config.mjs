import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**/*', 'node_modules/**/*', '**/*.js', '**/*.mjs']
  },
  {
    ...firebaseRulesPlugin.configs['flat/recommended'],
    files: ['**/*.rules']
  }
];
