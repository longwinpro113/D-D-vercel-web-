import { db } from "@/lib/db";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { DbParams, DbValue } from "@/lib/types";
import { sizeColumns } from "./order.model";

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

  static async checkDuplicate(type: "received" | "shipped", data: { ry_number: string, client: string, date: string, shipping_round: number }) {
    const table = type === "received" ? "return_received" : "return_shipped";
    const dateCol = type === "received" ? "received_date" : "shipped_date";
    const query = `SELECT id FROM ${table} WHERE ry_number = ? AND client = ? AND ${dateCol} = ? AND shipping_round = ?`;
    const [rows] = await db.query<RowDataPacket[]>(query, [data.ry_number, data.client, data.date, data.shipping_round]);
    return rows.length > 0;
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
      LEFT JOIN orders o ON TRIM(r.ry_number) = TRIM(o.ry_number)
      ${whereSQL ? whereSQL.replace(/\bclient\b/g, "TRIM(r.client)").replace(/\bry_number\b/g, "TRIM(r.ry_number)") : ""}
      GROUP BY r.id, o.CRD
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
        s.note,
        s.article,
        s.model_name,
        s.product,
        DATE_FORMAT(o.CRD, '%d/%m/%Y') AS CRD,
        ${sizeColumns.map((column) => `s.${column}`).join(", ")}
      FROM return_shipped s
      LEFT JOIN orders o ON TRIM(s.ry_number) = TRIM(o.ry_number)
      ${whereSQL ? whereSQL.replace(/\bclient\b/g, "TRIM(s.client)").replace(/\bry_number\b/g, "TRIM(s.ry_number)") : ""}
      GROUP BY s.id, o.CRD
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
      LEFT JOIN orders o ON TRIM(r.ry_number) = TRIM(o.ry_number)
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

  static async updateReturn(type: "received" | "shipped", id: number | string, data: Record<string, DbValue>) {
    const table = type === "received" ? "return_received" : "return_shipped";
    const keys = Object.keys(data);
    const setSql = keys.map(key => `${key} = ?`).join(", ");
    const values = keys.map(key => data[key]);
    
    const [result] = await db.query<ResultSetHeader>(
      `UPDATE ${table} SET ${setSql} WHERE id = ?`,
      [...values, id] as DbParams
    );
    return result;
  }

  static async deleteReturn(type: "received" | "shipped", id: number | string) {
    const table = type === "received" ? "return_received" : "return_shipped";
    const [result] = await db.query<ResultSetHeader>(
      `DELETE FROM ${table} WHERE id = ?`,
      [id]
    );
    return result;
  }

  static async getClients() {
    const query = `
      SELECT DISTINCT client FROM (
        SELECT client FROM orders WHERE client IS NOT NULL
        UNION
        SELECT client FROM return_received WHERE client IS NOT NULL
        UNION
        SELECT client FROM return_shipped WHERE client IS NOT NULL
      ) as combined_clients
      ORDER BY client ASC
    `;
    const [rows] = await db.query<RowDataPacket[]>(query);
    return rows.map(r => r.client);
  }
}
