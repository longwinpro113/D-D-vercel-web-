import { db } from "@/lib/db";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { DbParams, DbValue } from "@/lib/types";
import { sizeColumns as allSizeColumns } from "../size";
import { formatDateInputValue } from "../shared";

export { sizes, entrySizes, sizeColumns, sizeToCol } from "../size";

const DB_COLLATION = "utf8mb4_unicode_ci";

export const ORDER_SELECT_COLUMNS = [
  "ry_number",
  "article",
  "model_name",
  "product",
  "delivery_round",
  "CRD",
  "client_export_date",
  "client_import_date",
  "client",
  "total_order_qty",
  ...allSizeColumns,
  // "updated_at",
];

export const buildInsertParts = (data: Record<string, DbValue>) => {
  const sanitizedData = { ...data };
  ["CRD", "client_export_date", "client_import_date"].forEach((key) => {
    if (sanitizedData[key] && typeof sanitizedData[key] === "string") {
      sanitizedData[key] = formatDateInputValue(sanitizedData[key] as string);
    }
  });

  const keys = Object.keys(sanitizedData);
  return {
    keys,
    columnsSql: keys.join(", "),
    placeholdersSql: keys.map(() => "?").join(", "),
    values: keys.map((key) => sanitizedData[key]),
  };
};

export const buildUpdateParts = (updates: Record<string, DbValue>) => {
  const sanitizedUpdates = { ...updates };
  ["CRD", "client_export_date", "client_import_date"].forEach((key) => {
    if (sanitizedUpdates[key] && typeof sanitizedUpdates[key] === "string") {
      sanitizedUpdates[key] = formatDateInputValue(sanitizedUpdates[key] as string);
    }
  });

  const keys = Object.keys(sanitizedUpdates);
  return {
    keys,
    fieldsSql: keys.map((key) => `${key} = ?`).join(", "),
    values: keys.map((key) => sanitizedUpdates[key]),
  };
};

export class OrderModel {
  static async getAll(client?: string) {
    const formattedColumns = ORDER_SELECT_COLUMNS.map((col) => {
      if (["CRD", "client_export_date", "client_import_date"].includes(col)) {
        return `DATE_FORMAT(${col}, '%d/%m/%Y') AS ${col}`;
      }
      return col;
    });

    let query = `SELECT ${formattedColumns.join(", ")} FROM orders`;
    const params: DbParams = [];

    if (client) {
      query += ` WHERE client COLLATE ${DB_COLLATION} = CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE ${DB_COLLATION}`;
      params.push(client);
    }

    query += " ORDER BY ry_number DESC";
    const [rows] = await db.query<RowDataPacket[]>(query, params);
    return rows;
  }

  static async getByRyNumber(ryNumber: string) {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT ry_number, total_order_qty FROM orders WHERE ry_number COLLATE ${DB_COLLATION} = CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE ${DB_COLLATION} LIMIT 1`,
      [ryNumber]
    );
    return rows[0] || null;
  }

  static async create(data: Record<string, DbValue>) {
    const { columnsSql, placeholdersSql, values } = buildInsertParts(data);
    const [result] = await db.query<ResultSetHeader>(
      `INSERT INTO orders (${columnsSql}) VALUES (${placeholdersSql})`,
      values as DbParams
    );
    return result;
  }

  static async update(ryNumber: string, updates: Record<string, DbValue>) {
    const { fieldsSql, values } = buildUpdateParts(updates);
    if (!fieldsSql) return null;
    values.push(ryNumber);
    await db.query(`UPDATE orders SET ${fieldsSql} WHERE ry_number COLLATE ${DB_COLLATION} = CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE ${DB_COLLATION}`, values);
    return true;
  }

  static async updateById(id: string | number, updates: Record<string, DbValue>) {
    const { fieldsSql, values } = buildUpdateParts(updates);
    if (!fieldsSql) return null;
    values.push(id);
    await db.query(`UPDATE orders SET ${fieldsSql} WHERE ry_number COLLATE ${DB_COLLATION} = CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE ${DB_COLLATION}`, values);
    return true;
  }

  static async delete(id: string | number) {
    await db.query(`DELETE FROM orders WHERE ry_number COLLATE ${DB_COLLATION} = CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE ${DB_COLLATION}`, [id]);
    return true;
  }

  static async getUniqueClients() {
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT DISTINCT client FROM orders WHERE client IS NOT NULL ORDER BY client ASC"
    );
    return rows;
  }

  static async getSuggestions(field: string, client?: string) {
    let query = `SELECT DISTINCT ${field} FROM orders WHERE ${field} IS NOT NULL`;
    const params: DbParams = [];

    if (client) {
      query += ` AND client COLLATE ${DB_COLLATION} = CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE ${DB_COLLATION}`;
      params.push(client);
    }

    query += ` ORDER BY ${field} ASC LIMIT 50`;
    const [rows] = await db.query<RowDataPacket[]>(query, params);
    return rows
      .map((row) => row[field])
      .filter((value): value is string => typeof value === "string");
  }
}
