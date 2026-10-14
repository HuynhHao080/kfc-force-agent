import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from "@/lib/aws/dynamodb";
import { getDynamoDBDocumentClient } from "@/lib/aws/dynamodb";
import { User, UserProfile, UserPreferences, Address } from "@/lib/types/user";
import { Session, Message, ConversationContext } from "@/lib/types/session";
import {
  MenuCategory,
  MenuItem,
  MenuItemOption,
  OptionValue,
  ProductBundle,
  BundleItem,
} from "@/lib/types/menu";
import { Cart, CartItem } from "@/lib/types/cart";
import { Order, OrderItem, OrderEvent } from "@/lib/types/order";
import { UserRepository } from "../interfaces/user-repository.interface";
import { SessionRepository } from "../interfaces/session-repository.interface";
import { IMenuRepository } from "../interfaces/menu-repository.interface";
import { CartRepository } from "../interfaces/cart-repository.interface";
import { OrderRepository } from "../interfaces/order-repository.interface";

/**
 * Lazily resolves the document client so that importing this module in mock
 * mode never constructs an AWS client or requires credentials/region.
 */
function getClient() {
  return getDynamoDBDocumentClient();
}

const TABLE = () => process.env.DYNAMODB_TABLE_NAME || "KfcForceAgent";

/**
 * Single-table key strategy (must stay identical for every operation):
 *
 *   users          PK = USER#<userId>          SK = PROFILE | PREFERENCES | ADDRESS#<addressId>
 *   sessions       PK = SESSION#<sessionId>    SK = METADATA | CONTEXT | MESSAGE#<messageId>
 *   user sessions  PK = USER#<userId>          SK = SESSION#<sessionId>
 *   menu           PK = MENU                   SK = CATEGORY#<id> | ITEM#<id> | ITEM#<catId>#<id>
 *   menu options   PK = MENU_ITEM#<itemId>     SK = OPTION#<optionId>
 *   option values  PK = OPTION#<optionId>      SK = VALUE#<valueId>
 *   bundles        PK = BUNDLE                 SK = <bundleId>
 *   bundle items   PK = BUNDLE#<bundleId>      SK = ITEM#<bundleItemId>
 *   carts          PK = CART#<cartId>          SK = ACTIVE
 *   cart lookup    PK = USER#<userId>          SK = CART#ACTIVE
 *   cart items     PK = CART#<cartId>          SK = ITEM#<itemId>
 *   orders         PK = ORDER#<orderId>        SK = METADATA
 *   order lookup   PK = USER#<userId>          SK = ORDER#<orderId>
 *   order items    PK = ORDER#<orderId>        SK = ITEM#<orderItemId>
 *   order events   PK = ORDER#<orderId>        SK = EVENT#<eventId>
 */

type Keyed = { PK: string; SK: string };

function withKeys<T extends object>(item: T, keys: Keyed): T & Keyed {
  return { ...item, ...keys };
}

/** Removes the storage-only PK/SK attributes from a persisted record. */
function stripKeys<T>(item: Record<string, unknown> | undefined, keys: (keyof Keyed)[]): T | null {
  if (!item) return null;
  const plain = { ...item };
  for (const key of keys) {
    delete plain[key];
  }
  return plain as T;
}

function stripKeysList<T>(items: Record<string, unknown>[] | undefined, keys: (keyof Keyed)[]): T[] {
  if (!items) return [];
  return items.map((item) => stripKeys<T>(item, keys)).filter((item): item is T => item !== null);
}

export class DynamoDBUserRepository implements UserRepository {
  async getUserById(userId: string): Promise<User | null> {
    const command = new GetCommand({
      TableName: TABLE(),
      Key: { PK: `USER#${userId}`, SK: "PROFILE" },
    });
    const response = await getClient().send(command);
    return stripKeys<User>(response.Item, ["PK", "SK"]);
  }

  async createUser(user: User): Promise<void> {
    const command = new PutCommand({
      TableName: TABLE(),
      Item: withKeys(user, { PK: `USER#${user.id}`, SK: "PROFILE" }),
    });
    await getClient().send(command);
  }

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const command = new GetCommand({
      TableName: TABLE(),
      Key: { PK: `USER#${userId}`, SK: "PROFILE" },
    });
    const response = await getClient().send(command);
    return stripKeys<UserProfile>(response.Item, ["PK", "SK"]);
  }

  async updateUserProfile(profile: UserProfile): Promise<void> {
    const command = new PutCommand({
      TableName: TABLE(),
      Item: withKeys(profile, { PK: `USER#${profile.userId}`, SK: "PROFILE" }),
    });
    await getClient().send(command);
  }

  async getUserPreferences(userId: string): Promise<UserPreferences | null> {
    const command = new GetCommand({
      TableName: TABLE(),
      Key: { PK: `USER#${userId}`, SK: "PREFERENCES" },
    });
    const response = await getClient().send(command);
    return stripKeys<UserPreferences>(response.Item, ["PK", "SK"]);
  }

  async updateUserPreferences(preferences: UserPreferences): Promise<void> {
    const command = new PutCommand({
      TableName: TABLE(),
      Item: withKeys(preferences, { PK: `USER#${preferences.userId}`, SK: "PREFERENCES" }),
    });
    await getClient().send(command);
  }

  async getUserAddresses(userId: string): Promise<Address[]> {
    const command = new QueryCommand({
      TableName: TABLE(),
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `USER#${userId}`,
        ":sk": "ADDRESS#",
      },
    });
    const response = await getClient().send(command);
    return stripKeysList<Address>(response.Items, ["PK", "SK"]);
  }

  async createAddress(address: Address): Promise<void> {
    const command = new PutCommand({
      TableName: TABLE(),
      Item: withKeys(address, {
        PK: `USER#${address.userId}`,
        SK: `ADDRESS#${address.id}`,
      }),
    });
    await getClient().send(command);
  }
}

export class DynamoDBSessionRepository implements SessionRepository {
  async createSession(session: Session): Promise<void> {
    const command = new PutCommand({
      TableName: TABLE(),
      Item: withKeys(session, { PK: `SESSION#${session.id}`, SK: "METADATA" }),
    });
    await getClient().send(command);
  }

  async getSession(sessionId: string): Promise<Session | null> {
    const command = new GetCommand({
      TableName: TABLE(),
      Key: { PK: `SESSION#${sessionId}`, SK: "METADATA" },
    });
    const response = await getClient().send(command);
    return stripKeys<Session>(response.Item, ["PK", "SK"]);
  }

  async getActiveSession(userId: string): Promise<Session | null> {
    const command = new QueryCommand({
      TableName: TABLE(),
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `USER#${userId}`,
        ":sk": "SESSION#",
      },
    });
    const response = await getClient().send(command);
    const sessions = stripKeysList<Session>(response.Items, ["PK", "SK"]);
    return sessions.find((session) => session.status === "ACTIVE") || null;
  }

  async appendMessage(message: Message): Promise<void> {
    const command = new PutCommand({
      TableName: TABLE(),
      Item: withKeys(message, {
        PK: `SESSION#${message.sessionId}`,
        SK: `MESSAGE#${message.id}`,
      }),
    });
    await getClient().send(command);
  }

  async getMessages(sessionId: string): Promise<Message[]> {
    const command = new QueryCommand({
      TableName: TABLE(),
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `SESSION#${sessionId}`,
        ":sk": "MESSAGE#",
      },
    });
    const response = await getClient().send(command);
    return stripKeysList<Message>(response.Items, ["PK", "SK"]);
  }

  async getConversationContext(sessionId: string): Promise<ConversationContext | null> {
    const command = new GetCommand({
      TableName: TABLE(),
      Key: { PK: `SESSION#${sessionId}`, SK: "CONTEXT" },
    });
    const response = await getClient().send(command);
    return stripKeys<ConversationContext>(response.Item, ["PK", "SK"]);
  }

  async saveConversationContext(context: ConversationContext): Promise<void> {
    const command = new PutCommand({
      TableName: TABLE(),
      Item: withKeys(context, { PK: `SESSION#${context.sessionId}`, SK: "CONTEXT" }),
    });
    await getClient().send(command);
  }
}

export class DynamoDBMenuRepository implements IMenuRepository {
  async getCategories(): Promise<MenuCategory[]> {
    const command = new QueryCommand({
      TableName: TABLE(),
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": "MENU",
        ":sk": "CATEGORY#",
      },
    });
    const response = await getClient().send(command);
    return stripKeysList<MenuCategory>(response.Items, ["PK", "SK"]).sort(
      (a, b) => a.displayOrder - b.displayOrder,
    );
  }

  async getCategoryById(categoryId: string): Promise<MenuCategory | null> {
    const command = new GetCommand({
      TableName: TABLE(),
      Key: { PK: "MENU", SK: `CATEGORY#${categoryId}` },
    });
    const response = await getClient().send(command);
    return stripKeys<MenuCategory>(response.Item, ["PK", "SK"]);
  }

  async getMenuItems(): Promise<MenuItem[]> {
    const command = new QueryCommand({
      TableName: TABLE(),
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": "MENU",
        ":sk": "ITEM#",
      },
    });
    const response = await getClient().send(command);
    return stripKeysList<MenuItem>(response.Items, ["PK", "SK"]);
  }

  async getMenuItemById(itemId: string): Promise<MenuItem | null> {
    const command = new GetCommand({
      TableName: TABLE(),
      Key: { PK: "MENU", SK: `ITEM#${itemId}` },
    });
    const response = await getClient().send(command);
    return stripKeys<MenuItem>(response.Item, ["PK", "SK"]);
  }

  async getItemsByCategory(categoryId: string): Promise<MenuItem[]> {
    // Items are stored as ITEM#<categoryId>#<itemId> so a category scan is a
    // single begins_with query on the same PK used by getMenuItems.
    const command = new QueryCommand({
      TableName: TABLE(),
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": "MENU",
        ":sk": `ITEM#${categoryId}#`,
      },
    });
    const response = await getClient().send(command);
    return stripKeysList<MenuItem>(response.Items, ["PK", "SK"]);
  }

  async searchMenuItems(query: string): Promise<MenuItem[]> {
    // The menu is a bounded catalogue: load it and filter in memory so that
    // search stays deterministic and never depends on a token index.
    const normalizedQuery = query.toLowerCase().trim();
    const items = await this.getMenuItems();
    if (!normalizedQuery) {
      return items.filter((item) => item.isActive && item.isAvailable);
    }
    return items.filter((item) => {
      if (!item.isActive || !item.isAvailable) return false;
      const searchFields = [
        item.name.toLowerCase(),
        item.description?.toLowerCase() ?? "",
        item.tags?.join(" ").toLowerCase() ?? "",
      ];
      return searchFields.some((field) => field.includes(normalizedQuery));
    });
  }

  async getItemOptions(menuItemId: string): Promise<MenuItemOption[]> {
    const command = new QueryCommand({
      TableName: TABLE(),
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `MENU_ITEM#${menuItemId}`,
        ":sk": "OPTION#",
      },
    });
    const response = await getClient().send(command);
    return stripKeysList<MenuItemOption>(response.Items, ["PK", "SK"]);
  }

  async getItemOptionById(optionId: string): Promise<MenuItemOption | null> {
    const command = new GetCommand({
      TableName: TABLE(),
      Key: { PK: "MENU_ITEM_OPTION", SK: optionId },
    });
    const response = await getClient().send(command);
    return stripKeys<MenuItemOption>(response.Item, ["PK", "SK"]);
  }

  async getOptionValues(optionId: string): Promise<OptionValue[]> {
    const command = new QueryCommand({
      TableName: TABLE(),
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `OPTION#${optionId}`,
        ":sk": "VALUE#",
      },
    });
    const response = await getClient().send(command);
    return stripKeysList<OptionValue>(response.Items, ["PK", "SK"]);
  }

  async getOptionValueById(valueId: string): Promise<OptionValue | null> {
    const command = new GetCommand({
      TableName: TABLE(),
      Key: { PK: "OPTION_VALUE", SK: valueId },
    });
    const response = await getClient().send(command);
    return stripKeys<OptionValue>(response.Item, ["PK", "SK"]);
  }

  async getProductBundles(): Promise<ProductBundle[]> {
    const command = new QueryCommand({
      TableName: TABLE(),
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": "BUNDLE",
        ":sk": "BUNDLE#",
      },
    });
    const response = await getClient().send(command);
    return stripKeysList<ProductBundle>(response.Items, ["PK", "SK"]);
  }

  async getProductBundleById(bundleId: string): Promise<ProductBundle | null> {
    const command = new GetCommand({
      TableName: TABLE(),
      Key: { PK: "BUNDLE", SK: `BUNDLE#${bundleId}` },
    });
    const response = await getClient().send(command);
    return stripKeys<ProductBundle>(response.Item, ["PK", "SK"]);
  }

  async getBundleItems(bundleId: string): Promise<BundleItem[]> {
    const command = new QueryCommand({
      TableName: TABLE(),
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `BUNDLE#${bundleId}`,
        ":sk": "ITEM#",
      },
    });
    const response = await getClient().send(command);
    return stripKeysList<BundleItem>(response.Items, ["PK", "SK"]);
  }

  async getAvailableMenuItems(): Promise<MenuItem[]> {
    return (await this.getMenuItems()).filter((item) => item.isActive && item.isAvailable);
  }

  async getActiveCategories(): Promise<MenuCategory[]> {
    return (await this.getCategories()).filter((category) => category.isActive);
  }
}

export class DynamoDBCartRepository implements CartRepository {
  async getActiveCart(userId: string): Promise<Cart | null> {
    // Lookup item written by createCart: PK = USER#<userId>, SK = CART#ACTIVE
    const lookup = await getClient().send(
      new GetCommand({
        TableName: TABLE(),
        Key: { PK: `USER#${userId}`, SK: "CART#ACTIVE" },
      }),
    );
    const pointer = lookup.Item as { cartId?: string } | undefined;
    if (!pointer?.cartId) return null;
    return this.getCartById(pointer.cartId);
  }

  async getCartById(cartId: string): Promise<Cart | null> {
    const command = new GetCommand({
      TableName: TABLE(),
      Key: { PK: `CART#${cartId}`, SK: "ACTIVE" },
    });
    const response = await getClient().send(command);
    return stripKeys<Cart>(response.Item, ["PK", "SK"]);
  }

  async createCart(cart: Cart): Promise<void> {
    await getClient().send(
      new PutCommand({
        TableName: TABLE(),
        Item: withKeys(cart, { PK: `CART#${cart.id}`, SK: "ACTIVE" }),
      }),
    );
    // Pointer that makes "active cart by user" a single Get.
    await getClient().send(
      new PutCommand({
        TableName: TABLE(),
        Item: { PK: `USER#${cart.userId}`, SK: "CART#ACTIVE", cartId: cart.id },
      }),
    );
  }

  async updateCart(cart: Cart): Promise<void> {
    await getClient().send(
      new PutCommand({
        TableName: TABLE(),
        Item: withKeys(cart, { PK: `CART#${cart.id}`, SK: "ACTIVE" }),
      }),
    );
  }

  async getCartItems(cartId: string): Promise<CartItem[]> {
    const command = new QueryCommand({
      TableName: TABLE(),
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `CART#${cartId}`,
        ":sk": "ITEM#",
      },
    });
    const response = await getClient().send(command);
    return stripKeysList<CartItem>(response.Items, ["PK", "SK"]);
  }

  async getCartItemById(cartId: string, itemId: string): Promise<CartItem | null> {
    // The line item is always resolved through its owning cartId.
    const command = new GetCommand({
      TableName: TABLE(),
      Key: { PK: `CART#${cartId}`, SK: `ITEM#${itemId}` },
    });
    const response = await getClient().send(command);
    return stripKeys<CartItem>(response.Item, ["PK", "SK"]);
  }

  async addItem(item: CartItem): Promise<void> {
    await getClient().send(
      new PutCommand({
        TableName: TABLE(),
        Item: withKeys(item, {
          PK: `CART#${item.cartId}`,
          SK: `ITEM#${item.id}`,
        }),
      }),
    );
  }

  async updateItem(item: CartItem): Promise<void> {
    // Quantity and subtotal come from the caller, which recomputes the
    // subtotal from the stored authoritative unit price.
    await getClient().send(
      new PutCommand({
        TableName: TABLE(),
        Item: withKeys(item, {
          PK: `CART#${item.cartId}`,
          SK: `ITEM#${item.id}`,
        }),
      }),
    );
  }

  async removeItem(cartId: string, itemId: string): Promise<void> {
    await getClient().send(
      new DeleteCommand({
        TableName: TABLE(),
        Key: { PK: `CART#${cartId}`, SK: `ITEM#${itemId}` },
      }),
    );
  }

  async clearCart(cartId: string): Promise<void> {
    const items = await this.getCartItems(cartId);
    for (const item of items) {
      await this.removeItem(cartId, item.id);
    }
  }
}

export class DynamoDBOrderRepository implements OrderRepository {
  async createOrder(order: Order): Promise<void> {
    await getClient().send(
      new PutCommand({
        TableName: TABLE(),
        Item: withKeys(order, { PK: `ORDER#${order.id}`, SK: "METADATA" }),
      }),
    );
    // Per-user index item so getUserOrders is a single Query.
    await getClient().send(
      new PutCommand({
        TableName: TABLE(),
        Item: { PK: `USER#${order.userId}`, SK: `ORDER#${order.id}`, orderId: order.id },
      }),
    );
  }

  async getOrderById(orderId: string): Promise<Order | null> {
    const command = new GetCommand({
      TableName: TABLE(),
      Key: { PK: `ORDER#${orderId}`, SK: "METADATA" },
    });
    const response = await getClient().send(command);
    return stripKeys<Order>(response.Item, ["PK", "SK"]);
  }

  async getUserOrders(userId: string): Promise<Order[]> {
    const command = new QueryCommand({
      TableName: TABLE(),
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `USER#${userId}`,
        ":sk": "ORDER#",
      },
    });
    const response = await getClient().send(command);
    const pointers = stripKeysList<{ orderId?: string }>(response.Items, ["PK", "SK"]);
    const orders: Order[] = [];
    for (const pointer of pointers) {
      if (!pointer.orderId) continue;
      const order = await this.getOrderById(pointer.orderId);
      if (order) orders.push(order);
    }
    return orders;
  }

  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    const command = new QueryCommand({
      TableName: TABLE(),
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `ORDER#${orderId}`,
        ":sk": "ITEM#",
      },
    });
    const response = await getClient().send(command);
    return stripKeysList<OrderItem>(response.Items, ["PK", "SK"]);
  }

  async appendOrderEvent(event: OrderEvent): Promise<void> {
    const command = new PutCommand({
      TableName: TABLE(),
      Item: withKeys(event, {
        PK: `ORDER#${event.orderId}`,
        SK: `EVENT#${event.id}`,
      }),
    });
    await getClient().send(command);
  }
}

export const dynamodbRepositories = {
  userRepository: new DynamoDBUserRepository(),
  sessionRepository: new DynamoDBSessionRepository(),
  menuRepository: new DynamoDBMenuRepository(),
  cartRepository: new DynamoDBCartRepository(),
  orderRepository: new DynamoDBOrderRepository(),
};
