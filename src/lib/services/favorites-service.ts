import { createHash, randomUUID } from "node:crypto";
import type { UserRepository } from "@/lib/db/repositories/interfaces/user-repository.interface";
import type { FavoritesView } from "@/lib/types/favorites";
import { MenuService } from "./menu-service";
import { DomainError } from "@/lib/domain-error";
import { withUserLock } from "@/lib/server/user-lock";

export class FavoritesService {
  constructor(
    private users: UserRepository,
    private menu: MenuService,
  ) {}

  async view(userId: string): Promise<FavoritesView> {
    const preferences = await this.users.getUserPreferences(userId);
    return {
      itemIds: [...(preferences?.favoriteMenuItemIds ?? [])],
      revision:
        preferences?.favoritesRevision ??
        createHash("sha256").update(userId).digest("hex"),
    };
  }

  async set(
    userId: string,
    itemId: string,
    saved: boolean,
    revision: string,
  ): Promise<FavoritesView> {
    // Also serialize direct service callers. HTTP callers already hold the owner lock.
    return withUserLock("favorites:" + userId, async () => {
      const current = await this.view(userId);
      if (revision !== current.revision)
        throw new DomainError(
          "FAVORITES_CHANGED",
          "Món yêu thích đã thay đổi. Dữ liệu vừa được làm mới, hãy chọn lại thao tác.",
          409,
        );
      if (saved) {
        const item = await this.menu.getMenuItemById(itemId);
        if (!item?.isActive || !item.isAvailable)
          throw new DomainError(
            "MENU_ITEM_UNAVAILABLE",
            "Món này hiện không có trên thực đơn.",
            404,
          );
      }
      if (current.itemIds.includes(itemId) === saved) return current;
      if (saved && current.itemIds.length >= 200)
        throw new DomainError(
          "FAVORITES_LIMIT",
          "Bạn có thể lưu tối đa 200 món yêu thích.",
        );
      const itemIds = saved
        ? [...current.itemIds, itemId]
        : current.itemIds.filter((id) => id !== itemId);
      const preferences = await this.users.getUserPreferences(userId);
      const now = new Date().toISOString();
      const updatedRevision = randomUUID();
      await this.users.updateUserPreferences({
        ...(preferences ?? {
          id: randomUUID(),
          userId,
          language: "vi",
          createdAt: now,
        }),
        updatedAt: now,
        favoriteMenuItemIds: itemIds,
        favoritesRevision: updatedRevision,
      });
      return { itemIds: [...itemIds], revision: updatedRevision };
    });
  }
}
