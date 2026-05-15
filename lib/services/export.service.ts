import { ExportModel, EXPORT_INSERT_COLUMNS, EXPORT_UPDATE_COLUMNS } from "../models/export.model";
import { OrderModel, sizeColumns } from "../models/order.model";
import type { DbParams, DbValue } from "@/lib/types";

const DATE_SEARCH_REGEX = /^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/;
const DB_COLLATION = "utf8mb4_unicode_ci";

type RemainingOrderRow = {
  ry_number: string;
  total_order_qty?: string | number | null;
  article?: string | null;
  model_name?: string | null;
  product?: string | null;
  delivery_round?: string | null;
  [key: string]: string | number | null | undefined;
};

type ExportTotalsRow = {
  ry_number?: string;
  total_shipped?: string | number | null;
  [key: string]: string | number | null | undefined;
};

function toNumber(value: DbValue) {
  if (typeof value === "boolean") return value ? 1 : 0;
  return Number(value) || 0;
}

export class ExportService {
  static toIsoDate(date: string) {
    const parts = String(date || "").split("/");
    if (parts.length !== 3) return null;
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  static normalizeQuery(query: Record<string, string> = {}) {
    let { date, ry_number, round, any } = query;
    const { from, to, q, client } = query;
    if (q) {
      const trimmed = String(q).trim();
      if (DATE_SEARCH_REGEX.test(trimmed)) {
        date = trimmed;
      } else if (trimmed.toLowerCase().startsWith("d:")) {
        round = trimmed.slice(2).trim();
      } else {
        ry_number = trimmed;
        any = trimmed;
      }
    }
    return { date, from, to, ry_number, round, any, q, client };
  }

  static buildExportFilter(query: Record<string, string>) {
    const { date, from, to, ry_number, any, round, client } = this.normalizeQuery(query);
    const whereClauses: string[] = [];
    const params: DbParams = [];

    if (client) {
      whereClauses.push(`o.client COLLATE ${DB_COLLATION} = CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE ${DB_COLLATION}`);
      params.push(client);
    }

    if (date) {
      const parts = String(date).split("/");
      if (parts.length === 3) {
        whereClauses.push("DATE(e.export_date) = ?");
        params.push(this.toIsoDate(date));
      } else if (parts.length === 2) {
        whereClauses.push("DATE_FORMAT(e.export_date, '%d/%m') = ?");
        params.push(`${parts[0].padStart(2, "0")}/${parts[1].padStart(2, "0")}`);
      } else if (String(date).trim()) {
        whereClauses.push("DATE_FORMAT(e.export_date, '%d/%m/%Y') LIKE ?");
        params.push(`%${String(date).trim()}%`);
      }
    }

    if (from || to) {
      if (from && to) {
        whereClauses.push("DATE(e.export_date) BETWEEN ? AND ?");
        params.push(from, to);
      } else if (from) {
        whereClauses.push("DATE(e.export_date) >= ?");
        params.push(from);
      } else if (to) {
        whereClauses.push("DATE(e.export_date) <= ?");
        params.push(to);
      }
    }

    if (ry_number || any) {
      const value = ry_number || any;
      whereClauses.push("(e.ry_number LIKE ? OR e.delivery_round LIKE ?)");
      params.push(`%${value}%`, `%${value}%`);
    }

    if (round) {
      whereClauses.push("e.delivery_round = ?");
      params.push(round);
    }

    return {
      whereSQL: whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "",
      params,
    };
  }

  static buildRemainingOrderFilter(query: Record<string, string>) {
    const { round, ry_number, any, client } = this.normalizeQuery(query);
    const whereClauses: string[] = [];
    const params: DbParams = [];

    if (client) {
      whereClauses.push(`o.client COLLATE ${DB_COLLATION} = CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE ${DB_COLLATION}`);
      params.push(client);
    }
    if (round) {
      whereClauses.push("o.delivery_round = ?");
      params.push(round);
    }
    if (ry_number || any) {
      const value = ry_number || any;
      whereClauses.push("(o.ry_number LIKE ? OR o.delivery_round LIKE ?)");
      params.push(`%${value}%`, `%${value}%`);
    }

    return {
      whereSQL: whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "",
      params,
    };
  }

  static buildRemainingExportFilter(query: Record<string, string>) {
    const { date } = this.normalizeQuery(query);
    if (!date) return { whereSQL: "", params: [] as DbParams };
    const parts = String(date).split("/");
    if (parts.length !== 3) return { whereSQL: "", params: [] as DbParams };

    return {
      whereSQL: "WHERE DATE(export_date) <= ?",
      params: [this.toIsoDate(date)],
    };
  }

  static async recalculateTotals(ryNumber: string) {
    const order = await OrderModel.getByRyNumber(ryNumber);
    if (!order) return;

    const totalOrderQuantity = toNumber(order.total_order_qty);
    const exports = await ExportModel.getByRyNumber(ryNumber);

    let runningTotal = 0;
    for (const row of exports as Array<{ id: string | number; [key: string]: any }>) {
      // Robust calculation by summing sizes
      const rowTotal = sizeColumns.reduce((sum, col) => sum + toNumber(row[col]), 0);
      runningTotal += rowTotal;
      const remaining = totalOrderQuantity - runningTotal;
      await ExportModel.updateTotals(row.id, runningTotal, remaining);
    }
  }

  static async createExport(data: Record<string, DbValue>) {
    const payload: Record<string, DbValue> = {};
    
    // Note: shipped_quantity is a STORED GENERATED column in the database.
    // Do not include it in the insert payload.
    // const totalShipped = sizeColumns.reduce((sum, col) => sum + toNumber(data[col]), 0);
    // data.shipped_quantity = totalShipped;

    EXPORT_INSERT_COLUMNS.forEach((column) => {
      payload[column] = data[column] ?? (sizeColumns.includes(column) ? 0 : null);
    });
    
    // Default values
    payload.delivery_round = data.delivery_round ?? null;
    payload.note = data.note ?? null;

    const result = await ExportModel.createRecord(payload);
    await this.recalculateTotals(String(data.ry_number ?? ""));
    return result;
  }

  static async getExports(query: Record<string, string>) {
    const { whereSQL, params } = this.buildExportFilter(query);
    return await ExportModel.getFiltered(whereSQL, params);
  }

  static async getRemainingStock(query: Record<string, string>) {
    const isDetailed = query.detailed === "true";
    const orderFilter = this.buildRemainingOrderFilter(query);
    const exportFilter = this.buildRemainingExportFilter(query);

    const [orders, exportsData] = await Promise.all([
      ExportModel.getRemainingBaseOrders(orderFilter.whereSQL, orderFilter.params),
      isDetailed 
        ? ExportModel.getFiltered(exportFilter.whereSQL, exportFilter.params)
        : ExportModel.getTotalsGroupedByRy(exportFilter.whereSQL, exportFilter.params),
    ]);

    if (isDetailed) {
      const exportGrouped = new Map<string, any[]>();
      (exportsData as any[]).forEach((exp) => {
        const ry = exp.ry_number;
        if (!exportGrouped.has(ry)) exportGrouped.set(ry, []);
        exportGrouped.get(ry)!.push(exp);
      });

      return (orders as RemainingOrderRow[]).map((order) => {
        const orderExports = exportGrouped.get(order.ry_number) || [];
        const totalQuantity = toNumber(order.total_order_qty);
        
        const result: any = {
          ...order,
          exports: orderExports,
          remaining: {
            ry_number: order.ry_number,
            total_quantity: totalQuantity,
            accumulated_total: 0,
            remaining_quantity: totalQuantity,
          }
        };

        let totalShipped = 0;
        orderExports.forEach(exp => {
           // Calculate total for this export on the fly for robustness
           const rowTotal = sizeColumns.reduce((sum, col) => sum + toNumber(exp[col]), 0);
           totalShipped += rowTotal;
        });
        result.remaining.accumulated_total = totalShipped;
        result.remaining.remaining_quantity = totalQuantity - totalShipped;

        sizeColumns.forEach((column) => {
          const orderValue = toNumber(order[column]);
          const exportedValue = orderExports.reduce((sum, exp) => sum + toNumber(exp[column]), 0);
          result.remaining[column] = orderValue - exportedValue;
          result.remaining[`o${column}`] = orderValue;
        });

        return result;
      });
    }

    const exportMap = new Map<string, ExportTotalsRow>(
      (exportsData as ExportTotalsRow[]).map((item) => [item.ry_number || "", item])
    );

    return (orders as RemainingOrderRow[]).map((order) => {
      const exported = exportMap.get(order.ry_number) || {};
      const totalQuantity = toNumber(order.total_order_qty);
      
      // Calculate totalShipped by summing all size columns from the exported totals
      const totalShipped = sizeColumns.reduce((sum, col) => sum + toNumber(exported[col]), 0);

      const result: Record<string, string | number | null | undefined> = {
        ry_number: order.ry_number,
        article: order.article,
        model_name: order.model_name,
        product: order.product,
        delivery_round: order.delivery_round,
        total_quantity: order.total_order_qty,
        accumulated_total: totalShipped,
        shipped_quantity: 0,
        remaining_quantity: totalQuantity - totalShipped,
      };

      sizeColumns.forEach((column) => {
        const orderValueRaw = order[column];
        const orderValue = (orderValueRaw === null || orderValueRaw === undefined) ? null : Number(orderValueRaw);

        if (orderValue === null || orderValue === 0) {
          result[column] = null;
          result[`o${column}`] = null;
        } else {
          const exportedValue = toNumber(exported[column]);
          result[column] = orderValue - exportedValue;
          result[`o${column}`] = orderValue;
        }
      });

      return result;
    });
  }

  static async getMaxMonth(client?: string) {
    return await ExportModel.getMaxMonth(client);
  }

  static async getAvailableDates(client?: string) {
    return await ExportModel.getAvailableDates(client);
  }

  static async updateExport(id: string | number, updates: Record<string, DbValue>) {
    const row = await ExportModel.getById(id);
    if (!row) return { found: false as const };

    const writableUpdates: Record<string, DbValue> = {};
    
    // Note: shipped_quantity is a STORED GENERATED column in the database.
    // Do not include it in the update payload.
    // if (sizeKeys.length > 0) {
    //   const currentSizes: Record<string, any> = {};
    //   sizeColumns.forEach(col => {
    //     currentSizes[col] = updates[col] !== undefined ? updates[col] : row[col];
    //   });
    //   const newTotal = sizeColumns.reduce((sum, col) => sum + toNumber(currentSizes[col]), 0);
    //   updates.shipped_quantity = newTotal;
    // }

    EXPORT_UPDATE_COLUMNS.forEach((column) => {
      if (updates[column] !== undefined) writableUpdates[column] = updates[column];
    });

    if (Object.keys(writableUpdates).length > 0) {
      await ExportModel.updateRecord(id, writableUpdates);
      await this.recalculateTotals(row.ry_number);
    }
    
    return { found: true as const, updated: true as const, ryNumber: row.ry_number };
  }

  static async deleteExport(id: string | number) {
    const row = await ExportModel.getById(id);
    if (!row) return { found: false as const };

    await ExportModel.deleteRecord(id);
    await this.recalculateTotals(row.ry_number);
    return { found: true as const, ryNumber: row.ry_number };
  }
}
