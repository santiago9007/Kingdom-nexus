const registro = JSON.parse(sessionStorage.getItem("registro"));
const backToRegister = document.getElementById("backToRegister");

const planes = {
    basic: {
        name: "Plan Básico",
        price: "$49.900",
        features: [
            "1 sucursal",
            "Gestión de productos",
            "Control de inventario",
            "Alertas de stock bajo",
            "Entradas y salidas",
            "Hasta 2 usuarios"
        ]
    },

    professional: {
        name: "Plan Profesional",
        price: "$99.900",
        features: [
            "Hasta 5 sucursales",
            "Gestión completa de productos",
            "Reportes avanzados",
            "Clientes y proveedores",
            "Compras y ventas",
            "Hasta 10 usuarios"
        ]
    },

    enterprise: {
        name: "Plan Empresarial",
        price: "$199.900",
        features: [
            "Sucursales ilimitadas",
            "Multiusuario avanzado",
            "Auditoría y permisos",
            "Soporte prioritario",
            "Reportes corporativos",
            "Integraciones a medida"
        ]
    }
};

if (!registro) {
    window.location.href = "register.html";
} else {

    const planName = document.getElementById("selectedPlanName");
    const planPrice = document.getElementById("selectedPlanPrice");
    const nextPaymentPrice = document.getElementById("nextPaymentPrice");
    const planFeaturesList = document.getElementById("planFeaturesList");
    const paymentForm = document.getElementById("paymentForm");

    const planSeleccionado = planes[registro.plan] || planes.basic;

    if (!planSeleccionado) {
        window.location.href = "index.html";
    } else {

        planName.textContent = planSeleccionado.name;
        planPrice.textContent = planSeleccionado.price;
        nextPaymentPrice.textContent = `${planSeleccionado.price}/mes`;

        if (planFeaturesList) {
            planFeaturesList.innerHTML = planSeleccionado.features
                .slice(0, 4)
                .map((feature) => `<li>${feature}</li>`)
                .join("");
        }

        if (backToRegister) {
            backToRegister.href = `register.html?plan=${registro.plan || "basic"}`;
        }

        if (paymentForm) {
            paymentForm.addEventListener("submit", function (event) {
                event.preventDefault();

                if (!paymentForm.checkValidity()) {
                    paymentForm.reportValidity();
                    return;
                }

                const subscription = {
                    email: registro.email,
                    plan: registro.plan || "basic",
                    planName: planSeleccionado.name,
                    price: planSeleccionado.price,
                    status: "active",
                    startedAt: new Date().toISOString()
                };

                sessionStorage.setItem("authUser", JSON.stringify({
                    email: registro.email,
                    plan: registro.plan || "basic",
                    planName: planSeleccionado.name
                }));

                sessionStorage.setItem("subscription", JSON.stringify(subscription));
                window.location.href = "dashboard.html";
            });
        }
    }
}