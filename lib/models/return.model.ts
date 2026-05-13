import { db } from "@/lib/db";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { DbParams, DbValue } from "@/lib/types";
import { sizeColumns } from "./order.model";

const DB_COLLATION = "utf8mb4_unicode_ci";

export class ReturnModel {
  static async createReceived(data: Record<string, DbValue>) {
    const keys = Object.keys(data);
    const columnsSql = keys.join(", ");
    const placeholdersSql = keys.map(() => "?").join(", ");
    const values = keys.map((key) => data[key]);

    const [result] = await db.query<ResultSetHeader>(
      `INSERT INTO return_received (${columnsSql}) VALUES (${placeholdersSql})`,
      values as DbParams
    );
    return result;
  }

  static async createShipped(data: Record<string, DbValue>) {
    const keys = Object.keys(data);
    const columnsSql = keys.join(", ");
    const placeholdersSql = keys.map(() => "?").join(", ");
    const values = keys.map((key) => data[key]);

    const [result] = await db.query<ResultSetHeader>(
      `INSERT INTO return_shipped (${columnsSql}) VALUES (${placeholdersSql})`,
      values as DbParams
    );
    return result;
  }

  static async getReceivedFiltered(whereSQL: string, params: DbParams) {
    const query = `
      SELECT
        r.id,
        DATE_FORMAT(r.received_date, '%d/%m/%Y') AS received_date,
        r.ry_number,
        r.client,
        r.shipping_round,
        r.total_received,
        r.note,
        r.article,
        r.model_name,
        r.product,
        DATE_FORMAT(o.CRD, '%d/%m/%Y') AS CRD,
        ${sizeColumns.map((column) => `r.${column}`).join(", ")}
      FROM return_received r
      LEFT JOIN orders o ON r.ry_number = o.ry_number
      ${whereSQL ? whereSQL.replace(/\bclient\b/g, "r.client").replace(/\bry_number\b/g, "r.ry_number") : ""}
      ORDER BY r.received_date DESC, r.id DESC
    `;
    const [rows] = await db.query<RowDataPacket[]>(query, params);
    return rows;
  }

  static async getShippedFiltered(whereSQL: string, params: DbParams) {
    const query = `
      SELECT
        s.id,
        DATE_FORMAT(s.shipped_date, '%d/%m/%Y') AS shipped_date,
        s.ry_number,
        s.client,
        s.shipping_round,
        s.total_shipped,
        s.article,
        s.model_name,
        s.product,
        DATE_FORMAT(o.CRD, '%d/%m/%Y') AS CRD,
        ${sizeColumns.map((column) => `s.${column}`).join(", ")}
      FROM return_shipped s
      LEFT JOIN orders o ON s.ry_number = o.ry_number
      ${whereSQL ? whereSQL.replace(/\bclient\b/g, "s.client").replace(/\bry_number\b/g, "s.ry_number") : ""}
      ORDER BY s.shipped_date DESC, s.id DESC
    `;
    const [rows] = await db.query<RowDataPacket[]>(query, params);
    return rows;
  }

  static async getRemainingStock(client?: string) {
    let whereSQL = "";
    const params: DbParams = [];
    if (client) {
      whereSQL = `WHERE client = ?`;
      params.push(client);
    }

    // Get totals from received and shipped grouped by ry_number, client, shipping_round
    const query = `
      SELECT 
        r.ry_number, 
        r.client, 
        r.shipping_round,
        r.article,
        r.model_name,
        r.product,
        DATE_FORMAT(o.CRD, '%d/%m/%Y') as CRD,
        SUM(r.total_received) as total_received,
        ${sizeColumns.map(c => `SUM(r.${c}) as rec_${c}`).join(", ")}
      FROM return_received r
      LEFT JOIN orders o ON r.ry_number = o.ry_number
      ${whereSQL ? whereSQL.replace("client", "r.client") : ""}
      GROUP BY r.ry_number, r.client, r.shipping_round, r.article, r.model_name, r.product, o.CRD
    `;
    const [receivedRows] = await db.query<RowDataPacket[]>(query, params);

    const shippedQuery = `
      SELECT 
        s.ry_number, 
        s.client, 
        s.shipping_round,
        s.article,
        s.model_name,
        s.product,
        DATE_FORMAT(o.CRD, '%d/%m/%Y') as CRD,
        SUM(s.total_shipped) as total_shipped,
        ${sizeColumns.map(c => `SUM(s.${c}) as ship_${c}`).join(", ")}
      FROM return_shipped s
      LEFT JOIN orders o ON s.ry_number = o.ry_number
      ${whereSQL ? whereSQL.replace("client", "s.client") : ""}
      GROUP BY s.ry_number, s.client, s.shipping_round, s.article, s.model_name, s.product, o.CRD
    `;
    const [shippedRows] = await db.query<RowDataPacket[]>(shippedQuery, params);

    return { receivedRows, shippedRows };
  }
}
