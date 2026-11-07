import { withUserLock } from "@/lib/server/user-lock";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { mockRepositories } from "./mock-repository";
import type { RepositorySet } from "../repositories";

type Snapshot = Record<string, Record<string, [unknown, unknown][]>>;
const shared = globalThis as typeof globalThis & {
  kfcLocalRepositories?: RepositorySet;
};
export function localRepositories(): RepositorySet {
  if (shared.kfcLocalRepositories) return shared.kfcLocalRepositories;
  const directory = resolve(
    /* turbopackIgnore: true */ process.env.LOCAL_DATA_DIR || ".local",
  );
  mkdirSync(directory, { recursive: true });
  const file = resolve(directory, "store.json");
  const repositories = mockRepositories;
  const snapshot = (): Snapshot =>
    Object.fromEntries(
      Object.entries(repositories).map(([name, repository]) => [
        name,
        Object.fromEntries(
          Object.entries(repository)
            .filter(([, value]) => value instanceof Map)
            .map(([key, value]) => [
              key,
              [...(value as Map<unknown, unknown>)],
            ]),
        ),
      ]),
    );
  const restore = (data: Snapshot) => {
    for (const [name, fields] of Object.entries(data)) {
      const repository = repositories[
        name as keyof RepositorySet
      ] as unknown as Record<string, unknown>;
      if (!repository) continue;
      for (const [key, entries] of Object.entries(fields)) {
        if (repository[key] instanceof Map && Array.isArray(entries))
          repository[key] = new Map(entries);
      }
    }
  };
  if (existsSync(file)) restore(JSON.parse(readFileSync(file, "utf8")));
  const wrapped = Object.fromEntries(
    Object.entries(repositories).map(([name, repository]) => [
      name,
      new Proxy(repository, {
        get(target, property, receiver) {
          const value = Reflect.get(target, property, receiver);
          if (typeof value !== "function") return value;
          if (
            !/^(create|update|add|append|save|remove|clear|complete|cancel|transition)/.test(
              String(property),
            )
          )
            return value.bind(target);
          return (...args: unknown[]) =>
            withUserLock("__local_disk__", async () => {
              const before = JSON.stringify(snapshot());
              try {
                const result = await value.apply(target, args);
                const temporary = `${file}.tmp`;
                writeFileSync(temporary, JSON.stringify(snapshot()), {
                  mode: 0o600,
                });
                renameSync(temporary, file);
                return result;
              } catch (error) {
                restore(JSON.parse(before));
                throw error;
              }
            });
        },
      }),
    ]),
  ) as unknown as RepositorySet;
  return (shared.kfcLocalRepositories = wrapped);
}
