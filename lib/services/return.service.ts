import { ReturnModel } from "../models/return.model";
import type { DbParams, DbValue } from "@/lib/types";
import { sizeColumns } from "../models/order.model";

export class ReturnService {
  static async createReceived(data: Record<string, DbValue>) {
    return await ReturnModel.createReceived(data);
  }

  static async createShipped(data: Record<string, DbValue>) {
    return await ReturnModel.createShipped(data);
  }

  static async getReceivedList(client?: string, ry_number?: string) {
    const whereClauses: string[] = [];
    const params: DbParams = [];

    if (client) {
      whereClauses.push("client = ?");
      params.push(client);
    }
    if (ry_number) {
      whereClauses.push("ry_number LIKE ?");
      params.push(`%${ry_number}%`);
    }

    const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    return await ReturnModel.getReceivedFiltered(whereSQL, params);
  }

  static async getShippedList(client?: string, ry_number?: string) {
    const whereClauses: string[] = [];
    const params: DbParams = [];

    if (client) {
      whereClauses.push("client = ?");
      params.push(client);
    }
    if (ry_number) {
      whereClauses.push("ry_number LIKE ?");
      params.push(`%${ry_number}%`);
    }

    const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    return await ReturnModel.getShippedFiltered(whereSQL, params);
  }

  static async getRemainingStock(client?: string) {
    const { receivedRows, shippedRows } = await ReturnModel.getRemainingStock(client);
    
    // Combine them
    const combined = new Map<string, any>();

    receivedRows.forEach(rec => {
      const key = `${rec.client}_${rec.ry_number}_${rec.shipping_round}`;
      combined.set(key, {
        client: rec.client,
        ry_number: rec.ry_number,
        shipping_round: rec.shipping_round,
        article: rec.article,
        model_name: rec.model_name,
        product: rec.product,
        CRD: rec.CRD,
        total_received: rec.total_received,
        total_shipped: 0,
        remaining_quantity: rec.total_received,
        ...sizeColumns.reduce((acc, col) => {
          acc[col] = Number(rec[`rec_${col}`]) || 0;
          return acc;
        }, {} as any)
      });
    });

    shippedRows.forEach(ship => {
      const key = `${ship.client}_${ship.ry_number}_${ship.shipping_round}`;
      if (combined.has(key)) {
        const entry = combined.get(key);
        entry.total_shipped = ship.total_shipped;
        entry.remaining_quantity = entry.total_received - ship.total_shipped;
        sizeColumns.forEach(col => {
          entry[col] = (entry[col] || 0) - (Number(ship[`ship_${col}`]) || 0);
        });
      } else {
        combined.set(key, {
          client: ship.client,
          ry_number: ship.ry_number,
          shipping_round: ship.shipping_round,
          article: ship.article,
          model_name: ship.model_name,
          product: ship.product,
          CRD: ship.CRD,
          total_received: 0,
          total_shipped: ship.total_shipped,
          remaining_quantity: -ship.total_shipped,
          ...sizeColumns.reduce((acc, col) => {
            acc[col] = -(Number(ship[`ship_${col}`]) || 0);
            return acc;
          }, {} as any)
        });
      }
    });

    return Array.from(combined.values());
  }
}
