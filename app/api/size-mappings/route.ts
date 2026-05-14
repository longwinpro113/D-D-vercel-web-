import { NextResponse } from "next/server";
import { SizeMappingModel } from "@/lib/models/size-mapping.model";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const client = searchParams.get("client");
  
  if (!client) {
    return NextResponse.json({ error: "Thiếu tên khách hàng" }, { status: 400 });
  }

  try {
    const mappings = await SizeMappingModel.getAllByClient(client);
    return NextResponse.json(mappings);
  } catch (error: any) {
    console.error("[API Size Mapping] GET Error:", error);
    return NextResponse.json({ error: "Lỗi khi lấy dữ liệu quy đổi" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { client_name, client_size, standard_size } = body;

    if (!client_name || !client_size || !standard_size) {
      return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 });
    }

    await SizeMappingModel.upsert({ client_name, client_size, standard_size });
    return NextResponse.json({ message: "Lưu quy đổi thành công" });
  } catch (error: any) {
    console.error("[API Size Mapping] POST Error:", error);
    return NextResponse.json({ error: "Lỗi khi lưu quy đổi" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    await SizeMappingModel.delete(parseInt(id));
    return NextResponse.json({ message: "Đã xóa quy đổi" });
  } catch (error: any) {
    return NextResponse.json({ error: "Lỗi khi xóa" }, { status: 500 });
  }
}
