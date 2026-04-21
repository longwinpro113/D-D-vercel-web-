import { OrderModel } from "../models/order.model";
import type { DbValue } from "@/lib/types";

export class OrderService {
  static async getAllOrders(client?: string) {
    return await OrderModel.getAll(client);
  }

  static async createOrder(data: Record<string, DbValue>) {
    return await OrderModel.create(data);
  }

  static async getSuggestions(field: string, client?: string) {
    return await OrderModel.getSuggestions(field, client);
  }

  static async getClients() {
    return await OrderModel.getUniqueClients();
  }

  static async updateOrder(ryNumber: string, updates: Record<string, DbValue>) {
    return await OrderModel.update(ryNumber, updates);
  }

  static async updateOrderById(id: string | number, updates: Record<string, DbValue>) {
    return await OrderModel.updateById(id, updates);
  }

  static async deleteOrder(id: string | number) {
    return await OrderModel.delete(id);
  }
}
