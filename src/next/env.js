import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]),
    COOKIE_SECRET: z.string().min(32),
    HMAC_KEY: z.string().min(16),

    // Engine selection (required — no silent defaults)
    STORAGE_ENGINE: z.enum(["s3", "sqlite", "d1"]),
    AUTH_ENGINE: z.enum(["dev", "google"]),

    // Google OAuth (required when AUTH_ENGINE=google)
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    NEXTAUTH_SECRET: z.string().optional(),

    // S3-compatible storage (required when STORAGE_ENGINE=s3)
    S3_ENDPOINT: z.string().optional(),
    S3_REGION: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_BUCKET_NAME: z.string().optional(),

    // Cloudflare D1 (required when STORAGE_ENGINE=d1)
    D1_ACCOUNT_ID: z.string().optional(),
    D1_DATABASE_ID: z.string().optional(),
    D1_API_TOKEN: z.string().optional(),
  },

  client: {
    NEXT_PUBLIC_LANG: z.enum(["fr", "en", "de"]).optional(),
    NEXT_PUBLIC_THEME: z.string().optional(),
  },

  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_LANG: process.env.NEXT_PUBLIC_LANG,
    NEXT_PUBLIC_THEME: process.env.NEXT_PUBLIC_THEME,
    COOKIE_SECRET: process.env.COOKIE_SECRET,
    HMAC_KEY: process.env.HMAC_KEY,
    STORAGE_ENGINE: process.env.STORAGE_ENGINE,
    AUTH_ENGINE: process.env.AUTH_ENGINE,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    S3_ENDPOINT: process.env.S3_ENDPOINT,
    S3_REGION: process.env.S3_REGION,
    S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
    S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
    D1_ACCOUNT_ID: process.env.D1_ACCOUNT_ID,
    D1_DATABASE_ID: process.env.D1_DATABASE_ID,
    D1_API_TOKEN: process.env.D1_API_TOKEN,
  },

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});

// ─── Conditional validation (engine-specific requirements) ──────────
// Runs after Zod schema validation. These throw at startup if an engine
// is selected without its required credentials.
if (!process.env.SKIP_ENV_VALIDATION) {
  if (env.STORAGE_ENGINE === "s3") {
    const required = {
      S3_ENDPOINT: env.S3_ENDPOINT,
      S3_ACCESS_KEY_ID: env.S3_ACCESS_KEY_ID,
      S3_SECRET_ACCESS_KEY: env.S3_SECRET_ACCESS_KEY,
    };
    for (const [varName, value] of Object.entries(required)) {
      if (!value) {
        throw new Error(`STORAGE_ENGINE=s3 requires ${varName} to be set.`);
      }
    }
  }

  if (env.STORAGE_ENGINE === "d1") {
    const required = {
      D1_ACCOUNT_ID: env.D1_ACCOUNT_ID,
      D1_DATABASE_ID: env.D1_DATABASE_ID,
      D1_API_TOKEN: env.D1_API_TOKEN,
    };
    for (const [varName, value] of Object.entries(required)) {
      if (!value) {
        throw new Error(`STORAGE_ENGINE=d1 requires ${varName} to be set.`);
      }
    }
  }

  if (env.AUTH_ENGINE === "google") {
    const required = {
      GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
      NEXTAUTH_SECRET: env.NEXTAUTH_SECRET,
    };
    for (const [varName, value] of Object.entries(required)) {
      if (!value) {
        throw new Error(`AUTH_ENGINE=google requires ${varName} to be set.`);
      }
    }
  }
}
