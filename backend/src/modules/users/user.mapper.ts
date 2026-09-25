import type { User } from '../../generated/prisma/client.js';
import type { UserDto } from './dto/user.dto.js';
import { mergeNotificationPrefs } from './notification-prefs.js';

/** Único mapeamento User → UserDto (auth/me, login, refresh e /users/me). */
export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerifiedAt !== null,
    avatarUrl: user.avatarUrl,
    phone: user.phone,
    currency: user.currency,
    locale: user.locale,
    timezone: user.timezone,
    theme: user.theme,
    onboardingCompleted: user.onboardingCompletedAt !== null,
    notificationPrefs: mergeNotificationPrefs(user.notificationPrefs),
    createdAt: user.createdAt.toISOString(),
  };
}
