import Sequelize, { Op } from 'sequelize'
import Redis from 'redis'
import useCache from '../src'

describe('Integration test', () => {
  const redis = Redis.createClient()
  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: 'test.sqlite',
  })

  beforeAll(async () => {
    await redis.flushdb()

    sequelize.define('projects', {
      title: Sequelize.TEXT,
      description: Sequelize.TEXT,
    })
    sequelize.define('users', {
      name: Sequelize.TEXT,
    })

    const { projects, users } = sequelize.models

    users.belongsTo(projects)
    projects.hasMany(users)

    await sequelize.sync()

    await projects.bulkCreate([
      {
        id: 1,
        title: 'foo',
        description: 'foo'
      },
      {
        id: 2,
        title: 'bar',
        description: 'bar'
      },
    ])

    await users.bulkCreate([
      {
        id: 1,
        name: 'baz',
        projectId: 1,
      },
      {
        id: 2,
        name: 'quz',
        projectId: 2,
      }
    ])

    useCache(sequelize, redis)
  })

  afterAll(async done => {
    const { projects, users } = sequelize.models

    await users.destroy({
      where: {
        id: {
          [Op.gte]: 1,
        },
      },
    })
    await projects.destroy({
      where: {
        id: {
          [Op.gte]: 1,
        },
      },
    })

    sequelize.close()
    redis.end(true)
    done()
  })

  describe('Basic', () => {
    test('Not use cache', async () => {
      const { projects } = sequelize.models

      await projects.findAll({
        where: {
          title: 'bar',
        },
      })
      expect(sequelize.cacheHit).toEqual(undefined)
    })

    test('findAll', async () => {
      const { projects } = sequelize.models

      await projects.findAll({
        where: {
          title: 'bar',
        },
        cache: true,
        expire: 5,
      })
      expect(sequelize.cacheHit).toEqual(false)

      await projects.findAll({
        where: {
          title: 'bar',
        },
        cache: true,
        expire: 5,
      })
      expect(sequelize.cacheHit).toEqual(true)
    })

    test('findOne(with raw)', async () => {
      const { projects } = sequelize.models

      await projects.findOne({
        where: {
          title: 'foo',
        },
        raw: true,
        cache: true,
        expire: 5,
      })
      expect(sequelize.cacheHit).toEqual(false)

      await projects.findOne({
        where: {
          title: 'foo',
        },
        raw: true,
        cache: true,
        expire: 5,
      })
      expect(sequelize.cacheHit).toEqual(true)
    })

    test('count', async () => {
      const { projects } = sequelize.models

      const fromDB = await projects.count({
        cache: true,
        expire: 5,
      })
      expect(sequelize.cacheHit).toEqual(false)

      const fromCache = await projects.count({
        cache: true,
        expire: 5,
      })

      expect(fromDB).toEqual(fromCache)
      expect(fromCache).toEqual(2)
      expect(sequelize.cacheHit).toEqual(true)
    })

    test('min', async () => {
      const { projects } = sequelize.models

      const fromDB = await projects.min('id', {
        cache: true,
        expire: 5,
      })
      expect(sequelize.cacheHit).toEqual(false)

      const fromCache = await projects.min('id', {
        cache: true,
        expire: 5,
      })

      expect(fromDB).toEqual(fromCache)
      expect(fromCache).toEqual(1)
      expect(sequelize.cacheHit).toEqual(true)
    })

    test('max', async () => {
      const { projects } = sequelize.models

      const fromDB = await projects.max('id', {
        cache: true,
        expire: 5,
      })
      expect(sequelize.cacheHit).toEqual(false)

      const fromCache = await projects.max('id', {
        cache: true,
        expire: 5,
      })

      expect(fromDB).toEqual(fromCache)
      expect(fromCache).toEqual(2)
      expect(sequelize.cacheHit).toEqual(true)
    })

    test('sum', async () => {
      const { projects } = sequelize.models

      const fromDB = await projects.sum('id', {
        cache: true,
        expire: 5,
      })
      expect(sequelize.cacheHit).toEqual(false)

      const fromCache = await projects.sum('id', {
        cache: true,
        expire: 5,
      })

      expect(fromDB).toEqual(fromCache)
      expect(fromCache).toEqual(3)
      expect(sequelize.cacheHit).toEqual(true)
    })
  })
  describe('with include', () => {
    test('with include', async () => {
      const { projects, users } = sequelize.models

      await users.findOne({
        where: {
          id: 1,
        },
        include: {
          model: projects,
        },
        cache: true,
        expire: 5,
      })
      expect(sequelize.cacheHit).toEqual(false)


      await users.findOne({
        where: {
          id: 1,
        },
        include: {
          model: projects,
        },
        cache: true,
        expire: 5,
      })

      expect(sequelize.cacheHit).toEqual(true)
    })

    test('with include(with raw)', async () => {
      const { projects, users } = sequelize.models

      await users.findAll({
        where: {
          name: 'quz',
        },
        include: {
          model: projects,
        },
        raw: true,
        cache: true,
        expire: 5,
      })
      expect(sequelize.cacheHit).toEqual(false)

      await users.findAll({
        where: {
          name: 'quz',
        },
        include: {
          model: projects,
        },
        raw: true,
        cache: true,
        expire: 5,
      })
      expect(sequelize.cacheHit).toEqual(true)
    })
  })

  describe('with attributes', () => {
    test('with attributes', async () => {
      const { projects } = sequelize.models

      await projects.findAll({
        attributes: {
          exclude: ['id'],
        },
        cache: true,
        expire: 5
      })

      expect(sequelize.cacheHit).toEqual(false)

      await projects.findAll({
        attributes: {
          exclude: ['id'],
        },
        cache: true,
        expire: 5
      })

      expect(sequelize.cacheHit).toEqual(true)
    })
  })

  describe('with replacements', () => {
    test('with replacements', async () => {
      const query = `
        SELECT
          count(1)
        FROM projects
        WHERE title = :title
      `
      const fromDB = await sequelize.query(query, {
        type: sequelize.QueryTypes.SELECT,
        replacements: {
          title: 'foo',
        },
        cache: true,
        expire: 5,
      })

      expect(sequelize.cacheHit).toEqual(false)

      const fromCache = await sequelize.query(query, {
        type: sequelize.QueryTypes.SELECT,
        replacements: {
          title: 'foo',
        },
        cache: true,
        expire: 5,
      })

      expect(sequelize.cacheHit).toEqual(true)
      expect(fromDB).toEqual(fromCache)

      await sequelize.query(query, {
        type: sequelize.QueryTypes.SELECT,
        replacements: {
          title: 'bar',
        },
        cache: true,
        expire: 5,
      })

      expect(sequelize.cacheHit).toEqual(false)
    })
  })
})
