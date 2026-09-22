(function () {
    "use strict";

    const TABLA_PRODUCTOS = "products";
    const COLUMNAS_PRODUCTO = [
        "id",
        "name",
        "sku",
        "description",
        "category",
        "unit",
        "sales_price",
        "cost",
        "min_stock",
        "quantity",
        "is_active"
    ].join(", ");
    const COLUMNAS_TABLA = 7;

    const formatoMoneda = new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 2
    });

    const formatoNumero = new Intl.NumberFormat("es-CO", {
        maximumFractionDigits: 2
    });

    const elementos = {
        feedback: document.getElementById("productosFeedback"),
        nuevo: document.getElementById("nuevoProducto"),
        form: document.getElementById("productoForm"),
        formTitulo: document.getElementById("productoFormTitulo"),
        guardar: document.getElementById("guardarProducto"),
        guardarTexto: document.getElementById("guardarTexto"),
        cancelar: document.getElementById("cancelarProducto"),
        buscar: document.getElementById("buscarProducto"),
        filtroEstado: document.getElementById("filtroEstado"),
        filtroCategoria: document.getElementById("filtroCategoria"),
        tabla: document.getElementById("productosTabla"),
        campoStockInicial: document.getElementById("campoStockInicial"),
        listaCategorias: document.getElementById("categoriasProducto"),
        campos: {
            name: document.getElementById("productoNombre"),
            sku: document.getElementById("productoSku"),
            category: document.getElementById("productoCategoria"),
            unit: document.getElementById("productoUnidad"),
            sales_price: document.getElementById("productoPrecioVenta"),
            cost: document.getElementById("productoPrecioCosto"),
            min_stock: document.getElementById("productoStockMinimo"),
            initial_stock: document.getElementById("productoStockInicial"),
            description: document.getElementById("productoDescripcion")
        },
        errores: {
            name: document.getElementById("errorNombre"),
            sku: document.getElementById("errorSku"),
            sales_price: document.getElementById("errorPrecioVenta"),
            cost: document.getElementById("errorPrecioCosto"),
            min_stock: document.getElementById("errorStockMinimo"),
            initial_stock: document.getElementById("errorStockInicial")
        }
    };

    let productos = [];
    let productoEditandoId = null;
    let procesoEnCursoId = null;
    let guardando = false;
    let filtroTexto = "";
    let filtroEstado = "todos";
    let filtroCategoria = "todas";
    let temporizadorFeedback = null;

    const cliente = obtenerCliente();
    const usuario = obtenerUsuario();

    function obtenerCliente() {
        try {
            const candidato = typeof supabaseClient !== "undefined" ? supabaseClient : null;
            return candidato && typeof candidato.from === "function" ? candidato : null;
        } catch (error) {
            return null;
        }
    }

    function obtenerUsuario() {
        try {
            const claves = ["authUser", "registro"];

            for (const clave of claves) {
                const valor = sessionStorage.getItem(clave);
                if (!valor) continue;

                const datos = JSON.parse(valor);
                if (!datos || typeof datos.email !== "string") continue;

                const email = datos.email.trim().toLowerCase();
                if (!email) continue;

                return { email };
            }
        } catch (error) {
            return null;
        }

        return null;
    }

    function iniciar() {
        enlazarEventos();

        if (!cliente) {
            deshabilitarAcciones();
            mostrarFeedback("error", "No se pudo inicializar la conexión con el servicio de datos. Recarga la página e intenta de nuevo.");
            renderEstadoTabla("No se pudo inicializar el servicio de datos.");
            return;
        }

        if (!usuario) {
            deshabilitarAcciones();
            mostrarFeedback("error", "Tu sesión no está activa. Inicia sesión para gestionar productos.");
            renderEstadoTabla("Tu sesión no está activa.", { enlaceLogin: true });
            return;
        }

        cargarProductos();
    }

    function enlazarEventos() {
        elementos.nuevo.addEventListener("click", abrirFormularioNuevo);
        elementos.form.addEventListener("submit", manejarEnvio);
        elementos.cancelar.addEventListener("click", cerrarFormulario);
        elementos.buscar.addEventListener("input", manejarFiltros);
        elementos.filtroEstado.addEventListener("change", manejarFiltros);
        elementos.filtroCategoria.addEventListener("change", manejarFiltros);
        elementos.tabla.addEventListener("click", manejarAccionTabla);
    }

    async function cargarProductos() {
        if (!cliente || !usuario) return;

        renderEstadoTabla("Cargando productos…");

        const { data, error } = await cliente
            .from(TABLA_PRODUCTOS)
            .select(COLUMNAS_PRODUCTO)
            .order("name", { ascending: true });

        if (error) {
            productos = [];
            mostrarFeedback("error", `No se pudieron cargar los productos. ${traducirError(error)}`);
            renderEstadoTabla("No se pudieron cargar los productos.", {
                reintentar: cargarProductos
            });
            return;
        }

        productos = Array.isArray(data) ? data : [];
        renderTodo();
    }

    function manejarFiltros() {
        filtroTexto = elementos.buscar.value.trim().toLowerCase();
        filtroEstado = elementos.filtroEstado.value;
        filtroCategoria = elementos.filtroCategoria.value;
        renderTabla();
    }

    function manejarAccionTabla(evento) {
        const boton = evento.target.closest("button[data-accion]");
        if (!boton || !elementos.tabla.contains(boton)) return;

        const id = boton.dataset.id;
        if (!id) return;

        const producto = productos.find((item) => item.id === id);
        if (!producto) return;

        if (boton.dataset.accion === "editar") {
            abrirFormularioEdicion(producto);
            return;
        }

        alternarEstado(producto);
    }

    function abrirFormularioNuevo() {
        if (guardando) return;

        productoEditandoId = null;
        elementos.form.reset();
        mostrarErrores({});
        elementos.formTitulo.textContent = "Nuevo producto";
        elementos.campoStockInicial.hidden = false;
        elementos.form.hidden = false;
        elementos.campos.name.focus();
    }

    function abrirFormularioEdicion(producto) {
        if (guardando) return;

        productoEditandoId = producto.id;
        rellenarFormulario(producto);
        mostrarErrores({});
        elementos.formTitulo.textContent = "Editar producto";
        elementos.campoStockInicial.hidden = true;
        elementos.form.hidden = false;
        elementos.campos.name.focus();
    }

    function cerrarFormulario() {
        if (guardando) return;

        ocultarFormulario();
        elementos.nuevo.focus();
    }

    function ocultarFormulario() {
        elementos.form.hidden = true;
        elementos.form.reset();
        productoEditandoId = null;
        mostrarErrores({});
    }

    function rellenarFormulario(producto) {
        const campos = elementos.campos;

        campos.name.value = producto.name ?? "";
        campos.sku.value = producto.sku ?? "";
        campos.category.value = producto.category ?? "";
        campos.unit.value = producto.unit ?? "";
        campos.sales_price.value = valorInput(producto.sales_price);
        campos.cost.value = valorInput(producto.cost);
        campos.min_stock.value = valorInput(producto.min_stock);
        campos.initial_stock.value = valorInput(producto.initial_stock);
        campos.description.value = producto.description ?? "";
    }

    async function manejarEnvio(evento) {
        evento.preventDefault();

        if (guardando || !cliente || !usuario) return;

        const datos = datosFormulario();
        const errores = validarProducto(datos);
        mostrarErrores(errores);

        if (Object.keys(errores).length > 0) return;

        establecerGuardando(true);

        try {
            if (productoEditandoId) {
                await actualizarProducto(productoEditandoId, datos);
            } else {
                await crearProducto(datos);
            }

            ocultarFormulario();
            renderTodo();
        } catch (error) {
            mostrarFeedback("error", traducirError(error));
        } finally {
            establecerGuardando(false);
        }
    }

    async function crearProducto(datos) {
        const payload = {
            name: datos.name,
            sku: datos.sku,
            description: datos.description,
            category: datos.category,
            unit: datos.unit,
            sales_price: datos.sales_price,
            cost: datos.cost,
            min_stock: datos.min_stock,
            quantity: datos.initial_stock,
            initial_stock: datos.initial_stock
        };

        const { data, error } = await cliente
            .from(TABLA_PRODUCTOS)
            .insert(payload)
            .select(COLUMNAS_PRODUCTO)
            .single();

        if (error) throw error;

        productos = [...productos, data].sort(ordenarPorNombre);
        mostrarFeedback("success", "Producto creado correctamente.");
    }

    async function actualizarProducto(id, datos) {
        const { initial_stock, ...cambios } = datos;

        const { data, error } = await cliente
            .from(TABLA_PRODUCTOS)
            .update(cambios)
            .eq("id", id)
            .select(COLUMNAS_PRODUCTO)
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            ocultarFormulario();
            mostrarFeedback("error", "El producto ya no existe o no tienes acceso a él. Actualizamos el listado.");
            await cargarProductos();
            return;
        }

        productos = productos.map((producto) => (producto.id === data.id ? data : producto));
        mostrarFeedback("success", "Producto actualizado correctamente.");
    }

    async function alternarEstado(producto) {
        if (procesoEnCursoId || guardando || !cliente || !usuario) return;

        procesoEnCursoId = producto.id;
        actualizarBotonesTabla();

        try {
            const { data, error } = await cliente
                .from(TABLA_PRODUCTOS)
                .update({ is_active: !producto.is_active })
                .eq("id", producto.id)
                .select(COLUMNAS_PRODUCTO)
                .maybeSingle();

            if (error) throw error;

            if (!data) {
                mostrarFeedback("error", "El producto ya no existe o no tienes acceso a él. Actualizamos el listado.");
                await cargarProductos();
                return;
            }

            productos = productos.map((item) => (item.id === data.id ? data : item));
            mostrarFeedback("success", data.is_active ? "Producto activado." : "Producto desactivado.");
            renderTabla();
        } catch (error) {
            mostrarFeedback("error", traducirError(error));
        } finally {
            procesoEnCursoId = null;
            actualizarBotonesTabla();
        }
    }

    function datosFormulario() {
        const campos = elementos.campos;

        return {
            name: campos.name.value.trim(),
            sku: campos.sku.value.trim().toUpperCase(),
            category: valorOpcional(campos.category.value),
            unit: valorOpcional(campos.unit.value),
            sales_price: parsearNumero(campos.sales_price.value),
            cost: parsearNumero(campos.cost.value),
            min_stock: parsearNumero(campos.min_stock.value),
            initial_stock: parsearNumero(campos.initial_stock.value),
            description: valorOpcional(campos.description.value)
        };
    }

    function validarProducto(datos) {
        const errores = {};

        if (!datos.name) {
            errores.name = "El nombre es obligatorio.";
        } else if (datos.name.length > 120) {
            errores.name = "El nombre no puede superar 120 caracteres.";
        }

        if (!datos.sku) {
            errores.sku = "El SKU es obligatorio.";
        } else if (datos.sku.length > 40) {
            errores.sku = "El SKU no puede superar 40 caracteres.";
        }

        validarNumero(datos.sales_price, "sales_price", "El precio de venta", errores);
        validarNumero(datos.cost, "cost", "El precio de costo", errores);
        validarNumero(datos.min_stock, "min_stock", "El stock mínimo", errores);

        if (!productoEditandoId) {
            validarNumero(datos.initial_stock, "initial_stock", "El stock inicial", errores);
        }

        return errores;
    }

    function validarNumero(valor, campo, etiqueta, errores) {
        if (!Number.isFinite(valor)) {
            errores[campo] = `${etiqueta} debe ser un número válido.`;
            return;
        }

        if (valor < 0) {
            errores[campo] = `${etiqueta} no puede ser negativo.`;
        }
    }

    function mostrarErrores(errores) {
        Object.keys(elementos.errores).forEach((campo) => {
            const nodo = elementos.errores[campo];
            const input = elementos.campos[campo];
            const mensaje = errores[campo];

            nodo.textContent = mensaje || "";
            nodo.hidden = !mensaje;

            if (!input) return;

            if (mensaje) {
                input.setAttribute("aria-invalid", "true");
            } else {
                input.removeAttribute("aria-invalid");
            }
        });

        const primerCampo = Object.keys(errores)[0];
        if (primerCampo && elementos.campos[primerCampo]) {
            elementos.campos[primerCampo].focus();
        }
    }

    function establecerGuardando(activo) {
        guardando = activo;
        elementos.guardar.disabled = activo;
        elementos.cancelar.disabled = activo;
        elementos.nuevo.disabled = activo;
        elementos.guardarTexto.textContent = activo ? "Guardando…" : "Guardar producto";
        actualizarBotonesTabla();
    }

    function actualizarBotonesTabla() {
        elementos.tabla.querySelectorAll("button").forEach((boton) => {
            boton.disabled = guardando || Boolean(procesoEnCursoId);
        });
    }

    function deshabilitarAcciones() {
        [elementos.nuevo, elementos.guardar, elementos.cancelar].forEach((boton) => {
            if (boton) boton.disabled = true;
        });

        [elementos.buscar, elementos.filtroEstado, elementos.filtroCategoria].forEach((control) => {
            if (control) control.disabled = true;
        });
    }

    function renderTodo() {
        renderCategorias();
        renderTabla();
    }

    function renderCategorias() {
        const categorias = [
            ...new Set(
                productos
                    .map((producto) => (typeof producto.category === "string" ? producto.category.trim() : ""))
                    .filter(Boolean)
            )
        ].sort((a, b) => a.localeCompare(b, "es"));

        const seleccionPrevia = elementos.filtroCategoria.value;
        const fragmento = document.createDocumentFragment();
        const opcionTodas = document.createElement("option");
        opcionTodas.value = "todas";
        opcionTodas.textContent = "Todas";
        fragmento.append(opcionTodas);

        categorias.forEach((categoria) => {
            const opcion = document.createElement("option");
            opcion.value = categoria;
            opcion.textContent = categoria;
            fragmento.append(opcion);
        });

        elementos.filtroCategoria.replaceChildren(fragmento);
        elementos.filtroCategoria.value = categorias.includes(seleccionPrevia) ? seleccionPrevia : "todas";
        filtroCategoria = elementos.filtroCategoria.value;

        if (elementos.listaCategorias) {
            const fragmentoCategorias = document.createDocumentFragment();

            categorias.forEach((categoria) => {
                const opcion = document.createElement("option");
                opcion.value = categoria;
                fragmentoCategorias.append(opcion);
            });

            elementos.listaCategorias.replaceChildren(fragmentoCategorias);
        }
    }

    function renderTabla() {
        if (productos.length === 0) {
            renderEstadoTabla("Aún no tienes productos. Usa «Nuevo producto» para crear el primero.");
            return;
        }

        const visibles = productosFiltrados();

        if (visibles.length === 0) {
            renderEstadoTabla("No hay productos que coincidan con la búsqueda o los filtros.");
            return;
        }

        const fragmento = document.createDocumentFragment();
        visibles.forEach((producto) => fragmento.append(construirFila(producto)));
        elementos.tabla.replaceChildren(fragmento);
        dibujarIconos();
    }

    function productosFiltrados() {
        return productos.filter((producto) => {
            if (filtroEstado === "activos" && producto.is_active === false) return false;
            if (filtroEstado === "inactivos" && producto.is_active !== false) return false;

            if (filtroCategoria !== "todas" && (producto.category ?? "") !== filtroCategoria) return false;

            if (!filtroTexto) return true;

            const contenido = [producto.name, producto.sku, producto.category, producto.description]
                .filter((valor) => typeof valor === "string")
                .join(" ")
                .toLowerCase();

            return contenido.includes(filtroTexto);
        });
    }

    function construirFila(producto) {
        const fila = document.createElement("tr");
        const nombreProducto = texto(producto.name, "producto");

        const celdaNombre = document.createElement("td");
        const nombre = document.createElement("strong");
        nombre.textContent = texto(producto.name, "—");
        celdaNombre.append(nombre);

        if (typeof producto.description === "string" && producto.description.trim()) {
            const descripcion = document.createElement("small");
            descripcion.className = "row-note";
            descripcion.textContent = producto.description;
            celdaNombre.append(descripcion);
        }

        const celdaSku = document.createElement("td");
        celdaSku.textContent = texto(producto.sku, "—");

        const celdaCategoria = document.createElement("td");
        celdaCategoria.textContent = texto(producto.category, "Sin categoría");

        const celdaPrecio = document.createElement("td");
        celdaPrecio.textContent = formatearMoneda(producto.sales_price);

        const celdaStock = document.createElement("td");
        celdaStock.textContent = formatearNumero(producto.quantity);

        const activo = producto.is_active !== false;
        const celdaEstado = document.createElement("td");
        const pill = document.createElement("span");
        pill.className = `status-pill ${activo ? "good" : "alert"}`;
        pill.textContent = activo ? "Activo" : "Inactivo";
        celdaEstado.append(pill);

        const celdaAcciones = document.createElement("td");
        const acciones = document.createElement("div");
        acciones.className = "table-actions";
        acciones.append(
            crearBotonAccion("editar", "pencil", `Editar ${nombreProducto}`, producto.id),
            crearBotonAccion(
                activo ? "desactivar" : "activar",
                activo ? "toggle-right" : "toggle-left",
                `${activo ? "Desactivar" : "Activar"} ${nombreProducto}`,
                producto.id
            )
        );
        celdaAcciones.append(acciones);

        fila.append(celdaNombre, celdaSku, celdaCategoria, celdaPrecio, celdaStock, celdaEstado, celdaAcciones);

        return fila;
    }

    function crearBotonAccion(accion, icono, etiqueta, id) {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "icon-button";
        boton.dataset.accion = accion;
        boton.dataset.id = id;
        boton.setAttribute("aria-label", etiqueta);
        boton.disabled = guardando || Boolean(procesoEnCursoId);

        const iconoNodo = document.createElement("i");
        iconoNodo.setAttribute("data-lucide", icono);
        iconoNodo.setAttribute("aria-hidden", "true");
        boton.append(iconoNodo);

        return boton;
    }

    function renderEstadoTabla(mensaje, opciones = {}) {
        const fila = document.createElement("tr");
        const celda = document.createElement("td");
        celda.colSpan = COLUMNAS_TABLA;
        celda.className = "table-state";
        celda.textContent = mensaje;

        if (opciones.reintentar) {
            const boton = document.createElement("button");
            boton.type = "button";
            boton.className = "secondary-button";
            boton.textContent = "Reintentar";
            boton.addEventListener("click", opciones.reintentar);
            celda.append(document.createElement("br"), boton);
        }

        if (opciones.enlaceLogin) {
            const enlace = document.createElement("a");
            enlace.className = "secondary-button";
            enlace.href = "../login.html";
            enlace.textContent = "Iniciar sesión";
            celda.append(document.createElement("br"), enlace);
        }

        fila.append(celda);
        elementos.tabla.replaceChildren(fila);
    }

    function mostrarFeedback(tipo, mensaje) {
        if (!elementos.feedback) return;

        if (temporizadorFeedback) {
            clearTimeout(temporizadorFeedback);
            temporizadorFeedback = null;
        }

        elementos.feedback.textContent = mensaje;
        elementos.feedback.className = `module-feedback ${tipo}`;
        elementos.feedback.hidden = false;

        if (tipo === "success") {
            temporizadorFeedback = setTimeout(() => {
                elementos.feedback.hidden = true;
            }, 4000);
        }
    }

    function traducirError(error) {
        const codigo = error && error.code;
        const mensaje = error && typeof error.message === "string" ? error.message : "";

        if (codigo === "23505") return "Ya existe un producto con ese SKU.";
        if (codigo === "42501") return "Las políticas RLS bloquean Productos hasta que exista autenticación real. Revisa docs/productos-supabase.md.";
        if (codigo === "23502") return "Falta un dato obligatorio del producto.";
        if (codigo === "23514") return "Alguno de los valores no cumple las reglas de la base de datos.";
        if (codigo === "42703" || codigo === "PGRST204") return "El modelo de datos del catálogo no coincide con la base de datos (docs/productos-supabase.md).";
        if (!navigator.onLine) return "Sin conexión a internet. Revisa tu red e intenta de nuevo.";
        if (/fetch|network|timeout|load failed/i.test(mensaje)) return "No pudimos comunicarnos con el servidor. Intenta de nuevo en unos segundos.";

        return "No pudimos completar la operación. Intenta de nuevo.";
    }

    function parsearNumero(valor) {
        const texto = String(valor ?? "").trim();
        if (!texto) return 0;

        const numero = Number(texto);
        return Number.isFinite(numero) ? numero : NaN;
    }

    function valorOpcional(valor) {
        const texto = String(valor ?? "").trim();
        return texto || null;
    }

    function valorInput(valor) {
        return valor === null || valor === undefined || valor === "" ? "" : String(valor);
    }

    function texto(valor, respaldo) {
        return typeof valor === "string" && valor.trim() ? valor : respaldo;
    }

    function formatearMoneda(valor) {
        if (valor === null || valor === undefined || valor === "") return "—";

        const numero = Number(valor);
        return Number.isFinite(numero) ? formatoMoneda.format(numero) : "—";
    }

    function formatearNumero(valor) {
        if (valor === null || valor === undefined || valor === "") return "—";

        const numero = Number(valor);
        return Number.isFinite(numero) ? formatoNumero.format(numero) : "—";
    }

    function ordenarPorNombre(a, b) {
        return String(a.name ?? "").localeCompare(String(b.name ?? ""), "es");
    }

    function dibujarIconos() {
        if (window.lucide && typeof window.lucide.createIcons === "function") {
            window.lucide.createIcons();
        }
    }

    if (elementos.tabla && elementos.form && elementos.nuevo) {
        iniciar();
    }
})();
