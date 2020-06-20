import { promisify } from 'util'
import Sequelize from 'sequelize'
import crypto from 'crypto'
import cloneDeep from 'lodash.clonedeep'

const methods = {
  findOne: {
    optionsIdx: 0,
  },
  findAll: {
    optionsIdx: 0,
  },
  max: {
    optionsIdx: 1,
  },
  min: {
    optionsIdx: 1,
  },
  sum: {
    optionsIdx: 1,
  },
  count: {
    optionsIdx: 0,
  },
  // findAndCountAll === findAll + count
  // findByPk === findOne
}

export default function useCache (sequelize, redis) {
  const asyncRedisGet = promisify(redis.get).bind(redis)
  const asyncRedisSet = promisify(redis.set).bind(redis)
  const queryGenerator = sequelize.getQueryInterface().QueryGenerator

  const getFromCache = async (key, model, { raw }) => {
    const res = await asyncRedisGet(key)
    if (res) {
      const data = JSON.parse(res)

      if (typeof data !== 'object' || raw) {
        return data
      }

      // ToDo: if isNewRecord: false, createdAt and updatedAt be deleted
      // ToDo: if raw: true, createdAt and updated type be 'str'
      const buildData = model.build(data, {
        // isNewRecord: false,
        // raw: true,
      })

      return buildData
    }
  }

  const setCache = async (key, results, { expire }) => {
    const value = JSON.stringify(results)
    const redisArgs = [key, value]
    if (expire) {
      redisArgs.push('EX', expire)
    }

    await asyncRedisSet(...redisArgs)
  }

  const fetchFromDatabase = async (key, method, ...args) => {
    const results = await method(...args)

    const options = args[0]
    setCache(key, results, options)

    return results
  }

  const generateSelectQuery = (model, options) => {
    if (options.include) {
      if (!Array.isArray(options.include)) {
        options.include = [options.include]
      }
      const tableNames = {}
      tableNames[model.getTableName(options)] = true

      options.hasJoin = true
      model._validateIncludedElements(options, tableNames)
    }
    Sequelize.Utils.mapFinderOptions(options, model)

    return queryGenerator.selectQuery(
      model.tableName,
      options,
      model
    )
  }

  const keyPrefix = 'sequelize-use-cache'
  const generateKey = ({ model, method, options }) => {
    const stmt = generateSelectQuery(model, cloneDeep(options))
    const tableName = model.tableName

    const hash = crypto
      .createHash('sha256')
      .update(stmt)
      .digest('hex')

    return `${keyPrefix}:${tableName}:${method.name}:${hash}`
  }

  const fetchFromCache = async (model, method, ...args) => {
    const options = args[0]
    const key = generateKey({
      model,
      method,
      options,
    })

    const res = await getFromCache(key, model, options)
    if (res) {
      model.cacheHit = true
      return res
    }
    model.cacheHit = false
    return await fetchFromDatabase(key, method, ...args)
  }

  const modelNames = Object.keys(sequelize.models)
  modelNames.forEach(modelName => {
    const model = sequelize.models[modelName]
    Object.entries(methods).map(([method, { optionsIdx }]) => {
      const originalMethod = model[method].bind(model)

      model[method] = async (...args) => {
        const options = args[optionsIdx]

        if (options && options.cache) {
          return await fetchFromCache(model, originalMethod, ...args)
        }
        model.cacheHit = undefined
        return await originalMethod(...args)
      }
    })
  })
}
