/* eslint-disable @typescript-eslint/no-require-imports */
const mysql = require("mysql2/promise");

const DB_COLLATION = "utf8mb4_unicode_ci";

const sizeColumns = [
  "s1",
  "s2",
  "s2_5",
  ...Array.from({ length: 31 }, (_, index) => {
    const size = 3 + index * 0.5;
    return `s${String(size).replace(".", "_")}`;
  }),
];

const shippedExpression = sizeColumns
  .map((column) => `COALESCE(NEW.${column}, 0)`)
  .join(" + ");

const generatedShippedExpression = sizeColumns
  .map((column) => `COALESCE(${column}, 0)`)
  .join(" + ");

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "admin@1234",
    database: process.env.DB_NAME || "mydb",
    charset: DB_COLLATION,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  });

  await connection.query(`SET NAMES utf8mb4 COLLATE ${DB_COLLATION}`);

  await connection.query("DROP TRIGGER IF EXISTS trg_before_insert_export_final");
  await connection.query("DROP TRIGGER IF EXISTS trg_before_update_export_final");

  await connection.query(`
    ALTER TABLE export
    MODIFY shipped_quantity INT
    GENERATED ALWAYS AS (${generatedShippedExpression}) STORED
  `);

  await connection.query(`
    CREATE TRIGGER trg_before_insert_export_final
    BEFORE INSERT ON export
    FOR EACH ROW
    BEGIN
      DECLARE v_last_acc INT DEFAULT 0;
      DECLARE v_total_qty INT DEFAULT 0;
      DECLARE v_curr_ship INT;

      SET v_curr_ship = ${shippedExpression};

      SELECT total_order_qty INTO v_total_qty
      FROM orders
      WHERE ry_number COLLATE utf8mb4_unicode_ci = NEW.ry_number COLLATE utf8mb4_unicode_ci
      LIMIT 1;

      SELECT COALESCE(MAX(accumulated_total), 0) INTO v_last_acc
      FROM export
      WHERE ry_number COLLATE utf8mb4_unicode_ci = NEW.ry_number COLLATE utf8mb4_unicode_ci
        AND client COLLATE utf8mb4_unicode_ci = NEW.client COLLATE utf8mb4_unicode_ci;

      SET NEW.accumulated_total = v_last_acc + v_curr_ship;
      SET NEW.remaining_quantity = COALESCE(v_total_qty, 0) - (v_last_acc + v_curr_ship);
    END
  `);

  await connection.query(`
    CREATE TRIGGER trg_before_update_export_final
    BEFORE UPDATE ON export
    FOR EACH ROW
    BEGIN
      DECLARE v_last_acc INT DEFAULT 0;
      DECLARE v_total_qty INT DEFAULT 0;
      DECLARE v_curr_ship INT;

      SET v_curr_ship = ${shippedExpression};

      SELECT total_order_qty INTO v_total_qty
      FROM orders
      WHERE ry_number COLLATE utf8mb4_unicode_ci = NEW.ry_number COLLATE utf8mb4_unicode_ci
      LIMIT 1;

      SELECT COALESCE(SUM(shipped_quantity), 0) INTO v_last_acc
      FROM export
      WHERE ry_number COLLATE utf8mb4_unicode_ci = NEW.ry_number COLLATE utf8mb4_unicode_ci
        AND client COLLATE utf8mb4_unicode_ci = NEW.client COLLATE utf8mb4_unicode_ci
        AND id < NEW.id;

      SET NEW.accumulated_total = v_last_acc + v_curr_ship;
      SET NEW.remaining_quantity = COALESCE(v_total_qty, 0) - (v_last_acc + v_curr_ship);
    END
  `);

  await connection.end();
  console.log("Export triggers recreated without assigning generated shipped_quantity.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
