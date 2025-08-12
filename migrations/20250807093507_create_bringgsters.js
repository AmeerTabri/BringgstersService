/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable("bringgsters", (table) => {
    table.increments("id").primary(); // Auto-incrementing ID
    table.string("first_name", 100).notNullable();
    table.string("last_name", 100).notNullable();
    table.string("role", 100).notNullable();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTable("bringgsters");
};
