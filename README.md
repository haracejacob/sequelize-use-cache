# Sequelize-Use-Cache
caching sequelize result using redis

## Installation
```command
npm install --save redis # prerequisite
npm install --save sequelize-use-cache
```

## Usage
`Usable methods: findOne, findAll, count, max, min, sum, findByPk, findAndCountAll`

### parameter
```js
model.findOne({
  // ...options,
  cache: true, // use cache or not, boolean
  expire: 10, // expire time(seconds), integer
})
```


### Example
```js
import Sequelize from 'sequelize'
import Redis from 'redis'
import useCache from 'sequelize-use-cache'

const redis = Redis.createClient()
const sequelize = new Sequelize()

// import models
sequelize.define('projects', {
  title: Sequelize.TEXT,
  description: Sequelize.TEXT,
})

useCache(sequelize, redis)

const { projects } = sequelize.models

projects.findAll({
  cache: true,
  expire: 5,
})
console.log(projects.cacheHit) // false

projects.findAll({
  cache: true,
  expire: 5,
})
console.log(projects.cacheHit) // true
```

## License
MIT

### reference
* [sequelize-redis-cache](https://github.com/rfink/sequelize-redis-cache)
