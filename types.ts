export type Role = 'Admin' | 'Vendedor';

export type View = 'login' | 'sales' | 'reports' | 'users' | 'whatsapp' | 'paymentMethods' | 'products' | 'brands' | 'models';

export interface User {
  id: number;
  email: string;
  fullName: string;
  role: Role;
}

export interface Product {
  id: number;
  type: 'individual' | 'generic'; // Nuevo campo para diferenciar
  name: string; // Para genéricos: "Cargador USB", para individuales: "Samsung Galaxy S23"
  description: string; // Para genéricos: "Cargador rápido de 20W", para individuales: "Color negro, 128GB"
  price: number;
  stock: number; // Para individuales, siempre 1. Para genéricos, el stock real.

  // Campos específicos para productos individuales (teléfonos) - Opcionales para genéricos
  brand?: string;
  model?: string;
  
  imei1?: string;
  imei2?: string;
  serialNumber?: string;
  status?: 'Registrado' | 'No registrado'; // Estado del teléfono
}

export interface Customer {
  id: number;
  fullName: string;
  address: string;
  dni: string;
  phone: string;
}

export interface Sale {
  id: string;
  date: string;
  sellerId: number;
  customerId: number;
  total: number;
  // New fields
  customer?: Customer; // Make it optional for now, will be populated by getSalesData
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
    imei1?: string;
    imei2?: string;
    serialNumber?: string;
    status?: string;
  }>;
  payments?: Array<{
    paymentMethod: PaymentMethod;
    amount: number;
  }>;
}

export interface SaleDetail {
  saleId: string;
  productId: number;
  quantity: number;
  salePrice: number;
}

export type PaymentMethod = string;

export interface PaymentMethodAdmin {
  id: number;
  name: string;
}

export interface PaymentDetail {
  saleId: string;
  paymentMethod: PaymentMethod;
  amount: number;
}

export interface Brand {
  id: number;
  name: string;
}

export interface Model {
  id: number;
  brandId: number; // Relaciona el modelo con una marca
  name: string;
}

export interface CartItem {
  tempId: number;
  productId: string;
  name: string;
  quantity: number;
  price: number;
  stock: number;
  imei1?: string;
  imei2?: string;
  serialNumber?: string;
}

export interface ReportData {
  totalSales: number;
  salesByProduct: { [key: string]: number };
  salesBySeller: { [key: string]: number };
  salesByPaymentMethod: { [key: string]: number };
}