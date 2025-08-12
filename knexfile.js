/**
 * @type { Object.<string, import("knex").Knex.Config> }
 */
module.exports = {
  development: {
    client: "pg",
    connection: {
      host: "127.0.0.1",
      user: "bringg_user",
      password: "bringg_pass",
      database: "bringg_db",
      port: 5432,
    },
    migrations: {
      directory: "./migrations",
    },
  },
};
