const supplierForm = document.getElementById('supplierForm');
const supplierEditId = document.getElementById('supplierEditId');
const supplierMessage = document.getElementById('supplierMessage');
const supplierTableBody = document.getElementById('supplierTableBody');
const cancelSupplierEdit = document.getElementById('cancelSupplierEdit');
const submitSupplierButton = document.getElementById('submitSupplierButton');

const suppliersService = window.KingdomNexus?.suppliers || window.suppliers;

function showSupplierMessage(message, type = 'info') {
  if (!supplierMessage) {
    return;
  }

  supplierMessage.textContent = message;
  supplierMessage.className = `supplier-message visible ${type}`;
}

function resetSupplierForm() {
  supplierForm.reset();
  supplierEditId.value = '';
  submitSupplierButton.textContent = 'Guardar proveedor';
  cancelSupplierEdit.hidden = true;
}

function getSupplierPayload() {
  return {
    name: document.getElementById('supplierName').value.trim(),
    nit: document.getElementById('supplierTaxId').value.trim(),
    contact_person: document.getElementById('supplierContactPerson').value.trim(),
    email: document.getElementById('supplierEmail').value.trim(),
    phone: document.getElementById('supplierPhone').value.trim(),
    address: document.getElementById('supplierAddress').value.trim(),
    city: document.getElementById('supplierCity').value.trim(),
    notes: document.getElementById('supplierNotes').value.trim(),
    is_active: true
  };
}

function renderSuppliers(rows = []) {
  if (!supplierTableBody) {
    return;
  }

  if (!rows.length) {
    supplierTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-row">Sin proveedores cargados.</td>
      </tr>
    `;
    return;
  }

  supplierTableBody.innerHTML = rows
    .map((supplier) => {
      const statusLabel = supplier.is_active ? 'Activo' : 'Inactivo';
      const statusClass = supplier.is_active ? 'active' : 'inactive';

      return `
        <tr>
          <td>${supplier.name || '-'}</td>
          <td>${supplier.nit || '-'}</td>
          <td>${supplier.contact_person || '-'}</td>
          <td>${supplier.email || '-'}</td>
          <td>${supplier.city || '-'}</td>
          <td>
            <span class="status-chip ${statusClass}">${statusLabel}</span>
          </td>
          <td>
            <div class="supplier-actions-cell">
              <button class="icon-button edit" type="button" data-action="edit" data-id="${supplier.id}">
                Editar
              </button>
              <button class="icon-button delete" type="button" data-action="delete" data-id="${supplier.id}">
                Eliminar
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
}

async function loadSuppliers() {
  if (!suppliersService) {
    showSupplierMessage('No se pudo inicializar el servicio de proveedores.', 'error');
    return;
  }

  try {
    showSupplierMessage('Cargando proveedores...', 'info');
    const suppliers = await suppliersService.list();

    renderSuppliers(suppliers);
    showSupplierMessage(`Se cargaron ${suppliers.length} proveedores.`, 'success');
  } catch (error) {
    console.error(error);

    const status = error?.status || error?.code;
    const message = status === 403 || status === '42501'
      ? 'Supabase bloqueó la consulta por políticas RLS o porque la tabla no existe. Revisa la tabla public.suppliers y sus permisos.'
      : error?.message || 'Error al cargar proveedores.';

    showSupplierMessage(message, 'error');
  }
}

async function handleSupplierSubmit(event) {
  event.preventDefault();

  if (!suppliersService) {
    showSupplierMessage('El servicio de proveedores no está disponible.', 'error');
    return;
  }

  const payload = getSupplierPayload();

  if (!payload.name) {
    showSupplierMessage('El nombre del proveedor es obligatorio.', 'error');
    return;
  }

  try {
    if (supplierEditId.value) {
      await suppliersService.update(supplierEditId.value, payload);
      showSupplierMessage('Proveedor actualizado correctamente.', 'success');
    } else {
      await suppliersService.create(payload);
      showSupplierMessage('Proveedor guardado correctamente.', 'success');
    }

    resetSupplierForm();
    await loadSuppliers();
  } catch (error) {
    console.error(error);
    showSupplierMessage(error?.message || 'No se pudo guardar el proveedor.', 'error');
  }
}

function fillSupplierForm(supplier) {
  document.getElementById('supplierName').value = supplier.name || '';
  document.getElementById('supplierTaxId').value = supplier.nit || '';
  document.getElementById('supplierContactPerson').value = supplier.contact_person || '';
  document.getElementById('supplierEmail').value = supplier.email || '';
  document.getElementById('supplierPhone').value = supplier.phone || '';
  document.getElementById('supplierAddress').value = supplier.address || '';
  document.getElementById('supplierCity').value = supplier.city || '';
  document.getElementById('supplierNotes').value = supplier.notes || '';

  supplierEditId.value = supplier.id;
  submitSupplierButton.textContent = 'Actualizar proveedor';
  cancelSupplierEdit.hidden = false;
  document.getElementById('supplierName').focus();
}

async function handleSupplierTableClick(event) {
  const button = event.target.closest('[data-action]');

  if (!button) {
    return;
  }

  const { action, id } = button.dataset;

  if (!id || !suppliersService) {
    return;
  }

  if (action === 'edit') {
    try {
      const supplier = await suppliersService.getById(id);
      fillSupplierForm(supplier);
      showSupplierMessage('Editando proveedor seleccionado.', 'info');
    } catch (error) {
      console.error(error);
      showSupplierMessage('No se pudo cargar la información del proveedor.', 'error');
    }
    return;
  }

  if (action === 'delete') {
    const shouldDelete = window.confirm('¿Deseas eliminar este proveedor?');

    if (!shouldDelete) {
      return;
    }

    try {
      await suppliersService.softDelete(id);
      showSupplierMessage('Proveedor eliminado correctamente.', 'success');
      resetSupplierForm();
      await loadSuppliers();
    } catch (error) {
      console.error(error);
      showSupplierMessage(error?.message || 'No se pudo eliminar el proveedor.', 'error');
    }
  }
}

supplierForm.addEventListener('submit', handleSupplierSubmit);
supplierTableBody.addEventListener('click', handleSupplierTableClick);
cancelSupplierEdit.addEventListener('click', resetSupplierForm);

loadSuppliers();
