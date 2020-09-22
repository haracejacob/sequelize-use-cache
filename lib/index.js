"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = useCache;

var _util = require("util");

var _crypto = _interopRequireDefault(require("crypto"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function useCache(sequelize, redis) {
  const asyncRedisGet = (0, _util.promisify)(redis.get).bind(redis);
  const asyncRedisSet = (0, _util.promisify)(redis.set).bind(redis);
  const SELECT = 'SELECT';
  const originalQueryMethod = sequelize.query.bind(sequelize);

  const getFromCache = async (key, {
    model,
    raw
  }) => {
    const res = await asyncRedisGet(key);

    if (res) {
      const data = JSON.parse(res);

      if (typeof data !== 'object' || !model || raw) {
        return data;
      } // ToDo: if isNewRecord: false, createdAt and updatedAt be deleted
      // ToDo: if raw: true, createdAt and updated type be 'str'


      const buildData = model.build(data, {// isNewRecord: false,
        // raw: true,
      });
      return buildData;
    }
  };

  const setCache = async (key, results, {
    expire
  }) => {
    const value = JSON.stringify(results);
    const redisArgs = [key, value];

    if (expire) {
      redisArgs.push('EX', expire);
    }

    await asyncRedisSet(...redisArgs);
  };

  const fetchFromDatabase = async (key, sql, options) => {
    const results = await originalQueryMethod(sql, options);
    setCache(key, results, options);
    return results;
  };

  const keyPrefix = 'sequelize-use-cache';

  const generateKey = (sql, {
    model,
    replacements
  }) => {
    if (replacements) {
      sql = `${sql}${JSON.stringify(replacements)}`;
    }

    const tableName = model && model.tableName || '';

    const hash = _crypto.default.createHash('sha256').update(sql).digest('hex');

    return `${keyPrefix}:${tableName}:${hash}`;
  };

  const fetchFromCache = async (sql, options) => {
    const key = generateKey(sql, options);
    const res = await getFromCache(key, options);

    if (res) {
      sequelize.cacheHit = true;
      return res;
    }

    sequelize.cacheHit = false;
    return await fetchFromDatabase(key, sql, options);
  };

  sequelize.query = async (sql, options) => {
    if (options.type === SELECT && options.cache) {
      return await fetchFromCache(sql, options);
    }

    sequelize.cacheHit = undefined;
    return await originalQueryMethod(sql, options);
  };
}