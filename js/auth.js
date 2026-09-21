const SUPABASE_URL = "https://poghdicqjjrtxucuoqev.supabase.co";
const SUPABASE_KEY = "sb_publishable_-jDBMc58Msbi22Rys16pAQ_T3Q2CJ8I";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

/*
PRUEBA DE CONEXIÓN A SUPABASE
async function probarSupabase() {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
        console.error("❌ Error:", error);
        return;
    }

    console.log("✅ Supabase responde correctamente");
    console.log("Sesión actual:", data.session);
}

probarSupabase();
*/
