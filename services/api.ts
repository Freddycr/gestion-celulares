
import { User, Product, Customer, Sale, SaleDetail, PaymentDetail, Role, PaymentMethod, PaymentMethodAdmin } from '../types';
import { GOOGLE_API_KEY, GOOGLE_CLIENT_ID, SPREADSHEET_ID } from '../config';

declare global {
  var gapi: any;
  var google: any;
}

let tokenClient: any;

const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile';

let gapiReady = false;

export class AccessDeniedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AccessDeniedError';
    }
}

export class InvalidRequestError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InvalidRequestError';
    }
}

export async function initializeGapiClient(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        gapi.load('client', {
            callback: () => {
                gapiReady = true;
                resolve();
            },
            onerror: (err: any) => {
                console.error('Error loading GAPI client library', err);
                reject(new Error("No se pudo cargar la biblioteca cliente de Google. Verifica la conexión de red."));
            },
            timeout: 7000,
            ontimeout: () => {
                reject(new Error("Tiempo de espera agotado al cargar la biblioteca de Google. La red puede ser lenta."));
            }
        });
    });

    try {
        const initPromise = gapi.client.init({
            apiKey: GOOGLE_API_KEY,
            discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4', 'https://people.googleapis.com/$discovery/rest?version=v1'],
        });

        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('La inicialización de la API de Google tardó demasiado.')), 10000)
        );
        
        await Promise.race([initPromise, timeoutPromise]);

    } catch (err: any) {
        console.error("gapi.client.init error:", err);
        const newError: any = new Error('GAPI_INIT_FAILED');
        const errorDetails: { message?: string, code?: number | string, details?: any } = {};

        if (err && err.result && err.result.error) {
            const gapiError = err.result.error;
            errorDetails.message = gapiError.message;
            errorDetails.code = gapiError.code;
            errorDetails.details = gapiError.errors || gapiError.details;
        } else if (err && err.error) {
             errorDetails.message = typeof err.error === 'string' ? err.error : JSON.stringify(err.error);
             if(err.details) errorDetails.details = err.details;
        } else if (err instanceof Error) {
            errorDetails.message = err.message;
            errorDetails.details = err.stack;
        } else if (typeof err === 'object' && err !== null) {
            errorDetails.message = (err as any).message || 'El objeto de error no contenía un mensaje.';
            errorDetails.details = err; 
        } else {
            errorDetails.message = String(err);
        }

        newError.originalError = errorDetails;
        throw newError;
    }
    
    if (typeof window.google === 'undefined' || typeof window.google.accounts === 'undefined') {
        throw new Error("La biblioteca de Google Identity Services (GIS) no se cargó correctamente.");
    }

    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: () => {},
    });
}

export function requestAccessToken(): Promise<any> {
    return new Promise((resolve, reject) => {
        if (!tokenClient) {
            return reject(new Error('El cliente de autenticación de Google no está inicializado.'));
        }
        tokenClient.callback = (resp: any) => {
            if (resp.error) {
                console.error('Google Auth Error:', resp);
                if (resp.error === 'access_denied' || resp.error === 'popup_closed_by_user') {
                    return reject(new AccessDeniedError("El usuario denegó el acceso o cerró la ventana de permisos."));
                }
                if (resp.error === 'invalid_request') {
                    return reject(new InvalidRequestError(`Error de solicitud inválida. Esto suele ocurrir si el "URI de redireccionamiento autorizado" no está configurado en Google Cloud. Detalles: ${resp.error_description || resp.error}`));
                }
                return reject(new Error(`Error de autorización: ${resp.error_description || resp.error}.`));
            }
            gapi.client.setToken(resp);
            resolve(resp);
        };
        
        const token = gapi.client.getToken();
        if (token && token.access_token) {
            resolve(token);
        } else {
            tokenClient.requestAccessToken({ prompt: 'consent' });
        }
    });
}

export const getGoogleUserProfile = async (): Promise<{ email: string; name: string; }> => {
    try {
        const response = await gapi.client.people.people.get({
            resourceName: 'people/me',
            personFields: 'names,emailAddresses',
        });
        const profile = response.result;
        const email = profile.emailAddresses?.find((e: any) => e.metadata?.primary)?.value;
        const name = profile.names?.find((n: any) => n.metadata?.primary)?.displayName;
        if (!email || !name) {
            throw new Error('No se pudo obtener el email o nombre primario del perfil de Google.');
        }
        return { email, name };
    } catch (err) {
        console.error("Error fetching Google user profile", err);
        throw new Error("No se pudo obtener la información del perfil de Google.");
    }
};


export const gapiSignOut = () => {
    if(gapi && gapi.client) {
        const token = gapi.client.getToken();
        if (token !== null) {
            google.accounts.oauth2.revoke(token.access_token, () => {});
            gapi.client.setToken('');
        }
    }
    if (window.google && window.google.accounts && window.google.accounts.id) {
       google.accounts.id.disableAutoSelect();
    }
};

const SPREADSHEET_RANGES = {
    users: 'Usuarios!A2:D',
    products: 'Productos!A2:L', // Actualizado para incluir los nuevos campos (details eliminado)
    customers: 'Clientes!A2:E',
    sales: 'Ventas!A2:E',
    saleDetails: 'Detalle_Venta!A2:D',
    paymentDetails: 'Detalle_Venta_Metodo_Pago!A2:C',
    paymentMethods: 'Metodos_Pago!A2:B',
    brands: 'Marcas!A2:B',
    models: 'Modelos!A2:C',
};

const rowToUser = (row: any[]): User => ({ id: parseInt(row[0]), email: row[1], role: row[2] as Role, fullName: row[3] || '' });
const rowToProduct = (row: any[]): Product => ({
  id: parseInt(row[0]),
  type: row[1] as 'individual' | 'generic',
  name: row[2],
  description: row[3],
  price: parseFloat(row[4]),
  stock: parseInt(row[5]),
  brand: row[6] || undefined,
  model: row[7] || undefined,
  imei1: row[8] || undefined,
  imei2: row[9] || undefined,
  serialNumber: row[10] || undefined,
  status: row[11] as 'Registrado' | 'No registrado' || 'No registrado',
});
const rowToCustomer = (row: any[]): Customer => ({ id: parseInt(row[0]), fullName: row[1], address: row[2], dni: row[3], phone: row[4] });
const rowToPaymentMethod = (row: any[]): PaymentMethodAdmin => ({ id: parseInt(row[0]), name: row[1] });
const rowToBrand = (row: any[]): Brand => ({ id: parseInt(row[0]), name: row[1] });
const rowToModel = (row: any[]): Model => ({ id: parseInt(row[0]), brandId: parseInt(row[1]), name: row[2] });

export const getUserByEmail = async (email: string): Promise<User | null> => {
  try {
    const response = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: SPREADSHEET_RANGES.users,
    });
    const users = response.result.values?.map(rowToUser) || [];
    return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  } catch(err) {
    console.error("Error fetching user by email", err);
    throw err;
  }
};

export const getUsers = async (): Promise<User[]> => {
  const response = await gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Usuarios!A2:D' });
  return response.result.values?.map((row: any[]) => ({ id: parseInt(row[0]), email: row[1], fullName: row[3], role: row[2] as Role })) || [];
};

export const saveUser = async (user: Omit<User, 'id'>): Promise<User> => {
  const newId = Date.now();
  const newRow = [newId, user.email, user.role, user.fullName];
  await gapi.client.sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Usuarios!A:D',
    valueInputOption: 'USER_ENTERED',
    resource: { values: [newRow] },
  });
  return { ...user, id: newId };
};

export const getProducts = async (): Promise<Product[]> => {
    const res = await gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: SPREADSHEET_RANGES.products });
    return res.result.values?.filter(row => row.length >= 5).map(rowToProduct) || [];
};

export const saveProduct = async (product: Omit<Product, 'id'>): Promise<Product> => {
  const newId = Date.now();
  const newRow = [
    newId,
    product.type,
    product.name,
    product.description,
    product.price,
    product.stock,
    product.brand || '',
    product.model || '',
    product.imei1 || '',
    product.imei2 || '',
    product.serialNumber || '',
    product.status || 'No registrado',
  ];
  await gapi.client.sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Productos!A:L',
    valueInputOption: 'USER_ENTERED',
    resource: { values: [newRow] },
  });
  return { ...product, id: newId };
};

export const getCustomers = async (): Promise<Customer[]> => {
    const res = await gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: SPREADSHEET_RANGES.customers });
    return res.result.values?.filter(row => row.length >= 5).map(rowToCustomer) || [];
};

export const saveCustomer = async (customer: Omit<Customer, 'id'>): Promise<Customer> => {
    const newId = Date.now();
    const newRow = [newId, customer.fullName, customer.address, customer.dni, customer.phone];
    await gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Clientes!A:E',
        valueInputOption: 'USER_ENTERED',
        resource: { values: [newRow] }
    });
    return { ...customer, id: newId };
};

export const getPaymentMethods = async (): Promise<PaymentMethodAdmin[]> => {
    try {
        const res = await gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: SPREADSHEET_RANGES.paymentMethods });
        return res.result.values?.filter(row => row.length >= 2).map(rowToPaymentMethod) || [];
    } catch (err) {
        console.error("Error fetching payment methods", err);
        // Return a default list if the sheet doesn't exist or there's an error
        return [{id: 1, name: 'Efectivo'}, {id: 2, name: 'Tarjeta de Crédito'}, {id: 3, name: 'Transferencia'}];
    }
};

export const savePaymentMethod = async (paymentMethod: Omit<PaymentMethodAdmin, 'id'>): Promise<PaymentMethodAdmin> => {
  const newId = Date.now();
  const newRow = [newId, paymentMethod.name];
  await gapi.client.sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Metodos_Pago!A:B',
    valueInputOption: 'USER_ENTERED',
    resource: { values: [newRow] },
  });
  return { ...paymentMethod, id: newId };
};

export const getBrands = async (): Promise<Brand[]> => {
    const res = await gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: SPREADSHEET_RANGES.brands });
    return res.result.values?.filter(row => row.length >= 2).map(rowToBrand) || [];
};

export const saveBrand = async (brand: Omit<Brand, 'id'>): Promise<Brand> => {
  const newId = Date.now();
  const newRow = [newId, brand.name];
  await gapi.client.sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Marcas!A:B',
    valueInputOption: 'USER_ENTERED',
    resource: { values: [newRow] },
  });
  return { ...brand, id: newId };
};

export const getModels = async (): Promise<Model[]> => {
    const res = await gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: SPREADSHEET_RANGES.models });
    return res.result.values?.filter(row => row.length >= 3).map(rowToModel) || [];
};

export const saveModel = async (model: Omit<Model, 'id'>): Promise<Model> => {
  const newId = Date.now();
  const newRow = [newId, model.brandId, model.name];
  await gapi.client.sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Modelos!A:C',
    valueInputOption: 'USER_ENTERED',
    resource: { values: [newRow] },
  });
  return { ...model, id: newId };
};

interface SalePayload {
  sellerId: number;
  customerId: number;
  total: number;
  items: { productId: number; quantity: number; salePrice: number; imei1?: string; imei2?: string; serialNumber?: string }[];
  payments: { paymentMethod: PaymentMethod; amount: number }[];
}

export const saveSale = async (payload: SalePayload): Promise<{ saleId: string }> => {
  const saleId = `SALE-${Date.now()}`;
  
  const saleRow = [saleId, new Date().toISOString(), payload.sellerId, payload.customerId, payload.total];
  await gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Ventas!A:E',
      valueInputOption: 'USER_ENTERED',
      resource: { values: [saleRow] }
  });

  const detailRows = payload.items.map(item => [
    saleId, 
    item.productId, 
    item.quantity, 
    item.salePrice,
    item.imei1 || '',
    item.imei2 || '',
    item.serialNumber || ''
  ]);
  await gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Detalle_Venta!A:G',
      valueInputOption: 'USER_ENTERED',
      resource: { values: detailRows }
  });

  const paymentRows = payload.payments.map(p => [saleId, p.paymentMethod, p.amount]);
   await gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Detalle_Venta_Metodo_Pago!A:C',
      valueInputOption: 'USER_ENTERED',
      resource: { values: paymentRows }
  });

  const productsResponse = await gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: SPREADSHEET_RANGES.products });
  const allProducts = productsResponse.result.values?.map(rowToProduct) || [];
  
  const updateRequests = [];
  for (const item of payload.items) {
      const productIndex = allProducts.findIndex(p => p.id === item.productId);
      if (productIndex !== -1) {
          const product = allProducts[productIndex];
          const newStock = product.stock - item.quantity;
          const rowIndex = productIndex + 2;
          updateRequests.push({
              range: `Productos!F${rowIndex}`, // Corregido a columna F para stock
              values: [[newStock]]
          });
      }
  }

  if (updateRequests.length > 0) {
      await gapi.client.sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          resource: {
              valueInputOption: 'USER_ENTERED',
              data: updateRequests
          }
      });
  }

  return { saleId };
};

export const getSalesData = async (): Promise<{ sales: Sale[], details: SaleDetail[], payments: PaymentDetail[] }> => {
    const [salesRes, detailsRes, paymentsRes, productsRes, customersRes] = await Promise.all([
        gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: SPREADSHEET_RANGES.sales }),
        gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: SPREADSHEET_RANGES.saleDetails }),
        gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: SPREADSHEET_RANGES.paymentDetails }),
        gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: SPREADSHEET_RANGES.products }), // Fetch products
        gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: SPREADSHEET_RANGES.customers }) // Fetch customers
    ]);

    const allProducts = productsRes.result.values?.map(rowToProduct) || [];
    const allCustomers = customersRes.result.values?.map(rowToCustomer) || [];

    const sales = salesRes.result.values?.filter(r => r.length >= 5).map((r: any) => ({
        id: r[0],
        date: r[1],
        sellerId: parseInt(r[2]),
        customerId: parseInt(r[3]),
        total: parseFloat(r[4])
    })) || [];

    const details = detailsRes.result.values?.filter(r => r.length >= 4).map((r: any) => ({
        saleId: r[0],
        productId: parseInt(r[1]),
        quantity: parseInt(r[2]),
        salePrice: parseFloat(r[3]),
        imei1: r[4] || undefined, // Assuming IMEI1 is at index 4
        imei2: r[5] || undefined, // Assuming IMEI2 is at index 5
        serialNumber: r[6] || undefined // Assuming SerialNumber is at index 6
    })) || [];

    const payments = paymentsRes.result.values?.filter(r => r.length >= 3).map((r: any) => ({
        saleId: r[0],
        paymentMethod: r[1],
        amount: parseFloat(r[2])
    })) || [];

    // Now, enrich the sales data with customer and product details
    const enrichedSales = sales.map(sale => {
        const customer = allCustomers.find(c => c.id === sale.customerId);
        const saleItems = details
            .filter(detail => detail.saleId === sale.id)
            .map(detail => {
                const product = allProducts.find(p => p.id === detail.productId);
                return {
                    ...detail,
                    name: product?.name || 'Producto Desconocido',
                    description: product?.description || '',
                    brand: product?.brand || '',
                    model: product?.model || '',
                    status: product?.status || 'N/A'
                };
            });
        const salePayments = payments.filter(payment => payment.saleId === sale.id);

        return {
            ...sale,
            customer: customer || { id: sale.customerId, fullName: 'Cliente Desconocido', address: '', dni: '', phone: '' },
            items: saleItems,
            payments: salePayments
        };
    });

    return {
        sales: enrichedSales, // Return enriched sales
        details: details,
        payments: payments
    };
};
