import { z } from 'zod';

export const UserRoleSchema = z.enum(['admin', 'consultant']);

export const UserSchema = z.object({
  _id: z.string(),
  email: z.string().email(),
  passwordHash: z.string(),
  name: z.string(),
  role: UserRoleSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const UserPublicSchema = UserSchema.omit({ passwordHash: true });

export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

export const UpdateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const RefreshTokenSchema = z.object({
  _id: z.string(),
  userId: z.string(),
  token: z.string(),
  expiresAt: z.date(),
  createdAt: z.date(),
});

export const RefreshRequestSchema = z.object({
  refreshToken: z.string(),
});

export const AuthTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});

export type User = z.infer<typeof UserSchema>;
export type UserPublic = z.infer<typeof UserPublicSchema>;
export type CreateUser = z.infer<typeof CreateUserSchema>;
export type UpdateUser = z.infer<typeof UpdateUserSchema>;
export type Login = z.infer<typeof LoginSchema>;
export type RefreshToken = z.infer<typeof RefreshTokenSchema>;
export type RefreshRequest = z.infer<typeof RefreshRequestSchema>;
export type AuthTokens = z.infer<typeof AuthTokensSchema>;
export type UserRole = z.infer<typeof UserRoleSchema>;
