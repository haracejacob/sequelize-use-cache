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
      expect(projects.cacheHit).toEqual(undefined)
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
      expect(projects.cacheHit).toEqual(false)

      await projects.findAll({
        where: {
          title: 'bar',
        },
        cache: true,
        expire: 5,
      })
      expect(projects.cacheHit).toEqual(true)
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
      expect(projects.cacheHit).toEqual(false)

      await projects.findOne({
        where: {
          title: 'foo',
        },
        raw: true,
        cache: true,
        expire: 5,
      })
      expect(projects.cacheHit).toEqual(true)
    })

    test('min', async () => {
      const { projects } = sequelize.models

      const fromDB = await projects.min('id', {
        cache: true,
        expire: 5,
      })
      expect(projects.cacheHit).toEqual(false)

      const fromCache = await projects.min('id', {
        cache: true,
        expire: 5,
      })

      expect(fromDB).toEqual(fromCache)
      expect(fromCache).toEqual(1)
      expect(projects.cacheHit).toEqual(true)
    })

    test('max', async () => {
      const { projects } = sequelize.models

      const fromDB = await projects.max('id', {
        cache: true,
        expire: 5,
      })
      expect(projects.cacheHit).toEqual(false)

      const fromCache = await projects.max('id', {
        cache: true,
        expire: 5,
      })

      expect(fromDB).toEqual(fromCache)
      expect(fromCache).toEqual(2)
      expect(projects.cacheHit).toEqual(true)
    })

    test('sum', async () => {
      const { projects } = sequelize.models

      const fromDB = await projects.sum('id', {
        cache: true,
        expire: 5,
      })
      expect(projects.cacheHit).toEqual(false)

      const fromCache = await projects.sum('id', {
        cache: true,
        expire: 5,
      })

      expect(fromDB).toEqual(fromCache)
      expect(fromCache).toEqual(3)
      expect(projects.cacheHit).toEqual(true)
    })

    test('count', async () => {
      const { projects } = sequelize.models

      const fromDB = await projects.count({
        cache: true,
        expire: 5,
      })
      expect(projects.cacheHit).toEqual(false)

      const fromCache = await projects.count({
        cache: true,
        expire: 5,
      })

      expect(fromDB).toEqual(fromCache)
      expect(fromCache).toEqual(2)
      expect(projects.cacheHit).toEqual(true)
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
      expect(users.cacheHit).toEqual(false)


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

      expect(users.cacheHit).toEqual(true)
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
      expect(users.cacheHit).toEqual(false)

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
      expect(users.cacheHit).toEqual(true)
    })
  })
})
