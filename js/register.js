/* =====================================================
   DOM
===================================================== */

const form = document.getElementById("registerForm");

const pass = document.getElementById("password");
const confirmPass = document.getElementById("confirmPassword");

const generatePass = document.getElementById("generatePassword");

const alertContainer =
    document.getElementById("alertContainer");

const alertMessage =
    document.getElementById("alertMessage");

const toggles = document.querySelectorAll(".toggle-password");

const passwordStrengthText =
    document.getElementById("passwordStrengthText");

const passwordStrengthBar =
    document.getElementById("passwordStrengthBar");


/* =====================================================
   PASSWORD REQUIREMENTS
===================================================== */

const requirementLength =
    document.getElementById("requirement-length");

const requirementUppercase =
    document.getElementById("requirement-uppercase");

const requirementLowercase =
    document.getElementById("requirement-lowercase");

const requirementNumber =
    document.getElementById("requirement-number");

const requirementSpecial =
    document.getElementById("requirement-special");


/* =====================================================
   PLAN
===================================================== */

const params = new URLSearchParams(window.location.search);

const plan = params.get("plan");


/*
    El usuario debe llegar al registro
    después de seleccionar un plan.
*/

const planesValidos = [
    "basic",
    "professional",
    "enterprise"
];

if (!planesValidos.includes(plan)) {
    window.location.href = "index.html";
}


/* =====================================================
   REGISTER
===================================================== */

form.addEventListener("submit", function (event) {

    event.preventDefault();


    /* Validación HTML */

    if (!form.checkValidity()) {

        form.reportValidity();

        return;
    }


    /* Validación de contraseñas */

    if (pass.value !== confirmPass.value) {

        showAlert("Las contraseñas no coinciden.");

        return;
    }


    /* Obtener datos */

    const datos = Object.fromEntries(
        new FormData(form)
    );


    /* Crear registro */

    const registro = {
        ...datos,
        plan
    };


    /* Guardar temporalmente
        Pendiente por guardar en supabase
     */

    sessionStorage.setItem(
        "registro",
        JSON.stringify(registro)
    );


    /* Continuar */

    window.location.href = "login.html";

});

function showAlert(message) {

    alertMessage.textContent = message;

    alertContainer.classList.add("active");

    setTimeout(() => {

        alertContainer.classList.remove("active");

    }, 3000);
}


/* =====================================================
   PASSWORD INPUT
===================================================== */

pass.addEventListener("input", function () {

    updatePasswordStrength(pass.value);

});


/* =====================================================
   PASSWORD GENERATOR
===================================================== */

generatePass.addEventListener("click", function () {

    createPassword();

    updatePasswordStrength(pass.value);

});


function createPassword() {

    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    const lowercase = "abcdefghijklmnopqrstuvwxyz";

    const numbers = "0123456789";

    const special = "!@#$%&*()_+?:{}[]";


    /*
        Garantizamos al menos un carácter
        de cada categoría.
    */

    let password = "";

    password += getRandomCharacter(uppercase);

    password += getRandomCharacter(lowercase);

    password += getRandomCharacter(numbers);

    password += getRandomCharacter(special);


    /*
        Completamos hasta 12 caracteres.
    */

    const allCharacters =
        uppercase +
        lowercase +
        numbers +
        special;


    while (password.length < 12) {

        password += getRandomCharacter(allCharacters);

    }


    /*
        Mezclamos los caracteres.
    */

    password = shufflePassword(password);


    /*
        Asignamos a ambos campos.
        Pendiente por guardar en supabase
    */

    pass.value = password;

    confirmPass.value = password;

}


function getRandomCharacter(characters) {

    const array = new Uint32Array(1);

    crypto.getRandomValues(array);

    return characters[
        array[0] % characters.length
    ];

}


function shufflePassword(password) {

    const characters = password.split("");

    const array = new Uint32Array(
        characters.length
    );

    crypto.getRandomValues(array);


    for (let i = characters.length - 1; i > 0; i--) {

        const randomIndex =
            array[i] % (i + 1);


        [
            characters[i],
            characters[randomIndex]
        ] = [
            characters[randomIndex],
            characters[i]
        ];

    }


    return characters.join("");

}


/* =====================================================
   SHOW / HIDE PASSWORD
===================================================== */

toggles.forEach(function (toggle) {

    toggle.addEventListener("click", function () {

        const targetId =
            toggle.dataset.target;

        const target =
            document.getElementById(targetId);


        if (target.type === "password") {

            target.type = "text";

            toggle.innerHTML =
                '<i data-lucide="eye-off"></i>';

        } else {

            target.type = "password";

            toggle.innerHTML =
                '<i data-lucide="eye"></i>';

        }


        lucide.createIcons();

    });

});


/* =====================================================
   PASSWORD STRENGTH
===================================================== */

function checkPasswordStrength(password) {

    let score = 0;


    /* Longitud */

    if (password.length >= 8) {

        score++;

    }


    /* 12 caracteres */

    if (password.length >= 12) {

        score++;

    }


    /* Minúscula */

    if (/[a-z]/.test(password)) {

        score++;

    }


    /* Mayúscula */

    if (/[A-Z]/.test(password)) {

        score++;

    }


    /* Número */

    if (/[0-9]/.test(password)) {

        score++;

    }


    /* Carácter especial */

    if (/[^A-Za-z0-9]/.test(password)) {

        score++;

    }


    return score;

}


/* =====================================================
   UPDATE PASSWORD STRENGTH
===================================================== */

function updatePasswordStrength(password) {

    const score =
        checkPasswordStrength(password);


    /* =============================================
       SIN CONTRASEÑA
    ============================================== */

    if (password.length === 0) {

        passwordStrengthText.textContent =
            "Sin contraseña";

        passwordStrengthBar.style.width =
            "0%";


        resetRequirements();

        return;
    }


    /* =============================================
       REQUIREMENTS
    ============================================== */

    updateRequirement(
        requirementLength,
        password.length >= 8
    );

    updateRequirement(
        requirementUppercase,
        /[A-Z]/.test(password)
    );

    updateRequirement(
        requirementLowercase,
        /[a-z]/.test(password)
    );

    updateRequirement(
        requirementNumber,
        /[0-9]/.test(password)
    );

    updateRequirement(
        requirementSpecial,
        /[^A-Za-z0-9]/.test(password)
    );


    /* =============================================
       STRENGTH
    ============================================== */

    if (score <= 2) {

        passwordStrengthText.textContent =
            "Débil";

        passwordStrengthBar.style.width =
            "33%";

    }

    else if (score <= 4) {

        passwordStrengthText.textContent =
            "Media";

        passwordStrengthBar.style.width =
            "66%";

    }

    else {

        passwordStrengthText.textContent =
            "Fuerte";

        passwordStrengthBar.style.width =
            "100%";

    }

}


/* =====================================================
   REQUIREMENT STATUS
===================================================== */

function updateRequirement(element, valid) {

    const icon =
        element.querySelector("svg");


    if (valid) {

        element.classList.add("valid");

        element.innerHTML =
            '<i data-lucide="circle-check"></i>' +
            element.textContent.trim();

    }

    else {

        element.classList.remove("valid");

        element.innerHTML =
            '<i data-lucide="circle"></i>' +
            element.textContent.trim();

    }


    lucide.createIcons();

}


/* =====================================================
   RESET REQUIREMENTS
===================================================== */

function resetRequirements() {

    updateRequirement(
        requirementLength,
        false
    );

    updateRequirement(
        requirementUppercase,
        false
    );

    updateRequirement(
        requirementLowercase,
        false
    );

    updateRequirement(
        requirementNumber,
        false
    );

    updateRequirement(
        requirementSpecial,
        false
    );

}














