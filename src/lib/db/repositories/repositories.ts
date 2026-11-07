import { localRepositories } from "./implementations/local-repository";
import { mockRepositories } from "./implementations/mock-repository";
import { dynamodbRepositories } from "./implementations/dynamodb-repository";
import { CartRepository } from "./interfaces/cart-repository.interface";
import { IMenuRepository } from "./interfaces/menu-repository.interface";
import { OrderRepository } from "./interfaces/order-repository.interface";
import { SessionRepository } from "./interfaces/session-repository.interface";
import { UserRepository } from "./interfaces/user-repository.interface";

export interface RepositorySet {
  accountRepository: import("./interfaces/account-repository.interface").AccountRepository;
  userRepository: UserRepository;
  sessionRepository: SessionRepository;
  menuRepository: IMenuRepository;
  cartRepository: CartRepository;
  orderRepository: OrderRepository;
}

export type PersistenceDriver = "mock" | "local" | "dynamodb";

/** Local durable storage is the default. Cloud persistence is always explicit. */
export function resolvePersistenceDriver(): PersistenceDriver {
  const configured = process.env.PERSISTENCE_DRIVER?.toLowerCase();
  if (configured === "local") return "local";
  if (configured === "mock") return "mock";
  if (configured === "dynamodb") return "dynamodb";
  if (configured) throw new Error(`Unknown PERSISTENCE_DRIVER: ${configured}`);
  return "local";
}

/**
 * Repository factory. Called exactly once by the ServiceContainer so the whole
 * application shares a single coherent set of repository instances.
 */
export function createRepositories(): RepositorySet {
  const driver = resolvePersistenceDriver();
  return driver === "dynamodb"
    ? dynamodbRepositories
    : driver === "local"
      ? localRepositories()
      : mockRepositories;
}
