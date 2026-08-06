import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const CONFIG_ERROR = {
  message:
    "Supabase n'est pas configuré : remplis .env.local avec NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY (voir .env.local.example), puis redémarre le serveur.",
};

// Client de secours utilisé tant que les variables d'environnement ne sont
// pas renseignées, pour que l'app s'affiche (avec des listes vides) au lieu
// de planter au chargement. Imite juste assez l'API supabase-js pour que
// tous les appels .from(...).select()/.insert()/.update()/.eq()... et
// .channel(...).on(...).subscribe() utilisés dans l'app ne lèvent pas.
function createStubClient() {
  function stubResult() {
    const promise = Promise.resolve({ data: [], error: CONFIG_ERROR });
    return new Proxy(promise, {
      get(target, prop, receiver) {
        if (prop in target) {
          const value = Reflect.get(target, prop, target);
          return typeof value === "function" ? value.bind(target) : value;
        }
        return () => stubResult();
      },
    });
  }

  return {
    from() {
      return new Proxy(
        {},
        {
          get() {
            return () => stubResult();
          },
        }
      );
    },
    channel() {
      return {
        on() {
          return this;
        },
        subscribe() {
          return { unsubscribe() {} };
        },
      };
    },
    removeChannel() {},
    auth: {
      async getSession() {
        return { data: { session: null }, error: null };
      },
      async signInWithPassword() {
        return { data: { session: null, user: null }, error: CONFIG_ERROR };
      },
      async signOut() {
        return { error: null };
      },
      onAuthStateChange() {
        return { data: { subscription: { unsubscribe() {} } } };
      },
    },
    storage: {
      from() {
        return {
          async upload() {
            return { data: null, error: CONFIG_ERROR };
          },
          getPublicUrl() {
            return { data: { publicUrl: "" } };
          },
        };
      },
    },
  };
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createStubClient();

if (!isSupabaseConfigured && typeof window !== "undefined") {
  console.warn(CONFIG_ERROR.message);
}

// ---------------------------------------------------------------------
// Authentification — chaque déploiement (un par restaurant) se connecte
// automatiquement avec un compte Supabase Auth fixe qui lui est propre.
// C'est cette identité, pas la clé anon, qui détermine désormais quelles
// données Row Level Security laisse voir/modifier (voir supabase/schema.sql).
// ---------------------------------------------------------------------

const RESTAURANT_SERVICE_EMAIL = process.env.NEXT_PUBLIC_RESTAURANT_SERVICE_EMAIL;
const RESTAURANT_SERVICE_PASSWORD = process.env.NEXT_PUBLIC_RESTAURANT_SERVICE_PASSWORD;

export const isRestaurantAuthConfigured = Boolean(RESTAURANT_SERVICE_EMAIL && RESTAURANT_SERVICE_PASSWORD);

let authReadyPromise = null;

// Idempotent : ne se connecte qu'une fois par session navigateur (la session
// Supabase persiste ensuite toute seule d'un rechargement à l'autre).
export function ensureSignedIn() {
  if (!isSupabaseConfigured || !isRestaurantAuthConfigured) return Promise.resolve();
  if (!authReadyPromise) {
    authReadyPromise = supabase.auth.getSession().then(async ({ data }) => {
      if (data?.session) return;
      const { error } = await supabase.auth.signInWithPassword({
        email: RESTAURANT_SERVICE_EMAIL,
        password: RESTAURANT_SERVICE_PASSWORD,
      });
      if (error) throw error;
    });
  }
  return authReadyPromise;
}
