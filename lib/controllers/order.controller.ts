import { NextResponse } from "next/server";
import { OrderService } from "../services/order.service";
import { getErrorMessage } from "@/lib/types";

export class OrderController {
  static async getAll(request: Request) {
    console.log(`[OrderController] GET /api/orders - Request received`);
    try {
      const url = new URL(request.url);
      const client = url.searchParams.get("client") || undefined;
      
      const rows = await OrderService.getAllOrders(client);
      
      console.log(`[OrderController] GET /api/orders - Success: ${Array.isArray(rows) ? rows.length : 0} rows found`);
      return NextResponse.json(rows);
    } catch (error: unknown) {
      console.error(`[OrderController] GET /api/orders - Error:`, error);
      return NextResponse.json({ error: getErrorMessage(error, "Failed to fetch orders.") }, { status: 500 });
    }
  }

  static async create(request: Request) {
    console.log(`[OrderController] POST /api/orders - Request received`);
    try {
      const payload = await request.json();
      console.log(`[OrderController] POST /api/orders - Payload:`, JSON.stringify(payload));
      
      const result = await OrderService.createOrder(payload);
      
      console.log(`[OrderController] POST /api/orders - Success: ID ${result.insertId}`);
      return NextResponse.json({ id: result.insertId, message: "Order created successfully." });
    } catch (error: any) {
      console.error(`[OrderController] POST /api/orders - Error:`, error);
      
      // Handle MySQL Duplicate Entry (1062)
      const errCode = error?.errno || error?.code || (error as any)?.originalError?.errno;
      console.log(`[OrderController] Detected errCode: ${errCode}`);
      
      if (errCode === 1062 || errCode === 'ER_DUP_ENTRY' || error?.message?.includes('Duplicate entry')) {
        return NextResponse.json({ 
          error: "DUPLICATE_ENTRY", 
          message: "Dữ liệu đã tồn tại (PO/RY đã có trong hệ thống)." 
        }, { status: 409 });
      }

      return NextResponse.json({ 
        error: `Failed to create order: ${getErrorMessage(error, "Unknown error")}` 
      }, { status: 500 });
    }
  }

  static async getClients() {
    console.log(`[OrderController] GET /api/orders/clients - Request received`);
    try {
      const rows = await OrderService.getClients();
      console.log(`[OrderController] GET /api/orders/clients - Success: ${Array.isArray(rows) ? rows.length : 0} clients found`);
      return NextResponse.json(rows);
    } catch (error: unknown) {
      console.error(`[OrderController] GET /api/orders/clients - Error:`, error);
      return NextResponse.json({ error: getErrorMessage(error, "Failed to fetch clients.") }, { status: 500 });
    }
  }

  static async update(request: Request, context: { params: Promise<{ ry_number: string }> }) {
    console.log(`[OrderController] PATCH /api/orders/[ry_number] - Request received`);
    try {
      const { ry_number } = await context.params;
      const payload = await request.json();
      console.log(`[OrderController] PATCH /api/orders/${ry_number} - Payload:`, JSON.stringify(payload));

      const success = await OrderService.updateOrder(ry_number, payload);
      if (!success) {
        console.log(`[OrderController] PATCH /api/orders/${ry_number} - No fields to update`);
        return NextResponse.json({ error: "No fields to update." }, { status: 400 });
      }

      console.log(`[OrderController] PATCH /api/orders/${ry_number} - Success`);
      return NextResponse.json({ message: "Updated", ry_number });
    } catch (error: any) {
      console.error(`[OrderController] PATCH /api/orders - Error:`, error);

      const errCode = error?.errno || error?.code || (error as any)?.originalError?.errno;
      if (errCode === 1062 || errCode === 'ER_DUP_ENTRY' || error?.message?.includes('Duplicate entry')) {
        return NextResponse.json({ 
          error: "DUPLICATE_ENTRY", 
          message: "Dữ liệu đã tồn tại (Cập nhật trùng mã PO/RY khác)." 
        }, { status: 409 });
      }

      return NextResponse.json({ error: getErrorMessage(error, "Failed to update order.") }, { status: 500 });
    }
  }

  static async updateById(request: Request, context: { params: Promise<{ id: string }> }) {
    console.log(`[OrderController] PATCH /api/orders/[id] - Request received`);
    const { id } = await context.params;
    try {
      const payload = await request.json();
      console.log(`[OrderController] PATCH /api/orders/${id} - Payload:`, JSON.stringify(payload));

      const success = await OrderService.updateOrderById(id, payload);
      if (!success) {
        return NextResponse.json({ error: "Failed to update order or nothing changed." }, { status: 400 });
      }

      console.log(`[OrderController] PATCH /api/orders/${id} - Success`);
      return NextResponse.json({ message: "Updated", id });
    } catch (error: any) {
      console.error(`[OrderController] PATCH /api/orders/${id} - Error:`, error);

      const errCode = error?.errno || error?.code || (error as any)?.originalError?.errno;
      if (errCode === 1062 || errCode === 'ER_DUP_ENTRY' || error?.message?.includes('Duplicate entry')) {
        return NextResponse.json({ 
          error: "DUPLICATE_ENTRY", 
          message: "Dữ liệu đã tồn tại (PO/RY đã tồn tại)." 
        }, { status: 409 });
      }

      return NextResponse.json({ error: getErrorMessage(error, "Failed to update order.") }, { status: 500 });
    }
  }

  static async delete(request: Request, context: { params: Promise<{ id: string }> }) {
    console.log(`[OrderController] DELETE /api/orders/[id] - Request received`);
    const { id } = await context.params;
    try {
      await OrderService.deleteOrder(id);
      console.log(`[OrderController] DELETE /api/orders/${id} - Success`);
      return NextResponse.json({ message: "Deleted", id });
    } catch (error: unknown) {
      console.error(`[OrderController] DELETE /api/orders/${id} - Error:`, error);
      return NextResponse.json({ error: getErrorMessage(error, "Failed to delete order.") }, { status: 500 });
    }
  }
}
