(function () {
  const DEFAULT_TABLE = 'suppliers';
  const DEFAULT_SELECT = '*';

  const DEFAULT_URL = 'https://poghdicqjjrtxucuoqev.supabase.co';
  const DEFAULT_KEY = 'sb_publishable_-jDBMc58Msbi22Rys16pAQ_T3Q2CJ8I';

  function resolveSupabaseClient() {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      const url = window.SUPABASE_URL || DEFAULT_URL;
      const key = window.SUPABASE_KEY || DEFAULT_KEY;
      return window.supabase.createClient(url, key);
    }

    if (typeof supabaseClient !== 'undefined' && supabaseClient && typeof supabaseClient.from === 'function') {
      return supabaseClient;
    }

    if (window.supabaseClient && typeof window.supabaseClient.from === 'function') {
      return window.supabaseClient;
    }

    return null;
  }

  class SupplierModule {
    constructor(options = {}) {
      this.client = options.client || resolveSupabaseClient();
      this.table = options.table || DEFAULT_TABLE;
      this.select = options.select || DEFAULT_SELECT;

      if (!this.client) {
        throw new Error('No se pudo inicializar el cliente de Supabase para suppliers.');
      }
    }

    normalizePayload(payload = {}) {
      if (!payload || typeof payload !== 'object') {
        throw new Error('Los datos del proveedor deben enviarse como un objeto válido.');
      }

      const aliasMap = {
        id: 'id',
        nit: 'nit',
        tax_id: 'nit',
        name: 'name',
        contactPerson: 'contact_person',
        isActive: 'is_active'
      };

      const normalized = {};
      const allowedFields = [
        'name',
        'nit',
        'contact_person',
        'email',
        'phone',
        'address',
        'city',
        'notes',
        'is_active',
        'created_by',
        'created_at',
        'updated_at'
      ];

      Object.entries(payload).forEach(([key, rawValue]) => {
        const fieldName = aliasMap[key] || key;

        if (!allowedFields.includes(fieldName)) {
          return;
        }

        let value = rawValue;

        if (typeof value === 'string') {
          value = value.trim();
        }

        if (fieldName === 'email' && value) {
          value = value.toLowerCase();
        }

        if (fieldName === 'is_active') {
          normalized[fieldName] = Boolean(value);
          return;
        }

        normalized[fieldName] = value;
      });

      if (normalized.name === undefined || normalized.name === '') {
        throw new Error('El nombre del proveedor es obligatorio.');
      }

      if (normalized.is_active === undefined) {
        normalized.is_active = true;
      }

      return normalized;
    }

    async getCurrentUser() {
      if (!this.client || !this.client.auth) {
        return null;
      }

      try {
        const { data, error } = await this.client.auth.getUser();

        if (error || !data || !data.user) {
          return null;
        }

        return data.user;
      } catch (error) {
        console.warn('No se pudo obtener el usuario autenticado:', error);
        return null;
      }
    }

    async list(options = {}) {
      const {
        filters = {},
        search = '',
        orderBy = null,
        ascending = false,
        limit = null
      } = options;

      let query = this.client.from(this.table).select(this.select);

      Object.entries(filters).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') {
          return;
        }

        query = query.eq(key, value);
      });

      const cleanedSearch = search.trim();

      if (cleanedSearch) {
        const searchTerm = cleanedSearch.replace(/'/g, "''");
        query = query.or(
          `name.ilike.%${searchTerm}%,nit.ilike.%${searchTerm}%,contact_person.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`
        );
      }

      if (orderBy) {
        query = query.order(orderBy, { ascending });
      }

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data || [];
    }

    async getAll(options = {}) {
      return this.list(options);
    }

    async getById(id) {
      if (!id) {
        throw new Error('Debe indicar el identificador del proveedor.');
      }

      const { data, error } = await this.client
        .from(this.table)
        .select(this.select)
        .eq('id', id)
        .single();

      if (error) {
        throw error;
      }

      return data;
    }

    async getByTaxId(nit) {
      if (!nit) {
        throw new Error('Debe indicar el NIT/RUC del proveedor.');
      }

      const { data, error } = await this.client
        .from(this.table)
        .select(this.select)
        .eq('nit', nit)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data;
    }

    async create(payload) {
      const preparedPayload = this.normalizePayload(payload);
      const currentUser = await this.getCurrentUser();

      if (currentUser && !preparedPayload.created_by) {
        preparedPayload.created_by = currentUser.id;
      }

      const { data, error } = await this.client
        .from(this.table)
        .insert(preparedPayload)
        .select(this.select)
        .single();

      if (error) {
        throw error;
      }

      return data;
    }

    async update(id, payload) {
      if (!id) {
        throw new Error('Debe indicar el identificador del proveedor.');
      }

      const preparedPayload = this.normalizePayload(payload);

      const { data, error } = await this.client
        .from(this.table)
        .update(preparedPayload)
        .eq('id', id)
        .select(this.select)
        .single();

      if (error) {
        throw error;
      }

      return data;
    }

    async softDelete(id) {
      return this.update(id, { is_active: false });
    }

    async activate(id) {
      return this.update(id, { is_active: true });
    }

    async remove(id) {
      if (!id) {
        throw new Error('Debe indicar el identificador del proveedor.');
      }

      const { error } = await this.client
        .from(this.table)
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }

      return true;
    }

    async count(options = {}) {
      const {
        filters = {},
        search = ''
      } = options;

      let query = this.client.from(this.table).select('*', { count: 'exact', head: true });

      Object.entries(filters).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') {
          return;
        }

        query = query.eq(key, value);
      });

      const cleanedSearch = search.trim();

      if (cleanedSearch) {
        const searchTerm = cleanedSearch.replace(/'/g, "''");
        query = query.or(
          `name.ilike.%${searchTerm}%,nit.ilike.%${searchTerm}%,contact_person.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`
        );
      }

      const { count, error } = await query;

      if (error) {
        throw error;
      }

      return count || 0;
    }
  }

  const client = resolveSupabaseClient();

  window.SupplierModule = SupplierModule;
  window.SupplierService = new SupplierModule({ client });
  window.suppliers = window.SupplierService;

  window.KingdomNexus = window.KingdomNexus || {};
  window.KingdomNexus.suppliers = window.SupplierService;
})();
