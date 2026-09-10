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

form.addEventListener("submit", function(event){
    event.preventDefault();

    /* VALIDACIÓN HTML */

    if(!form.checkValidity()){
        form.reportValidity();

        return;
    }

    /* OBTENER REGISTRO */

    const registro = JSON.parse(sessionStorage.getItem("registro"));

    if(!registro){
        showAlert("No encontramos una cuenta registrada.");

        return;
    }

    /* VALIDAR CREDENCIALES */

    const emailCorrecto = email.value.trim().toLowerCase() === registro.email.trim().toLowerCase();

    const passwordCorrecto = password.value === registro.password;

    if(!emailCorrecto || !passwordCorrecto){
        showAlert("Correo o contraseña incorrecto");

        return;
    }

    /* LOGIN CORRECTO */

    sessionStorage.setItem("sesionActiva",
        "true"
    );

    sessionStorage.setItem("authUser", JSON.stringify(registro));

    const destinosPorPlan = {
        basic: "../planBasico/dashboard.html",
        professional: "../planProfesional/dashboard.html",
        enterprise: "../planEmpresarial/dashboard.html"
    };

    window.location.href = destinosPorPlan[registro.plan] || "dashboard.html";
})
