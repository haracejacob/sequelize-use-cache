import { promisify } from 'util'
import crypto from 'crypto'

export default function useCache (sequelize, redis) {
  const asyncRedisGet = promisify(redis.get).bind(redis)
  const asyncRedisSet = promisify(redis.set).bind(redis)

  const SELECT = 'SELECT'
  const originalQueryMethod = sequelize.query.bind(sequelize)

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

  const fetchFromDatabase = async (key, sql, options) => {
    const results = await originalQueryMethod(sql, options)

    setCache(key, results, options)

    return results
  }

  const keyPrefix = 'sequelize-use-cache'
  const generateKey = (sql, model) => {

    const tableName = model && model.tableName || ''
    const hash = crypto
      .createHash('sha256')
      .update(sql)
      .digest('hex')

    return `${keyPrefix}:${tableName}:${hash}`
  }

  const fetchFromCache = async (sql, options) => {
    const { model } = options

    const key = generateKey(sql, model)

    const res = await getFromCache(key, model, options)
    if (res) {
      sequelize.cacheHit = true
      return res
    }
    sequelize.cacheHit = false
    return await fetchFromDatabase(key, sql, options)
  }

  sequelize.query = async (sql, options) => {
    if (options.type === SELECT && options.cache) {
      return await fetchFromCache(sql, options)
    }
    sequelize.cacheHit = undefined
    return await originalQueryMethod(sql, options)
  }
}
