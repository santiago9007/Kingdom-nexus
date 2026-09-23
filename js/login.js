const SUPABASE_URL = "https://poghdicqjjrtxucuoqev.supabase.co";
const SUPABASE_KEY = "sb_publishable_-jDBMc58Msbi22Rys16pAQ_T3Q2CJ8I";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

/* DOM */

const form = document.getElementById("loginForm");
const email = document.getElementById("email");
const password = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");
const alertContainer = document.getElementById("alertContainer");
const alertMessage = document.getElementById("alertMessage");

/* ALERT */

function showAlert(message){
    alertMessage.textContent = message;

    alertContainer.classList.add("active");

    setTimeout(()=> {
        alertContainer.classList.remove("active");
    }, 3000)
}

/* VER/ESCONDER CONTRASEÑA */
togglePassword.addEventListener("click", function(){
    if(password.type === "password"){
        password.type = "text";

        togglePassword.innerHTML = '<i data-lucide="eye-off"></i>'
    }else {
        password.type = "password";

        togglePassword.innerHTML = `<i data-lucide="eye"></i>`
    }

    lucide.createIcons();
});

/* LOGIN */

form.addEventListener("submit", async function(event){
    event.preventDefault();

    /* VALIDACIÓN HTML */

    if(!form.checkValidity()){
        form.reportValidity();

        return;
    }

    /* OBTENER REGISTRO */

    const emailValue = email.value.trim().toLowerCase();
    const passwordValue = password.value;

    const { data: loginData, error: loginError } = await supabaseClient.auth.signInWithPassword({
        email: emailValue,
        password: passwordValue
    });

    //ERROR

    if(loginError){
        showAlert("Correo o contraseña incorrectos");
        return;
    }

    //USUARIO AUTENTICADO

    const user = loginData.user;

    console.log("Usuario", user)

    //BUSCAR DATOS EN REGISTRO

    const { data: registerData, error: registerError } = await supabaseClient
            .from("register")
            .select("id, name, lastname, email, plans")
            .eq("id", user.id)
            .single()

    //ERROR AL BUSCAR EL REGISTRO

    if(registerError){
        console.error(registerError);

        showAlert("No encontramos la información de tu cuenta")

        /* CERRAMOS LA SESIÓN PORQUE EL USUARIO NO TIENE REGISTRO ASOCIADO */

        await supabaseClient.auth.signOut();
        return;
    }
    
   
    const destinosPorPlan = {
        basic: "../planBasico/dashboard.html",
        professional: "../planProfesional/dashboard.html",
        enterprise: "../planEmpresarial/dashboard.html"
    };

     //REDIRECCIÓN

     const destino = destinosPorPlan[registerData.plans]

     if(!destino){
        showAlert("El plan de tu cuenta no es válido")
     }

    window.location.href = destino
})
