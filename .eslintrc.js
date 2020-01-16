module.exports = {
    'env': {
        'commonjs': true,
        'es6': true,
        'node': true
    },
    "plugins": ['prettier'],
    "extends": ["plugin:prettier/recommended"],
        'globals': {
        'Atomics': 'readonly',
        'SharedArrayBuffer': 'readonly'
    },
    'parserOptions': {
        'ecmaVersion': 2018
    },
    'rules': {
        'prettier/prettier': 'error',
    }
}