import { z } from "zod";
import dotenv from "dotenv";

// Ensure .env is loaded
dotenv.config();

const envSchema = z.object({
  APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().default("postgres://referee:referee@localhost:5432/referee"),
  PAYPAL_ENV: z.literal("sandbox", {
    errorMap: () => ({ message: "PAYPAL_ENV must be strictly 'sandbox'. Production is forbidden." }),
  }),
  PAYPAL_CLIENT_ID: z.string().min(1, "PAYPAL_CLIENT_ID is required"),
  PAYPAL_CLIENT_SECRET: z.string().min(1, "PAYPAL_CLIENT_SECRET is required"),
  PAYPAL_PLATFORM_EMAIL: z.string().email().optional().or(z.literal("")),
  KERNEL_API_KEY: z.string().optional().or(z.literal("")),
  LLM_PROVIDER: z.string().default("google"),
  LLM_MODEL: z.string().default("gemini-3.5-flash-lite"),
  LLM_API_KEY: z.string().optional().or(z.literal("")),
  GEMINI_API_KEY: z.string().optional().or(z.literal("")),
  INTERNAL_SWEEP_SECRET: z.string().default("referee-internal-sweep-secret-demo"),
  HUMAN_APPROVAL_THRESHOLD: z.coerce.number().default(300),
  DEMO_MODE: z
    .string()
    .optional()
    .default("true")
    .transform((val) => val === "true"),
  DEMO_TIME_SCALE: z.coerce.number().default(1440),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Invalid environment variables:", result.error.format());
    throw new Error(
      `Environment validation failed: ${result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`
    );
  }

  if (result.data.PAYPAL_ENV !== "sandbox") {
    throw new Error(`CRITICAL MONEY SAFETY ERROR: PAYPAL_ENV must be 'sandbox'. Got: ${result.data.PAYPAL_ENV}`);
  }

  return result.data;
}

export const env = validateEnv();

