// Manipular DOM
const user = document.getElementById("userName");
const email = document.getElementById("userEmail");

//Obtener los datos desde register.js
const datos = sessionStorage.getItem("registro");

//Condición para almacenar los datos en JSON y pasarlos a los campos correspondientes
if(datos){
    const info = JSON.parse(datos);

    user.textContent = `${info.firstName} ${info.lastName}`;
    email.textContent = info.email;
}

