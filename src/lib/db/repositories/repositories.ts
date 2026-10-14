import { mockRepositories } from "./implementations/mock-repository";
import { dynamodbRepositories } from "./implementations/dynamodb-repository";
import { CartRepository } from "./interfaces/cart-repository.interface";
import { IMenuRepository } from "./interfaces/menu-repository.interface";
import { OrderRepository } from "./interfaces/order-repository.interface";
import { SessionRepository } from "./interfaces/session-repository.interface";
import { UserRepository } from "./interfaces/user-repository.interface";

export interface RepositorySet {
  userRepository: UserRepository;
  sessionRepository: SessionRepository;
  menuRepository: IMenuRepository;
  cartRepository: CartRepository;
  orderRepository: OrderRepository;
}

export type PersistenceDriver = "mock" | "dynamodb";

/**
 * Resolves the persistence driver.
 *
 * Defaults to the in-memory mock repositories so local development and tests
 * never require AWS credentials. DynamoDB is only used when explicitly
 * selected via PERSISTENCE_DRIVER=dynamodb (or when running a production
 * build), and even then clients are created lazily on first use.
 */
export function resolvePersistenceDriver(): PersistenceDriver {
  const configured = process.env.PERSISTENCE_DRIVER?.toLowerCase();
  if (configured === "mock") return "mock";
  if (configured === "dynamodb") return "dynamodb";
  return process.env.NODE_ENV === "production" ? "dynamodb" : "mock";
}

/**
 * Repository factory. Called exactly once by the ServiceContainer so the whole
 * application shares a single coherent set of repository instances.
 */
export function createRepositories(): RepositorySet {
  return resolvePersistenceDriver() === "dynamodb" ? dynamodbRepositories : mockRepositories;
}

