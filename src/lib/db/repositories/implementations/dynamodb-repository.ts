import { assertCartCommit } from "@/lib/db/cart-commit";
import { addressRevision } from "@/lib/server/address-revision";
import type { CatalogAuditEntry } from "@/lib/types/catalog-audit";
import { createHash } from "node:crypto";
import type { CustomerAccount } from "@/lib/types/account";
import type {
  AccountPatch,
  AccountRepository,
} from "../interfaces/account-repository.interface";
import { DomainError } from "@/lib/domain-error";
import { TransactWriteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import {
  GetCommand,
  PutCommand,
  QueryCommand,
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
function stripKeys<T>(
  item: Record<string, unknown> | undefined,
  keys: (keyof Keyed)[],
): T | null {
  if (!item) return null;
  const plain = { ...item };
  for (const key of keys) {
    delete plain[key];
  }
  return plain as T;
}

function stripKeysList<T>(
  items: Record<string, unknown>[] | undefined,
  keys: (keyof Keyed)[],
): T[] {
  if (!items) return [];
  return items
    .map((item) => stripKeys<T>(item, keys))
    .filter((item): item is T => item !== null);
}

export class DynamoDBAccountRepository implements AccountRepository {
  async updateAccount(
    id: string,
    patch: AccountPatch,
    expectedPasswordHash: string,
  ): Promise<CustomerAccount> {
    const entries = Object.entries(patch);
    try {
      const result = await getClient().send(
        new UpdateCommand({
          TableName: TABLE(),
          Key: { PK: "ACCOUNT#" + id, SK: "PROFILE" },
          UpdateExpression:
            "SET " +
            entries
              .map((_, index) => "#f" + index + " = :v" + index)
              .join(", "),
          ConditionExpression: "attribute_exists(PK) AND #hash = :expected",
          ExpressionAttributeNames: {
            "#hash": "passwordHash",
            ...Object.fromEntries(
              entries.map(([key], index) => ["#f" + index, key]),
            ),
          },
          ExpressionAttributeValues: {
            ":expected": expectedPasswordHash,
            ...Object.fromEntries(
              entries.map(([, value], index) => [":v" + index, value]),
            ),
          },
          ReturnValues: "ALL_NEW",
        }),
      );
      return stripKeys<CustomerAccount>(result.Attributes, ["PK", "SK"])!;
    } catch (error) {
      if (
        error instanceof Error &&
        error.name === "ConditionalCheckFailedException"
      )
        throw new DomainError(
          "ACCOUNT_CHANGED",
          "Tài khoản đã thay đổi. Vui lòng đăng nhập lại.",
          409,
        );
      throw error;
    }
  }
  async createAuthSession(id: string, accountId: string, expires: number) {
    await getClient().send(
      new PutCommand({
        TableName: TABLE(),
        Item: {
          PK: `AUTH_SESSION#${id}`,
          SK: "CUSTOMER",
          accountId,
          expires,
          ttl: Math.floor(expires / 1000),
        },
      }),
    );
  }
  async getAuthSession(id: string) {
    const result = await getClient().send(
      new GetCommand({
        TableName: TABLE(),
        Key: { PK: `AUTH_SESSION#${id}`, SK: "CUSTOMER" },
        ConsistentRead: true,
      }),
    );
    return typeof result.Item?.accountId === "string" &&
      typeof result.Item.expires === "number" &&
      result.Item.expires > Date.now()
      ? { accountId: result.Item.accountId, expires: result.Item.expires }
      : null;
  }
  async removeAuthSession(id: string) {
    await getClient().send(
      new DeleteCommand({
        TableName: TABLE(),
        Key: { PK: `AUTH_SESSION#${id}`, SK: "CUSTOMER" },
      }),
    );
  }
  async createAccount(account: CustomerAccount) {
    await getClient().send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: TABLE(),
              Item: withKeys(account, {
                PK: `ACCOUNT#${account.id}`,
                SK: "PROFILE",
              }),
              ConditionExpression: "attribute_not_exists(PK)",
            },
          },
          {
            Put: {
              TableName: TABLE(),
              Item: {
                PK: `EMAIL#${createHash("sha256").update(account.email).digest("hex")}`,
                SK: "ACCOUNT",
                accountId: account.id,
              },
              ConditionExpression: "attribute_not_exists(PK)",
            },
          },
        ],
      }),
    );
  }
  async getAccountById(id: string): Promise<CustomerAccount | null> {
    const result = await getClient().send(
      new GetCommand({
        TableName: TABLE(),
        Key: { PK: `ACCOUNT#${id}`, SK: "PROFILE" },
        ConsistentRead: true,
      }),
    );
    return stripKeys<CustomerAccount>(result.Item, ["PK", "SK"]);
  }
  async getAccountByEmail(email: string): Promise<CustomerAccount | null> {
    const result = await getClient().send(
      new GetCommand({
        TableName: TABLE(),
        Key: {
          PK: `EMAIL#${createHash("sha256").update(email).digest("hex")}`,
          SK: "ACCOUNT",
        },
        ConsistentRead: true,
      }),
    );
    return typeof result.Item?.accountId === "string"
      ? this.getAccountById(result.Item.accountId)
      : null;
  }
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
      Item: withKeys(preferences, {
        PK: `USER#${preferences.userId}`,
        SK: "PREFERENCES",
      }),
    });
    await getClient().send(command);
  }

  async getUserAddresses(userId: string): Promise<Address[]> {
    const canonical = await getClient().send(
      new GetCommand({
        TableName: TABLE(),
        Key: { PK: "USER#" + userId, SK: "ADDRESS_BOOK" },
        ConsistentRead: true,
      }),
    );
    if (Array.isArray(canonical.Item?.addresses))
      return canonical.Item.addresses as Address[];
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

  async saveUserAddresses(
    userId: string,
    addresses: Address[],
    expectedRevision: string,
  ) {
    try {
      await getClient().send(
        new PutCommand({
          TableName: TABLE(),
          Item: {
            PK: "USER#" + userId,
            SK: "ADDRESS_BOOK",
            addresses,
            revision: addressRevision(userId, addresses),
          },
          ConditionExpression:
            "attribute_not_exists(PK) OR #revision = :expected",
          ExpressionAttributeNames: { "#revision": "revision" },
          ExpressionAttributeValues: { ":expected": expectedRevision },
        }),
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.name === "ConditionalCheckFailedException"
      )
        throw new DomainError(
          "ADDRESS_BOOK_CHANGED",
          "Sổ địa chỉ đã thay đổi. Vui lòng làm mới trước khi lưu.",
          409,
        );
      throw error;
    }
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
    await getClient().send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: TABLE(),
              Item: withKeys(session, {
                PK: `SESSION#${session.id}`,
                SK: "METADATA",
              }),
            },
          },
          {
            Put: {
              TableName: TABLE(),
              Item: withKeys(session, {
                PK: `USER#${session.userId}`,
                SK: `SESSION#${session.id}`,
              }),
            },
          },
        ],
      }),
    );
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

  async getConversationContext(
    sessionId: string,
  ): Promise<ConversationContext | null> {
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
      Item: withKeys(context, {
        PK: `SESSION#${context.sessionId}`,
        SK: "CONTEXT",
      }),
    });
    await getClient().send(command);
  }
}

export class DynamoDBMenuRepository implements IMenuRepository {
  async getShopSettings(): Promise<import("@/lib/types/shop").ShopSettings | null> {
    const result = await getClient().send(new GetCommand({ TableName: TABLE(), Key: { PK: "SHOP", SK: "SETTINGS" }, ConsistentRead: true }));
    return result.Item ? stripKeys<import("@/lib/types/shop").ShopSettings>(result.Item, ["PK", "SK"]) : null;
  }
  async saveShopSettings(settings: import("@/lib/types/shop").ShopSettings, expectedRevision: string) {
    try {
      await getClient().send(new PutCommand({ TableName: TABLE(), Item: withKeys(settings, { PK: "SHOP", SK: "SETTINGS" }),
        ConditionExpression: expectedRevision === "default" ? "attribute_not_exists(PK)" : "#revision = :expected",
        ...(expectedRevision !== "default" ? { ExpressionAttributeNames: { "#revision": "revision" }, ExpressionAttributeValues: { ":expected": expectedRevision } } : {}),
      }));
    } catch (error) {
      if (error instanceof Error && error.name === "ConditionalCheckFailedException")
        throw new DomainError("SHOP_CHANGED", "Cấu hình cửa hàng đã thay đổi. Hãy tải lại.", 409);
      throw error;
    }
  }
  async getPromotions(): Promise<import("@/lib/types/promotion").Promotion[]> {
    const result = await getClient().send(
      new QueryCommand({
        TableName: TABLE(),
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: { ":pk": "PROMOTIONS" },
        ConsistentRead: true,
        Limit: 200,
      }),
    );
    return stripKeysList<import("@/lib/types/promotion").Promotion>(
      result.Items,
      ["PK", "SK"],
    );
  }
  async getPromotion(
    code: string,
  ): Promise<import("@/lib/types/promotion").Promotion | null> {
    const result = await getClient().send(
      new GetCommand({
        TableName: TABLE(),
        Key: { PK: "PROMOTIONS", SK: code },
        ConsistentRead: true,
      }),
    );
    return result.Item
      ? stripKeys<import("@/lib/types/promotion").Promotion>(result.Item, [
          "PK",
          "SK",
        ])
      : null;
  }
  async savePromotion(
    entry: import("@/lib/types/promotion").Promotion,
    expectedRevision?: string,
  ) {
    try {
      await getClient().send(
        new PutCommand({
          TableName: TABLE(),
          Item: withKeys(entry, { PK: "PROMOTIONS", SK: entry.code }),
          ConditionExpression: expectedRevision
            ? "#revision = :expected"
            : "attribute_not_exists(PK)",
          ...(expectedRevision
            ? {
                ExpressionAttributeNames: { "#revision": "revision" },
                ExpressionAttributeValues: { ":expected": expectedRevision },
              }
            : {}),
        }),
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.name === "ConditionalCheckFailedException"
      )
        throw new DomainError(
          "PROMOTION_CHANGED",
          "Mã giảm giá đã thay đổi. Vui lòng làm mới.",
          409,
        );
      throw error;
    }
  }
  async getCatalogAudit(limit: number): Promise<CatalogAuditEntry[]> {
    const result = await getClient().send(
      new QueryCommand({
        TableName: TABLE(),
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: { ":pk": "ADMIN#CATALOG_AUDIT" },
        ScanIndexForward: false,
        ConsistentRead: true,
        Limit: limit,
      }),
    );
    return stripKeysList<CatalogAuditEntry>(result.Items, ["PK", "SK"]);
  }
  private async saveCatalog(
    record: MenuCategory | MenuItem,
    prefix: string,
    audit?: CatalogAuditEntry,
  ) {
    const item = withKeys(record, { PK: "MENU", SK: prefix + record.id });
    if (!audit) {
      await getClient().send(
        new PutCommand({ TableName: TABLE(), Item: item }),
      );
      return;
    }
    await getClient().send(
      new TransactWriteCommand({
        TransactItems: [
          { Put: { TableName: TABLE(), Item: item } },
          {
            Put: {
              TableName: TABLE(),
              Item: withKeys(audit, {
                PK: "ADMIN#CATALOG_AUDIT",
                SK: audit.createdAt + "#" + audit.id,
              }),
              ConditionExpression: "attribute_not_exists(PK)",
            },
          },
        ],
      }),
    );
  }
  async saveCategory(category: MenuCategory, audit?: CatalogAuditEntry) {
    await this.saveCatalog(category, "CATEGORY#", audit);
  }
  async saveMenuItem(item: MenuItem, audit?: CatalogAuditEntry) {
    await this.saveCatalog(item, "ITEM#", audit);
  }
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
      (a, b) => a.displayOrder - b.displayOrder || a.id.localeCompare(b.id),
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
    return (await this.getMenuItems()).filter(
      (item) => item.categoryId === categoryId,
    );
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
    return (await this.getMenuItems()).filter(
      (item) => item.isActive && item.isAvailable,
    );
  }

  async getActiveCategories(): Promise<MenuCategory[]> {
    return (await this.getCategories()).filter((category) => category.isActive);
  }
}

export class DynamoDBCartRepository implements CartRepository {
  async saveCartView(cart: Cart, items: CartItem[], expectedRevision: string | null) {
    assertCartCommit(cart, items);
    const lookup = await getClient().send(new GetCommand({ TableName: TABLE(), Key: { PK: "USER#" + cart.userId, SK: "CART#ACTIVE" }, ConsistentRead: true }));
    const previousId = lookup.Item?.cartId as string | undefined;
    if (expectedRevision === null) {
      const previous = previousId ? await this.getCartById(previousId) : null;
      if (previous?.status === "ACTIVE") throw new DomainError("CART_CHANGED", "Giỏ đã thay đổi. Hãy tải lại.", 409);
    } else if (previousId !== cart.id) throw new DomainError("CART_CHANGED", "Giỏ đã thay đổi. Hãy tải lại.", 409);
    const oldItems = expectedRevision === null ? [] : await this.getCartItems(cart.id);
    const old = new Map(oldItems.map(item => [item.id, item]));
    const next = new Set(items.map(item => item.id));
    const changed = items.filter(item => JSON.stringify(item) !== JSON.stringify(old.get(item.id)));
    const removed = oldItems.filter(item => !next.has(item.id));
    if (changed.length + removed.length + 2 > 100) throw new DomainError("CART_LIMIT", "Thao tác vượt giới hạn transaction giỏ.");
    try {
      await getClient().send(new TransactWriteCommand({ TransactItems: [
        { Put: { TableName: TABLE(), Item: withKeys(cart, { PK: "CART#" + cart.id, SK: "ACTIVE" }),
          ConditionExpression: expectedRevision === null ? "attribute_not_exists(PK)" :
            "#status = :active AND userId = :owner AND " + (expectedRevision === "legacy" ? "attribute_not_exists(#revision)" : "#revision = :expected"),
          ...(expectedRevision !== null ? { ExpressionAttributeNames: { "#status": "status", "#revision": "revision" },
            ExpressionAttributeValues: { ":active": "ACTIVE", ":owner": cart.userId, ...(expectedRevision !== "legacy" ? { ":expected": expectedRevision } : {}) } } : {}),
        } },
        ...(expectedRevision === null ? [{ Put: { TableName: TABLE(), Item: { PK: "USER#" + cart.userId, SK: "CART#ACTIVE", cartId: cart.id },
          ConditionExpression: previousId ? "cartId = :previous" : "attribute_not_exists(PK)",
          ...(previousId ? { ExpressionAttributeValues: { ":previous": previousId } } : {}),
        } }] : [{ ConditionCheck: { TableName: TABLE(), Key: { PK: "USER#" + cart.userId, SK: "CART#ACTIVE" }, ConditionExpression: "cartId = :current", ExpressionAttributeValues: { ":current": cart.id } } }]),
        ...changed.map(item => ({ Put: { TableName: TABLE(), Item: withKeys(item, { PK: "CART#" + cart.id, SK: "ITEM#" + item.id }) } })),
        ...removed.map(item => ({ Delete: { TableName: TABLE(), Key: { PK: "CART#" + cart.id, SK: "ITEM#" + item.id } } })),
      ] }));
    } catch (error) {
      if (error instanceof Error && error.name === "TransactionCanceledException")
        throw new DomainError("CART_CHANGED", "Giỏ hàng đã thay đổi. Hãy tải lại trước khi thao tác tiếp.", 409);
      throw error;
    }
  }

  async completeReorder(
    cart: Cart,
    items: CartItem[],
    expectedCartId: string | null,
  ) {
    const current = await this.getActiveCart(cart.userId);
    if (
      (current?.id ?? null) !== expectedCartId ||
      (current && (await this.getCartItems(current.id)).length)
    )
      throw new DomainError(
        "REORDER_CHANGED",
        "Giỏ đã thay đổi. Hãy xem lại.",
        409,
      );
    try {
      await getClient().send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: TABLE(),
                Item: withKeys(cart, { PK: "CART#" + cart.id, SK: "ACTIVE" }),
                ConditionExpression: "attribute_not_exists(PK)",
              },
            },
            ...items.map((item) => ({
              Put: {
                TableName: TABLE(),
                Item: withKeys(item, {
                  PK: "CART#" + cart.id,
                  SK: "ITEM#" + item.id,
                }),
                ConditionExpression: "attribute_not_exists(PK)",
              },
            })),
            {
              Put: {
                TableName: TABLE(),
                Item: {
                  PK: "USER#" + cart.userId,
                  SK: "CART#ACTIVE",
                  cartId: cart.id,
                },
                ConditionExpression: expectedCartId
                  ? "cartId = :expected"
                  : "attribute_not_exists(PK)",
                ...(expectedCartId
                  ? {
                      ExpressionAttributeValues: {
                        ":expected": expectedCartId,
                      },
                    }
                  : {}),
              },
            },
            ...(current
              ? [
                  {
                    Update: {
                      TableName: TABLE(),
                      Key: { PK: "CART#" + current.id, SK: "ACTIVE" },
                      UpdateExpression:
                        "SET #status = :abandoned, updatedAt = :now",
                      ConditionExpression:
                        "#status = :active AND updatedAt = :previous AND userId = :owner AND " + (current.revision ? "#revision = :revision" : "attribute_not_exists(#revision)"),
                      ExpressionAttributeNames: { "#status": "status", "#revision": "revision" },
                      ExpressionAttributeValues: {
                        ":abandoned": "ABANDONED",
                        ":now": cart.updatedAt,
                        ":active": "ACTIVE",
                        ":previous": current.updatedAt,
                        ":owner": cart.userId,
                        ...(current.revision ? { ":revision": current.revision } : {}),
                      },
                    },
                  },
                ]
              : []),
          ],
        }),
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.name === "TransactionCanceledException"
      )
        throw new DomainError(
          "REORDER_CHANGED",
          "Giỏ đã thay đổi. Hãy xem lại.",
          409,
        );
      throw error;
    }
  }
  async getActiveCart(userId: string): Promise<Cart | null> {
    // Lookup item written by createCart: PK = USER#<userId>, SK = CART#ACTIVE
    const lookup = await getClient().send(
      new GetCommand({
        TableName: TABLE(),
        Key: { PK: `USER#${userId}`, SK: "CART#ACTIVE" },
        ConsistentRead: true,
      }),
    );
    const pointer = lookup.Item as { cartId?: string } | undefined;
    if (!pointer?.cartId) return null;
    const cart = await this.getCartById(pointer.cartId);
    return cart?.status === "ACTIVE" ? cart : null;
  }

  async getCartById(cartId: string): Promise<Cart | null> {
    const command = new GetCommand({
      TableName: TABLE(),
      Key: { PK: `CART#${cartId}`, SK: "ACTIVE" },
      ConsistentRead: true,
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
      ConsistentRead: true,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `CART#${cartId}`,
        ":sk": "ITEM#",
      },
    });
    const response = await getClient().send(command);
    return stripKeysList<CartItem>(response.Items, ["PK", "SK"]);
  }

  async getCartItemById(
    cartId: string,
    itemId: string,
  ): Promise<CartItem | null> {
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
  async getRecentFeedback(limit: number): Promise<Order[]> {
    const result = await getClient().send(new QueryCommand({ TableName: TABLE(),
      KeyConditionExpression: "PK = :pk", ExpressionAttributeValues: { ":pk": "ADMIN#FEEDBACK" },
      ScanIndexForward: false, Limit: limit, ConsistentRead: true,
    }));
    const rows = await Promise.all((result.Items ?? []).map(async pointer => {
      const response = await getClient().send(new GetCommand({ TableName: TABLE(),
        Key: { PK: "ORDER#" + pointer.orderId, SK: "METADATA" }, ConsistentRead: true }));
      const order = stripKeys<Order>(response.Item, ["PK", "SK"]);
      return order?.status === "COMPLETED" && order.feedback?.revision === pointer.revision ? order : null;
    }));
    return rows.filter((order): order is Order => !!order);
  }
  async saveFeedback(orderId: string, userId: string, feedback: import("@/lib/types/feedback").OrderFeedback, expectedRevision: string | null) {
    const result = await getClient().send(new GetCommand({ TableName: TABLE(), Key: { PK: "ORDER#" + orderId, SK: "METADATA" }, ConsistentRead: true }));
    const previous = stripKeys<Order>(result.Item, ["PK", "SK"]);
    if (!previous || previous.userId !== userId || previous.status !== "COMPLETED" || (previous.feedback?.revision ?? null) !== expectedRevision)
      throw new DomainError("FEEDBACK_CHANGED", "Đánh giá đã thay đổi. Vui lòng tải lại.", 409);
    const pointerKey = (entry: import("@/lib/types/feedback").OrderFeedback) => entry.updatedAt + "#" + orderId + "#" + entry.revision;
    try {
      await getClient().send(new TransactWriteCommand({ TransactItems: [
        { Put: { TableName: TABLE(), Item: withKeys({ ...previous, feedback, updatedAt: feedback.updatedAt }, { PK: "ORDER#" + orderId, SK: "METADATA" }),
          ConditionExpression: "#user = :user AND #status = :completed AND " + (expectedRevision ? "#feedback.#revision = :expected" : "attribute_not_exists(#feedback)"),
          ExpressionAttributeNames: { "#user": "userId", "#status": "status", "#feedback": "feedback", ...(expectedRevision ? { "#revision": "revision" } : {}) },
          ExpressionAttributeValues: { ":user": userId, ":completed": "COMPLETED", ...(expectedRevision ? { ":expected": expectedRevision } : {}) },
        } },
        { Put: { TableName: TABLE(), Item: { PK: "ADMIN#FEEDBACK", SK: pointerKey(feedback), orderId, revision: feedback.revision } } },
        ...(previous.feedback ? [{ Delete: { TableName: TABLE(), Key: { PK: "ADMIN#FEEDBACK", SK: pointerKey(previous.feedback) } } }] : []),
      ] }));
    } catch (error) {
      if (error instanceof Error && error.name === "TransactionCanceledException")
        throw new DomainError("FEEDBACK_CHANGED", "Đánh giá đã thay đổi. Vui lòng tải lại.", 409);
      throw error;
    }
  }

  async completeCheckout(
    order: Order,
    items: OrderItem[],
    event: OrderEvent,
    cart: Cart,
  ): Promise<void> {
    // All writes commit together. The ACTIVE condition also rejects a second
    // checkout on another process, even if it uses a different request key.
    const put = (item: object, PK: string, SK: string) => ({
      Put: { TableName: TABLE(), Item: withKeys(item, { PK, SK }) },
    });
    await getClient().send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: TABLE(),
              Item: withKeys(order, {
                PK: `ORDER#${order.id}`,
                SK: "METADATA",
              }),
              ConditionExpression: "attribute_not_exists(PK)",
            },
          },
          put(
            { orderId: order.id },
            `USER#${order.userId}`,
            `ORDER#${order.id}`,
          ),
          put(
            { orderId: order.id },
            "ADMIN#ORDERS",
            `${order.createdAt}#${order.id}`,
          ),
          ...items.map((item) =>
            put(item, `ORDER#${order.id}`, `ITEM#${item.id}`),
          ),
          put(event, `ORDER#${order.id}`, `EVENT#${event.id}`),
          {
            Put: {
              TableName: TABLE(),
              Item: withKeys(cart, { PK: `CART#${cart.id}`, SK: "ACTIVE" }),
              ConditionExpression: "#status = :active AND userId = :owner AND " + (cart.revision ? "#revision = :revision" : "attribute_not_exists(#revision)"),
              ExpressionAttributeNames: { "#status": "status", "#revision": "revision" },
              ExpressionAttributeValues: { ":active": "ACTIVE", ":owner": order.userId, ...(cart.revision ? { ":revision": cart.revision } : {}) },
            },
          },
          {
            Delete: {
              TableName: TABLE(),
              Key: { PK: `USER#${order.userId}`, SK: "CART#ACTIVE" },
              ConditionExpression: "cartId = :cartId",
              ExpressionAttributeValues: { ":cartId": cart.id },
            },
          },
        ],
      }),
    );
  }
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
        Item: {
          PK: `USER#${order.userId}`,
          SK: `ORDER#${order.id}`,
          orderId: order.id,
        },
      }),
    );
  }

  async getRecentOrders(limit: number): Promise<Order[]> {
    const result = await getClient().send(
      new QueryCommand({
        TableName: TABLE(),
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: { ":pk": "ADMIN#ORDERS" },
        ScanIndexForward: false,
        Limit: limit,
        ConsistentRead: true,
      }),
    );
    const orders = await Promise.all(
      (result.Items ?? []).map((pointer) =>
        this.getOrderById(String(pointer.orderId)),
      ),
    );
    return orders.filter((order): order is Order => !!order);
  }
  async transitionOrder(
    order: Order,
    event: OrderEvent,
    expectedStatus: Order["status"],
  ): Promise<void> {
    try {
      await getClient().send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: TABLE(),
                Item: withKeys(order, {
                  PK: `ORDER#${order.id}`,
                  SK: "METADATA",
                }),
                ConditionExpression: "#status = :expected",
                ExpressionAttributeNames: { "#status": "status" },
                ExpressionAttributeValues: { ":expected": expectedStatus },
              },
            },
            {
              Put: {
                TableName: TABLE(),
                Item: withKeys(event, {
                  PK: `ORDER#${order.id}`,
                  SK: `EVENT#${event.id}`,
                }),
              },
            },
          ],
        }),
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.name === "TransactionCanceledException"
      )
        throw new DomainError(
          "ORDER_CONFLICT",
          "Đơn đã thay đổi. Vui lòng tải lại.",
          409,
        );
      throw error;
    }
  }
  async cancelOrder(order: Order, event: OrderEvent): Promise<void> {
    return this.transitionOrder(order, event, "CONFIRMED");
  }
  async getOrderEvents(orderId: string): Promise<OrderEvent[]> {
    const response = await getClient().send(
      new QueryCommand({
        TableName: TABLE(),
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: {
          ":pk": `ORDER#${orderId}`,
          ":sk": "EVENT#",
        },
      }),
    );
    return stripKeysList<OrderEvent>(response.Items, ["PK", "SK"]).sort(
      (a, b) => a.createdAt.localeCompare(b.createdAt),
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
    const pointers = stripKeysList<{ orderId?: string }>(response.Items, [
      "PK",
      "SK",
    ]);
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
  accountRepository: new DynamoDBAccountRepository(),
  userRepository: new DynamoDBUserRepository(),
  sessionRepository: new DynamoDBSessionRepository(),
  menuRepository: new DynamoDBMenuRepository(),
  cartRepository: new DynamoDBCartRepository(),
  orderRepository: new DynamoDBOrderRepository(),
};
