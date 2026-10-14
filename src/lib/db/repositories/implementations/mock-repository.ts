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

export class MockUserRepository implements UserRepository {
  private users: Map<string, User> = new Map();
  private userProfiles: Map<string, UserProfile> = new Map();
  private userPreferences: Map<string, UserPreferences> = new Map();
  private addresses: Map<string, Address[]> = new Map();

  async getUserById(userId: string): Promise<User | null> {
    return this.users.get(userId) || null;
  }

  async createUser(user: User): Promise<void> {
    // Keyed by the raw user id, matching getUserById above.
    this.users.set(user.id, user);
  }

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    return this.userProfiles.get(userId) || null;
  }

  async updateUserProfile(profile: UserProfile): Promise<void> {
    this.userProfiles.set(profile.userId, profile);
  }

  async getUserPreferences(userId: string): Promise<UserPreferences | null> {
    return this.userPreferences.get(userId) || null;
  }

  async updateUserPreferences(preferences: UserPreferences): Promise<void> {
    this.userPreferences.set(preferences.userId, preferences);
  }

  async getUserAddresses(userId: string): Promise<Address[]> {
    return this.addresses.get(userId) || [];
  }

  async createAddress(address: Address): Promise<void> {
    const userAddresses = this.addresses.get(address.userId) || [];
    userAddresses.push(address);
    this.addresses.set(address.userId, userAddresses);
  }
}

export class MockSessionRepository implements SessionRepository {
  private sessions: Map<string, Session> = new Map();
  private messages: Map<string, Message[]> = new Map();
  private conversationContexts: Map<string, ConversationContext> = new Map();

  async createSession(session: Session): Promise<void> {
    // Keyed by the raw session id; every read below uses the same key.
    this.sessions.set(session.id, session);
    if (!this.messages.has(session.id)) {
      this.messages.set(session.id, []);
    }
  }

  async getSession(sessionId: string): Promise<Session | null> {
    return this.sessions.get(sessionId) || null;
  }

  async getActiveSession(userId: string): Promise<Session | null> {
    let active: Session | null = null;
    for (const session of this.sessions.values()) {
      if (session.userId !== userId || session.status !== "ACTIVE") continue;
      if (!active || session.updatedAt > active.updatedAt) {
        active = session;
      }
    }
    return active;
  }

  async appendMessage(message: Message): Promise<void> {
    // Keyed by message.sessionId; getMessages reads with the same key.
    const sessionMessages = this.messages.get(message.sessionId) || [];
    sessionMessages.push(message);
    this.messages.set(message.sessionId, sessionMessages);

    const session = this.sessions.get(message.sessionId);
    if (session) {
      this.sessions.set(message.sessionId, { ...session, updatedAt: message.createdAt });
    }
  }

  async getMessages(sessionId: string): Promise<Message[]> {
    return this.messages.get(sessionId) || [];
  }

  async getConversationContext(sessionId: string): Promise<ConversationContext | null> {
    return this.conversationContexts.get(sessionId) || null;
  }

  async saveConversationContext(context: ConversationContext): Promise<void> {
    // Keyed by context.sessionId; the read above uses the same key.
    this.conversationContexts.set(context.sessionId, context);
  }
}

export class MockMenuRepository implements IMenuRepository {
  private categories: Map<string, MenuCategory> = new Map();
  private items: Map<string, MenuItem> = new Map();
  private itemOptions: Map<string, MenuItemOption[]> = new Map();
  private optionValues: Map<string, OptionValue[]> = new Map();
  private bundles: Map<string, ProductBundle> = new Map();
  private bundleItems: Map<string, BundleItem[]> = new Map();

  constructor() {
    this.seedData();
  }

  private seedData() {
    // Categories
    const breakfastId = "cat_breakfast_001";
    this.categories.set(breakfastId, {
      id: breakfastId,
      name: "Bữa sáng",
      description: "Các món ăn sáng ngon miệng",
      displayOrder: 1,
      isActive: true,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    });

    const lunchId = "cat_lunch_002";
    this.categories.set(lunchId, {
      id: lunchId,
      name: "Bữa trưa",
      description: "Các món ăn trưa hấp dẫn",
      displayOrder: 2,
      isActive: true,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    });

    const dinnerId = "cat_dinner_003";
    this.categories.set(dinnerId, {
      id: dinnerId,
      name: "Bữa tối",
      description: "Các món ăn tối sang trọng",
      displayOrder: 3,
      isActive: true,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    });

    const drinksId = "cat_drinks_004";
    this.categories.set(drinksId, {
      id: drinksId,
      name: "Đồ uống",
      description: "Nước ngọt và đồ uống lạnh",
      displayOrder: 4,
      isActive: true,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    });

    const sidesId = "cat_sides_005";
    this.categories.set(sidesId, {
      id: sidesId,
      name: "Món ăn kèm",
      description: "Khoai tây chiên, gà sốt, salad",
      displayOrder: 5,
      isActive: true,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    });

    // Menu Items
    const item1 = "item_burger_001";
    this.items.set(item1, {
      id: item1,
      categoryId: lunchId,
      name: "Burger Gà Rán",
      description: "Burger gà rán giòn tan với rau thơm",
      price: 89000,
      currency: "VND",
      imageUrl: "/images/burger.png",
      isAvailable: true,
      isActive: true,
      tags: ["burger", "chicken"],
      metadata: { calories: 450, spicy: false },
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    });

    const item2 = "item_combo_002";
    this.items.set(item2, {
      id: item2,
      categoryId: breakfastId,
      name: "Combo Gà Cay",
      description: "Combo gà cay đặc biệt với khoai tây chiên",
      price: 159000,
      currency: "VND",
      imageUrl: "/images/combo.png",
      isAvailable: true,
      isActive: true,
      tags: ["combo", "chicken", "spicy"],
      metadata: { calories: 800, spicy: true },
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    });

    const item3 = "item_fried_chicken_003";
    this.items.set(item3, {
      id: item3,
      categoryId: lunchId,
      name: "Gà Rán Sốt Honey",
      description: "Gà rán tẩm mật ong, thơm ngon",
      price: 99000,
      currency: "VND",
      imageUrl: "/images/fried-chicken.png",
      isAvailable: true,
      isActive: true,
      tags: ["chicken", "honey"],
      metadata: { calories: 550, spicy: false },
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    });

    const item4 = "item_pepsi_004";
    this.items.set(item4, {
      id: item4,
      categoryId: drinksId,
      name: "Pepsi 1.5L",
      description: "Nước ngọt Pepsi vị truyền thống",
      price: 25000,
      currency: "VND",
      imageUrl: "/images/pepsi.png",
      isAvailable: true,
      isActive: true,
      tags: ["drink", "soft-drink"],
      metadata: { calories: 150, volume: "1.5L" },
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    });

    const item5 = "item_french_fries_005";
    this.items.set(item5, {
      id: item5,
      categoryId: sidesId,
      name: "Khoai Tây Chiên",
      description: "Khoai tây chiên giòn rụm",
      price: 35000,
      currency: "VND",
      imageUrl: "/images/fries.png",
      isAvailable: true,
      isActive: true,
      tags: ["side", "potato"],
      metadata: { calories: 300, glutenFree: true },
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    });

    const item6 = "item_chicken_wings_006";
    this.items.set(item6, {
      id: item6,
      categoryId: sidesId,
      name: "Gà Sườn Chiên",
      description: "Gà sườn chiên giòn với sốt BBQ",
      price: 75000,
      currency: "VND",
      imageUrl: "/images/wings.png",
      isAvailable: true,
      isActive: true,
      tags: ["chicken", "wings", "bbq"],
      metadata: { calories: 400, spicy: true },
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    });

    const item7 = "item_inactive_007";
    this.items.set(item7, {
      id: item7,
      categoryId: lunchId,
      name: "Món Ăn Không Hoạt Động",
      description: "Món này hiện không có sẵn",
      price: 50000,
      currency: "VND",
      imageUrl: "/images/unavailable.png",
      isAvailable: false,
      isActive: true,
      tags: ["unavailable"],
      metadata: { reason: "temporary_unavailable" },
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    });

    const item8 = "item_inactive_008";
    this.items.set(item8, {
      id: item8,
      categoryId: dinnerId,
      name: "Món Ăn Dừng Hoạt Động",
      description: "Món này đã ngừng kinh doanh",
      price: 60000,
      currency: "VND",
      imageUrl: "/images/discontinued.png",
      isAvailable: true,
      isActive: false,
      tags: ["discontinued"],
      metadata: { reason: "discontinued" },
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    });

    // Menu Item Options
    const option1 = "option_spicy_level_001";
    this.itemOptions.set(option1, [
      {
        id: option1,
        menuItemId: item1,
        name: "Cấp độ cay",
        required: false,
        displayOrder: 1,
        isActive: true,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
      {
        id: "option_size_002",
        menuItemId: item1,
        name: "Kích thước",
        required: true,
        displayOrder: 2,
        isActive: true,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    ]);

    const option2 = "option_drink_size_003";
    this.itemOptions.set(option2, [
      {
        id: option2,
        menuItemId: item4,
        name: "Kích thước",
        required: true,
        displayOrder: 1,
        isActive: true,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    ]);

    // Option Values
    this.optionValues.set(option1, [
      {
        id: "value_spicy_1",
        optionId: option1,
        name: "Ít cay",
        priceDelta: 0,
        isDefault: false,
        isAvailable: true,
        displayOrder: 1,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
      {
        id: "value_spicy_2",
        optionId: option1,
        name: "Cay vừa",
        priceDelta: 5000,
        isDefault: true,
        isAvailable: true,
        displayOrder: 2,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
      {
        id: "value_spicy_3",
        optionId: option1,
        name: "Cay nhiều",
        priceDelta: 10000,
        isDefault: false,
        isAvailable: true,
        displayOrder: 3,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    ]);

    this.optionValues.set(option2, [
      {
        id: "value_size_small_001",
        optionId: option2,
        name: "Nhỏ",
        priceDelta: 0,
        isDefault: false,
        isAvailable: true,
        displayOrder: 1,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
      {
        id: "value_size_medium_002",
        optionId: option2,
        name: "Vừa",
        priceDelta: 0,
        isDefault: true,
        isAvailable: true,
        displayOrder: 2,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
      {
        id: "value_size_large_003",
        optionId: option2,
        name: "Lớn",
        priceDelta: 5000,
        isDefault: false,
        isAvailable: true,
        displayOrder: 3,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    ]);

    // Product Bundles
    const bundle1 = "bundle_family_001";
    this.bundles.set(bundle1, {
      id: bundle1,
      name: "Combo Gia Đình",
      description: "Combo tiết kiệm cho gia đình",
      price: 299000,
      currency: "VND",
      isActive: true,
      isAvailable: true,
      imageUrl: "/images/family-bundle.png",
      metadata: { servings: 3, recommended: true },
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    });

    const bundle2 = "bundle_student_002";
    this.bundles.set(bundle2, {
      id: bundle2,
      name: "Combo Sinh Viên",
      description: "Combo giá hợp lý cho sinh viên",
      price: 129000,
      currency: "VND",
      isActive: true,
      isAvailable: true,
      imageUrl: "/images/student-bundle.png",
      metadata: { budget: true, popular: true },
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    });

    const bundle3 = "bundle_vegetarian_003";
    this.bundles.set(bundle3, {
      id: bundle3,
      name: "Combo Chay",
      description: "Lựa chọn chay cho khách hàng",
      price: 89000,
      currency: "VND",
      isActive: true,
      isAvailable: true,
      imageUrl: "/images/vegetarian-bundle.png",
      metadata: { dietary: "vegetarian", healthy: true },
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    });

    // Bundle Items
    this.bundleItems.set(bundle1, [
      {
        id: "bundle_item_1_1",
        bundleId: bundle1,
        menuItemId: item1,
        quantity: 2,
        isRequired: true,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
      {
        id: "bundle_item_1_2",
        bundleId: bundle1,
        menuItemId: item5,
        quantity: 1,
        isRequired: true,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
      {
        id: "bundle_item_1_3",
        bundleId: bundle1,
        menuItemId: item4,
        quantity: 2,
        isRequired: true,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    ]);

    this.bundleItems.set(bundle2, [
      {
        id: "bundle_item_2_1",
        bundleId: bundle2,
        menuItemId: item2,
        quantity: 1,
        isRequired: true,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
      {
        id: "bundle_item_2_2",
        bundleId: bundle2,
        menuItemId: item5,
        quantity: 1,
        isRequired: true,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    ]);

    this.bundleItems.set(bundle3, [
      {
        id: "bundle_item_3_1",
        bundleId: bundle3,
        menuItemId: item5,
        quantity: 1,
        isRequired: true,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
      {
        id: "bundle_item_3_2",
        bundleId: bundle3,
        menuItemId: item4,
        quantity: 1,
        isRequired: true,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    ]);
  }

  async getCategories(): Promise<MenuCategory[]> {
    return Array.from(this.categories.values());
  }

  async getCategoryById(categoryId: string): Promise<MenuCategory | null> {
    return this.categories.get(categoryId) || null;
  }

  async getMenuItems(): Promise<MenuItem[]> {
    return Array.from(this.items.values());
  }

  async getMenuItemById(itemId: string): Promise<MenuItem | null> {
    return this.items.get(itemId) || null;
  }

  async getItemsByCategory(categoryId: string): Promise<MenuItem[]> {
    return Array.from(this.items.values()).filter((item) => item.categoryId === categoryId);
  }

  async searchMenuItems(query: string): Promise<MenuItem[]> {
    const normalizedQuery = query.toLowerCase().trim();
    return Array.from(this.items.values()).filter((item) => {
      if (!item.isActive || !item.isAvailable) return false;

      const searchFields = [
        item.name.toLowerCase(),
        item.description?.toLowerCase() || "",
        item.tags?.join(" ").toLowerCase() || "",
      ];

      return searchFields.some((field) => field.includes(normalizedQuery));
    });
  }

  async getItemOptions(menuItemId: string): Promise<MenuItemOption[]> {
    return this.itemOptions.get(menuItemId) || [];
  }

  async getItemOptionById(optionId: string): Promise<MenuItemOption | null> {
    for (const options of this.itemOptions.values()) {
      const option = options.find((opt) => opt.id === optionId);
      if (option) return option;
    }
    return null;
  }

  async getOptionValues(optionId: string): Promise<OptionValue[]> {
    return this.optionValues.get(optionId) || [];
  }

  async getOptionValueById(valueId: string): Promise<OptionValue | null> {
    for (const values of this.optionValues.values()) {
      const value = values.find((val) => val.id === valueId);
      if (value) return value;
    }
    return null;
  }

  async getProductBundles(): Promise<ProductBundle[]> {
    return Array.from(this.bundles.values());
  }

  async getProductBundleById(bundleId: string): Promise<ProductBundle | null> {
    return this.bundles.get(bundleId) || null;
  }

  async getBundleItems(bundleId: string): Promise<BundleItem[]> {
    return this.bundleItems.get(bundleId) || [];
  }

  async getAvailableMenuItems(): Promise<MenuItem[]> {
    return Array.from(this.items.values()).filter((item) => item.isActive && item.isAvailable);
  }

  async getActiveCategories(): Promise<MenuCategory[]> {
    return Array.from(this.categories.values()).filter((category) => category.isActive);
  }
}

export class MockCartRepository implements CartRepository {
  private carts: Map<string, Cart> = new Map();
  private cartItems: Map<string, CartItem[]> = new Map();

  async getActiveCart(userId: string): Promise<Cart | null> {
    let active: Cart | null = null;
    for (const cart of this.carts.values()) {
      if (cart.userId !== userId || cart.status !== "ACTIVE") continue;
      if (!active || cart.updatedAt > active.updatedAt) {
        active = cart;
      }
    }
    return active;
  }

  async getCartById(cartId: string): Promise<Cart | null> {
    return this.carts.get(cartId) || null;
  }

  async createCart(cart: Cart): Promise<void> {
    // Keyed by cart.id; every cart read below uses the same key.
    this.carts.set(cart.id, cart);
    this.cartItems.set(cart.id, []);
  }

  async updateCart(cart: Cart): Promise<void> {
    this.carts.set(cart.id, cart);
  }

  async getCartItems(cartId: string): Promise<CartItem[]> {
    return this.cartItems.get(cartId) || [];
  }

  async getCartItemById(cartId: string, itemId: string): Promise<CartItem | null> {
    // The line item is always resolved through its owning cartId.
    const items = this.cartItems.get(cartId) || [];
    return items.find((item) => item.id === itemId) || null;
  }

  async addItem(item: CartItem): Promise<void> {
    const items = this.cartItems.get(item.cartId) || [];
    items.push(item);
    this.cartItems.set(item.cartId, items);
  }

  async updateItem(item: CartItem): Promise<void> {
    const items = this.cartItems.get(item.cartId) || [];
    this.cartItems.set(
      item.cartId,
      items.map((existing) => (existing.id === item.id ? item : existing)),
    );
  }

  async removeItem(cartId: string, itemId: string): Promise<void> {
    const items = this.cartItems.get(cartId) || [];
    this.cartItems.set(
      cartId,
      items.filter((item) => item.id !== itemId),
    );
  }

  async clearCart(cartId: string): Promise<void> {
    this.cartItems.set(cartId, []);
  }
}

export class MockOrderRepository implements OrderRepository {
  private orders: Map<string, Order> = new Map();
  private orderItems: Map<string, OrderItem[]> = new Map();
  private orderEvents: Map<string, OrderEvent[]> = new Map();

  async createOrder(order: Order): Promise<void> {
    this.orders.set(order.id, order);
    this.orderItems.set(order.id, []);
    this.orderEvents.set(order.id, []);
  }

  async getOrderById(orderId: string): Promise<Order | null> {
    return this.orders.get(orderId) || null;
  }

  async getUserOrders(userId: string): Promise<Order[]> {
    return Array.from(this.orders.values()).filter((o) => o.userId === userId);
  }

  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    return this.orderItems.get(orderId) || [];
  }

  async appendOrderEvent(event: OrderEvent): Promise<void> {
    const events = this.orderEvents.get(event.orderId) || [];
    events.push(event);
    this.orderEvents.set(event.orderId, events);
  }
}

export const mockRepositories = {
  userRepository: new MockUserRepository(),
  sessionRepository: new MockSessionRepository(),
  menuRepository: new MockMenuRepository(),
  cartRepository: new MockCartRepository(),
  orderRepository: new MockOrderRepository(),
};
