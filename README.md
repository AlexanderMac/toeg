<p align="center">
  <h1 align="center">toeg</h1>
  <p align="center">Generates entities for TypeORM from a databases.</p>
  <p align="center">
    <a href="https://github.com/AlexanderMac/toeg/actions/workflows/ci.yml"><img src="https://github.com/alexandermac/toeg/actions/workflows/ci.yml/badge.svg" alt="Build Status"></a>
    <!--<a href="https://codecov.io/gh/AlexanderMac/toeg"><img src="https://codecov.io/gh/AlexanderMac/toeg/branch/master/graph/badge.svg" alt="Code Coverage"></a>-->
    <a href="LICENSE"><img src="https://img.shields.io/github/license/alexandermac/toeg.svg" alt="License"></a>
    <a href="https://badge.fury.io/js/toeg"><img src="https://badge.fury.io/js/toeg.svg" alt="npm version"></a>
  </p>
</p>

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
