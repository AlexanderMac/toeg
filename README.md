# toeg

[![Build Status](https://github.com/AlexanderMac/toeg/workflows/CI/badge.svg)](https://github.com/AlexanderMac/toeg/actions?query=workflow%3ACI)
[![Code Coverage](https://codecov.io/gh/AlexanderMac/toeg/branch/master/graph/badge.svg)](https://codecov.io/gh/AlexanderMac/toeg)
[![npm version](https://badge.fury.io/js/toeg.svg)](https://badge.fury.io/js/toeg)

### Features
Generates entities for TypeORM from a databases. Supports PostgreSQL engine only, but can be extend using Abstract driver.
Inspired by https://github.com/Kononnable/typeorm-model-generator (unfortunately not supported anymore). The fork was created to add two main features: skip indices and relations generation.

### Usage
1. Add `toeg` to your project
```sh
npm i -D toeg
```

2. Then create a configuration file `.toeg.json` using `.toeg-example.json` as a base.

3. And finally run `toeg`:
```sh
node_modules/.bin/toeg
```

The generated entity models aren't formatted well, so it's recommended to run prettify and eslint on generated modules:
```sh
prettier --write --loglevel error \"output/*.ts\" && eslint \"output/*.ts\" --fix --quiet
```

### Licence
Licensed under the MIT license.

### Author
Alexander Mac
