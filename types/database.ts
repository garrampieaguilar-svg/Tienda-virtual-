/**
 * Tipos de la base de datos (reflejan supabase/migrations).
 *
 * Están escritos a mano con el mismo formato que genera Supabase. Si cambiás
 * las tablas, actualizalos o regeneralos con:
 *   npx supabase gen types typescript --project-id <id> > types/database.ts
 */

export type UserRole = "customer" | "employee" | "admin";
export type SaleUnit = "unidad" | "kilo" | "litro" | "pack";
export type ContentUnit = "g" | "kg" | "ml" | "l" | "un";
export type DeliveryMode = "pickup" | "delivery";
export type PaymentMethod = "transfer" | "cash";
export type ShippingMode = "fixed" | "zones";
export type OrderStatus =
  | "new"
  | "preparing"
  | "ready_for_pickup"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

/** Arma los tipos Insert/Update a partir de la fila: `O` son las columnas opcionales al insertar. */
type Tabla<Row, O extends keyof Row = never, Generadas extends keyof Row = never> = {
  Row: Row;
  Insert: Omit<Row, O | Generadas> & Partial<Pick<Row, Exclude<O, Generadas>>>;
  Update: Partial<Omit<Row, Generadas>>;
  Relationships: [];
};

export type Profile = {
  id: string;
  role: UserRole;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  address_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Category = {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type Product = {
  id: string;
  sku: string | null;
  barcode: string | null;
  name: string;
  slug: string;
  brand: string | null;
  description: string | null;
  category_id: string | null;
  /** 0 = precio todavía sin cargar (se muestra, pero no se puede comprar). */
  price: number;
  previous_price: number | null;
  on_sale: boolean;
  sale_unit: SaleUnit;
  /** De a cuánto se suma en el carrito (1, o 0.25 / 0.5 para productos por kilo). */
  quantity_step: number;
  net_content: number | null;
  net_content_unit: ContentUnit | null;
  image_url: string | null;
  stock: number;
  active: boolean;
  /** Columna generada por la base para el buscador. No se escribe. */
  search_text: string;
  created_at: string;
  updated_at: string;
};

export type Settings = {
  id: number;
  store_name: string;
  store_address: string | null;
  whatsapp_phone: string | null;
  opening_hours: string | null;
  logo_url: string | null;
  bank_alias: string | null;
  bank_cbu: string | null;
  bank_holder: string | null;
  min_order_amount: number;
  pickup_enabled: boolean;
  delivery_enabled: boolean;
  shipping_mode: ShippingMode;
  shipping_fixed_cost: number;
  free_shipping_from: number | null;
  track_stock: boolean;
  updated_at: string;
};

export type DeliveryZone = {
  id: string;
  name: string;
  cost: number;
  sort_order: number;
  active: boolean;
  created_at: string;
};

export type TimeSlot = {
  id: string;
  /** null = sirve para retiro y para envío. */
  delivery_mode: DeliveryMode | null;
  /** 0 = domingo … 6 = sábado. */
  weekdays: number[];
  start_time: string;
  end_time: string;
  sort_order: number;
  active: boolean;
  created_at: string;
};

export type Order = {
  id: string;
  order_number: number;
  user_id: string | null;
  status: OrderStatus;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  delivery_mode: DeliveryMode;
  address: string | null;
  address_notes: string | null;
  delivery_zone_id: string | null;
  delivery_zone_name: string | null;
  delivery_date: string | null;
  time_slot_id: string | null;
  time_slot_label: string | null;
  payment_method: PaymentMethod;
  cash_amount: number | null;
  receipt_path: string | null;
  comments: string | null;
  subtotal: number;
  shipping_cost: number;
  total: number;
  created_at: string;
  updated_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  product_brand: string | null;
  sku: string | null;
  barcode: string | null;
  sale_unit: SaleUnit;
  unit_price: number;
  quantity: number;
  line_total: number;
};

/** Lo que devuelve get_order(): el pedido (sin user_id) con sus productos. */
export type OrderWithItems = Omit<Order, "user_id"> & {
  items: Omit<OrderItem, "order_id">[];
};

/** Datos del formulario de checkout que recibe create_order(). */
export type CreateOrderInput = {
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  delivery_mode: DeliveryMode;
  address?: string | null;
  address_notes?: string | null;
  delivery_zone_id?: string | null;
  delivery_date?: string | null;
  time_slot_id?: string | null;
  payment_method: PaymentMethod;
  cash_amount?: number | null;
  comments?: string | null;
};

export type CreateOrderItem = { product_id: string; quantity: number };

/** Lo que devuelve admin_users(): perfil + email (solo para el administrador). */
export type AdminUser = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  created_at: string;
  last_sign_in_at: string | null;
};

/** Una fila del archivo de importación, ya normalizada. Solo viajan las columnas que trae el archivo. */
export type ImportRow = {
  row: number;
  sku?: string;
  barcode?: string;
  name?: string;
  brand?: string;
  description?: string;
  category?: string;
  subcategory?: string;
  price?: number;
  previous_price?: number | null;
  on_sale?: boolean;
  stock?: number;
  sale_unit?: SaleUnit;
  quantity_step?: number;
  net_content?: number | null;
  net_content_unit?: ContentUnit | null;
  active?: boolean;
};

export type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; error: string }[];
};

export type Database = {
  public: {
    Tables: {
      profiles: Tabla<
        Profile,
        "role" | "full_name" | "phone" | "address" | "address_notes" | "created_at" | "updated_at"
      >;
      categories: Tabla<
        Category,
        "id" | "parent_id" | "slug" | "sort_order" | "active" | "created_at" | "updated_at"
      >;
      products: Tabla<
        Product,
        | "id"
        | "sku"
        | "barcode"
        | "slug"
        | "brand"
        | "description"
        | "category_id"
        | "price"
        | "previous_price"
        | "on_sale"
        | "sale_unit"
        | "quantity_step"
        | "net_content"
        | "net_content_unit"
        | "image_url"
        | "stock"
        | "active"
        | "created_at"
        | "updated_at",
        "search_text"
      >;
      settings: Tabla<Settings, keyof Settings>;
      delivery_zones: Tabla<DeliveryZone, "id" | "cost" | "sort_order" | "active" | "created_at">;
      time_slots: Tabla<
        TimeSlot,
        "id" | "delivery_mode" | "weekdays" | "sort_order" | "active" | "created_at"
      >;
      orders: Tabla<Order, keyof Order>;
      order_items: Tabla<OrderItem, "id">;
    };
    Views: Record<string, never>;
    Functions: {
      search_products: {
        Args: { p_query: string; p_limit?: number; p_offset?: number };
        Returns: Product[];
      };
      create_order: {
        Args: { p_order: CreateOrderInput; p_items: CreateOrderItem[] };
        Returns: { id: string; order_number: number };
      };
      get_order: {
        Args: { p_id: string };
        Returns: OrderWithItems | null;
      };
      is_staff: { Args: Record<string, never>; Returns: boolean };
      admin_users: { Args: Record<string, never>; Returns: AdminUser[] };
      set_order_status: { Args: { p_order_id: string; p_status: OrderStatus }; Returns: undefined };
      import_products: { Args: { p_rows: ImportRow[]; p_create?: boolean }; Returns: ImportResult };
      is_admin: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: {
      user_role: UserRole;
      sale_unit: SaleUnit;
      content_unit: ContentUnit;
      delivery_mode: DeliveryMode;
      payment_method: PaymentMethod;
      shipping_mode: ShippingMode;
      order_status: OrderStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
