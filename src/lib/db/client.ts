import { createClient } from "@supabase/supabase-js";

// Dynamically load environment variables if running in a test/standalone server environment
if (typeof window === "undefined" && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
  try {
    const fs = require("fs");
    const path = require("path");
    const envPath = path.join(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, "utf8");
      envContent.split(/\r?\n/).forEach((line: string) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const equalsIndex = trimmed.indexOf("=");
          if (equalsIndex !== -1) {
            const key = trimmed.slice(0, equalsIndex).trim();
            let value = trimmed.slice(equalsIndex + 1).trim();
            if (value.startsWith('"') && value.endsWith('"')) {
              value = value.slice(1, -1);
            } else if (value.startsWith("'") && value.endsWith("'")) {
              value = value.slice(1, -1);
            }
            if (!process.env[key]) {
              process.env[key] = value;
            }
          }
        }
      });
    }
  } catch (e) {
    console.warn("Could not load .env.local file:", e);
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Standard client (safe for both browser and server)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client (server-side only, bypasses RLS)
export const supabaseAdmin = typeof window === "undefined"
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

/**
 * Returns the appropriate database client based on the context.
 * Server actions/handlers processing system workflows should use the admin client
 * to ensure integrity and audit trailing.
 */
export function getDbClient(useAdmin = false) {
  if (useAdmin) {
    if (!supabaseAdmin) {
      throw new Error("Admin database client can only be initialized on the server side.");
    }
    return supabaseAdmin;
  }
  return supabase;
}
