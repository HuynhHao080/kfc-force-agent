import { NextResponse } from "next/server";
import { createOrderSchema } from "@/lib/validation/order";
import { services } from "@/lib/agent/agent-core";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const orderId = searchParams.get("orderId");

    if (orderId) {
      const order = await services.orderService.getOrderById(orderId);
      if (!order) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }
      return NextResponse.json(order);
    }

    if (userId) {
      const orders = await services.orderService.getUserOrders(userId);
      return NextResponse.json({ orders });
    }

    return NextResponse.json({ error: "Missing userId or orderId" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createOrderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const order = {
      id: `order_${Date.now()}`,
      userId: parsed.data.userId,
      cartId: parsed.data.cartId,
      status: "PENDING" as const,
      subtotal: 0,
      discount: 0,
      deliveryFee: 0,
      total: 0,
      currency: "VND" as const,
      shippingAddress: parsed.data.shippingAddress,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await services.orderService.createOrder(order);
    return NextResponse.json(order, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
