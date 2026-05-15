import { db } from "@/lib/db";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { DbParams, DbValue } from "@/lib/types";
import { sizeColumns } from "./order.model";

const DB_COLLATION = "utf8mb4_unicode_ci";
const RY_NUMBER_COLLATION = DB_COLLATION;

export const EXPORT_INSERT_COLUMNS = ["export_date", "client", "ry_number", "delivery_round", "shipped_quantity", ...sizeColumns, "note"];
export const EXPORT_UPDATE_COLUMNS = ["export_date", "client", "delivery_round", "shipped_quantity", ...sizeColumns, "note"];

export class ExportModel {
  static async createRecord(data: Record<string, DbValue>) {
    const keys = Object.keys(data);
    const columnsSql = keys.join(", ");
    const placeholdersSql = keys.map(() => "?").join(", ");
    const values = keys.map((key) => data[key]);

    const [result] = await db.query<ResultSetHeader>(
      `INSERT INTO export (${columnsSql}) VALUES (${placeholdersSql})`,
      values as DbParams
    );
    return result;
  }

  static async updateRecord(id: string | number, updates: Record<string, DbValue>) {
    const keys = Object.keys(updates);
    const fieldsSql = keys.map((key) => `${key} = ?`).join(", ");
    const values = keys.map((key) => updates[key]);
    values.push(id);

    await db.query(`UPDATE export SET ${fieldsSql} WHERE id = ?`, values);
    return true;
  }

  static async getById(id: string | number) {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT id, ry_number, export_date, delivery_round, shipped_quantity, note, ${sizeColumns.join(", ")} FROM export WHERE id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  }

  static async deleteRecord(id: string | number) {
    await db.query("DELETE FROM export WHERE id = ?", [id]);
  }

  static async getByRyNumber(ryNumber: string) {
    const [rows] = await db.query(
      `SELECT id, shipped_quantity, ${sizeColumns.join(", ")} FROM export WHERE ry_number COLLATE ${RY_NUMBER_COLLATION} = CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE ${RY_NUMBER_COLLATION} ORDER BY export_date ASC, id ASC`,
      [ryNumber]
    );
    return rows;
  }

  static async updateTotals(id: string | number, runningTotal: number, remaining: number) {
    await db.query(
      "UPDATE export SET accumulated_total = ?, remaining_quantity = ? WHERE id = ?",
      [runningTotal, remaining, id]
    );
  }

  static async getFiltered(whereSQL: string, params: DbParams) {
    const query = `
      SELECT
        e.id,
        DATE_FORMAT(e.export_date, '%d/%m/%Y') AS export_date,
        e.ry_number,
        COALESCE(e.delivery_round, o.delivery_round) AS delivery_round,
        (${sizeColumns.map((c) => `e.${c}`).join(" + ")}) AS shipped_quantity,
        e.remaining_quantity,
        e.accumulated_total,
        e.updated_at,
        e.note,
        o.article,
        o.model_name,
        o.product,
        o.client,
        o.total_order_qty AS total_quantity,
        DATE_FORMAT(o.CRD, '%d/%m/%Y') AS CRD,
        ${sizeColumns.map((column) => `e.${column}`).join(", ")}
      FROM export e
      LEFT JOIN orders o
        ON e.ry_number COLLATE ${RY_NUMBER_COLLATION} = o.ry_number COLLATE ${RY_NUMBER_COLLATION}
      ${whereSQL}
      ORDER BY e.export_date DESC, e.id ASC
    `;
    const [rows] = await db.query<RowDataPacket[]>(query, params);
    return rows;
  }

  static async getRemainingBaseOrders(whereSQL: string, params: DbParams) {
    const formattedColumns = [
      "o.ry_number",
      "o.article",
      "o.model_name",
      "o.product",
      "o.delivery_round",
      "o.total_order_qty",
      "DATE_FORMAT(o.CRD, '%d/%m/%Y') AS CRD",
      "DATE_FORMAT(o.client_export_date, '%d/%m/%Y') AS client_export_date",
      "DATE_FORMAT(o.client_import_date, '%d/%m/%Y') AS client_import_date",
      ...sizeColumns.map((column) => `o.${column}`),
    ];

    const query = `
      SELECT
        ${formattedColumns.join(", ")}
      FROM orders o
      ${whereSQL}
    `;
    const [rows] = await db.query<RowDataPacket[]>(query, params);
    return rows;
  }

  static async getTotalsGroupedByRy(whereSQL: string, params: DbParams) {
    const [rows] = await db.query<RowDataPacket[]>(
      `
        SELECT
          ry_number,
          SUM(shipped_quantity) AS total_shipped,
          ${sizeColumns.map((column) => `SUM(${column}) AS ${column}`).join(", ")}
        FROM export
        ${whereSQL}
        GROUP BY ry_number
      `,
      params
    );
    return rows;
  }

  static async getMaxMonth(client?: string) {
    let query = `
      SELECT DATE_FORMAT(MAX(e.export_date), '%Y-%m') AS max_month,
             DATE_FORMAT(MAX(e.export_date), '%Y-%m-%d') AS max_date
      FROM export e
    `;
    const params: DbParams = [];
    if (client) {
      query += `
        LEFT JOIN orders o
          ON e.ry_number COLLATE ${RY_NUMBER_COLLATION} = o.ry_number COLLATE ${RY_NUMBER_COLLATION}
        WHERE o.client COLLATE ${DB_COLLATION} = CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE ${DB_COLLATION}
      `;
      params.push(client);
    }
    const [rows] = await db.query<RowDataPacket[]>(query, params);
    return rows[0] || {};
  }

  static async getAvailableDates(client?: string) {
    let query = `
      SELECT DISTINCT DATE_FORMAT(e.export_date, '%d/%m/%Y') as formatted_date, e.export_date
      FROM export e
    `;
    const params: DbParams = [];
    if (client) {
      query += `
        LEFT JOIN orders o ON e.ry_number COLLATE ${RY_NUMBER_COLLATION} = o.ry_number COLLATE ${RY_NUMBER_COLLATION}
        WHERE o.client COLLATE ${DB_COLLATION} = CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE ${DB_COLLATION}
      `;
      params.push(client);
    }
    query += " ORDER BY e.export_date DESC LIMIT 50";
    const [rows] = await db.query<RowDataPacket[]>(query, params);
    return rows;
  }
}
