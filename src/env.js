import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]),
    COOKIE_SECRET: z.string().min(32),
    HMAC_KEY: z.string().min(16),
    ALLOW_LIST_DEV_MODE: z.enum(["0", "1"]).optional(),

    // Google OAuth (required in production, optional in dev)
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    NEXTAUTH_SECRET: z.string().optional(),

    // S3-compatible storage (when set, S3 store is used instead of SQLite)
    S3_ENDPOINT: z.string().url().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_BUCKET_NAME: z.string().optional(),
  },

  client: {
    NEXT_PUBLIC_LANG: z.enum(["fr", "en"]).optional(),
    NEXT_PUBLIC_AUTH_MODE: z.enum(["dev", "google"]).optional(),
  },

  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_LANG: process.env.NEXT_PUBLIC_LANG,
    NEXT_PUBLIC_AUTH_MODE: process.env.NEXT_PUBLIC_AUTH_MODE,
    COOKIE_SECRET: process.env.COOKIE_SECRET,
    HMAC_KEY: process.env.HMAC_KEY,
    ALLOW_LIST_DEV_MODE: process.env.ALLOW_LIST_DEV_MODE,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    S3_ENDPOINT: process.env.S3_ENDPOINT,
    S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
    S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
  },

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
